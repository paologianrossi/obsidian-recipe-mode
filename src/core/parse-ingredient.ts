/**
 * Lenient ingredient-line parser: `[quantity] [unit] [name] [(note)]`.
 * Handles EN + IT units, decimal commas, ASCII and unicode fractions, ranges.
 * Unparseable lines still come back with the full text as `name` — data is never lost.
 */

import type { Ingredient, Quantity } from "../types";
import { findUnit, MULTIWORD_ALIASES } from "./units";

const VULGAR: Record<string, number> = {
  "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4,
  "⅕": 1 / 5, "⅖": 2 / 5, "⅗": 3 / 5, "⅘": 4 / 5,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8,
};
const VULGAR_CLASS = `[${Object.keys(VULGAR).join("")}]`;

// One number: "1", "1.5", "1,5", "1/2", "1 1/2", "1½", "½"
const NUMBER_RE = new RegExp(
  `(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?\\s*${VULGAR_CLASS}?|${VULGAR_CLASS})`,
);

// Quantity at line start, optionally a range: "2-3", "2 – 3", "2 o 3", "2 or 3"
const QTY_RE = new RegExp(
  `^(${NUMBER_RE.source})(?:\\s*(?:[-–—~]|\\bo\\b|\\bor\\b|\\bto\\b)\\s*(${NUMBER_RE.source}))?\\s*`,
  "i",
);

const QB_RE = /[,\s]*\b(?:q\.?\s?b\.?|quanto basta|to taste)\s*$/i;
const CONNECTOR_RE = /^(?:di\s+|d['’]\s*|of\s+)/i;

/** Parse a single numeric token into a float. Returns NaN when malformed. */
export function parseNumberToken(token: string): number {
  const t = token.trim();
  // trailing vulgar fraction: "1½" or bare "½"
  const vulgar = t.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)?\\s*(${VULGAR_CLASS})$`));
  if (vulgar) {
    const whole = vulgar[1] ? parseFloat(vulgar[1].replace(",", ".")) : 0;
    return whole + VULGAR[vulgar[2]!]!;
  }
  // mixed fraction: "1 1/2"
  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return parseInt(mixed[1]!) + parseInt(mixed[2]!) / parseInt(mixed[3]!);
  // plain fraction: "1/2"
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return parseInt(frac[1]!) / parseInt(frac[2]!);
  // decimal with . or ,
  return parseFloat(t.replace(",", "."));
}

/** Try to match a unit at the start of `text`; returns [unitId, rest] or undefined. */
function matchUnit(text: string): [string, string] | undefined {
  const lower = text.toLowerCase();
  for (const { alias, unit } of MULTIWORD_ALIASES) {
    if (lower.startsWith(alias) && /^\W|^$/.test(text.slice(alias.length))) {
      return [unit.id, text.slice(alias.length)];
    }
  }
  const token = text.match(/^([^\s,()]+)/);
  if (token) {
    const unit = findUnit(token[1]!);
    // A unit token must be followed by more text: "2 fette di pane" yes,
    // but a line ending at the token ("3 uova") keeps it as the name.
    const rest = text.slice(token[1]!.length);
    if (unit && rest.trim().length > 0) return [unit.id, rest];
  }
  return undefined;
}

/**
 * Split the raw quantity+unit prefix off a line, preserving the original text:
 * "1,5 l passata" → { prefix: "1,5 l ", rest: "passata" }. For display markup.
 */
export function matchQuantityPrefix(line: string): { prefix: string; rest: string } | undefined {
  const m = line.match(QTY_RE);
  if (!m || m[0].trim().length === 0 || Number.isNaN(parseNumberToken(m[1]!))) return undefined;
  let consumed = m[0].length;
  const unitMatch = matchUnit(line.slice(consumed));
  if (unitMatch) consumed = line.length - unitMatch[1].length;
  return { prefix: line.slice(0, consumed), rest: line.slice(consumed) };
}

export interface InlineQuantity {
  /** Character offsets into the scanned text. */
  start: number;
  end: number;
  quantity: Quantity;
}

/**
 * Find quantity+unit occurrences anywhere in prose ("Add salt (2 tsp for a
 * small jar)"). Only number+known-unit pairs match — bare numbers ("type 1",
 * "rest 30 minutes") are left alone, so step text stays quiet unless the
 * unit is a real measurement.
 */
export function findInlineQuantities(text: string): InlineQuantity[] {
  const out: InlineQuantity[] = [];
  const numRe = new RegExp(
    `(${NUMBER_RE.source})(?:\\s*[-–—]\\s*(${NUMBER_RE.source}))?`,
    "g",
  );
  for (const m of text.matchAll(numRe)) {
    // must start at a word boundary ("00" in "farina 00" is fine, "x2" is not)
    if (m.index > 0 && /[\w°%€$.,]/.test(text[m.index - 1]!)) continue;
    const afterNum = m.index + m[0].length;
    const ws = text.slice(afterNum).match(/^[ \t]*/)![0].length;
    const token = text.slice(afterNum + ws).match(/^([^\s,().;:!?]+)/);
    if (!token) continue;
    const unit = findUnit(token[1]!);
    if (!unit) continue;
    const value = parseNumberToken(m[1]!);
    if (Number.isNaN(value)) continue;
    const quantity: Quantity = { value, unit: unit.id };
    if (m[2]) {
      const rangeEnd = parseNumberToken(m[2]);
      if (!Number.isNaN(rangeEnd)) quantity.rangeEnd = rangeEnd;
    }
    out.push({ start: m.index, end: afterNum + ws + token[1]!.length, quantity });
  }
  return out;
}

export function parseIngredient(line: string): Ingredient {
  const raw = line.trim();
  let text = raw;

  // Pull out a parenthetical note anywhere in the line.
  let note: string | undefined;
  const noteMatch = text.match(/\(([^)]*)\)/);
  if (noteMatch) {
    note = noteMatch[1]!.trim() || undefined;
    text = (text.slice(0, noteMatch.index) + text.slice(noteMatch.index! + noteMatch[0].length)).trim();
  }

  // "sale q.b." / "pepper to taste"
  const qb = text.match(QB_RE);
  if (qb) {
    text = text.slice(0, qb.index).trim();
    note = note ? `${note}; q.b.` : "q.b.";
  }

  let quantity: Quantity | undefined;
  const qtyMatch = text.match(QTY_RE);
  if (qtyMatch && qtyMatch[0].trim().length > 0) {
    const value = parseNumberToken(qtyMatch[1]!);
    if (!Number.isNaN(value)) {
      quantity = { value };
      if (qtyMatch[2]) {
        const end = parseNumberToken(qtyMatch[2]);
        if (!Number.isNaN(end)) quantity.rangeEnd = end;
      }
      text = text.slice(qtyMatch[0].length);
    }
  }

  if (quantity) {
    const unitMatch = matchUnit(text);
    if (unitMatch) {
      quantity.unit = unitMatch[0];
      text = unitMatch[1].trim();
      text = text.replace(CONNECTOR_RE, "");
    }
  }

  const name = text.replace(/^[,\s]+|[,\s]+$/g, "");
  return { raw, quantity, name: name || raw, note };
}
