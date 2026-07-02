import { App, Modal, Notice, Setting, normalizePath, requestUrl } from "obsidian";
import type RecipeModePlugin from "../main";
import type { Recipe } from "../types";
import { htmlToRecipe } from "../core/schema-org";
import { recipeToMarkdown } from "../core/to-markdown";
import { createUniqueNote } from "./editor-commands";

export class ImportRecipeModal extends Modal {
  private url = "";

  constructor(
    app: App,
    private plugin: RecipeModePlugin,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Import recipe from the web");
    new Setting(this.contentEl)
      .setName("URL")
      .setDesc("The plugin reads schema.org metadata (JSON-LD or microdata) from the page.")
      .addText((t) => {
        t.setPlaceholder("https://…").onChange((v) => (this.url = v));
        t.inputEl.style.width = "100%";
        t.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void this.doImport();
          }
        });
        window.setTimeout(() => t.inputEl.focus(), 0);
      });
    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText("Import")
        .setCta()
        .onClick(() => void this.doImport()),
    );
  }

  private async doImport(): Promise<void> {
    const url = this.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      new Notice("Enter a valid http(s) URL.");
      return;
    }
    this.close();
    await importRecipeFromUrl(this.plugin, url);
  }
}

export async function importRecipeFromUrl(plugin: RecipeModePlugin, url: string): Promise<void> {
  const notice = new Notice("Importing recipe…", 0);
  try {
    const res = await requestUrl({
      url,
      headers: { "User-Agent": "Mozilla/5.0 (ObsidianRecipeMode)" },
      throw: true,
    });
    const recipe = htmlToRecipe(res.text, url);

    if (!recipe) {
      // No structured data: create a stub so the URL is not lost.
      const stub: Recipe = { title: titleFromUrl(url), source: url, tags: [], ingredients: [], steps: [] };
      const md = recipeToMarkdown(stub, { locale: plugin.settings.locale, recipeTag: plugin.settings.recipeTag });
      const file = await createUniqueNote(plugin, stub.title, md);
      notice.hide();
      new Notice("No recipe metadata found on the page — created a stub note with the source URL.");
      if (file) await plugin.app.workspace.getLeaf(false).openFile(file);
      return;
    }

    if (recipe.image && plugin.settings.downloadImages) {
      const local = await downloadImage(plugin, recipe.image, recipe.title);
      if (local) recipe.image = local;
    }

    const md = recipeToMarkdown(recipe, { locale: plugin.settings.locale, recipeTag: plugin.settings.recipeTag });
    const file = await createUniqueNote(plugin, recipe.title, md);
    notice.hide();
    if (file) {
      new Notice(`Imported “${recipe.title}”.`);
      await plugin.app.workspace.getLeaf(false).openFile(file);
    }
  } catch (e) {
    notice.hide();
    new Notice(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function titleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const last = path.split("/").pop() ?? "";
    const cleaned = decodeURIComponent(last).replace(/[-_]+/g, " ").replace(/\.\w+$/, "").trim();
    return cleaned || new URL(url).hostname;
  } catch {
    return "Imported recipe";
  }
}

async function downloadImage(plugin: RecipeModePlugin, imageUrl: string, title: string): Promise<string | null> {
  try {
    const res = await requestUrl({ url: imageUrl, throw: true });
    const ext = (imageUrl.match(/\.(jpe?g|png|webp|gif)(?:[?#]|$)/i)?.[1] ?? "jpg").toLowerCase();
    const folder = plugin.settings.recipeFolder.trim();
    const safe = title.replace(/[\\/:*?"<>|#^\[\]]/g, "-").trim() || "recipe";
    let path = normalizePath(folder ? `${folder}/${safe}.${ext}` : `${safe}.${ext}`);
    let n = 2;
    while (plugin.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(folder ? `${folder}/${safe} ${n}.${ext}` : `${safe} ${n}.${ext}`);
      n++;
    }
    await plugin.app.vault.createBinary(path, res.arrayBuffer);
    return path;
  } catch {
    return null; // keep the remote URL
  }
}
