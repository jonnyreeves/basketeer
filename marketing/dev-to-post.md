---
title: "I reverse-engineered Tesco's API so an AI agent can do my grocery shop (and rank food by nutrition)"
published: false
tags: typescript, opensource, ai, webdev
cover_image: https://raw.githubusercontent.com/tobyandrews1985/basketeer/main/docs/media/nutrition.gif
---

> Local draft (untracked — not committed/published). Paste into https://dev.to/new, tweak, publish.
> Cross-post the same piece to Hashnode and your blog with a canonical URL.

Tesco — the UK's biggest supermarket — has no public API. I wanted to automate my own weekly shop, eventually hand it to an AI agent, and get at the one thing every grocery site has and none of them let you query: **nutrition data**. So I built [basketeer](https://github.com/tobyandrews1985/basketeer), a typed TypeScript SDK for a personal Tesco account.

Here's the part that surprised me most:

![Filtering and ranking a live Tesco search by nutrition, then reading a product's micronutrients](https://raw.githubusercontent.com/tobyandrews1985/basketeer/main/docs/media/nutrition.gif)

```bash
# "high-protein yogurt, >=10g protein, <=7g sugar, ranked by protein" — live, no login
basketeer search "high protein yogurt" --min-protein 10 --max-sugar 7 --sort protein
```

## Not scraping — a GraphQL gateway

Most "Tesco API" projects scrape the HTML and shatter the next time the site is restyled. But Tesco's own website talks to a GraphQL gateway at `xapi.tesco.com`. If you speak that protocol directly, you get a stable, structured data plane that a cosmetic redesign doesn't touch. The only load-bearing header for reads is a public `x-apikey`.

So the whole catalogue side — search, product lookup, browse — is plain `fetch`. No browser, stateless, polite 1 req/s.

## The nutrition goldmine

The product endpoint returns the on-pack nutrition table. Raw, it's a mess: energy split across two rows (`"257 kJ/"` then `"61 kcal"`), comma decimals, footnote markers, label aliases (`"of which sugars"`, `"salt equivalent"`). basketeer normalizes all of it into a typed model:

```ts
const { results } = await client.searchByNutrition("high protein yogurt", {
  where: { protein: { min: 10 }, sugars: { max: 7 } },
  sort:  { by: "protein", dir: "desc" },
});

results[0]?.macros;            // { energyKcal, protein, fat, saturates, carbs, sugars, fibre, salt }
results[0]?.nutrition?.micros; // [{ name: "Calcium", amount: 120, unit: "mg", nrvPercent: 15 }, ...]
```

Macros *and* structured micronutrients — per vitamin and mineral, with amount, unit, and % of the Nutrient Reference Value — and it's all on anonymous reads. That's a meal-planning dataset hiding in plain sight.

## The hard part: auth

Reads are free. Anything tied to your account needs a session, and that's where it gets interesting: Tesco's sign-in sits behind Akamai (TLS fingerprinting + a JS challenge) that only a genuine browser satisfies. So basketeer mints the session once with a real Chrome (via Playwright), harvests the bearer token + cookies, and from then on every call is pure HTTP. The session lasts ~30 days; the ~1-hour access token refreshes through the same browser path.

## Letting an agent shop

Because there's one clean typed core, putting a CLI and an **MCP server** on top was easy. The MCP server lets Claude Desktop (or any MCP client) run the shop. The catalogue + nutrition tools work with zero auth, so an agent can search and rank by nutrition out of the box.

The safety model matters here: read-only tools are annotated `readOnlyHint`, mutating ones `destructiveHint`, and the irreversible ones (cancel an order, check out) are **two-step** — the first call returns a preview and a confirm token, and you only proceed by calling again with that token. And `checkout()` deliberately stops at the payment URL. There is no "pay" tool — 3-D Secure is browser-bound and fraud-sensitive by design, so a human always finishes.

## Where it stops, on purpose

- **Payment** is out of scope. `checkout()` fills nothing and pays nothing; it returns the URL where you finish.
- It's **UK-only** and **reverse-engineered** — it can break if Tesco changes the gateway.
- It's for automating **your own** account, in the spirit of personal interoperability. Not scraping at scale.

## Try it

```bash
npm install basketeer
```

```ts
import { Basketeer } from "basketeer";
const client = new Basketeer();              // no auth for catalogue + nutrition
const { results } = await client.search("oat milk", { limit: 5 });
```

MIT, zero deps in the importable core, 71 tests, CI on Node 18/20.

- GitHub: https://github.com/tobyandrews1985/basketeer
- npm: https://www.npmjs.com/package/basketeer

If you've reverse-engineered a retailer's private API, or you're wiring grocery data into an agent, I'd love to hear how you approached auth and the inevitable schema drift.
