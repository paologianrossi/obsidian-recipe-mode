import { describe, expect, it } from "vitest";
import { parseIngredient } from "../src/core/parse-ingredient";
import { formatIngredient, formatQuantity, formatValue, roundSensible, servingsFactor } from "../src/core/scale";

describe("servingsFactor", () => {
  it("computes ratio", () => {
    expect(servingsFactor(4, 6)).toBe(1.5);
    expect(servingsFactor(4, 2)).toBe(0.5);
  });
  it("defaults to 1 without base servings", () => {
    expect(servingsFactor(undefined, 6)).toBe(1);
  });
});

describe("roundSensible", () => {
  it("rounds by magnitude", () => {
    expect(roundSensible(1333.33)).toBe(1330);
    expect(roundSensible(473.176)).toBe(473);
    expect(roundSensible(33.333)).toBe(33.3);
    expect(roundSensible(0.666)).toBe(0.67);
  });
});

describe("formatValue", () => {
  it("uses vulgar fractions when preferred", () => {
    expect(formatValue(0.5, "en", true)).toBe("½");
    expect(formatValue(1.5, "en", true)).toBe("1½");
    expect(formatValue(0.75, "en", true)).toBe("¾");
    expect(formatValue(2 / 3, "en", true)).toBe("⅔");
  });
  it("locale decimal separator", () => {
    expect(formatValue(1.5, "it", false)).toBe("1,5");
    expect(formatValue(1.5, "en", false)).toBe("1.5");
  });
});

describe("formatIngredient", () => {
  it("scales and formats metric", () => {
    const i = parseIngredient("400 g pasta");
    expect(formatIngredient(i, 1.5, { locale: "it" })).toBe("600 g pasta");
  });
  it("scales spoons with fractions", () => {
    const i = parseIngredient("2 cucchiai di olio d'oliva");
    expect(formatIngredient(i, 0.75, { locale: "it" })).toBe("1½ cucchiai olio d'oliva");
  });
  it("keeps notes and q.b. lines unscaled", () => {
    const i = parseIngredient("sale q.b.");
    expect(formatIngredient(i, 2, { locale: "it" })).toBe("sale (q.b.)");
  });
  it("scales ranges", () => {
    const i = parseIngredient("2-3 tbsp olive oil");
    expect(formatIngredient(i, 2, { locale: "en" })).toBe("4–6 tbsp olive oil");
  });
  it("converts to imperial on request", () => {
    const i = parseIngredient("500 ml milk");
    const out = formatIngredient(i, 1, { locale: "en", targetSystem: "imperial" });
    expect(out).toMatch(/(cup|pint)/);
  });
  it("singular vs plural unit display", () => {
    const one = parseIngredient("1 tazza di latte");
    expect(formatQuantity(one.quantity!, { locale: "it" })).toBe("1 tazza");
    const two = parseIngredient("2 tazze di latte");
    expect(formatQuantity(two.quantity!, { locale: "it" })).toBe("2 tazze");
  });
});
