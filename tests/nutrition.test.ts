// tests/nutrition.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseNutrition } from "../src/nutrition.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (n: string) => JSON.parse(readFileSync(join(here, "fixtures/nutrition", n), "utf8"));

describe("parseNutrition", () => {
  it("normalizes the Oatly drink (per 100ml, split energy, micros)", () => {
    const n = parseNutrition(fixture("oatly-barista.json"))!;
    expect(n.basis).toBe("per_100ml");
    expect(n.macros).toMatchObject({
      energyKj: 257, energyKcal: 61, fat: 3.0, saturates: 0.3,
      carbs: 7.1, sugars: 3.4, fibre: 0.8, protein: 1.1, salt: 0.10,
    });
    expect(n.micros).toContainEqual({ name: "Vitamin B12", amount: 0.38, unit: "µg", nrvPercent: 15 });
    expect(n.micros).toContainEqual({ name: "Calcium", amount: 120, unit: "mg", nrvPercent: 15 });
    expect(n.micros).toHaveLength(5);
  });

  it("normalizes the chicken (per 100g, inline energy, no micros, value2 columns)", () => {
    const n = parseNutrition(fixture("chicken-breast.json"))!;
    expect(n.basis).toBe("per_100g");
    expect(n.macros).toMatchObject({
      energyKj: 486, energyKcal: 115, fat: 3.3, saturates: 0.8,
      carbs: 0, sugars: 0, fibre: 0, protein: 21.5, salt: 0.18,
    });
    expect(n.micros).toHaveLength(0);
  });

  it("returns null for empty/invalid input", () => {
    expect(parseNutrition(fixture("empty.json"))).toBeNull();
    expect(parseNutrition(null as unknown as unknown[])).toBeNull();
  });

  it("preserves the raw rows", () => {
    const rows = fixture("oatly-barista.json");
    expect(parseNutrition(rows)!.raw).toEqual(rows);
  });
});
