import { App, PluginSettingTab, Setting } from "obsidian";
import type RecipeModePlugin from "./main";
import { DEFAULT_INGREDIENT_HEADINGS, DEFAULT_STEP_HEADINGS } from "./core/parse-recipe";

export interface RecipeModeSettings {
  /** Tag that marks a note as a recipe (without #). */
  recipeTag: string;
  /** Comma-separated heading names for the ingredients section. */
  ingredientHeadings: string;
  /** Comma-separated heading names for the steps section. */
  stepHeadings: string;
  /** Display locale for quantities and units. */
  locale: "en" | "it";
  /** Unit system for display: keep as written, or convert. */
  unitSystem: "original" | "metric" | "imperial";
  /** Keep the screen awake while the cooking view is open. */
  wakeLock: boolean;
  /** Folder for new recipes ("" = vault root). */
  recipeFolder: string;
  /** Download the recipe image on web import. */
  downloadImages: boolean;
  /** Only style notes carrying the recipe tag (default: style any note with an ingredients section). */
  requireTagForStyling: boolean;
}

export const DEFAULT_SETTINGS: RecipeModeSettings = {
  recipeTag: "recipe",
  ingredientHeadings: DEFAULT_INGREDIENT_HEADINGS.join(", "),
  stepHeadings: DEFAULT_STEP_HEADINGS.join(", "),
  locale: "en",
  unitSystem: "original",
  wakeLock: true,
  recipeFolder: "Recipes",
  downloadImages: false,
  requireTagForStyling: false,
};

export function splitHeadings(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export class RecipeModeSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: RecipeModePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Recipe tag")
      .setDesc("Notes with this tag are treated as recipes.")
      .addText((t) =>
        t.setValue(this.plugin.settings.recipeTag).onChange(async (v) => {
          this.plugin.settings.recipeTag = v.replace(/^#/, "").trim() || "recipe";
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Ingredient headings")
      .setDesc("Comma-separated heading names recognized as the ingredients section.")
      .addText((t) =>
        t.setValue(this.plugin.settings.ingredientHeadings).onChange(async (v) => {
          this.plugin.settings.ingredientHeadings = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Step headings")
      .setDesc("Comma-separated heading names recognized as the steps section.")
      .addText((t) =>
        t.setValue(this.plugin.settings.stepHeadings).onChange(async (v) => {
          this.plugin.settings.stepHeadings = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Quantity display language")
      .setDesc("Language used to render units (cucchiai vs tbsp) and decimal separators.")
      .addDropdown((d) =>
        d
          .addOptions({ en: "English", it: "Italiano" })
          .setValue(this.plugin.settings.locale)
          .onChange(async (v) => {
            this.plugin.settings.locale = v as "en" | "it";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Unit system")
      .setDesc("Convert quantities in the cooking view, or keep them as written.")
      .addDropdown((d) =>
        d
          .addOptions({ original: "As written", metric: "Metric", imperial: "Imperial" })
          .setValue(this.plugin.settings.unitSystem)
          .onChange(async (v) => {
            this.plugin.settings.unitSystem = v as RecipeModeSettings["unitSystem"];
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Only style tagged notes")
      .setDesc(
        "When on, reading-mode and editor styling apply only to notes with the recipe tag. " +
          "When off, any note with a recognizable ingredients section is styled.",
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.requireTagForStyling).onChange(async (v) => {
          this.plugin.settings.requireTagForStyling = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Keep screen awake")
      .setDesc("Prevent the screen from sleeping while the cooking view is open (where supported).")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.wakeLock).onChange(async (v) => {
          this.plugin.settings.wakeLock = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("New recipe folder")
      .setDesc("Folder where new recipes are created. Empty for the vault root.")
      .addText((t) =>
        t.setValue(this.plugin.settings.recipeFolder).onChange(async (v) => {
          this.plugin.settings.recipeFolder = v.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Download images on import")
      .setDesc("Save the recipe photo into the vault when importing from the web.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.downloadImages).onChange(async (v) => {
          this.plugin.settings.downloadImages = v;
          await this.plugin.saveSettings();
        }),
      );
  }
}
