# awesome-mcp-servers PR kit

> Local draft (untracked). Use to add basketeer to the curated MCP lists.
> Targets: github.com/punkpeye/awesome-mcp-servers · wong2/awesome-mcp-servers ·
> appcypher/awesome-mcp-servers · modelcontextprotocol/servers (Community section)

## Where it fits
No "groceries" category exists on most lists. Best fits, in order: an existing
**🛒 Shopping / Commerce / Lifestyle** section if present, otherwise **Other Tools
and Integrations**. Keep entries alphabetical within the section.

## Entry — punkpeye style (with legend emojis: 📇 TypeScript · 🏠 local service)

```markdown
- [tobyandrews1985/basketeer](https://github.com/tobyandrews1985/basketeer) 📇 🏠 - Drive a personal UK Tesco grocery account: search, basket, delivery slots, orders, and on-pack nutrition. Filter and rank products by macros + micros. Catalogue and nutrition tools need no auth.
```

## Entry — plain style (for lists without the legend)

```markdown
- [basketeer](https://github.com/tobyandrews1985/basketeer) - Personal UK Tesco grocery account over MCP: search, basket, slots, orders, and on-pack nutrition (search and rank by macros + micros). Catalogue + nutrition tools need no auth; destructive actions require a two-step confirm.
```

## PR title

```
Add basketeer — Tesco groceries + nutrition MCP server
```

## PR description

```markdown
Adds **basketeer**, a stdio MCP server (published on npm) for automating a
personal UK Tesco grocery account.

- Tools: search, product, browse, favourites, basket, delivery/collection slots,
  orders (list/amend/cancel/reorder), checkout (returns a payment URL — never pays).
- Differentiator: normalized **nutrition** — typed macros and structured
  micronutrients per product — with `basketeer_search_by_nutrition` to filter and
  rank a search by them. Catalogue + nutrition tools need no auth.
- Agent-safe: read-only/destructive annotations, and a two-step confirm token on
  the irreversible tools (cancel, checkout). No "pay" tool.

Repo: https://github.com/tobyandrews1985/basketeer
npm: https://www.npmjs.com/package/basketeer
Run: `npx -y -p basketeer basketeer-mcp`

MIT · TypeScript · 71 tests · CI on Node 18/20.
```

## Submission checklist
- [ ] punkpeye/awesome-mcp-servers (fork → add entry → PR)
- [ ] wong2/awesome-mcp-servers
- [ ] appcypher/awesome-mcp-servers
- [ ] modelcontextprotocol/servers (Community Servers list)
- [ ] glama.ai/mcp/servers (claim/submit — it also auto-indexes public repos)
- [ ] smithery.ai (submit/deploy)
- [ ] pulsemcp.com / mcp.so (submit form)
