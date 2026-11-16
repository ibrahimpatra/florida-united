# AI assistant and Stripe setup

## Gemini assistant
1. Create a key at https://aistudio.google.com/apikey and put it in the server env as GEMINI_API_KEY (never NEXT_PUBLIC_). Optional: GEMINI_MODEL.
2. The browser widget (src/components/agent/AgentChat.tsx) posts chat history to /api/agent.
3. /api/agent sends it to Gemini with function declarations (src/lib/agent/tools.ts). Gemini answers directly or asks for a tool call; the server runs the tool with the caller's real session and sends the result back, up to 6 rounds.
4. Customers get catalogue, store info and their own orders. Admins also get stats, orders, low stock, and PROPOSED changes (create or update product, change order status, place COD order). Proposals appear as a Confirm button; the server re-checks the admin session before running them.
5. Add a capability by adding a declaration and a case in runTool.

## Stripe (USD)
- Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL. Set the KWD to USD rate in Admin > Settings.
- Webhook URL: /api/stripe/webhook. Events: checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded.
- Flow: order saved (stock reserved) -> Checkout Session created from the saved total -> webhook or success page marks paid. Unpaid orders can use Pay now in My Orders. Cancelling a paid card order and approving a refund on a return both refund through Stripe.

## Flash deals at checkout
- Types that change the price: percentage, fixed (KWD off each unit) and buy-one-get-one (every second unit free). "Bundle" is no longer offered as a deal type.
- The best live deal per line wins; scope (all, category, products), start/end, minimum cart, total uses and per-customer uses are enforced on the server in the same transaction that places the order. Cancelling an order releases the deal use.
- The cart, mini cart and product cards use the same pure function (src/lib/pricing.ts) so what is shown is what is charged.
- Home page: every live deal marked "show on homepage" becomes a banner automatically, with countdown, and Arabic title/badge fields.

## Password reset
/auth/forgot emails a single-use link (valid 1 hour; only a SHA-256 of the token is stored). Needs working email settings and NEXT_PUBLIC_APP_URL.

## Tests
`npm test` runs the pricing tests and an order-engine suite on an in-memory Firestore (tests/fakeFirestore.ts) covering units, deals, limits, cancel, card payment states and restock.
