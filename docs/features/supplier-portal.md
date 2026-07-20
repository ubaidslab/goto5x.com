# Supplier Portal

## What it does

A supplier is a separate kind of account from a seller — someone who
fulfills products on behalf of one or more sellers' stores (print-on-demand,
dropshipping, etc.). The supplier portal is where they manage their listings,
see what they need to ship, and (on the paid tier) see everything across
every store they work with in one place.

## How it works

- **Signing up.** A supplier signs up with the same form as a seller, just
  picking "Supplier" instead. No country restriction, no seller agreement —
  suppliers aren't sellers.
- **Connecting to a store.** A supplier requests a link to a seller's store
  (or a seller invites a supplier); either way, the link only becomes active
  once the seller approves it.
- **Fulfilling orders.** Every order item a supplier is responsible for shows
  up in their queue. They upload a tracking number, which is relayed straight
  to the buyer automatically.
- **Free vs. Premium.** On the Free plan, a supplier connected to more than
  one store has to pick one store at a time to view. On the Premium plan, all
  of it — every store, every order — shows up merged into one list. This is
  the paid tier's headline feature.
- **The supplier's own wallet.** A Premium subscription is billed the same
  way a seller's plan is: monthly, straight out of a wallet the supplier tops
  up themselves. It's a separate, smaller wallet from any seller's — a
  supplier only ever pays its own plan fee, nothing else.

## Settings keys

| Key | What it tunes |
|---|---|
| `suppliers.aggregated_dashboard_enabled` | Whether a supplier sees the merged cross-store view (on by default for the Premium plan tier) |
