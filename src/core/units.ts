/**
 * Unit table with English + Italian aliases, plus metric ⇄ imperial conversion.
 * Pure module: no Obsidian imports.
 */

export type UnitKind = "mass" | "volume" | "count";
export type UnitSystem = "metric" | "imperial" | "neutral";

export interface UnitDef {
  /** Canonical id, used in Quantity.unit. */
  id: string;
  kind: UnitKind;
  system: UnitSystem;
  /** Factor to the kind's base unit (g for mass, ml for volume). */
  toBase?: number;
  /** How to render the unit: [singular, plural]. Keyed by locale. */
  display: { en: [string, string]; it: [string, string] };
  /** All spellings recognized when parsing (lowercase, no trailing dot). */
  aliases: string[];
}

const U = (
  id: string,
  kind: UnitKind,
  system: UnitSystem,
  toBase: number | undefined,
  en: [string, string],
  it: [string, string],
  aliases: string[],
): UnitDef => ({ id, kind, system, toBase, display: { en, it }, aliases });

export const UNITS: UnitDef[] = [
  // --- mass (base: g) ---
  U("mg", "mass", "metric", 0.001, ["mg", "mg"], ["mg", "mg"], ["mg", "milligram", "milligrams", "milligrammo", "milligrammi"]),
  U("g", "mass", "metric", 1, ["g", "g"], ["g", "g"], ["g", "gr", "gram", "grams", "grammo", "grammi"]),
  U("etto", "mass", "metric", 100, ["hg", "hg"], ["etto", "etti"], ["hg", "etto", "etti", "ettogrammo", "ettogrammi"]),
  U("kg", "mass", "metric", 1000, ["kg", "kg"], ["kg", "kg"], ["kg", "kilogram", "kilograms", "chilo", "chili", "chilogrammo", "chilogrammi", "kilo", "kilos"]),
  U("oz", "mass", "imperial", 28.3495, ["oz", "oz"], ["oz", "oz"], ["oz", "ounce", "ounces", "oncia", "once"]),
  U("lb", "mass", "imperial", 453.592, ["lb", "lbs"], ["libbra", "libbre"], ["lb", "lbs", "pound", "pounds", "libbra", "libbre"]),

  // --- volume (base: ml) ---
  U("ml", "volume", "metric", 1, ["ml", "ml"], ["ml", "ml"], ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "millilitro", "millilitri"]),
  U("cl", "volume", "metric", 10, ["cl", "cl"], ["cl", "cl"], ["cl", "centilitro", "centilitri", "centiliter", "centiliters"]),
  U("dl", "volume", "metric", 100, ["dl", "dl"], ["dl", "dl"], ["dl", "decilitro", "decilitri", "deciliter", "deciliters"]),
  U("l", "volume", "metric", 1000, ["l", "l"], ["l", "l"], ["l", "lt", "liter", "liters", "litre", "litres", "litro", "litri"]),
  U("tsp", "volume", "neutral", 4.929, ["tsp", "tsp"], ["cucchiaino", "cucchiaini"], ["tsp", "teaspoon", "teaspoons", "cucchiaino", "cucchiaini", "cucchiaino da tè", "cc"]),
  U("tbsp", "volume", "neutral", 14.787, ["tbsp", "tbsp"], ["cucchiaio", "cucchiai"], ["tbsp", "tbs", "tablespoon", "tablespoons", "cucchiaio", "cucchiai", "cucchiaiata", "cucchiaiate"]),
  U("cup", "volume", "imperial", 236.588, ["cup", "cups"], ["tazza", "tazze"], ["cup", "cups", "tazza", "tazze"]),
  U("floz", "volume", "imperial", 29.5735, ["fl oz", "fl oz"], ["fl oz", "fl oz"], ["fl oz", "floz", "fluid ounce", "fluid ounces"]),
  U("pint", "volume", "imperial", 473.176, ["pint", "pints"], ["pinta", "pinte"], ["pt", "pint", "pints", "pinta", "pinte"]),
  U("quart", "volume", "imperial", 946.353, ["quart", "quarts"], ["quarto", "quarti"], ["qt", "quart", "quarts"]),
  U("gallon", "volume", "imperial", 3785.41, ["gallon", "gallons"], ["gallone", "galloni"], ["gal", "gallon", "gallons", "gallone", "galloni"]),
  U("glass", "volume", "neutral", 200, ["glass", "glasses"], ["bicchiere", "bicchieri"], ["glass", "glasses", "bicchiere", "bicchieri"]),

  // --- count-ish / informal (no conversion) ---
  U("pinch", "count", "neutral", undefined, ["pinch", "pinches"], ["pizzico", "pizzichi"], ["pinch", "pinches", "pizzico", "pizzichi", "presa", "prese"]),
  U("clove", "count", "neutral", undefined, ["clove", "cloves"], ["spicchio", "spicchi"], ["clove", "cloves", "spicchio", "spicchi"]),
  U("slice", "count", "neutral", undefined, ["slice", "slices"], ["fetta", "fette"], ["slice", "slices", "fetta", "fette", "fettina", "fettine"]),
  U("piece", "count", "neutral", undefined, ["piece", "pieces"], ["pezzo", "pezzi"], ["piece", "pieces", "pezzo", "pezzi", "pz"]),
  U("can", "count", "neutral", undefined, ["can", "cans"], ["lattina", "lattine"], ["can", "cans", "tin", "tins", "lattina", "lattine", "barattolo", "barattoli", "scatola", "scatole"]),
  U("package", "count", "neutral", undefined, ["package", "packages"], ["confezione", "confezioni"], ["package", "packages", "pack", "packs", "confezione", "confezioni", "pacchetto", "pacchetti", "busta", "buste"]),
  U("bunch", "count", "neutral", undefined, ["bunch", "bunches"], ["mazzetto", "mazzetti"], ["bunch", "bunches", "mazzetto", "mazzetti", "mazzo", "mazzi", "ciuffo", "ciuffi"]),
  U("sprig", "count", "neutral", undefined, ["sprig", "sprigs"], ["rametto", "rametti"], ["sprig", "sprigs", "rametto", "rametti"]),
  U("leaf", "count", "neutral", undefined, ["leaf", "leaves"], ["foglia", "foglie"], ["leaf", "leaves", "foglia", "foglie", "foglina", "fogline"]),
  U("stick", "count", "neutral", undefined, ["stick", "sticks"], ["stecca", "stecche"], ["stick", "sticks", "stecca", "stecche", "gambo", "gambi", "costa", "coste"]),
  U("sachet", "count", "neutral", undefined, ["sachet", "sachets"], ["bustina", "bustine"], ["sachet", "sachets", "bustina", "bustine"]),
  U("drop", "count", "neutral", undefined, ["drop", "drops"], ["goccia", "gocce"], ["drop", "drops", "goccia", "gocce"]),
  U("qb", "count", "neutral", undefined, ["to taste", "to taste"], ["q.b.", "q.b."], ["qb", "q.b", "quanto basta", "to taste"]),
];

