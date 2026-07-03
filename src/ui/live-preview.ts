/**
 * Live Preview decorations: highlight ingredient quantities in the editor
 * for recipe notes. A CodeMirror ViewPlugin — reading mode is handled
 * separately in reading-mode.ts.
 */

import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { editorInfoField, getAllTags } from "obsidian";
import type RecipeModePlugin from "../main";
import { matchQuantityPrefix } from "../core/parse-ingredient";
import { computeSectionKinds } from "../core/parse-recipe";
import { splitHeadings } from "../settings";

const QTY_MARK = Decoration.mark({ class: "recipe-qty" });
const LIST_ITEM_RE = /^(\s*(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?)(.*)$/;

function buildDecorations(view: EditorView, plugin: RecipeModePlugin): DecorationSet {
  const info = view.state.field(editorInfoField, false);
  const file = info?.file;
  if (!file) return Decoration.none;

  const cache = plugin.app.metadataCache.getFileCache(file);
  if (!cache) return Decoration.none;
  const want = "#" + plugin.settings.recipeTag.replace(/^#/, "").toLowerCase();
  if (!(getAllTags(cache) ?? []).some((t) => t.toLowerCase() === want)) return Decoration.none;

  const doc = view.state.doc;
  const lines: string[] = [];
  for (let i = 1; i <= doc.lines; i++) lines.push(doc.line(i).text);
  const kinds = computeSectionKinds(
    lines,
    splitHeadings(plugin.settings.ingredientHeadings),
    splitHeadings(plugin.settings.stepHeadings),
  );

  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 0; i < lines.length; i++) {
    if (kinds[i] !== "ingredients") continue;
    const m = lines[i]!.match(LIST_ITEM_RE);
    if (!m) continue;
    const split = matchQuantityPrefix(m[2]!);
    if (!split) continue;
    const lineStart = doc.line(i + 1).from;
    const from = lineStart + m[1]!.length;
    builder.add(from, from + split.prefix.trimEnd().length, QTY_MARK);
  }
  return builder.finish();
}

export function recipeLivePreviewExtension(plugin: RecipeModePlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, plugin);
      }

      update(update: ViewUpdate) {
        // Recipe notes are small; a full rebuild on change is cheap and simple.
        if (update.docChanged || update.viewportChanged || update.focusChanged) {
          this.decorations = buildDecorations(update.view, plugin);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
