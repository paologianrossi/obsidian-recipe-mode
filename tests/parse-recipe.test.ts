import { describe, expect, it } from "vitest";
import { parseFrontmatter, parseRecipe } from "../src/core/parse-recipe";
import { allIngredients } from "../src/types";

const PASTA_AL_FORNO = `---
tags: [recipe, primi]
servings: 4
prep_time: 20m
cook_time: 45m
cuisine: italian
source: https://example.com/pasta
---

# Pasta al forno

## Ingredienti
- 400 g pasta
- 2 cucchiai di olio d'oliva
- 1,5 l passata di pomodoro
- sale q.b.

## Preparazione
1. Preriscaldare il forno a 200 °C.
2. Cuocere la pasta molto al dente.
3. Infornare per 45 minuti.
`;

describe("parseFrontmatter", () => {
  it("parses inline arrays, numbers and strings", () => {
    const { frontmatter } = parseFrontmatter(PASTA_AL_FORNO);
    expect(frontmatter.tags).toEqual(["recipe", "primi"]);
    expect(frontmatter.servings).toBe(4);
    expect(frontmatter.source).toBe("https://example.com/pasta");
  });
  it("parses block lists", () => {
    const { frontmatter } = parseFrontmatter("---\ntags:\n  - recipe\n  - dolci\n---\nbody");
    expect(frontmatter.tags).toEqual(["recipe", "dolci"]);
  });
  it("no frontmatter → empty", () => {
    const { frontmatter, body } = parseFrontmatter("# Hello");
    expect(frontmatter).toEqual({});
    expect(body).toBe("# Hello");
  });
});

describe("parseRecipe — Italian recipe", () => {
  const r = parseRecipe(PASTA_AL_FORNO);
  it("title and meta", () => {
    expect(r.title).toBe("Pasta al forno");
    expect(r.servings).toBe(4);
    expect(r.prepTime).toBe(20);
    expect(r.cookTime).toBe(45);
    expect(r.totalTime).toBe(65);
    expect(r.tags).toContain("recipe");
  });
  it("ingredients parsed", () => {
    const items = allIngredients(r);
    expect(items).toHaveLength(4);
    expect(items[0]!.quantity?.value).toBe(400);
    expect(items[2]!.quantity?.value).toBe(1.5);
    expect(items[3]!.name).toBe("sale");
  });
  it("steps parsed", () => {
    expect(r.steps).toHaveLength(3);
    expect(r.steps[0]!.text).toContain("Preriscaldare");
  });
});

describe("parseRecipe — English + groups", () => {
  const md = `# Lasagna

## Ingredients

### For the sauce
- 1 lb ground beef
- 2 cans crushed tomatoes

### For the béchamel
- 4 tbsp butter
- 2 cups milk

## Directions

Brown the beef in a large pan.

Make the béchamel separately.
`;
  const r = parseRecipe(md);
  it("ingredient groups", () => {
    expect(r.ingredients).toHaveLength(2);
    expect(r.ingredients[0]!.name).toBe("For the sauce");
    expect(r.ingredients[1]!.name).toBe("For the béchamel");
    expect(r.ingredients[1]!.items[1]!.quantity?.unit).toBe("cup");
  });
  it("paragraph steps", () => {
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]!.text).toBe("Brown the beef in a large pan.");
  });
});

describe("parseRecipe — resilience", () => {
  it("no sections → empty lists, fallback title", () => {
    const r = parseRecipe("just some text", { fallbackTitle: "My note" });
    expect(r.title).toBe("My note");
    expect(r.ingredients).toHaveLength(0);
    expect(r.steps).toHaveLength(0);
  });
  it("checkbox list items are cleaned", () => {
    const r = parseRecipe("# X\n\n## Ingredients\n- [ ] 100 g flour\n");
    expect(allIngredients(r)[0]!.name).toBe("flour");
  });
  it("stops the section at the next same-level heading", () => {
    const r = parseRecipe("# X\n\n## Ingredients\n- 1 egg\n\n## Notes\n- not an ingredient\n");
    expect(allIngredients(r)).toHaveLength(1);
  });
  it("italian time strings in frontmatter", () => {
    const r = parseRecipe('---\nprep_time: "1 ora e 30 minuti"\n---\n# X');
    expect(r.prepTime).toBe(90);
  });
});
