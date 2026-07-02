import { Editor, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, RecipeModeSettings, RecipeModeSettingTab } from "./settings";
import { COOKING_VIEW_TYPE, CookingView } from "./ui/cooking-view";
import { NewRecipeModal, formatSelectionAsIngredients } from "./ui/editor-commands";

export default class RecipeModePlugin extends Plugin {
  settings: RecipeModeSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new RecipeModeSettingTab(this.app, this));

    this.registerView(COOKING_VIEW_TYPE, (leaf) => new CookingView(leaf, this));

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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
