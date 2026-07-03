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
  /** How a note qualifies as a recipe (styling, Cmd+E cooking swap, shopping lists). */
  recipeDetection: "content" | "tag" | "folder" | "filename";
  /** Comma-separated folder paths for "folder" detection. */
  detectionFolders: string;
  /** Case-insensitive filename regex for "filename" detection. */
  detectionPattern: string;
  /** Replace reading mode with the cooking view for recipe notes (Cmd+E toggles edit ⇄ cooking). */
  cookingAsReading: boolean;
  /** Collapse the sidebars while the cooking view is open; restore them on exit. */
  hideSidebars: boolean;
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
  recipeDetection: "content",
  detectionFolders: "Recipes",
  detectionPattern: "^Recipe",
  cookingAsReading: true,
  hideSidebars: true,
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
      .setName("Cooking mode as reading view")
      .setDesc("For recipe notes, toggling to reading view (Cmd+E) opens cooking mode instead. Cmd+E in cooking mode returns to editing.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.cookingAsReading).onChange(async (v) => {
          this.plugin.settings.cookingAsReading = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Hide sidebars in cooking mode")
      .setDesc("Collapse both sidebars while the cooking view is open and restore them when leaving it.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.hideSidebars).onChange(async (v) => {
          this.plugin.settings.hideSidebars = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Recipe detection")
      .setDesc("What makes a note a recipe — for styling, the cooking-mode toggle, and shopping lists.")
      .addDropdown((d) =>
        d
          .addOptions({
            content: "Content (has an ingredients section)",
            tag: "Recipe tag",
            folder: "Folder",
            filename: "Filename pattern",
          })
          .setValue(this.plugin.settings.recipeDetection)
          .onChange(async (v) => {
            this.plugin.settings.recipeDetection = v as RecipeModeSettings["recipeDetection"];
            await this.plugin.saveSettings();
            this.display(); // show/hide the mode-specific fields
          }),
      );

    if (this.plugin.settings.recipeDetection === "folder") {
      new Setting(containerEl)
        .setName("Recipe folders")
        .setDesc("Comma-separated folders whose notes are recipes.")
        .addText((t) =>
          t.setValue(this.plugin.settings.detectionFolders).onChange(async (v) => {
            this.plugin.settings.detectionFolders = v;
            await this.plugin.saveSettings();
          }),
        );
    }

    if (this.plugin.settings.recipeDetection === "filename") {
      new Setting(containerEl)
        .setName("Filename pattern")
        .setDesc("Case-insensitive regular expression matched against the note name, e.g. ^Recipe")
        .addText((t) =>
          t.setValue(this.plugin.settings.detectionPattern).onChange(async (v) => {
            this.plugin.settings.detectionPattern = v;
            await this.plugin.saveSettings();
          }),
        );
    }

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
