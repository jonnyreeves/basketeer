# Show HN draft

> Local draft (untracked — not committed/published). Edit then post at https://news.ycombinator.com/submit
> Tip: post Tue–Thu, ~8–10am ET tends to do well. Reply to early comments fast.

**Title** (≤ 80 chars):

```
Show HN: Basketeer – a typed TS SDK for your Tesco account, with nutrition data
```

**URL:** https://github.com/tobyandrews1985/basketeer

**Text:**

Hi HN. basketeer is a TypeScript SDK that drives a personal UK Tesco grocery account over plain HTTP — search, basket, delivery slots, orders, and checkout (it stops at the payment URL and never pays). It ships a CLI and an MCP server too, so you can run the weekly shop from code, the terminal, or an AI agent.

Two things make it more than another scraper:

1. **Nutrition.** Tesco's product endpoint returns the on-pack nutrition table, and basketeer normalizes it into typed macros *and* structured micronutrients (per vitamin/mineral, with amount, unit, and %NRV) — free, on anonymous reads. You can filter and rank a search by it: *"high-protein yogurt, ≥10g protein, ≤7g sugar, ranked by protein"* returns a live, ranked list of real products. I haven't found another Tesco client that surfaces this.

2. **Pure HTTP, not DOM scraping.** Tesco's site talks to a GraphQL gateway; basketeer speaks that directly, so a cosmetic redesign doesn't break it. A real browser is needed only for sign-in (Akamai guards login); every call after that is `fetch`.

Why I built it: I wanted to automate my own weekly shop — and increasingly, let an AI agent do it — and I wanted real nutrition data for meal planning, which no existing tool exposed.

Honest limits: catalogue + nutrition reads need only a public API key. Account actions need a browser to mint a session once (~30-day session, ~1h access token refreshed via the same browser path). Payment is deliberately out of scope — it's CSRF-protected + 3-D Secure, so `checkout()` returns the URL where a human finishes. It's UK-only, reverse-engineered (can break if Tesco changes things), and explicitly for automating *your own* account, not scraping at scale.

MIT, ~40 kB, zero deps in the importable core. 71 tests, CI on Node 18/20.

- Repo: https://github.com/tobyandrews1985/basketeer
- npm: https://www.npmjs.com/package/basketeer

Happy to talk about the reverse-engineering, the nutrition normalization (the on-pack table is gloriously inconsistent — split energy rows, comma decimals, footnote markers), or the agent-safety model (destructive MCP tools require a two-step confirm token, and there's no "pay" tool).
