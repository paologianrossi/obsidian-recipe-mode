import { describe, expect, it } from "vitest";
import { matchQuantityPrefix, parseIngredient, parseNumberToken } from "../src/core/parse-ingredient";

describe("parseNumberToken", () => {
  it("parses integers and decimals", () => {
    expect(parseNumberToken("2")).toBe(2);
    expect(parseNumberToken("1.5")).toBe(1.5);
    expect(parseNumberToken("1,5")).toBe(1.5);
  });
  it("parses fractions", () => {
    expect(parseNumberToken("1/2")).toBe(0.5);
    expect(parseNumberToken("1 1/2")).toBe(1.5);
    expect(parseNumberToken("½")).toBe(0.5);
    expect(parseNumberToken("1½")).toBe(1.5);
    expect(parseNumberToken("¾")).toBe(0.75);
  });
});

describe("parseIngredient — English", () => {
  it("qty unit name", () => {
    const i = parseIngredient("2 cups flour");
    expect(i.quantity).toEqual({ value: 2, rangeEnd: undefined, unit: "cup" });
    expect(i.name).toBe("flour");
  });
  it("mass units", () => {
    const i = parseIngredient("400 g pasta");
    expect(i.quantity?.unit).toBe("g");
    expect(i.quantity?.value).toBe(400);
    expect(i.name).toBe("pasta");
  });
  it("fraction quantity", () => {
    const i = parseIngredient("1/2 tsp salt");
    expect(i.quantity?.value).toBe(0.5);
    expect(i.quantity?.unit).toBe("tsp");
    expect(i.name).toBe("salt");
  });
  it("unicode mixed fraction", () => {
    const i = parseIngredient("1½ cups sugar");
    expect(i.quantity?.value).toBe(1.5);
    expect(i.quantity?.unit).toBe("cup");
  });
  it("no unit — count", () => {
    const i = parseIngredient("3 eggs");
    expect(i.quantity?.value).toBe(3);
    expect(i.quantity?.unit).toBeUndefined();
    expect(i.name).toBe("eggs");
  });
  it("range", () => {
    const i = parseIngredient("2-3 tbsp olive oil");
    expect(i.quantity?.value).toBe(2);
    expect(i.quantity?.rangeEnd).toBe(3);
    expect(i.quantity?.unit).toBe("tbsp");
  });
  it("parenthetical note", () => {
    const i = parseIngredient("100 g butter (softened)");
    expect(i.name).toBe("butter");
    expect(i.note).toBe("softened");
  });
  it("to taste", () => {
    const i = parseIngredient("black pepper to taste");
    expect(i.name).toBe("black pepper");
    expect(i.note).toBe("q.b.");
    expect(i.quantity).toBeUndefined();
  });
  it("multiword unit", () => {
    const i = parseIngredient("8 fl oz milk");
    expect(i.quantity?.unit).toBe("floz");
    expect(i.name).toBe("milk");
  });
});

describe("parseIngredient — Italiano", () => {
  it("cucchiai + connector di", () => {
    const i = parseIngredient("2 cucchiai di olio d'oliva");
    expect(i.quantity).toEqual({ value: 2, rangeEnd: undefined, unit: "tbsp" });
    expect(i.name).toBe("olio d'oliva");
  });
  it("decimal comma", () => {
    const i = parseIngredient("1,5 l passata di pomodoro");
    expect(i.quantity?.value).toBe(1.5);
    expect(i.quantity?.unit).toBe("l");
    expect(i.name).toBe("passata di pomodoro");
  });
  it("etti", () => {
    const i = parseIngredient("2 etti di prosciutto crudo");
    expect(i.quantity?.unit).toBe("etto");
    expect(i.name).toBe("prosciutto crudo");
  });
  it("spicchio d'aglio", () => {
    const i = parseIngredient("1 spicchio d'aglio");
    expect(i.quantity?.unit).toBe("clove");
    expect(i.name).toBe("aglio");
  });
  it("q.b.", () => {
    const i = parseIngredient("sale q.b.");
    expect(i.name).toBe("sale");
    expect(i.note).toBe("q.b.");
  });
  it("quanto basta", () => {
    const i = parseIngredient("pepe quanto basta");
    expect(i.name).toBe("pepe");
    expect(i.note).toBe("q.b.");
  });
  it("range con 'o'", () => {
    const i = parseIngredient("2 o 3 uova");
    expect(i.quantity?.value).toBe(2);
    expect(i.quantity?.rangeEnd).toBe(3);
    expect(i.name).toBe("uova");
  });
  it("grammi spelled out", () => {
    const i = parseIngredient("300 grammi di farina 00");
    expect(i.quantity?.unit).toBe("g");
    expect(i.name).toBe("farina 00");
  });
});

describe("matchQuantityPrefix", () => {
  it("splits qty+unit from the name, preserving raw text", () => {
    expect(matchQuantityPrefix("1,5 l passata di pomodoro")).toEqual({
      prefix: "1,5 l",
      rest: " passata di pomodoro",
    });
    expect(matchQuantityPrefix("2 cucchiai di olio")).toEqual({ prefix: "2 cucchiai", rest: " di olio" });
  });
  it("qty only when there is no unit", () => {
    expect(matchQuantityPrefix("3 uova")).toEqual({ prefix: "3 ", rest: "uova" });
  });
  it("undefined for unquantified lines", () => {
    expect(matchQuantityPrefix("sale q.b.")).toBeUndefined();
  });
});

describe("parseIngredient — resilience", () => {
  it("keeps unparseable lines intact", () => {
    const i = parseIngredient("una manciata abbondante di rucola");
    expect(i.name).toBe("una manciata abbondante di rucola");
    expect(i.raw).toBe("una manciata abbondante di rucola");
    expect(i.quantity).toBeUndefined();
  });
  it("never returns an empty name", () => {
    const i = parseIngredient("2");
    expect(i.name).not.toBe("");
  });
  it("unit word at end of line stays in the name", () => {
    // "3 uova" — "uova" is not a unit; but also "1 tazza" alone keeps text
    const i = parseIngredient("1 tazza");
    expect(i.name).toBe("tazza");
    expect(i.quantity?.unit).toBeUndefined();
  });
});