const byId = new Map(UNITS.map((u) => [u.id, u]));

const byAlias = new Map<string, UnitDef>();
for (const u of UNITS) {
  for (const a of u.aliases) byAlias.set(a, u);
}

export function getUnit(id: string): UnitDef | undefined {
  return byId.get(id);
}

/** Look up a unit by any alias ("Grammi." → g). */
export function findUnit(token: string): UnitDef | undefined {
  return byAlias.get(token.toLowerCase().replace(/\.+$/, ""));
}

/** Multi-word aliases ("fluid ounce", "quanto basta"), longest first, for greedy matching. */
export const MULTIWORD_ALIASES: { alias: string; unit: UnitDef }[] = UNITS.flatMap((u) =>
  u.aliases.filter((a) => a.includes(" ")).map((alias) => ({ alias, unit: u })),
).sort((a, b) => b.alias.length - a.alias.length);

/** Convert value between two units of the same kind. Returns undefined when not convertible. */
export function convert(value: number, fromId: string, toId: string): number | undefined {
  const from = byId.get(fromId);
  const to = byId.get(toId);
  if (!from || !to || from.kind !== to.kind) return undefined;
  if (from.toBase === undefined || to.toBase === undefined) return undefined;
  return (value * from.toBase) / to.toBase;
}

/**
 * Convert a quantity to the preferred system, choosing a human-friendly target
 * unit (350 g → 12.3 oz; 2 cups → 473 ml → shown as 470 ml… caller rounds).
 */
export function toSystem(
  value: number,
  unitId: string,
  system: "metric" | "imperial",
): { value: number; unit: string } | undefined {
  const unit = byId.get(unitId);
  if (!unit || unit.toBase === undefined) return undefined;
  if (unit.system === system || unit.system === "neutral") return undefined;

  const base = value * unit.toBase; // g or ml
  // Only convert into everyday units, not colloquial ones (etto, cl, dl…).
  const TARGETS = new Set(["g", "kg", "ml", "l", "oz", "lb", "floz", "cup", "pint", "quart", "gallon"]);
  const candidates = UNITS.filter(
    (u) => u.kind === unit.kind && u.system === system && u.toBase !== undefined && TARGETS.has(u.id),
  ).sort((a, b) => a.toBase! - b.toBase!);
  if (candidates.length === 0) return undefined;

  // Pick the largest unit that keeps the value >= 1 (else smallest).
  let pick = candidates[0]!;
  for (const c of candidates) {
    if (base / c.toBase! >= 1) pick = c;
  }
  return { value: base / pick.toBase!, unit: pick.id };
}

/** Render a unit for display. */
export function displayUnit(unitId: string, value: number, locale: "en" | "it"): string {
  const unit = byId.get(unitId);
  if (!unit) return unitId;
  const [singular, plural] = unit.display[locale];
  return Math.abs(value) <= 1 ? singular : plural;
}
