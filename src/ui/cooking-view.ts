import { ItemView, Scope, TFile, WorkspaceLeaf } from "obsidian";
import type RecipeModePlugin from "../main";
import type { Recipe } from "../types";
import { findInlineQuantities } from "../core/parse-ingredient";
import { parseRecipe } from "../core/parse-recipe";
import { formatIngredient, formatQuantity, scaleQuantity, servingsFactor, type FormatOptions } from "../core/scale";
import { formatDurationLong } from "../core/duration";
import { splitHeadings } from "../settings";
import { ServingControl } from "./serving-control";

export const COOKING_VIEW_TYPE = "recipe-cooking-view";

interface CookingViewState {
  filePath?: string;
}

export class CookingView extends ItemView {
  private file: TFile | null = null;
  private recipe: Recipe | null = null;
  private targetServings = 0;
  private unitSystem: "original" | "metric" | "imperial";
  private checkedIngredients = new Set<string>();
  private checkedSteps = new Set<number>();
  private servingControl: ServingControl | null = null;
  private wakeLock: { release(): Promise<void> } | null = null;
  /** Sidebar expansion state to restore on close (null = nothing to restore). */
  private sidebarsToRestore: { left: boolean; right: boolean } | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: RecipeModePlugin,
  ) {
    super(leaf);
    this.unitSystem = plugin.settings.unitSystem;
    // Cmd+E in cooking mode returns to editing, mirroring the reading-view toggle.
    this.scope = new Scope(this.app.scope);
    this.scope.register(["Mod"], "e", (evt) => {
      evt.preventDefault();
      void this.openInEditor();
      return false;
    });
  }

  async openInEditor(): Promise<void> {
    if (!this.file) return;
    await this.leaf.setViewState({
      type: "markdown",
      active: true,
      state: { file: this.file.path, mode: "source" },
    });
  }

  getViewType(): string {
    return COOKING_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.recipe?.title ?? "Cooking mode";
  }

  getIcon(): string {
    return "chef-hat";
  }

  async onOpen(): Promise<void> {
    // Re-render when the underlying note changes.
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.path === this.file?.path) void this.loadFile(file);
      }),
    );
    this.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") void this.acquireWakeLock();
    });
    await this.acquireWakeLock();
    this.hideSidebars();
  }

  async onClose(): Promise<void> {
    await this.releaseWakeLock();
    this.restoreSidebars();
  }

  private hideSidebars(): void {
    if (!this.plugin.settings.hideSidebars) return;
    const ws = this.app.workspace;
    this.sidebarsToRestore = {
      left: !ws.leftSplit.collapsed,
      right: !ws.rightSplit.collapsed,
    };
    ws.leftSplit.collapse();
    ws.rightSplit.collapse();
  }

  private restoreSidebars(): void {
    if (!this.sidebarsToRestore) return;
    const ws = this.app.workspace;
    if (this.sidebarsToRestore.left) ws.leftSplit.expand();
    if (this.sidebarsToRestore.right) ws.rightSplit.expand();
    this.sidebarsToRestore = null;
  }

  getState(): Record<string, unknown> {
    return { filePath: this.file?.path };
  }

  async setState(state: CookingViewState, result: unknown): Promise<void> {
    if (state?.filePath) {
      const file = this.app.vault.getFileByPath(state.filePath);
      if (file) await this.loadFile(file, true);
    }
    return super.setState(state, result as never);
  }

  async loadFile(file: TFile, reset = false): Promise<void> {
    this.file = file;
    const content = await this.app.vault.cachedRead(file);
    const cache = this.app.metadataCache.getFileCache(file);
    this.recipe = parseRecipe(content, {
      fallbackTitle: file.basename,
      ingredientHeadings: splitHeadings(this.plugin.settings.ingredientHeadings),
      stepHeadings: splitHeadings(this.plugin.settings.stepHeadings),
      frontmatter: cache?.frontmatter,
    });
    if (reset || this.targetServings <= 0) {
      this.targetServings = this.recipe.servings ?? 1;
      this.checkedIngredients.clear();
      this.checkedSteps.clear();
    }
    this.render();
    // update tab title
    this.leaf.setEphemeralState({});
    (this.leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
  }

  private async acquireWakeLock(): Promise<void> {
    if (!this.plugin.settings.wakeLock) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
    };
    if (!nav.wakeLock) return;
    try {
      this.wakeLock = await nav.wakeLock.request("screen");
    } catch {
      // Not fatal: browser may refuse (battery saver, hidden tab).
      this.wakeLock = null;
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      /* already released */
    }
    this.wakeLock = null;
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("recipe-cooking-view");

    if (!this.recipe) {
      root.createEl("p", { text: "Open a recipe note, then run “Open recipe in cooking mode”." });
      return;
    }
    const recipe = this.recipe;

    // --- header ---
    const header = root.createDiv({ cls: "recipe-header" });
    header.createEl("h1", { text: recipe.title, cls: "recipe-title" });

    const chips = header.createDiv({ cls: "recipe-chips" });
    const chip = (label: string, value: string) => {
      const c = chips.createDiv({ cls: "recipe-chip" });
      c.createSpan({ cls: "recipe-chip-label", text: label });
      c.createSpan({ cls: "recipe-chip-value", text: value });
    };
    if (recipe.prepTime !== undefined) chip("Prep", formatDurationLong(recipe.prepTime));
    if (recipe.cookTime !== undefined) chip("Cook", formatDurationLong(recipe.cookTime));
    if (recipe.totalTime !== undefined && recipe.prepTime !== undefined && recipe.cookTime !== undefined)
      chip("Total", formatDurationLong(recipe.totalTime));
    if (recipe.course) chip("Course", recipe.course);
    if (recipe.cuisine) chip("Cuisine", recipe.cuisine);
    if (recipe.rating !== undefined) chip("Rating", "★".repeat(Math.round(recipe.rating)));

    // --- controls ---
    const controls = header.createDiv({ cls: "recipe-controls" });
    if (recipe.servings !== undefined) {
      const servingsWrap = controls.createDiv({ cls: "recipe-servings" });
      servingsWrap.createSpan({ text: "Servings:", cls: "recipe-servings-label" });
      this.servingControl = new ServingControl(servingsWrap, this.targetServings, (v) => {
        this.targetServings = v;
        this.renderIngredients();
        this.renderSteps();
      });
    }
    const unitBtn = controls.createEl("button", { cls: "recipe-unit-toggle" });
    const unitLabel = () =>
      this.unitSystem === "original" ? "Units: as written" : this.unitSystem === "metric" ? "Units: metric" : "Units: imperial";
    unitBtn.setText(unitLabel());
    unitBtn.addEventListener("click", () => {
      this.unitSystem =
        this.unitSystem === "original" ? "metric" : this.unitSystem === "metric" ? "imperial" : "original";
      unitBtn.setText(unitLabel());
      this.renderIngredients();
      this.renderSteps();
    });

    // --- body: ingredients | steps ---
    const body = root.createDiv({ cls: "recipe-body" });
    body.createDiv({ cls: "recipe-ingredients-pane" });
    body.createDiv({ cls: "recipe-steps-pane" });

    this.renderIngredients();
    this.renderSteps();

    if (recipe.source) {
      const src = root.createDiv({ cls: "recipe-source" });
      src.createEl("a", { text: recipe.source, href: recipe.source });
    }
  }

  /** Steps re-render when servings/units change: quantities inside step prose scale too. */
  private renderSteps(): void {
    const pane = this.contentEl.querySelector<HTMLElement>(".recipe-steps-pane");
    if (!pane || !this.recipe) return;
    pane.empty();
    const recipe = this.recipe;
    const factor = servingsFactor(recipe.servings, this.targetServings);
    const opts: FormatOptions = {
      locale: this.plugin.settings.locale,
      targetSystem: this.unitSystem === "original" ? undefined : this.unitSystem,
    };

    pane.createEl("h2", { text: "Steps" });
    const stepsList = pane.createEl("ol", { cls: "recipe-steps" });
    recipe.steps.forEach((step, i) => {
      const li = stepsList.createEl("li", { cls: "recipe-step" });
      if (this.checkedSteps.has(i)) li.addClass("is-done");
      this.renderStepText(li.createSpan(), step.text, factor, opts);
      li.addEventListener("click", () => {
        if (this.checkedSteps.has(i)) this.checkedSteps.delete(i);
        else this.checkedSteps.add(i);
        li.toggleClass("is-done", this.checkedSteps.has(i));
      });
    });
    if (recipe.steps.length === 0) pane.createEl("p", { text: "No steps found.", cls: "recipe-empty" });
  }

  /** Render step prose, scaling and converting inline quantities ("2 tsp" → "1 tsp" at half servings). */
  private renderStepText(parent: HTMLElement, text: string, factor: number, opts: FormatOptions): void {
    let pos = 0;
    for (const iq of findInlineQuantities(text)) {
      parent.appendText(text.slice(pos, iq.start));
      parent.createSpan({ cls: "recipe-qty", text: formatQuantity(scaleQuantity(iq.quantity, factor), opts) });
      pos = iq.end;
    }
    parent.appendText(text.slice(pos));
  }

  /** Ingredients re-render alone when servings/units change; checkboxes keep state. */
  private renderIngredients(): void {
    const pane = this.contentEl.querySelector<HTMLElement>(".recipe-ingredients-pane");
    if (!pane || !this.recipe) return;
    pane.empty();
    const recipe = this.recipe;
    const factor = servingsFactor(recipe.servings, this.targetServings);
    const opts = {
      locale: this.plugin.settings.locale,
      targetSystem: this.unitSystem === "original" ? undefined : this.unitSystem,
    };

    pane.createEl("h2", { text: "Ingredients" });
    recipe.ingredients.forEach((group, gi) => {
      if (group.name) pane.createEl("h3", { text: group.name, cls: "recipe-group-name" });
      const list = pane.createEl("ul", { cls: "recipe-ingredients" });
      group.items.forEach((ing, ii) => {
        const key = `${gi}:${ii}`;
        const li = list.createEl("li", { cls: "recipe-ingredient" });
        if (this.checkedIngredients.has(key)) li.addClass("is-done");
        li.createSpan({ text: formatIngredient(ing, factor, opts) });
        li.addEventListener("click", () => {
          if (this.checkedIngredients.has(key)) this.checkedIngredients.delete(key);
          else this.checkedIngredients.add(key);
          li.toggleClass("is-done", this.checkedIngredients.has(key));
        });
      });
    });
    if (recipe.ingredients.length === 0) pane.createEl("p", { text: "No ingredients found.", cls: "recipe-empty" });
  }
}
