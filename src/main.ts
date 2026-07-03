import { Editor, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, getAllTags } from "obsidian";
import { DEFAULT_SETTINGS, RecipeModeSettings, RecipeModeSettingTab, splitHeadings } from "./settings";
import { COOKING_VIEW_TYPE, CookingView } from "./ui/cooking-view";
import { NewRecipeModal, formatSelectionAsIngredients } from "./ui/editor-commands";
import { ImportRecipeModal } from "./ui/import-modal";
import { ShoppingListModal, createMealPlanNote, shoppingListFromMealPlan } from "./shopping/shopping-list";
import { registerReadingModeDecorations } from "./ui/reading-mode";
import { recipeChipsField, recipeLivePreviewExtension } from "./ui/live-preview";

/** Bumped by hand when it matters that the vault copy is current. */
const BUILD_TAG = "detect-1";

export default class RecipeModePlugin extends Plugin {
  settings: RecipeModeSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    console.log(`Recipe Mode v${this.manifest.version} loaded (build ${BUILD_TAG})`);
    await this.loadSettings();
    this.addSettingTab(new RecipeModeSettingTab(this.app, this));

    this.registerView(COOKING_VIEW_TYPE, (leaf) => new CookingView(leaf, this));
    registerReadingModeDecorations(this);
    this.registerEditorExtension([recipeChipsField(this), recipeLivePreviewExtension(this)]);

    this.addRibbonIcon("chef-hat", "Open recipe in cooking mode", () => {
      void this.openCookingView();
    });

    this.addCommand({
      id: "open-cooking-view",
      name: "Open recipe in cooking mode",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.openCookingView(file);
        return true;
      },
    });

    this.addCommand({
      id: "new-recipe",
      name: "New recipe",
      callback: () => new NewRecipeModal(this.app, this).open(),
    });

    this.addCommand({
      id: "format-ingredients",
      name: "Format selection as ingredients",
      editorCallback: (editor: Editor) => formatSelectionAsIngredients(editor),
    });

    this.addCommand({
      id: "import-recipe",
      name: "Import recipe from URL",
      callback: () => new ImportRecipeModal(this.app, this).open(),
    });

    this.addCommand({
      id: "shopping-list",
      name: "Create shopping list from recipes",
      callback: () => new ShoppingListModal(this.app, this).open(),
    });

    this.addCommand({
      id: "new-meal-plan",
      name: "New meal plan",
      callback: () => void createMealPlanNote(this),
    });

    this.addCommand({
      id: "shopping-list-from-meal-plan",
      name: "Generate shopping list from meal plan",
      callback: () => void shoppingListFromMealPlan(this),
    });

    // "Cooking mode as reading view": when a markdown leaf lands in preview
    // mode on a recipe note, swap it to the cooking view (Cmd+E in the
    // cooking view swaps back to editing — see CookingView).
    this.registerEvent(this.app.workspace.on("layout-change", () => this.swapPreviewLeaves()));
  }

  private swapPreviewLeaves(): void {
    if (!this.settings.cookingAsReading) return;
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || view.getMode() !== "preview") continue;
      const file = view.file;
      if (!file || !this.isRecipeFile(file)) continue;
      const wasActive = view === activeView;
      void leaf
        .setViewState({ type: COOKING_VIEW_TYPE, state: { filePath: file.path } })
        .then(() => {
          if (wasActive) this.app.workspace.setActiveLeaf(leaf, { focus: true });
        });
    }
  }

  /** A note qualifies as a recipe per the configured detection strategy. */
  isRecipeFile(file: TFile): boolean {
    switch (this.settings.recipeDetection) {
      case "tag": {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return false;
        const want = "#" + this.settings.recipeTag.replace(/^#/, "").toLowerCase();
        return (getAllTags(cache) ?? []).some((t) => t.toLowerCase() === want);
      }
      case "folder": {
        const path = file.path.toLowerCase();
        return this.settings.detectionFolders
          .split(",")
          .map((f) => f.trim().replace(/\/+$/, "").toLowerCase())
          .filter(Boolean)
          .some((f) => path.startsWith(f + "/"));
      }
      case "filename": {
        try {
          return new RegExp(this.settings.detectionPattern, "i").test(file.basename);
        } catch {
          return false; // invalid regex matches nothing
        }
      }
      case "content":
      default: {
        // Ingredients heading in the note (or the recipe tag, as a courtesy).
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return false;
        const want = "#" + this.settings.recipeTag.replace(/^#/, "").toLowerCase();
        if ((getAllTags(cache) ?? []).some((t) => t.toLowerCase() === want)) return true;
        const headings = splitHeadings(this.settings.ingredientHeadings);
        return (cache.headings ?? []).some((h) => {
          const t = h.heading.toLowerCase().replace(/[:.]+$/, "").trim();
          return headings.some((x) => t === x || t.startsWith(x + " "));
        });
      }
    }
  }

  async openCookingView(file?: TFile): Promise<void> {
    const target = file ?? this.app.workspace.getActiveFile();
    if (!target || target.extension !== "md") {
      new Notice("Open a recipe note first.");
      return;
    }

    // Reuse an existing cooking view when there is one.
    let leaf: WorkspaceLeaf;
    const existing = this.app.workspace.getLeavesOfType(COOKING_VIEW_TYPE);
    if (existing.length > 0) {
      leaf = existing[0]!;
    } else {
      leaf = this.app.workspace.getLeaf("split", "vertical");
      await leaf.setViewState({ type: COOKING_VIEW_TYPE, active: true });
    }
    const view = leaf.view;
    if (view instanceof CookingView) await view.loadFile(target, true);
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const data = ((await this.loadData()) ?? {}) as Record<string, unknown>;
    // migrate the old boolean gate to the detection dropdown
    if (data["requireTagForStyling"] === true && data["recipeDetection"] === undefined) {
      data["recipeDetection"] = "tag";
    }
    delete data["requireTagForStyling"];
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
