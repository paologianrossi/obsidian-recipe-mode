import { App, Editor, Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import type RecipeModePlugin from "../main";
import { parseIngredient } from "../core/parse-ingredient";
import { recipeToMarkdown } from "../core/to-markdown";

/** Prompt for a recipe name, then create + open a templated note. */
export class NewRecipeModal extends Modal {
  private name = "";

  constructor(
    app: App,
    private plugin: RecipeModePlugin,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("New recipe");
    new Setting(this.contentEl).setName("Name").addText((t) => {
      t.setPlaceholder("Pasta al forno").onChange((v) => (this.name = v));
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void this.create();
        }
      });
      window.setTimeout(() => t.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText("Create")
        .setCta()
        .onClick(() => void this.create()),
    );
  }

  private async create(): Promise<void> {
    const name = this.name.trim();
    if (!name) {
      new Notice("Give the recipe a name.");
      return;
    }
    this.close();
    const file = await createRecipeNote(this.plugin, name);
    if (file) await this.app.workspace.getLeaf(false).openFile(file);
  }
}

/** Create a note in the recipe folder, deduplicating the filename. */
export async function createUniqueNote(
  plugin: RecipeModePlugin,
  title: string,
  content: string,
): Promise<TFile | null> {
  const { app, settings } = plugin;
  const folder = settings.recipeFolder.trim();
  if (folder && !app.vault.getFolderByPath(normalizePath(folder))) {
    await app.vault.createFolder(normalizePath(folder));
  }
  const safe = title.replace(/[\\/:*?"<>|#^\[\]]/g, "-").trim() || "Recipe";
  let path = normalizePath(folder ? `${folder}/${safe}.md` : `${safe}.md`);
  let n = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = normalizePath(folder ? `${folder}/${safe} ${n}.md` : `${safe} ${n}.md`);
    n++;
  }
  try {
    return await app.vault.create(path, content);
  } catch (e) {
    new Notice(`Could not create recipe: ${String(e)}`);
    return null;
  }
}

export async function createRecipeNote(plugin: RecipeModePlugin, title: string): Promise<TFile | null> {
  const content = recipeToMarkdown(
    {
      title,
      servings: 4,
      tags: [],
      ingredients: [],
      steps: [],
    },
    { locale: plugin.settings.locale, recipeTag: plugin.settings.recipeTag },
  );
  return createUniqueNote(plugin, title, content);
}

/**
 * Normalize the selected lines into ingredient bullets:
 * strips bullets/numbering, re-emits "- <line>", keeping parseable
 * quantity/unit/name lines exactly as written (parser is display-time).
 */
export function formatSelectionAsIngredients(editor: Editor): void {
  const selection = editor.getSelection();
  if (!selection.trim()) {
    new Notice("Select the ingredient lines first.");
    return;
  }
  const out = selection
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*+•]|\d+[.)])?\s*(?:\[.\]\s*)?/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const ing = parseIngredient(line);
      return `- ${ing.raw}`;
    })
    .join("\n");
  editor.replaceSelection(out + "\n");
}
