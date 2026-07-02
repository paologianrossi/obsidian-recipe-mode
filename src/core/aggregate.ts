/** Aggregate ingredients across recipes into a shopping list. Pure module. */

import type { Quantity, Recipe } from "../types";
import { allIngredients } from "../types";
import { getUnit } from "./units";
import { formatQuantity, scaleQuantity, type Locale } from "./scale";

export interface AggregatedPart {
  quantity?: Quantity;
  /** Recipe title the part came from. */
  from: string;
  /** Original text when there is no parseable quantity. */
  raw: string;
}

export interface AggregatedItem {
  /** Normalized ingredient name (first spelling wins for display). */
  name: string;
  parts: AggregatedPart[];
  /** Combined quantity when all parts are convertible into one unit. */
  total?: Quantity;
}

const normalize = (name: string): string => name.toLowerCase().replace(/\s+/g, " ").trim();

/** Sum quantities when they share a kind (g+kg fine, g+cup no). Undefined when mixed. */
function sumQuantities(quantities: (Quantity | undefined)[]): Quantity | undefined {
  if (quantities.some((q) => !q)) return undefined;
  const qs = quantities as Quantity[];

  // All unitless: plain sum (counts).
  if (qs.every((q) => !q.unit)) {
    return { value: qs.reduce((acc, q) => acc + q.value, 0) };
  }
  if (qs.some((q) => !q.unit)) return undefined;

  const defs = qs.map((q) => getUnit(q.unit!));
  if (defs.some((d) => !d || d.toBase === undefined)) {
    // Non-convertible units still merge when they are all the same unit (2 + 1 pinch).
    const unit = qs[0]!.unit;
    if (qs.every((q) => q.unit === unit)) return { value: qs.reduce((a, q) => a + q.value, 0), unit };
    return undefined;
  }
  const kind = defs[0]!.kind;
  if (defs.some((d) => d!.kind !== kind)) return undefined;

  const baseTotal = qs.reduce((acc, q, i) => acc + q.value * defs[i]!.toBase!, 0);
  // Report in the largest input unit to keep numbers kitchen-sized.
  const biggest = defs.reduce((a, b) => (a!.toBase! >= b!.toBase! ? a : b))!;
  return { value: baseTotal / biggest.toBase!, unit: biggest.id };
}

/** Aggregate scaled recipes into one deduplicated list, alphabetical by name. */
export function aggregateIngredients(inputs: { recipe: Recipe; factor?: number }[]): AggregatedItem[] {
  const byName = new Map<string, AggregatedItem>();

  for (const { recipe, factor = 1 } of inputs) {
    for (const ing of allIngredients(recipe)) {
      const key = normalize(ing.name);
      if (!key) continue;
      let item = byName.get(key);
      if (!item) {
        item = { name: ing.name, parts: [] };
        byName.set(key, item);
      }
      item.parts.push({
        quantity: ing.quantity ? scaleQuantity(ing.quantity, factor) : undefined,
        from: recipe.title,
        raw: ing.raw,
      });
    }
  }

  const items = [...byName.values()];
  for (const item of items) {
    item.total = sumQuantities(item.parts.map((p) => p.quantity));
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** Render the aggregated list as a checklist note. */
export function shoppingListMarkdown(items: AggregatedItem[], locale: Locale): string {
  const lines: string[] = [];
  for (const item of items) {
    if (item.total) {
      lines.push(`- [ ] ${formatQuantity(item.total, { locale })} ${item.name}`);
    } else if (item.parts.length === 1) {
      lines.push(`- [ ] ${item.parts[0]!.raw}`);
    } else {
      // Couldn't merge: one line with the breakdown.
      const detail = item.parts
        .map((p) => (p.quantity ? formatQuantity(p.quantity, { locale }) : p.raw))
        .join(" + ");
      lines.push(`- [ ] ${item.name} (${detail})`);
    }
  }
  return lines.join("\n") + "\n";
}
