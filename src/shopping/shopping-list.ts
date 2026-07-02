import { App, Modal, Notice, Setting, TFile, getAllTags } from "obsidian";
import type RecipeModePlugin from "../main";
import type { Recipe } from "../types";
import { aggregateIngredients, shoppingListMarkdown } from "../core/aggregate";
import { parseRecipe } from "../core/parse-recipe";
import { splitHeadings } from "../settings";
import { createUniqueNote } from "../ui/editor-commands";

/** All notes carrying the recipe tag (frontmatter or inline). */
export function findRecipeFiles(plugin: RecipeModePlugin): TFile[] {
  const want = "#" + plugin.settings.recipeTag.replace(/^#/, "").toLowerCase();
  return plugin.app.vault.getMarkdownFiles().filter((file) => {
    const cache = plugin.app.metadataCache.getFileCache(file);
    if (!cache) return false;
    return (getAllTags(cache) ?? []).some((t) => t.toLowerCase() === want);
  });
}

export async function parseRecipeFile(plugin: RecipeModePlugin, file: TFile): Promise<Recipe> {
  const content = await plugin.app.vault.cachedRead(file);
  return parseRecipe(content, {
    fallbackTitle: file.basename,
    ingredientHeadings: splitHeadings(plugin.settings.ingredientHeadings),
    stepHeadings: splitHeadings(plugin.settings.stepHeadings),
    frontmatter: plugin.app.metadataCache.getFileCache(file)?.frontmatter,
  });
}

/** Multi-select the recipes to shop for. */
export class ShoppingListModal extends Modal {
  private selected = new Set<TFile>();

  constructor(
    app: App,
    private plugin: RecipeModePlugin,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Shopping list");
    const files = findRecipeFiles(this.plugin).sort((a, b) => a.basename.localeCompare(b.basename));

    if (files.length === 0) {
      this.contentEl.createEl("p", {
        text: `No recipes found (notes tagged #${this.plugin.settings.recipeTag}).`,
      });
      return;
    }

    this.contentEl.createEl("p", { text: "Pick the recipes to aggregate:" });
    const list = this.contentEl.createDiv({ cls: "recipe-shopping-picker" });
    for (const file of files) {
      new Setting(list).setName(file.basename).addToggle((t) =>
        t.onChange((on) => {
          if (on) this.selected.add(file);
          else this.selected.delete(file);
        }),
      );
    }

    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText("Create shopping list")
        .setCta()
        .onClick(() => void this.create()),
    );
  }

  private async create(): Promise<void> {
    if (this.selected.size === 0) {
      new Notice("Select at least one recipe.");
      return;
    }
    this.close();
    await createShoppingListNote(this.plugin, [...this.selected]);
  }
}

export async function createShoppingListNote(plugin: RecipeModePlugin, files: TFile[]): Promise<void> {
  const recipes = await Promise.all(files.map((f) => parseRecipeFile(plugin, f)));
  const items = aggregateIngredients(recipes.map((recipe) => ({ recipe })));
  if (items.length === 0) {
    new Notice("Those recipes have no parseable ingredients.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const header = [
    `# Shopping list ${today}`,
    "",
    "From: " + files.map((f) => `[[${f.basename}]]`).join(", "),
    "",
  ].join("\n");
  const body = shoppingListMarkdown(items, plugin.settings.locale);

  const file = await createUniqueNote(plugin, `Shopping List ${today}`, header + body);
  if (file) {
    new Notice(`Shopping list created (${items.length} items).`);
    await plugin.app.workspace.getLeaf(false).openFile(file);
  }
}

/** Aggregate every linked recipe in the active note (a meal plan) into a shopping list. */
export async function shoppingListFromMealPlan(plugin: RecipeModePlugin): Promise<void> {
  const file = plugin.app.workspace.getActiveFile();
  if (!file) {
    new Notice("Open the meal-plan note first.");
    return;
  }
  const cache = plugin.app.metadataCache.getFileCache(file);
  const links = cache?.links ?? [];
  const recipeSet = new Set(findRecipeFiles(plugin));
  const targets: TFile[] = [];
  for (const link of links) {
    const dest = plugin.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
    if (dest && recipeSet.has(dest) && !targets.includes(dest)) targets.push(dest);
  }
  if (targets.length === 0) {
    new Notice(`No links to recipe notes (#${plugin.settings.recipeTag}) found in this note.`);
    return;
  }
  await createShoppingListNote(plugin, targets);
}

const WEEK_TEMPLATE = `---
tags: [meal-plan]
---

# Meal plan

| Day       | Lunch | Dinner |
| --------- | ----- | ------ |
| Monday    |       |        |
| Tuesday   |       |        |
| Wednesday |       |        |
| Thursday  |       |        |
| Friday    |       |        |
| Saturday  |       |        |
| Sunday    |       |        |

Link recipes into the cells ([[like this]]), then run
“Generate shopping list from meal plan”.
`;

export async function createMealPlanNote(plugin: RecipeModePlugin): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const file = await createUniqueNote(plugin, `Meal Plan ${today}`, WEEK_TEMPLATE);
  if (file) await plugin.app.workspace.getLeaf(false).openFile(file);
}
