/** Serialize a Recipe back into the note format (frontmatter + markdown). Pure module. */

import type { Recipe } from "../types";
import { formatDuration } from "./duration";

export interface ToMarkdownOptions {
  /** Section-heading language. */
  locale: "en" | "it";
  /** Tag marking recipe notes. */
  recipeTag: string;
}

const HEADINGS = {
  en: { ingredients: "Ingredients", steps: "Steps" },
  it: { ingredients: "Ingredienti", steps: "Preparazione" },
};

function yamlEscape(s: string): string {
  return /[:#\[\]{}"'\n]/.test(s) ? JSON.stringify(s) : s;
}

export function recipeToMarkdown(recipe: Recipe, opts: ToMarkdownOptions): string {
  const h = HEADINGS[opts.locale];
  const lines: string[] = ["---"];

  const tags = [...new Set([opts.recipeTag, ...recipe.tags])];
  lines.push(`tags: [${tags.join(", ")}]`);
  if (recipe.servings !== undefined) lines.push(`servings: ${recipe.servings}`);
  if (recipe.prepTime !== undefined) lines.push(`prep_time: ${formatDuration(recipe.prepTime)}`);
  if (recipe.cookTime !== undefined) lines.push(`cook_time: ${formatDuration(recipe.cookTime)}`);
  if (
    recipe.totalTime !== undefined &&
    recipe.totalTime !== (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)
  )
    lines.push(`total_time: ${formatDuration(recipe.totalTime)}`);
  if (recipe.course) lines.push(`course: ${yamlEscape(recipe.course)}`);
  if (recipe.cuisine) lines.push(`cuisine: ${yamlEscape(recipe.cuisine)}`);
  if (recipe.source) lines.push(`source: ${yamlEscape(recipe.source)}`);
  if (recipe.rating !== undefined) lines.push(`rating: ${recipe.rating}`);
  if (recipe.image) lines.push(`image: ${yamlEscape(recipe.image)}`);
  if (recipe.description) lines.push(`description: ${yamlEscape(recipe.description)}`);
  lines.push("---", "", `# ${recipe.title}`, "");

  lines.push(`## ${h.ingredients}`, "");
  for (const group of recipe.ingredients) {
    if (group.name) lines.push(`### ${group.name}`, "");
    for (const ing of group.items) lines.push(`- ${ing.raw}`);
    lines.push("");
  }
  if (recipe.ingredients.length === 0) lines.push("- ", "");

  lines.push(`## ${h.steps}`, "");
  recipe.steps.forEach((step, i) => lines.push(`${i + 1}. ${step.text}`));
  if (recipe.steps.length === 0) lines.push("1. ", "");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}
