/**
 * Parse a markdown note (frontmatter + body) into a Recipe.
 * Pure module — own minimal YAML-subset parser so it is testable without Obsidian.
 * At runtime the plugin may pass pre-parsed frontmatter from Obsidian's metadataCache.
 */

import type { Ingredient, IngredientGroup, Recipe, Step } from "../types";
import { parseDuration } from "./duration";
import { parseIngredient } from "./parse-ingredient";

export interface ParseOptions {
  /** Fallback title when the note has no H1 (usually the filename). */
  fallbackTitle?: string;
  /** Heading names (lowercase) that mark the ingredients section. */
  ingredientHeadings?: string[];
  /** Heading names (lowercase) that mark the steps section. */
  stepHeadings?: string[];
  /** Pre-parsed frontmatter (from Obsidian metadataCache); skips internal parsing. */
  frontmatter?: Record<string, unknown>;
}

export const DEFAULT_INGREDIENT_HEADINGS = ["ingredients", "ingredienti"];
export const DEFAULT_STEP_HEADINGS = [
  "steps", "directions", "instructions", "method", "preparation",
  "preparazione", "procedimento", "istruzioni", "esecuzione",
];

/** Minimal YAML subset: `key: value`, inline arrays, block lists, quoted strings. */
export function parseFrontmatter(md: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontmatter: {}, body: md };

  const fm: Record<string, unknown> = {};
  const lines = m[1]!.split(/\r?\n/);
  let currentKey: string | undefined;
  for (const line of lines) {
    const listItem = line.match(/^\s+-\s*(.*)$/);
    if (listItem && currentKey) {
      const arr = (fm[currentKey] as unknown[]) ?? [];
      arr.push(parseScalar(listItem[1]!));
      fm[currentKey] = arr;
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1]!;
    const rawVal = kv[2]!.trim();
    if (rawVal === "") {
      currentKey = key;
      fm[key] = fm[key] ?? [];
    } else {
      currentKey = undefined;
      fm[key] = parseScalar(rawVal);
    }
  }
  return { frontmatter: fm, body: md.slice(m[0].length) };
}

function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    return inner === "" ? [] : inner.split(",").map((x) => parseScalar(x));
  }
  const unquoted = s.replace(/^["']|["']$/g, "");
  if (/^-?\d+(\.\d+)?$/.test(unquoted)) return parseFloat(unquoted);
  if (unquoted === "true") return true;
  if (unquoted === "false") return false;
  return unquoted;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const m = v.match(/\d+(?:[.,]\d+)?/);
    if (m) return parseFloat(m[0].replace(",", "."));
  }
  return undefined;
}

function asTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).replace(/^#/, ""));
  if (typeof v === "string") return v.split(/[,\s]+/).filter(Boolean).map((x) => x.replace(/^#/, ""));
  return [];
}

function pick(fm: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (fm[k] !== undefined) return fm[k];
  }
  return undefined;
}

interface Section {
  kind: "ingredients" | "steps";
  level: number;
  lines: string[];
}

export function parseRecipe(md: string, opts: ParseOptions = {}): Recipe {
  const ingredientHeadings = opts.ingredientHeadings ?? DEFAULT_INGREDIENT_HEADINGS;
  const stepHeadings = opts.stepHeadings ?? DEFAULT_STEP_HEADINGS;

  let frontmatter: Record<string, unknown>;
  let body: string;
  if (opts.frontmatter) {
    frontmatter = opts.frontmatter;
    body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  } else {
    ({ frontmatter, body } = parseFrontmatter(md));
  }

  const lines = body.split(/\r?\n/);

  let title: string | undefined;
  const sections: Section[] = [];
  let current: Section | undefined;

  const headingKind = (text: string): Section["kind"] | undefined => {
    const t = text.toLowerCase().replace(/[:.]+$/, "").trim();
    if (ingredientHeadings.some((h) => t === h || t.startsWith(h + " "))) return "ingredients";
    if (stepHeadings.some((h) => t === h || t.startsWith(h + " "))) return "steps";
    return undefined;
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1]!.length;
      const text = heading[2]!.trim();
      if (level === 1 && !title) title = text;
      const kind = headingKind(text);
      if (kind) {
        current = { kind, level, lines: [] };
        sections.push(current);
        continue;
      }
      // A heading at the same or higher level ends the current section;
      // a deeper heading inside it becomes a group marker line.
      if (current) {
        if (level <= current.level) current = undefined;
        else current.lines.push(line);
      }
      continue;
    }
    current?.lines.push(line);
  }

  const ingredients: IngredientGroup[] = [];
  const steps: Step[] = [];

  for (const section of sections) {
    if (section.kind === "ingredients") parseIngredientSection(section, ingredients);
    else parseStepSection(section, steps);
  }

  const prepTime = parseDuration(asString(pick(frontmatter, "prep_time", "prepTime", "prep")) ?? asNumber(pick(frontmatter, "prep_time", "prepTime", "prep")));
  const cookTime = parseDuration(asString(pick(frontmatter, "cook_time", "cookTime", "cook")) ?? asNumber(pick(frontmatter, "cook_time", "cookTime", "cook")));
  const explicitTotal = parseDuration(asString(pick(frontmatter, "total_time", "totalTime")) ?? asNumber(pick(frontmatter, "total_time", "totalTime")));
  const totalTime =
    explicitTotal ?? (prepTime !== undefined || cookTime !== undefined ? (prepTime ?? 0) + (cookTime ?? 0) : undefined);

  return {
    title: title ?? opts.fallbackTitle ?? "Untitled recipe",
    servings: asNumber(pick(frontmatter, "servings", "serves", "porzioni", "yield")),
    prepTime,
    cookTime,
    totalTime,
    course: asString(pick(frontmatter, "course", "portata")),
    cuisine: asString(pick(frontmatter, "cuisine", "cucina")),
    source: asString(pick(frontmatter, "source", "url", "fonte")),
    rating: asNumber(pick(frontmatter, "rating", "voto")),
    description: asString(pick(frontmatter, "description", "descrizione")),
    image: asString(pick(frontmatter, "image", "immagine")),
    tags: asTags(pick(frontmatter, "tags", "tag")),
    ingredients,
    steps,
  };
}

function parseIngredientSection(section: Section, groups: IngredientGroup[]): void {
  let group: IngredientGroup | undefined;
  const ensureGroup = (): IngredientGroup => {
    if (!group) {
      group = { items: [] };
      groups.push(group);
    }
    return group;
  };

  for (const line of section.lines) {
    // sub-heading or bold-only line starts a named group
    const sub = line.match(/^#{2,6}\s+(.*)$/) ?? line.match(/^\*\*(.+)\*\*:?\s*$/);
    if (sub) {
      group = { name: sub[1]!.replace(/[:.]+$/, "").trim(), items: [] };
      groups.push(group);
      continue;
    }
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      // strip a task checkbox if present: "- [ ] 200 g farina"
      const text = item[1]!.replace(/^\[.\]\s+/, "");
      ensureGroup().items.push(parseIngredient(text));
    }
  }
}

function parseStepSection(section: Section, steps: Step[]): void {
  let pendingParagraph: string[] = [];
  const flushParagraph = () => {
    const text = pendingParagraph.join(" ").trim();
    if (text) steps.push({ text });
    pendingParagraph = [];
  };

  let sawListItems = false;
  for (const line of section.lines) {
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      flushParagraph();
      sawListItems = true;
      steps.push({ text: item[1]!.replace(/^\[.\]\s+/, "").trim() });
      continue;
    }
    if (/^\s*$/.test(line)) {
      if (!sawListItems) flushParagraph();
      continue;
    }
    if (sawListItems && /^\s+/.test(line) && steps.length > 0) {
      // indented continuation of the previous list item
      steps[steps.length - 1]!.text += " " + line.trim();
      continue;
    }
    if (!sawListItems && !/^#{1,6}\s/.test(line)) pendingParagraph.push(line.trim());
  }
  if (!sawListItems) flushParagraph();
}

/** True when the note carries the recipe tag (frontmatter or inline already merged by caller). */
export function isRecipeNote(tags: string[], recipeTag: string): boolean {
  const want = recipeTag.replace(/^#/, "").toLowerCase();
  return tags.some((t) => t.replace(/^#/, "").toLowerCase() === want);
}
