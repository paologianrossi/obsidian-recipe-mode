import { describe, expect, it } from "vitest";
import { aggregateIngredients, shoppingListMarkdown } from "../src/core/aggregate";
import { parseRecipe } from "../src/core/parse-recipe";

const A = parseRecipe(`# Pasta
## Ingredients
- 400 g pasta
- 2 cloves garlic
- 1 tbsp olive oil
- salt to taste
`);

const B = parseRecipe(`# Risotto
## Ingredients
- 0.3 kg pasta
- 1 clove garlic
- 2 tbsp olive oil
`);

describe("aggregateIngredients", () => {
  const items = aggregateIngredients([{ recipe: A }, { recipe: B }]);
  const find = (name: string) => items.find((i) => i.name.toLowerCase().includes(name))!;

  it("merges convertible mass units into the largest unit", () => {
    const pasta = find("pasta");
    expect(pasta.total).toEqual({ value: 0.7, unit: "kg" });
  });
  it("merges same count units", () => {
    const garlic = find("garlic");
    expect(garlic.total).toEqual({ value: 3, unit: "clove" });
  });
  it("merges spoons", () => {
    const oil = find("olive oil");
    expect(oil.total).toEqual({ value: 3, unit: "tbsp" });
  });
  it("keeps quantity-less items", () => {
    const salt = find("salt");
    expect(salt.total).toBeUndefined();
    expect(salt.parts).toHaveLength(1);
  });
  it("applies scale factors", () => {
    const doubled = aggregateIngredients([{ recipe: A, factor: 2 }]);
    expect(doubled.find((i) => i.name === "pasta")!.total!.value).toBe(800);
  });
  it("sorts alphabetically", () => {
    const names = items.map((i) => i.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });
});

describe("shoppingListMarkdown", () => {
  it("renders checkboxes with merged totals", () => {
    const md = shoppingListMarkdown(aggregateIngredients([{ recipe: A }, { recipe: B }]), "en");
    expect(md).toContain("- [ ] 0.7 kg pasta");
    expect(md).toContain("- [ ] 3 cloves garlic");
    expect(md).toContain("- [ ] salt to taste");
  });
});
