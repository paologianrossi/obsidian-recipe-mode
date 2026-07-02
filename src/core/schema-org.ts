/**
 * Extract a schema.org Recipe from a web page's HTML (JSON-LD first,
 * microdata fallback) and map it onto our Recipe model. Pure module.
 */

import type { Recipe, Step } from "../types";
import { parseDuration } from "./duration";
import { parseIngredient } from "./parse-ingredient";

type Json = Record<string, unknown>;

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  agrave: "à", egrave: "è", eacute: "é", igrave: "ì", ograve: "ò", ugrave: "ù",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** All parseable JSON-LD blocks in the page. */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(m[1]!.trim()));
    } catch {
      // Some sites ship broken JSON-LD; skip the block.
    }
  }
  return out;
}

function isType(node: Json, type: string): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase() === type.toLowerCase();
  if (Array.isArray(t)) return t.some((x) => String(x).toLowerCase() === type.toLowerCase());
  return false;
}

/** Depth-first search for a Recipe node in arrays / @graph / mainEntity nesting. */
export function findRecipeNode(data: unknown): Json | undefined {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return undefined;
  }
  if (data && typeof data === "object") {
    const node = data as Json;
    if (isType(node, "Recipe")) return node;
    for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
      if (node[key] !== undefined) {
        const found = findRecipeNode(node[key]);
        if (found) return found;
      }
    }
  }
  return undefined;
}

function asText(v: unknown): string | undefined {
  if (typeof v === "string") return decodeEntities(v.replace(/<[^>]*>/g, "")).trim() || undefined;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return asText(v[0]);
  if (v && typeof v === "object") {
    const o = v as Json;
    return asText(o["name"] ?? o["text"] ?? o["url"] ?? o["@id"]);
  }
  return undefined;
}

function yieldToServings(v: unknown): number | undefined {
  const s = asText(v);
  if (!s) return undefined;
  const m = s.match(/\d+/);
  return m ? parseInt(m[0]) : undefined;
}

function imageUrl(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return imageUrl(v[0]);
  if (v && typeof v === "object") {
    const o = v as Json;
    return imageUrl(o["url"] ?? o["contentUrl"]);
  }
  return undefined;
}

function instructionsToSteps(v: unknown, out: Step[]): void {
  if (typeof v === "string") {
    // Single blob: turn HTML breaks into newlines, strip tags, then one step per line.
    const withBreaks = v.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div)>/gi, "\n");
    const plain = decodeEntities(withBreaks.replace(/<[^>]*>/g, " "));
    for (const p of plain.split(/\r?\n+/)) {
      const text = p.replace(/^\s*\d+[.)]\s*/, "").replace(/\s+/g, " ").trim();
      if (text) out.push({ text });
    }
    return;
  }
  if (Array.isArray(v)) {
    for (const item of v) instructionsToSteps(item, out);
    return;
  }
  if (v && typeof v === "object") {
    const node = v as Json;
    if (isType(node, "HowToSection")) {
      instructionsToSteps(node["itemListElement"], out);
      return;
    }
    const text = asText(node["text"] ?? node["name"]);
    if (text) out.push({ text });
  }
}

/** Map a schema.org Recipe node onto our model. */
export function schemaToRecipe(node: Json, sourceUrl?: string): Recipe {
  const ingredients = (
    Array.isArray(node["recipeIngredient"])
      ? node["recipeIngredient"]
      : Array.isArray(node["ingredients"])
        ? node["ingredients"]
        : []
  )
    .map((x) => asText(x))
    .filter((x): x is string => !!x)
    .map((line) => parseIngredient(line));

  const steps: Step[] = [];
  instructionsToSteps(node["recipeInstructions"], steps);

  const prepTime = parseDuration(asText(node["prepTime"]));
  const cookTime = parseDuration(asText(node["cookTime"]));
  const explicitTotal = parseDuration(asText(node["totalTime"]));

  return {
    title: asText(node["name"]) ?? "Imported recipe",
    servings: yieldToServings(node["recipeYield"] ?? node["yield"]),
    prepTime,
    cookTime,
    totalTime:
      explicitTotal ??
      (prepTime !== undefined || cookTime !== undefined ? (prepTime ?? 0) + (cookTime ?? 0) : undefined),
    course: asText(node["recipeCategory"]),
    cuisine: asText(node["recipeCuisine"]),
    source: sourceUrl ?? asText(node["url"] ?? node["mainEntityOfPage"]),
    description: asText(node["description"]),
    image: imageUrl(node["image"]),
    tags: [],
    ingredients: ingredients.length > 0 ? [{ items: ingredients }] : [],
    steps,
  };
}

/** Microdata fallback: scrape itemprop attributes when there is no JSON-LD. */
export function microdataToRecipe(html: string, sourceUrl?: string): Recipe | undefined {
  const prop = (name: string): string[] => {
    const out: string[] = [];
    const re = new RegExp(
      `itemprop\\s*=\\s*["']${name}["'][^>]*(?:content\\s*=\\s*["']([^"']*)["'][^>]*)?>([^<]*)`,
      "gi",
    );
    for (const m of html.matchAll(re)) {
      const text = (m[1] ?? m[2] ?? "").trim();
      if (text) out.push(decodeEntities(text));
    }
    // content attr can come before itemprop
    const re2 = new RegExp(`content\\s*=\\s*["']([^"']*)["'][^>]*itemprop\\s*=\\s*["']${name}["']`, "gi");
    for (const m of html.matchAll(re2)) {
      if (m[1]!.trim()) out.push(decodeEntities(m[1]!.trim()));
    }
    return out;
  };

  const ingredientLines = [...prop("recipeIngredient"), ...prop("ingredients")];
  if (ingredientLines.length === 0) return undefined;

  const prepTime = parseDuration(prop("prepTime")[0]);
  const cookTime = parseDuration(prop("cookTime")[0]);
  return {
    title: prop("name")[0] ?? "Imported recipe",
    servings: yieldToServings(prop("recipeYield")[0]),
    prepTime,
    cookTime,
    totalTime:
      parseDuration(prop("totalTime")[0]) ??
      (prepTime !== undefined || cookTime !== undefined ? (prepTime ?? 0) + (cookTime ?? 0) : undefined),
    source: sourceUrl,
    tags: [],
    ingredients: [{ items: ingredientLines.map((l) => parseIngredient(l)) }],
    steps: prop("recipeInstructions").map((text) => ({ text })),
  };
}

/** Full pipeline: HTML → Recipe (JSON-LD, then microdata). Undefined when nothing found. */
export function htmlToRecipe(html: string, sourceUrl?: string): Recipe | undefined {
  for (const block of extractJsonLd(html)) {
    const node = findRecipeNode(block);
    if (node) return schemaToRecipe(node, sourceUrl);
  }
  return microdataToRecipe(html, sourceUrl);
}
