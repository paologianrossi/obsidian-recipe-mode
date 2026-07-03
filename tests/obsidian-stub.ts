/**
 * Test stub for the `obsidian` package (types-only on npm, provided by the
 * app at runtime). Only what the modules under test actually touch.
 */
import { StateField } from "@codemirror/state";

export const editorInfoField = StateField.define<{ file: null }>({
  create: () => ({ file: null }),
  update: (v) => v,
});

export function getAllTags(): string[] {
  return [];
}

// Classes referenced at module-evaluation time by code under test.
export class PluginSettingTab {}
export class Setting {}
export class Modal {}
export class ItemView {}
export class Plugin {}
