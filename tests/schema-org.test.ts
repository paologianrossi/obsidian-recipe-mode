import { describe, expect, it } from "vitest";
import { decodeEntities, extractJsonLd, findRecipeNode, htmlToRecipe } from "../src/core/schema-org";
import { allIngredients } from "../src/types";

const JSONLD_SIMPLE = `<!doctype html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Classic Tiramisu",
  "recipeYield": "6 servings",
  "prepTime": "PT30M",
  "cookTime": "PT0M",
  "recipeCategory": "Dessert",
  "recipeCuisine": "Italian",
  "description": "The real deal &amp; no shortcuts.",
  "image": ["https://example.com/tiramisu.jpg"],
  "recipeIngredient": ["500 g mascarpone", "4 eggs", "300 g savoiardi", "1 cup espresso"],
  "recipeInstructions": [
    {"@type": "HowToStep", "text": "Separate the eggs."},
    {"@type": "HowToStep", "text": "Whip the yolks with sugar."}
  ]
}
</script></head><body></body></html>`;

const JSONLD_GRAPH = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {"@type": "WebSite", "name": "Food Blog"},
    {"@type": ["Recipe", "NewsArticle"],
     "name": "Rag\\u00f9 alla bolognese",
     "recipeYield": 8,
     "totalTime": "PT3H",
     "recipeIngredient": ["300 g macinato di manzo"],
     "recipeInstructions": "1. Soffriggere.\\n2. Aggiungere la carne."}
  ]
}
</script>`;

const MICRODATA = `<html><body itemscope itemtype="https://schema.org/Recipe">
<h1 itemprop="name">Pancakes</h1>
<span itemprop="recipeYield">4</span>
<li itemprop="recipeIngredient">2 cups flour</li>
<li itemprop="recipeIngredient">2 eggs</li>
<p itemprop="recipeInstructions">Mix and fry.</p>
</body></html>`;

describe("decodeEntities", () => {
  it("handles named, decimal and hex entities", () => {
    expect(decodeEntities("Fish &amp; chips &#233; &#xe0;")).toBe("Fish & chips é à");
  });
});

describe("extractJsonLd", () => {
  it("finds and parses blocks, skipping broken ones", () => {
    const html = `<script type="application/ld+json">{bad json}</script>` + JSONLD_SIMPLE;
    expect(extractJsonLd(html)).toHaveLength(1);
  });
});

describe("findRecipeNode", () => {
  it("finds a recipe in @graph with array @type", () => {
    const node = findRecipeNode(extractJsonLd(JSONLD_GRAPH)[0]);
    expect(node?.["name"]).toBe("Ragù alla bolognese");
  });
});

describe("htmlToRecipe", () => {
  it("maps a simple JSON-LD recipe", () => {
    const r = htmlToRecipe(JSONLD_SIMPLE, "https://example.com/tiramisu")!;
    expect(r.title).toBe("Classic Tiramisu");
    expect(r.servings).toBe(6);
    expect(r.prepTime).toBe(30);
    expect(r.course).toBe("Dessert");
    expect(r.cuisine).toBe("Italian");
    expect(r.description).toBe("The real deal & no shortcuts.");
    expect(r.image).toBe("https://example.com/tiramisu.jpg");
    expect(r.source).toBe("https://example.com/tiramisu");
    expect(allIngredients(r)).toHaveLength(4);
    expect(allIngredients(r)[0]!.quantity?.value).toBe(500);
    expect(r.steps.map((s) => s.text)).toEqual(["Separate the eggs.", "Whip the yolks with sugar."]);
  });

  it("handles @graph + string instructions with numbering", () => {
    const r = htmlToRecipe(JSONLD_GRAPH)!;
    expect(r.title).toBe("Ragù alla bolognese");
    expect(r.servings).toBe(8);
    expect(r.totalTime).toBe(180);
    expect(r.steps.map((s) => s.text)).toEqual(["Soffriggere.", "Aggiungere la carne."]);
  });

  it("falls back to microdata", () => {
    const r = htmlToRecipe(MICRODATA, "https://example.com/pancakes")!;
    expect(r.title).toBe("Pancakes");
    expect(r.servings).toBe(4);
    expect(allIngredients(r)).toHaveLength(2);
    expect(allIngredients(r)[0]!.quantity?.unit).toBe("cup");
    expect(r.steps[0]!.text).toBe("Mix and fry.");
  });

  it("returns undefined when the page has no recipe", () => {
    expect(htmlToRecipe("<html><body><p>hello</p></body></html>")).toBeUndefined();
  });
});
