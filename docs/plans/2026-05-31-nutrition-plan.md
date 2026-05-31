# Nutrition Normalization + Filtered Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize Tesco's raw on-pack nutrition rows into a typed macros+micros model, expose it across SDK/CLI/MCP, and add nutrition-filtered search.

**Architecture:** A new pure module `src/nutrition.ts` holds the normalizer (`parseNutrition`) and the pure filter (`filterByNutrition`). `parseProductNode` populates `Product.nutrition` with the normalized object. The client gains `searchByNutrition` (keyword search → bounded hydration of each result's nutrition → `filterByNutrition`). CLI and MCP expose both lookup and filtered search.

**Tech Stack:** TypeScript (ESM, NodeNext), vitest, commander (CLI), `@modelcontextprotocol/sdk` (MCP). All parsers are defensive (typed over `unknown`, null-safe, never throw).

**Spec:** [docs/design/2026-05-31-nutrition-design.md](../design/2026-05-31-nutrition-design.md)

**Before starting:** the repo has a stack of uncommitted work (README rewrite, `docs/`, visuals). Commit or stash that first so this feature's commits are clean. Run `npm test` to confirm a green baseline (33 passing).

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/models.ts` | **Modify** — add nutrition types; change `Product.nutrition`; add `Product.macros` |
| `src/nutrition.ts` | **Create** — pure `parseNutrition` + `filterByNutrition` + label maps + value parsing (no I/O) |
| `src/parsers.ts` | **Modify** — `parseProductNode` calls `parseNutrition`; set `macros` |
| `src/client.ts` | **Modify** — add `searchByNutrition` |
| `src/cli.ts` | **Modify** — `nutrition` command + nutrition flags on `search` |
| `src/mcp-server.ts` | **Modify** — `basketeer_nutrition`, `basketeer_search_by_nutrition` tools |
| `src/index.ts` | **Modify** — export new public types + `filterByNutrition` |
| `tests/fixtures/nutrition/*.json` | **Create** — real raw rows (provided below) |
| `tests/nutrition.test.ts` | **Create** — normalizer + filter tests |
| `tests/client.test.ts` | **Modify** — add `searchByNutrition` tests |
| `README.md`, `docs/api.md` | **Modify** — document feature + honest constraint |

---

## Task 1: Nutrition types (additive — keeps build green)

**Files:**
- Modify: `src/models.ts`

- [ ] **Step 1: Add the types** (append after the `Product` interface; do NOT change `Product` yet)

```ts
export type NutritionBasis = "per_100g" | "per_100ml" | "per_serving" | "unknown";

export interface Macros {
  energyKcal: number | null;
  energyKj: number | null;
  protein: number | null;
  fat: number | null;
  saturates: number | null;
  carbs: number | null;
  sugars: number | null;
  fibre: number | null;
  salt: number | null;
}

export interface Micronutrient {
  name: string;
  amount: number | null;
  unit: string | null;
  nrvPercent: number | null;
}

export interface Nutrition {
  basis: NutritionBasis;
  servingSize: string | null;
  macros: Macros;
  micros: Micronutrient[];
  perServing: Macros | null;
  raw: unknown[];
}

export interface Range { min?: number; max?: number; }

/** Macro fields that can be filtered/sorted on. Excludes energyKj (use energyKcal). */
export type MacroFilterKey =
  | "energyKcal" | "protein" | "fat" | "saturates"
  | "carbs" | "sugars" | "fibre" | "salt";

export type NutritionFilter =
  Partial<Record<MacroFilterKey, Range>> & {
    micro?: { name: string; min?: number; max?: number }[];
  };

export interface NutritionSort {
  by: MacroFilterKey | (string & {}); // a MacroFilterKey or a micronutrient name
  dir?: "asc" | "desc";
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: PASS (no tsc errors — these types are additive and unused so far).

- [ ] **Step 3: Commit**

```bash
git add src/models.ts
git commit -m "feat(nutrition): add Nutrition/Macros/Micronutrient + filter types"
```

---

## Task 2: Fixtures (real captured data)

**Files:**
- Create: `tests/fixtures/nutrition/oatly-barista.json`
- Create: `tests/fixtures/nutrition/chicken-breast.json`
- Create: `tests/fixtures/nutrition/empty.json`

These are the real `nutrition` row arrays captured live (SKUs 292990463 and 294007923). They exercise the two main shapes: split-energy + micros + lowercase aliases (Oatly), and inline-energy + value2 columns + "Available Carbohydrate"/"As sold" (chicken).

- [ ] **Step 1: Create `tests/fixtures/nutrition/oatly-barista.json`**

```json
[
  { "name": "Typical Values", "value1": "per 100 ml:", "value2": null, "value3": null },
  { "name": "Energy", "value1": "257 kJ/", "value2": null, "value3": null },
  { "name": "-", "value1": "61 kcal", "value2": null, "value3": null },
  { "name": "Fat", "value1": "3.0 g", "value2": null, "value3": null },
  { "name": "of which saturates", "value1": "0.3 g", "value2": null, "value3": null },
  { "name": "Carbohydrate", "value1": "7.1 g", "value2": null, "value3": null },
  { "name": "sugars", "value1": "3.4 g*", "value2": null, "value3": null },
  { "name": "Fibre", "value1": "0.8 g", "value2": null, "value3": null },
  { "name": "Protein", "value1": "1.1 g", "value2": null, "value3": null },
  { "name": "Salt", "value1": "0.10 g", "value2": null, "value3": null },
  { "name": "Vitamin D", "value1": "1.1 µg (22%**)", "value2": null, "value3": null },
  { "name": "Riboflavin", "value1": "0.21 mg (15%**)", "value2": null, "value3": null },
  { "name": "Vitamin B12", "value1": "0.38 µg (15%**)", "value2": null, "value3": null },
  { "name": "Calcium", "value1": "120 mg (15%**)", "value2": null, "value3": null },
  { "name": "Iodine", "value1": "22.5 µg (15%**)", "value2": null, "value3": null },
  { "name": "of which", "value1": "-", "value2": null, "value3": null },
  { "name": "*Natural sugars from oats", "value1": "-", "value2": null, "value3": null },
  { "name": "**Of the Nutrient Reference Value (NRVs)", "value1": "-", "value2": null, "value3": null }
]
```

- [ ] **Step 2: Create `tests/fixtures/nutrition/chicken-breast.json`**

```json
[
  { "name": "Typical Values", "value1": "Per 100g", "value2": null, "value3": null },
  { "name": "Energy", "value1": "486kJ / 115kcal", "value2": "null / null", "value3": null },
  { "name": "Fat", "value1": "3.3g", "value2": "", "value3": null },
  { "name": "Saturates", "value1": "0.8g", "value2": "", "value3": null },
  { "name": "Available Carbohydrate", "value1": "0g", "value2": "", "value3": null },
  { "name": "Sugars", "value1": "0g", "value2": "", "value3": null },
  { "name": "Fibre", "value1": "0g", "value2": "", "value3": null },
  { "name": "Protein", "value1": "21.5g", "value2": "", "value3": null },
  { "name": "Salt", "value1": "0.18g", "value2": "", "value3": null },
  { "name": "* Reference intake of an average adult (8400 kJ / 2000 kcal)", "value1": "-", "value2": null, "value3": null },
  { "name": "As sold", "value1": "-", "value2": null, "value3": null }
]
```

- [ ] **Step 3: Create `tests/fixtures/nutrition/empty.json`**

```json
[]
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/nutrition/
git commit -m "test(nutrition): add real-product nutrition fixtures"
```

> **Optional follow-up (not blocking):** during/after implementation, capture 1–2 more shapes (a ready meal with a per-serving column, a multipack) with
> `node dist/cli.js product <sku> | jq '.nutrition.raw'` and add as fixtures + assertions.

---

## Task 3: `parseNutrition` normalizer

**Files:**
- Create: `src/nutrition.ts`
- Test: `tests/nutrition.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run tests/nutrition.test.ts`
Expected: FAIL — `parseNutrition` not found / module missing.

- [ ] **Step 3: Implement `src/nutrition.ts`**

```ts
// src/nutrition.ts — pure nutrition normalization + filtering. No I/O.
import type {
  Macros, Micronutrient, Nutrition, NutritionBasis,
} from "./models.js";

const emptyMacros = (): Macros => ({
  energyKcal: null, energyKj: null, protein: null, fat: null,
  saturates: null, carbs: null, sugars: null, fibre: null, salt: null,
});

/** First number in a string: "3.0 g" -> 3.0, "21.5g" -> 21.5, "3.4 g*" -> 3.4. */
function num(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/** Unit right after the number: "1.1 µg (22%)" -> "µg", "3.0 g" -> "g". */
function unitOf(s: string): string | null {
  const m = s.match(/-?\d+(?:\.\d+)?\s*([A-Za-zµμ]+)/);
  return m ? m[1] : null;
}

/** NRV percent in parens: "(22%**)" -> 22. */
function nrvOf(s: string): number | null {
  const m = s.match(/\((\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : null;
}

function basisFromHeader(v: string): NutritionBasis {
  const t = v.toLowerCase();
  if (t.includes("100 ml") || t.includes("100ml")) return "per_100ml";
  if (t.includes("100 g") || t.includes("100g")) return "per_100g";
  if (t.includes("serving")) return "per_serving";
  return "unknown";
}

const MACRO_LABELS: Record<string, keyof Macros> = {
  "fat": "fat",
  "saturates": "saturates",
  "of which saturates": "saturates",
  "carbohydrate": "carbs",
  "available carbohydrate": "carbs",
  "sugars": "sugars",
  "of which sugars": "sugars",
  "fibre": "fibre",
  "protein": "protein",
  "salt": "salt",
};

function isFootnote(name: string, value: string | null): boolean {
  const n = name.trim();
  if (n.startsWith("*")) return true;
  if (/^of which$/i.test(n)) return true;
  if (/^as sold$/i.test(n)) return true;
  if (/reference intake|nutrient reference value/i.test(n)) return true;
  const known = !!MACRO_LABELS[n.toLowerCase()] || /^energy/i.test(n);
  if (!known && (value === "-" || value === null || value === "")) return true;
  return false;
}

export function parseNutrition(rows: unknown[]): Nutrition | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const macros = emptyMacros();
  const micros: Micronutrient[] = [];
  let basis: NutritionBasis = "unknown";
  let expectKcalNext = false;

  for (const r of rows) {
    const row = (r ?? {}) as { name?: unknown; value1?: unknown };
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const value1 = typeof row.value1 === "string" ? row.value1.trim() : null;
    if (!name) continue;

    // Energy split across two rows: "257 kJ/" then a row whose value holds the kcal.
    if (expectKcalNext) {
      expectKcalNext = false;
      if (value1 && /kcal/i.test(value1)) {
        macros.energyKcal = num(value1.match(/(\d+(?:\.\d+)?)\s*kcal/i)?.[0] ?? null);
        continue;
      }
      // not a kcal continuation — fall through and process normally
    }

    // Header row → basis
    if (/typical values/i.test(name) || (value1 && /per\s*100|per\s*serving/i.test(value1))) {
      if (value1) basis = basisFromHeader(value1);
      continue;
    }

    // Energy (inline "486kJ / 115kcal" or split "257 kJ/")
    if (/^energy/i.test(name)) {
      if (value1) {
        const kj = value1.match(/(\d+(?:\.\d+)?)\s*kj/i);
        const kcal = value1.match(/(\d+(?:\.\d+)?)\s*kcal/i);
        if (kj) macros.energyKj = parseFloat(kj[1]);
        if (kcal) macros.energyKcal = parseFloat(kcal[1]);
        if (kj && !kcal) expectKcalNext = true;
      }
      continue;
    }

    if (isFootnote(name, value1)) continue;

    const key = MACRO_LABELS[name.toLowerCase()];
    if (key) {
      macros[key] = num(value1);
      continue;
    }

    // Anything else with a value is a micronutrient.
    if (value1) {
      micros.push({ name, amount: num(value1), unit: unitOf(value1), nrvPercent: nrvOf(value1) });
    }
  }

  return { basis, servingSize: null, macros, micros, perServing: null, raw: rows };
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run tests/nutrition.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/nutrition.ts tests/nutrition.test.ts
git commit -m "feat(nutrition): add parseNutrition normalizer with fixture tests"
```

---

## Task 4: `filterByNutrition` primitive

**Files:**
- Modify: `src/nutrition.ts`
- Test: `tests/nutrition.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/nutrition.test.ts`)

```ts
import { filterByNutrition } from "../src/nutrition.js";
import type { Product } from "../src/models.js";

function product(sku: string, basis: "per_100g" | null, macros: Partial<Record<string, number>>): Product {
  const nutrition = basis === null ? null : {
    basis, servingSize: null, perServing: null, micros: [], raw: [],
    macros: {
      energyKcal: null, energyKj: null, protein: null, fat: null, saturates: null,
      carbs: null, sugars: null, fibre: null, salt: null, ...macros,
    },
  };
  return { sku, tpnb: sku, title: sku, brand: null, price: null, onOffer: null,
    promotions: [], packSize: null, nutrition, macros: nutrition?.macros ?? null, raw: {} } as unknown as Product;
}

describe("filterByNutrition", () => {
  const items = [
    product("a", "per_100g", { protein: 25, sugars: 1 }),
    product("b", "per_100g", { protein: 10, sugars: 9 }),
    product("c", "per_100g", { protein: 30, sugars: 0 }),
    product("d", null, {}), // no nutrition
  ];

  it("drops products with no nutrition when filtering", () => {
    const out = filterByNutrition(items, { where: { protein: { min: 0 } } });
    expect(out.map(p => p.sku)).not.toContain("d");
  });

  it("applies min/max ranges", () => {
    const out = filterByNutrition(items, { where: { protein: { min: 20 }, sugars: { max: 2 } } });
    expect(out.map(p => p.sku).sort()).toEqual(["a", "c"]);
  });

  it("sorts descending, missing last", () => {
    const out = filterByNutrition(items, { sort: { by: "protein", dir: "desc" } });
    expect(out.map(p => p.sku)).toEqual(["c", "a", "b"]); // d dropped (sort references nutrition)
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run tests/nutrition.test.ts`
Expected: FAIL — `filterByNutrition` not exported.

- [ ] **Step 3: Implement (append to `src/nutrition.ts`)**

```ts
import type { Product, NutritionFilter, NutritionSort, NutritionBasis, MacroFilterKey, Range } from "./models.js";

const MACRO_FILTER_KEYS: MacroFilterKey[] =
  ["energyKcal", "protein", "fat", "saturates", "carbs", "sugars", "fibre", "salt"];

function inRange(v: number | null, r: Range | undefined): boolean {
  if (!r) return true;
  if (v == null) return false;
  if (r.min != null && v < r.min) return false;
  if (r.max != null && v > r.max) return false;
  return true;
}

function sortValue(p: Product, by: string): number | null {
  const m = p.nutrition?.macros;
  if (m && by in m) return m[by as keyof typeof m];
  const micro = p.nutrition?.micros.find((x) => x.name.toLowerCase() === by.toLowerCase());
  return micro?.amount ?? null;
}

export function filterByNutrition(
  products: Product[],
  opts: { where?: NutritionFilter; sort?: NutritionSort; basis?: NutritionBasis } = {},
): Product[] {
  const { where, sort, basis } = opts;
  const usesNutrition = !!where || !!sort;

  let out = usesNutrition ? products.filter((p) => p.nutrition) : [...products];

  if (usesNutrition) {
    const target = basis ?? out.find((p) => p.nutrition)?.nutrition?.basis;
    if (target) out = out.filter((p) => p.nutrition!.basis === target);
  }

  if (where) {
    out = out.filter((p) => {
      const m = p.nutrition!.macros;
      for (const k of MACRO_FILTER_KEYS) {
        if (where[k] && !inRange(m[k], where[k])) return false;
      }
      for (const mc of where.micro ?? []) {
        const found = p.nutrition!.micros.find((x) => x.name.toLowerCase() === mc.name.toLowerCase());
        if (!inRange(found?.amount ?? null, { min: mc.min, max: mc.max })) return false;
      }
      return true;
    });
  }

  if (sort) {
    const dir = sort.dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = sortValue(a, String(sort.by));
      const bv = sortValue(b, String(sort.by));
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }

  return out;
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run tests/nutrition.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/nutrition.ts tests/nutrition.test.ts
git commit -m "feat(nutrition): add filterByNutrition (drop-no-nutrition, ranges, sort)"
```

---

## Task 5: Wire normalizer into the Product

**Files:**
- Modify: `src/models.ts` (change `Product`)
- Modify: `src/parsers.ts` (populate `nutrition` + `macros`)

- [ ] **Step 1: Change `Product` in `src/models.ts`**

Replace the line `nutrition: unknown[];` (currently models.ts:33) and add `macros`:

```ts
  /** Normalized nutrition, or null if Tesco returned none / it was unparseable. */
  nutrition: Nutrition | null;
  /** Convenience mirror of `nutrition?.macros`. */
  macros: Macros | null;
  raw: unknown;
```

- [ ] **Step 2: Update `parseProductNode` in `src/parsers.ts`**

Currently parsers.ts:72 reads `nutrition: arr(details.nutrition),`. Replace with the normalized version and add `macros`. Add the import at the top of `src/parsers.ts`:

```ts
import { parseNutrition } from "./nutrition.js";
```

Then in the returned product object, replace `nutrition: arr(details.nutrition),` with:

```ts
    nutrition: parseNutrition(arr(details.nutrition)),
    get macros() { return this.nutrition?.macros ?? null; },
```

If a getter inside the object literal is awkward with the existing return shape, instead compute it explicitly before the return:

```ts
    const nutrition = parseNutrition(arr(details.nutrition));
    // ...in the returned object:
    nutrition,
    macros: nutrition?.macros ?? null,
```

(Use the explicit-variable form — it's simplest and `Product` is a plain object.)

- [ ] **Step 3: Build + run the full suite**

Run: `npm run build && npm test`
Expected: PASS. If any existing test asserted `product.nutrition` was an array, update it to the new shape (search tests for `.nutrition`). The product GraphQL query already requests the rows, so no query change is needed.

- [ ] **Step 4: Commit**

```bash
git add src/models.ts src/parsers.ts tests/
git commit -m "feat(nutrition): populate Product.nutrition + macros from parser"
```

---

## Task 6: `searchByNutrition` on the client

**Files:**
- Modify: `src/client.ts`
- Test: `tests/client.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/client.test.ts`)

Use the existing test helpers. This stubs `fetchImpl` so `search` returns 3 SKUs and each `getProduct` returns nutrition. (Adapt the stub to match how `helpers.ts` builds responses — the key behaviors to assert are below.)

```ts
describe("searchByNutrition", () => {
  it("hydrates results, filters by nutrition, and reports counts", async () => {
    // Arrange a client whose search returns 3 results and whose getProduct
    // returns: a=protein 25, b=protein 10, c=protein 30 (all per_100g).
    const client = makeNutritionClient(); // helper that stubs search + getProduct (see helpers.ts)

    const out = await client.searchByNutrition("protein", {
      where: { protein: { min: 20 } },
      sort: { by: "protein", dir: "desc" },
      hydrate: 3,
    });

    expect(out.hydrated).toBe(3);
    expect(out.results.map((p) => p.sku)).toEqual(["c", "a"]); // b filtered out, sorted desc
    expect(out.skipped).toBe(0);
  });

  it("respects the hydrate cap and reports skipped", async () => {
    const client = makeNutritionClient(); // search returns 3
    const out = await client.searchByNutrition("protein", { hydrate: 2 });
    expect(out.hydrated).toBe(2);
    expect(out.skipped).toBe(1);
  });
});
```

Add `makeNutritionClient()` to `tests/helpers.ts` (a small factory returning a `Basketeer` whose `fetchImpl` answers the search op with 3 results and the product op with per-SKU nutrition). Follow the existing helper patterns in that file.

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run tests/client.test.ts -t searchByNutrition`
Expected: FAIL — `searchByNutrition` is not a function.

- [ ] **Step 3: Implement on `Basketeer` in `src/client.ts`**

Add the import:

```ts
import { filterByNutrition } from "./nutrition.js";
import type { NutritionFilter, NutritionSort, Product } from "./models.js";
```

Add the method:

```ts
  /**
   * Keyword search, then hydrate the top `hydrate` results' nutrition (each a throttled
   * product fetch) and filter/rank locally. Returns the products plus how many were
   * hydrated/skipped — the cost is bounded by `hydrate` (default 20) and reported, not hidden.
   */
  async searchByNutrition(
    query: string,
    opts: { where?: NutritionFilter; sort?: NutritionSort; hydrate?: number; limit?: number } = {},
  ): Promise<{ results: Product[]; hydrated: number; skipped: number }> {
    const cap = opts.hydrate ?? 20;
    const page = await this.search(query);
    const head = page.results.slice(0, cap);
    const skipped = Math.max(0, page.results.length - head.length);

    const hydrated: Product[] = [];
    for (const r of head) {
      hydrated.push(await this.getProduct(r.sku)); // serial — relies on the 1 req/s transport throttle
    }

    let results = filterByNutrition(hydrated, { where: opts.where, sort: opts.sort });
    if (opts.limit != null) results = results.slice(0, opts.limit);
    return { results, hydrated: hydrated.length, skipped };
  }
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run tests/client.test.ts -t searchByNutrition`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client.ts tests/client.test.ts tests/helpers.ts
git commit -m "feat(nutrition): add client.searchByNutrition (bounded hydration + reported counts)"
```

---

## Task 7: Public exports

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add exports**

```ts
export { parseNutrition, filterByNutrition } from "./nutrition.js";
export type {
  Nutrition, Macros, Micronutrient, NutritionBasis,
  Range, NutritionFilter, NutritionSort, MacroFilterKey,
} from "./models.js";
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(nutrition): export nutrition API + types"
```

---

## Task 8: CLI surface

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Add the `nutrition` command** (follow the existing `product` command pattern in cli.ts)

```ts
program
  .command("nutrition")
  .argument("<sku>", "product SKU (tpnc)")
  .description("Print normalized nutrition (macros + micros) for a product.")
  .action(async (sku: string) => {
    emit((await readClient().getProduct(sku)).nutrition);
  });
```

- [ ] **Step 2: Add nutrition flags to the existing `search` command**

On the existing `search` command definition, add options and branch the action:

```ts
  .option("--min-protein <g>", "only products with at least this protein per 100g/ml", parseFloat)
  .option("--max-sugar <g>", "only products with at most this sugar per 100g/ml", parseFloat)
  .option("--sort <field>", "sort hydrated results by a macro (e.g. protein)")
  .option("--hydrate <n>", "max results to fetch nutrition for (default 20)", (v) => parseInt(v, 10))
```

In the `search` action, before the plain search, detect nutrition flags:

```ts
    const usesNutrition =
      opts.minProtein != null || opts.maxSugar != null || opts.sort != null;
    if (usesNutrition) {
      const where: NutritionFilter = {};
      if (opts.minProtein != null) where.protein = { min: opts.minProtein };
      if (opts.maxSugar != null) where.sugars = { max: opts.maxSugar };
      const sort = opts.sort ? { by: opts.sort, dir: "desc" as const } : undefined;
      emit(await readClient().searchByNutrition(query, { where, sort, hydrate: opts.hydrate, limit: opts.limit }));
      return;
    }
```

Add the type import at the top of `src/cli.ts`: `import type { NutritionFilter } from "./index.js";`

- [ ] **Step 3: Manual smoke (anonymous, real)**

Run:
```bash
npm run build
node dist/cli.js nutrition 292990463 | jq '.macros'
node dist/cli.js search "greek yogurt" --min-protein 8 --sort protein --hydrate 8 | jq '{hydrated, skipped, top: .results[0].title}'
```
Expected: the first prints clean macros; the second prints counts and a high-protein yogurt title.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat(nutrition): CLI nutrition command + search nutrition flags"
```

---

## Task 9: MCP surface

**Files:**
- Modify: `src/mcp-server.ts`

- [ ] **Step 1: Add `basketeer_nutrition`** (follow the existing `basketeer_product` tool registration; use `zod` for the schema as the other tools do)

```ts
server.tool(
  "basketeer_nutrition",
  "Normalized nutrition (typed macros + micros) for a product by SKU.",
  { sku: z.string() },
  async ({ sku }) => json((await client.getProduct(sku)).nutrition),
);
```

- [ ] **Step 2: Add `basketeer_search_by_nutrition`**

```ts
server.tool(
  "basketeer_search_by_nutrition",
  "Search products by keyword, then filter/rank by nutrition (per 100g/ml). " +
    "Hydrates each candidate with a throttled product fetch; bounded by `hydrate`.",
  {
    query: z.string(),
    minProtein: z.number().optional(),
    maxSugar: z.number().optional(),
    sortBy: z.string().optional(),
    hydrate: z.number().optional(),
    limit: z.number().optional(),
  },
  async ({ query, minProtein, maxSugar, sortBy, hydrate, limit }) => {
    const where: NutritionFilter = {};
    if (minProtein != null) where.protein = { min: minProtein };
    if (maxSugar != null) where.sugars = { max: maxSugar };
    const sort = sortBy ? { by: sortBy, dir: "desc" as const } : undefined;
    return json(await client.searchByNutrition(query, { where, sort, hydrate, limit }));
  },
);
```

Add the type import near the top of `src/mcp-server.ts`: `import type { NutritionFilter } from "./index.js";`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/mcp-server.ts
git commit -m "feat(nutrition): MCP nutrition + search_by_nutrition tools"
```

---

## Task 10: Docs

**Files:**
- Modify: `README.md`, `docs/api.md`

- [ ] **Step 1: README** — add a short "Nutrition" subsection under Capabilities (or its own `##`), e.g.:

```markdown
## Nutrition

Every product carries Tesco's on-pack nutrition, normalized to typed macros and micros:

` ` `ts
const p = await client.getProduct(sku);
p.macros;              // { energyKcal, protein, fat, saturates, carbs, sugars, fibre, salt }
p.nutrition?.micros;   // [{ name: "Vitamin B12", amount: 0.38, unit: "µg", nrvPercent: 15 }, ...]

// Filter/rank a keyword search by nutrition:
const { results, hydrated } = await client.searchByNutrition("greek yogurt", {
  where: { protein: { min: 8 }, sugars: { max: 6 } },
  sort: { by: "protein", dir: "desc" },
});
` ` `

> Nutrition-filtered search runs a keyword search, then fetches each candidate's nutrition
> (a throttled product call each, capped by `hydrate`, default 20). It filters *within* a
> search — it does not scan the whole catalogue.
```

(Use real triple-backticks; they are spaced out above only to nest in this plan.)

- [ ] **Step 2: docs/api.md** — add `searchByNutrition`, `filterByNutrition`, `parseNutrition`, and the `Nutrition`/`Macros`/`Micronutrient` shapes to the reference, plus the `nutrition <sku>` CLI command and the two MCP tools.

- [ ] **Step 3: Full verification**

Run: `npm run build && npm test`
Expected: PASS (all prior + new nutrition tests).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/api.md
git commit -m "docs(nutrition): document nutrition model, search, and constraints"
```

---

## Self-review (completed by plan author)

- **Spec coverage:** every spec section maps to a task — data model (T1), normalizer (T3), filter primitive (T4), Product wiring (T5), searchByNutrition (T6), exports (T7), CLI (T8), MCP (T9), tests/fixtures (T2–T6), docs + constraints (T10). ✓
- **Placeholder scan:** no TBD/TODO; all code steps contain real code. The one "adapt the stub" note (T6) points at the existing `helpers.ts` pattern rather than inventing a parallel transport — intentional, not a placeholder.
- **Type consistency:** `parseNutrition`, `filterByNutrition`, `searchByNutrition`, `NutritionFilter`, `NutritionSort`, `MacroFilterKey`, `Macros` are used identically across T1/T3/T4/T6/T7/T8/T9. `Product.nutrition: Nutrition | null` and `Product.macros: Macros | null` consistent T1/T5.
- **Known risk:** `parseNutrition` is only proven against 2 fixtures; the optional follow-up in T2 (capture a per-serving ready-meal) should be done before relying on `perServing`, which v1 leaves `null`.
