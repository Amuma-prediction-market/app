# Amuma

Demo at [amuma-cv4.pages.dev](https://amuma-cv4.pages.dev)

## Run it

Requires Node 22.13 or a later 22, Node 24, or Node 26 and later: the versions Vite, ESLint and Vitest all support.

```bash
npm ci
```

```bash
npm run dev
```

Open http://localhost:5173 and connect a Meteor wallet with a testnet account. Connecting and trading cost a little
testnet NEAR for gas. With a gas faucet configured (`VITE_GAS_FAUCET_URL`), "New wallet? Get free gas", next to Connect
wallet, sends a new account some by name, and the trade form offers the same once connected; without one, use your
wallet's own testnet faucet. The account menu's faucet registers your account with tUSD, the test dollar, and mints
1,000, in one approval. A little testnet NEAR pays the token's storage deposit.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`npm run build` writes a static site to `dist/` that any static host can serve, from any path.

## Configuration

Every setting has a testnet default in `src/config.ts`, and each can be changed at build time through a `VITE_`
variable. See `.env.example`. `VITE_COLLATERAL` names the token the demo's questions are paid in, and `VITE_RESOLVERS`
the accounts trusted to report their results; the site lists only the questions that use them. Reads go to FastNEAR,
the RPC service NEAR's documentation points to: `rpc.testnet.near.org` is deprecated and refuses nearly every request.
Past blocks come from the regular node while it keeps them, about two days, and from FastNEAR's archival node after
that. The archival node rate-limits hard, so its reads are spaced a second apart, and the readings the chart will ask
for again are kept in the browser, because a past block never changes.

## Layout

| Path | What it is |
|---|---|
| `src/near/` | RPC reads, the typed contract client, the tUSD token, transaction outcomes, the wallet |
| `src/lib/` | Fixed-point units, the curve estimate, payouts, price history, Polymarket, formatting, each with tests |
| `src/hooks/` | React Query hooks for every read, and the transaction and faucet hooks |
| `src/components/` | The pages and their parts |

Amounts stay as bigint from the contract to the screen, so nothing is rounded before it is shown. The wallet SDKs are
loaded after the first render, which keeps the first load near 100 KB gzipped.

## Questions

The app lists the daily-high questions for the cities in `src/lib/format.ts` that are paid in the configured collateral
and resolved by the configured resolvers, as both resolver and fallback resolver. Anyone can open a question on the
contract, with any token and any resolver, and a question with any other token or resolver is never listed. Any question can still be opened
at `#/q/<id>`: one that is not the demo's is shown read-only, with a notice naming its token, operator and resolver.
In the demo, the operator opens each day's questions at the matching Polymarket market's prices.

## Built with

| | |
|---|---|
| Interface | [React](https://react.dev) 19, [TanStack Query](https://tanstack.com/query) 5 |
| Wallet and NEAR | [NEAR Wallet Selector](https://github.com/near/wallet-selector) 10 (core, modal, Meteor), `@near-js/transactions` 2, `buffer` |
| Build and checks | [Vite](https://vite.dev) 8, TypeScript 6, Vitest 5, ESLint 10 |
| AI-assisted code | Written with [Claude Code](https://claude.com/claude-code) (Anthropic) under the team's direction; commits it worked on carry its co-author line |

## Hackathon

Everything in this repository was built for the NEAR Hackathon, inside its window of 19 October to 14 November 2026:
the first commit is from 6 November.

## Licence

MIT. See [`LICENSE`](LICENSE).
