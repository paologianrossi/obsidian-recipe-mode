/** Scaling and pretty-printing of quantities. Pure module. */

import type { Ingredient, Quantity } from "../types";
import { displayUnit, getUnit, toSystem } from "./units";

export type Locale = "en" | "it";

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"], [1 / 6, "⅙"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"],
  [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [5 / 6, "⅚"], [7 / 8, "⅞"],
];

export function scaleQuantity(q: Quantity, factor: number): Quantity {
  return {
    value: q.value * factor,
    rangeEnd: q.rangeEnd !== undefined ? q.rangeEnd * factor : undefined,
    unit: q.unit,
  };
}

/** Round to a kitchen-sensible precision for the magnitude. */
export function roundSensible(value: number): number {
  if (value >= 1000) return Math.round(value / 10) * 10;
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/** Format a bare number: vulgar fractions for count-ish amounts, locale decimal separator. */
export function formatValue(value: number, locale: Locale, preferFractions: boolean): string {
  const rounded = roundSensible(value);
  if (preferFractions && rounded < 100) {
    const whole = Math.floor(rounded);
    const frac = rounded - whole;
    if (frac < 0.03) return String(whole === 0 ? rounded : whole);
    for (const [v, glyph] of NICE_FRACTIONS) {
      if (Math.abs(frac - v) < 0.03) return whole === 0 ? glyph : `${whole}${glyph}`;
    }
  }
  let s = String(rounded);
  if (locale === "it") s = s.replace(".", ",");
  return s;
}

export interface FormatOptions {
  locale: Locale;
  /** Convert convertible units into this system for display. */
  targetSystem?: "metric" | "imperial";
}

export function formatQuantity(q: Quantity, opts: FormatOptions): string {
  let { value, rangeEnd, unit } = q;

  if (unit && opts.targetSystem) {
    const conv = toSystem(value, unit, opts.targetSystem);
    if (conv) {
      value = conv.value;
      if (rangeEnd !== undefined) rangeEnd = toSystem(rangeEnd, unit, opts.targetSystem)!.value;
      unit = conv.unit;
    }
  }

  const def = unit ? getUnit(unit) : undefined;
  // fractions read better for counts, spoons and cups; decimals for weights/volumes
  const preferFractions = !def || def.kind === "count" || ["tsp", "tbsp", "cup", "glass"].includes(def.id);

  let s = formatValue(value, opts.locale, preferFractions);
  if (rangeEnd !== undefined) s += `–${formatValue(rangeEnd, opts.locale, preferFractions)}`;
  if (def) s += ` ${displayUnit(def.id, rangeEnd ?? value, opts.locale)}`;
  return s;
}

/** Render a full ingredient line at a scale factor: "300 g pasta (integrale)". */
export function formatIngredient(ing: Ingredient, factor: number, opts: FormatOptions): string {
  if (!ing.quantity) return ing.note ? `${ing.name} (${ing.note})` : ing.name;
  const q = scaleQuantity(ing.quantity, factor);
  const qty = formatQuantity(q, opts);
  const note = ing.note ? ` (${ing.note})` : "";
  return `${qty} ${ing.name}${note}`.trim();
}

/** Factor to go from a recipe's base servings to a target. */
export function servingsFactor(base: number | undefined, target: number): number {
  if (!base || base <= 0) return 1;
  return target / base;
}
