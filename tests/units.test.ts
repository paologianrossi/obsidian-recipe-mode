import { describe, expect, it } from "vitest";
import { convert, findUnit, toSystem } from "../src/core/units";

describe("findUnit", () => {
  it("resolves EN and IT aliases to the same unit", () => {
    expect(findUnit("tablespoon")?.id).toBe("tbsp");
    expect(findUnit("cucchiai")?.id).toBe("tbsp");
    expect(findUnit("Grammi")?.id).toBe("g");
    expect(findUnit("gr.")?.id).toBe("g");
  });
  it("returns undefined for non-units", () => {
    expect(findUnit("farina")).toBeUndefined();
  });
});

describe("convert", () => {
  it("metric mass", () => {
    expect(convert(1.5, "kg", "g")).toBe(1500);
    expect(convert(250, "g", "kg")).toBe(0.25);
  });
  it("etto = 100 g", () => {
    expect(convert(2, "etto", "g")).toBe(200);
  });
  it("volume across systems", () => {
    expect(convert(1, "cup", "ml")).toBeCloseTo(236.6, 1);
    expect(convert(3, "tsp", "tbsp")).toBeCloseTo(1, 1);
  });
  it("refuses cross-kind conversion", () => {
    expect(convert(1, "g", "ml")).toBeUndefined();
  });
  it("refuses count units", () => {
    expect(convert(1, "pinch", "g")).toBeUndefined();
  });
});

describe("toSystem", () => {
  it("imperial mass → metric", () => {
    const r = toSystem(1, "lb", "metric");
    expect(r?.unit).toBe("g");
    expect(r?.value).toBeCloseTo(453.6, 0);
  });
  it("metric volume → imperial picks a sane unit", () => {
    const r = toSystem(500, "ml", "imperial");
    expect(r).toBeDefined();
    expect(["cup", "pint"]).toContain(r!.unit);
  });
  it("no-op when already in system", () => {
    expect(toSystem(100, "g", "metric")).toBeUndefined();
  });
  it("neutral units (spoons) stay put", () => {
    expect(toSystem(2, "tbsp", "metric")).toBeUndefined();
  });
});
