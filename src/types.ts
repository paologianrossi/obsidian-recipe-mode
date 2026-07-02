/** A parsed quantity: `1.5` in "1,5 l passata". */
export interface Quantity {
  value: number;
  /** Upper bound when the line gives a range ("2-3 uova"). */
  rangeEnd?: number;
  /** Canonical unit id from units.ts (e.g. "g", "tbsp"), if recognized. */
  unit?: string;
}

/** One ingredient line. `raw` is always preserved verbatim. */
export interface Ingredient {
  raw: string;
  quantity?: Quantity;
  name: string;
  /** Parenthetical note: "burro (a temperatura ambiente)". */
  note?: string;
}

/** Ingredients may be grouped under sub-headings ("Per la salsa"). */
export interface IngredientGroup {
  name?: string;
  items: Ingredient[];
}

export interface Step {
  text: string;
}

export interface Recipe {
  title: string;
  servings?: number;
  /** Minutes. */
  prepTime?: number;
  /** Minutes. */
  cookTime?: number;
  /** Minutes; derived from prep+cook when absent. */
  totalTime?: number;
  course?: string;
  cuisine?: string;
  source?: string;
  rating?: number;
  description?: string;
  image?: string;
  tags: string[];
  ingredients: IngredientGroup[];
  steps: Step[];
}

/** Flatten grouped ingredients into a single list. */
export function allIngredients(recipe: Recipe): Ingredient[] {
  return recipe.ingredients.flatMap((g) => g.items);
}
