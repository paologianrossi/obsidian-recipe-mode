/**
 * Live Preview decorations for recipe notes:
 *  - meta chips rendered as a block widget under the H1 (StateField — block
 *    widgets are not allowed from view plugins)
 *  - accent-highlighted quantities in the ingredients section
 *  - ghost unit-conversion annotations after quantities ("400 g ‹14 oz›")
 *  - section banding for ingredients/steps, dotted underline on ingredient
 *    lines the parser cannot scale
 * All display-only; the document is never modified. Annotations step aside
 * on the line being edited so they never fight the cursor.
 */

import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { editorInfoField, getAllTags } from "obsidian";
import type RecipeModePlugin from "../main";
import { findInlineQuantities, matchQuantityPrefix, parseIngredient } from "../core/parse-ingredient";
import type { Quantity } from "../types";
import { computeSectionKinds, parseFrontmatter } from "../core/parse-recipe";
import { formatValue } from "../core/scale";
import { displayUnit, getUnit, toSystem } from "../core/units";
import { splitHeadings } from "../settings";
import { chipData, renderChips } from "./chips";

const LIST_ITEM_RE = /^(\s*(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?)(.*)$/;

/**
 * Text-based gate: decorate unless the user restricted styling to tagged
 * notes. Deliberately avoids metadataCache so freshly-edited notes are
 * never skipped because the cache has not caught up yet.
 */
function shouldDecorate(state: EditorState, plugin: RecipeModePlugin): boolean {
  if (!plugin.settings.requireTagForStyling) return true;
  const file = state.field(editorInfoField, false)?.file;
  if (!file) return false;
  const cache = plugin.app.metadataCache.getFileCache(file);
  if (!cache) return false;
  const want = "#" + plugin.settings.recipeTag.replace(/^#/, "").toLowerCase();
  return (getAllTags(cache) ?? []).some((t) => t.toLowerCase() === want);
}

/** Frontmatter parsed straight from the document text (cache-independent). */
function docFrontmatter(state: EditorState): Record<string, unknown> {
  const head = state.doc.sliceString(0, Math.min(state.doc.length, 4000));
  return parseFrontmatter(head).frontmatter;
}

/* ---------- meta chips under the title (block widget via StateField) ---------- */

class ChipsWidget extends WidgetType {
  constructor(private chips: [string, string][]) {
    super();
  }

  eq(other: ChipsWidget): boolean {
    return JSON.stringify(this.chips) === JSON.stringify(other.chips);
  }

  toDOM(): HTMLElement {
    const container = createDiv({ cls: "recipe-lp-chips-container" });
    renderChips(container, this.chips, "recipe-lp-chips");
    return container;
  }
}

export function buildChips(state: EditorState, plugin: RecipeModePlugin): DecorationSet {
  if (!shouldDecorate(state, plugin)) return Decoration.none;
  const chips = chipData(docFrontmatter(state));
  if (chips.length === 0) return Decoration.none;

  // Find the first H1 in the leading part of the note.
  const scanEnd = Math.min(state.doc.lines, 100);
  for (let i = 1; i <= scanEnd; i++) {
    const line = state.doc.line(i);
    if (/^#\s+/.test(line.text)) {
      return Decoration.set(
        Decoration.widget({ widget: new ChipsWidget(chips), side: 1, block: true }).range(line.to),
      );
    }
  }
  return Decoration.none;
}

export function recipeChipsField(plugin: RecipeModePlugin) {
  return StateField.define<DecorationSet>({
    create: (state) => buildChips(state, plugin),
    update: (value, tr) => (tr.docChanged ? buildChips(tr.state, plugin) : value.map(tr.changes)),
    provide: (field) => EditorView.decorations.from(field),
  });
}

/* ---------- inline decorations (marks, line classes, conversion ghosts) ---------- */

class ConversionWidget extends WidgetType {
  constructor(private text: string) {
    super();
  }

  eq(other: ConversionWidget): boolean {
    return this.text === other.text;
  }

  toDOM(): HTMLElement {
    return createSpan({ cls: "recipe-lp-conv", text: ` ‹${this.text}›` });
  }
}

const QTY_MARK = Decoration.mark({ class: "recipe-qty" });

function ghostText(q: Quantity | undefined, plugin: RecipeModePlugin): string | undefined {
  if (!q?.unit) return undefined;
  const def = getUnit(q.unit);
  if (!def || def.toBase === undefined) return undefined;

  // Annotate only toward the preferred system: with a metric preference,
  // imperial quantities get a metric ghost and metric ones stay clean.
  // Neutral units (tbsp, cups…) are imperial-native tools: ghost them for
  // metric users ("1 tbsp ‹15 ml›") but not for imperial users.
  // "As written" means no preference, so no ghosts.
  const target = plugin.settings.unitSystem;
  if (target === "original" || def.system === target) return undefined;
  if (def.system === "neutral" && target === "imperial") return undefined;
  const conv = toSystem(q.value, q.unit, target, { convertNeutral: true });
  if (!conv) return undefined;

  const locale = plugin.settings.locale;
  return `${formatValue(conv.value, locale, false)} ${displayUnit(conv.unit, conv.value, locale)}`;
}

export function buildInline(state: EditorState, plugin: RecipeModePlugin): DecorationSet {
  if (!shouldDecorate(state, plugin)) return Decoration.none;

  const doc = state.doc;
  const lines: string[] = [];
  for (let i = 1; i <= doc.lines; i++) lines.push(doc.line(i).text);
  const kinds = computeSectionKinds(
    lines,
    splitHeadings(plugin.settings.ingredientHeadings),
    splitHeadings(plugin.settings.stepHeadings),
  );
  const cursorLine = doc.lineAt(state.selection.main.head).number - 1;

  // Collect first, then sort: marks and ghosts come from several scanners and
  // RangeSetBuilder insists on sorted input.
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const mark = (from: number, to: number) => ranges.push({ from, to, deco: QTY_MARK });
  const ghost = (at: number, q: Quantity | undefined) => {
    const text = ghostText(q, plugin);
    if (text) ranges.push({ from: at, to: at, deco: Decoration.widget({ widget: new ConversionWidget(text), side: 1 }) });
  };

  for (let i = 0; i < lines.length; i++) {
    const kind = kinds[i];
    if (!kind) continue;
    const text = lines[i]!;
    const line = doc.line(i + 1);
    const editingHere = i === cursorLine;

    if (kind === "steps") {
      ranges.push({ from: line.from, to: line.from, deco: Decoration.line({ class: "recipe-lp-steps" }) });
      // Quantities inside step prose: "Add salt (2 tsp for a small jar)".
      for (const iq of findInlineQuantities(text)) {
        mark(line.from + iq.start, line.from + iq.end);
        if (!editingHere) ghost(line.from + iq.end, iq.quantity);
      }
      continue;
    }

    // --- ingredients section ---
    const item = text.match(LIST_ITEM_RE);
    const classes = ["recipe-lp-ingredients"];

    if (item && item[2]!.trim()) {
      const ing = parseIngredient(item[2]!);
      // No quantity and not a "q.b." line: scaling and shopping lists can't use it.
      if (!ing.quantity && ing.note !== "q.b." && !editingHere) classes.push("recipe-lp-noqty");
    }
    ranges.push({ from: line.from, to: line.from, deco: Decoration.line({ class: classes.join(" ") }) });

    if (!item) continue;
    const itemStart = line.from + item[1]!.length;
    const split = matchQuantityPrefix(item[2]!);
    if (split) {
      mark(itemStart, itemStart + split.prefix.trimEnd().length);
      if (!editingHere) ghost(itemStart + split.prefix.trimEnd().length, parseIngredient(item[2]!).quantity);
    }
    // Additional quantities later in the line ("burro (50 g)").
    const restOffset = split ? split.prefix.length : 0;
    for (const iq of findInlineQuantities(item[2]!.slice(restOffset))) {
      mark(itemStart + restOffset + iq.start, itemStart + restOffset + iq.end);
      if (!editingHere) ghost(itemStart + restOffset + iq.end, iq.quantity);
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide);
  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) builder.add(r.from, r.to, r.deco);
  return builder.finish();
}

export function recipeLivePreviewExtension(plugin: RecipeModePlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildInline(view.state, plugin);
      }

      update(update: ViewUpdate) {
        // Recipe notes are small; a full rebuild on change is cheap and simple.
        if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
          this.decorations = buildInline(update.state, plugin);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
