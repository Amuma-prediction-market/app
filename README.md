# AIMM Weather Markets

**A trading app for AIMM, the Adaptive Information Market Maker, on NEAR testnet.** It lists the highest-temperature
questions for New York and London, mirrored from Polymarket. You can buy and sell YES and NO on every answer, and
redeem once the result is in.

The contract and its tests are in `Amuma-prediction-market/AIMM-rust`. This app only reads the chain and asks your wallet to sign.
It has no server, no indexer and no keys.

## What the screen shows

| Element | What it is |
|---|---|
| Chance | The curve's price for each answer, in percent; YES costs that many cents, NO the rest |
| Information interval | The band around the price: how far the price can be trusted once the payout is taken into account. While the pot can pay every winner it is the price itself; when it cannot, it widens |
| Polymarket ring | Polymarket's bid-ask midpoint for the same answer, read live from its public API, so you can see when AIMM's price sits away from it |
| Operator's fund ℓ and L | The money actually put up, and the depth the curve prices at; AIMM prices like an L market on ℓ < L |
| A winning token pays | min(1, pot ÷ winning tokens), the same for every winner whenever it bought |
| Price history | The contract's own prices at past blocks, read from a NEAR node. Hover shows the block height, so every point can be checked |

The trade form takes dollars. It estimates the tokens with the curve (`src/lib/curve.ts`), then asks the contract's
`quote_buy` for the exact cost. Before you sign, it shows the tokens, the average price, the price after the trade, and
what each token would be paid if it won. The purchase sends at most 1% above the quote, and the contract returns
whatever it doesn't use in the same transaction.

## Run it

Requires Node 22.13 or a later 22, Node 24, or Node 26 and later: the versions Vite, ESLint and Vitest all support.

```bash
npm ci
```

```bash
npm run dev
```

Open http://localhost:5173 and connect a wallet: Meteor (with a testnet account), or MetaMask or any Ethereum wallet in the browser, which signs NEAR transactions as the NEAR account `0x<address>` (NEP-518). A MetaMask account starts with no NEAR; the trade form's "Get testnet NEAR for gas" asks the bot Worker's faucet for 0.25. The account menu's
faucet registers your account with tUSD, the test dollar, and mints 1,000. Meteor signs that in one approval; MetaMask
signs each action on its own, so the first time it asks for two, one to register and one to mint. A little testnet
NEAR pays the token's storage deposit.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`npm run build` writes a static site to `dist/` that any static host can serve, from any path.

## Configuration

Every setting has a testnet default in `src/config.ts`, and each can be changed at build time through a `VITE_`
variable. See `.env.example`. Reads go to FastNEAR, the RPC service NEAR's documentation points to:
`rpc.testnet.near.org` is deprecated and refuses nearly every request. Past blocks come from the regular node while it
keeps them, about two days, and from FastNEAR's archival node after that. The archival node rate-limits hard, so its
reads are spaced a second apart, and every reading is kept in the browser, because a past block never changes.

## Layout

| Path | What it is |
|---|---|
| `src/near/` | RPC reads, the typed contract client, the tUSD token, transaction outcomes, the wallet |
| `src/lib/` | Fixed-point units, the curve estimate, payouts, price history, Polymarket, formatting, each with tests |
| `src/hooks/` | React Query hooks for every read, and the transaction and faucet hooks |
| `src/components/` | The pages and their parts |

Amounts stay as bigint from the contract to the screen, so nothing is rounded before it is shown. The wallet SDKs are
loaded after the first render, which keeps the first load near 100 KB gzipped.

## The arbitrage bot

`bot/` is a Cloudflare Worker that trades AIMM toward Polymarket's prices every two minutes, so the prices move the way a
live market's would. Its README says how to deploy it and give it its keys.

## New questions

The operator opens a question per city and day with `demo/open_live.py` in `Amuma-prediction-market/AIMM-rust`, at Polymarket's
prices. The app finds questions on the chain by itself, so a new day needs no change here.

## Licence

No licence is granted. All rights reserved.
