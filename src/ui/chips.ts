/** Shared meta-chip construction for reading mode and live preview. */

import { formatDurationLong, parseDuration } from "../core/duration";

export function chipData(fm: Record<string, unknown>): [string, string][] {
  const chips: [string, string][] = [];
  const servings = fm["servings"] ?? fm["serves"] ?? fm["porzioni"];
  if (servings !== undefined) chips.push(["Servings", String(servings)]);
  const dur = (v: unknown) => parseDuration(typeof v === "string" || typeof v === "number" ? v : undefined);
  const prep = dur(fm["prep_time"] ?? fm["prepTime"]);
  const cook = dur(fm["cook_time"] ?? fm["cookTime"]);
  if (prep !== undefined) chips.push(["Prep", formatDurationLong(prep)]);
  if (cook !== undefined) chips.push(["Cook", formatDurationLong(cook)]);
  if (prep !== undefined && cook !== undefined) chips.push(["Total", formatDurationLong(prep + cook)]);
  const rating = fm["rating"] ?? fm["voto"];
  if (typeof rating === "number") chips.push(["Rating", "★".repeat(Math.round(rating))]);
  return chips;
}

export function renderChips(parent: HTMLElement, chips: [string, string][], extraCls = ""): HTMLElement {
  const el = parent.createDiv({ cls: ("recipe-chips " + extraCls).trim() });
  for (const [label, value] of chips) {
    const c = el.createDiv({ cls: "recipe-chip" });
    c.createSpan({ cls: "recipe-chip-label", text: label });
    c.createSpan({ cls: "recipe-chip-value", text: value });
  }
  return el;
}
