/**
 * Reading-mode decorations for recipe notes: meta chips under the title,
 * highlighted quantities in ingredient lists, roomier step lists.
 * Pure presentation — the markdown itself is never modified.
 */

import { MarkdownPostProcessorContext, getAllTags } from "obsidian";
import type RecipeModePlugin from "../main";
import { matchQuantityPrefix } from "../core/parse-ingredient";
import { computeSectionKinds } from "../core/parse-recipe";
import { formatDurationLong, parseDuration } from "../core/duration";
import { splitHeadings } from "../settings";

export function registerReadingModeDecorations(plugin: RecipeModePlugin): void {
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const cache = plugin.app.metadataCache.getCache(ctx.sourcePath);
    if (!cache) return;
    const want = "#" + plugin.settings.recipeTag.replace(/^#/, "").toLowerCase();
    if (!(getAllTags(cache) ?? []).some((t) => t.toLowerCase() === want)) return;

    el.addClass("recipe-reading");

    // Title block: append meta chips read from frontmatter.
    const h1 = el.querySelector("h1");
    if (h1) appendChips(h1, cache.frontmatter ?? {});

    // Section-aware styling: which section does this block sit in?
    const info = ctx.getSectionInfo(el);
    if (!info) return;
    const kind = sectionKindAt(info.text, info.lineStart, plugin);
    if (kind === "ingredients") {
      el.addClass("recipe-reading-ingredients");
      el.querySelectorAll("li").forEach((li) => highlightQuantity(li));
    } else if (kind === "steps") {
      el.addClass("recipe-reading-steps");
    }
  });
}

function appendChips(h1: HTMLElement, fm: Record<string, unknown>): void {
  const chips = createDiv({ cls: "recipe-chips recipe-reading-chips" });
  const chip = (label: string, value: string) => {
    const c = chips.createDiv({ cls: "recipe-chip" });
    c.createSpan({ cls: "recipe-chip-label", text: label });
    c.createSpan({ cls: "recipe-chip-value", text: value });
  };

  const servings = fm["servings"] ?? fm["serves"] ?? fm["porzioni"];
  if (servings !== undefined) chip("Servings", String(servings));
  const dur = (v: unknown) => parseDuration(typeof v === "string" || typeof v === "number" ? v : undefined);
  const prep = dur(fm["prep_time"] ?? fm["prepTime"]);
  const cook = dur(fm["cook_time"] ?? fm["cookTime"]);
  if (prep !== undefined) chip("Prep", formatDurationLong(prep));
  if (cook !== undefined) chip("Cook", formatDurationLong(cook));
  if (prep !== undefined && cook !== undefined) chip("Total", formatDurationLong(prep + cook));
  const rating = fm["rating"] ?? fm["voto"];
  if (typeof rating === "number") chip("Rating", "★".repeat(Math.round(rating)));

  if (chips.childElementCount > 0) h1.insertAdjacentElement("afterend", chips);
}

function sectionKindAt(
  noteText: string,
  line: number,
  plugin: RecipeModePlugin,
): "ingredients" | "steps" | undefined {
  const kinds = computeSectionKinds(
    noteText.split(/\r?\n/),
    splitHeadings(plugin.settings.ingredientHeadings),
    splitHeadings(plugin.settings.stepHeadings),
  );
  return kinds[line];
}

/** Wrap the leading "400 g" of an ingredient item in a styled span. */
function highlightQuantity(li: HTMLElement): void {
  for (const node of Array.from(li.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = node.textContent ?? "";
    if (!text.trim()) continue;
    const split = matchQuantityPrefix(text.replace(/^\s+/, ""));
    if (split) {
      const leading = text.slice(0, text.length - text.trimStart().length);
      const span = createSpan({ cls: "recipe-qty", text: split.prefix.trimEnd() });
      const rest = document.createTextNode(" " + split.rest.trimStart());
      li.insertBefore(document.createTextNode(leading), node);
      li.insertBefore(span, node);
      li.replaceChild(rest, node);
    }
    return; // only the first meaningful text node
  }
}
