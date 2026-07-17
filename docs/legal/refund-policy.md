> **DRAFT — NOT LEGAL ADVICE.** This document is a starting point for a Pakistani
> lawyer to review, correct, and finalize before goto5x.com launches. It has not
> been reviewed by counsel. Do not publish it as-is. See `docs/SRS.md` §13, open
> question 2.

# goto5x.com — Refund Policy (Draft)

**Last updated:** [date] · **Version:** draft-2

## 1. Who This Applies To
Each Seller store on goto5x.com sets its own refund terms for its own products,
which must be at least as protective of Buyers as this baseline policy. Where a
Seller has not published a more specific policy, this baseline applies.

## 2. Requesting a Refund
A Buyer can look up their order status via the secure link sent at checkout (no
account required) and initiate a refund or dispute request from that page, or by
contacting the Seller directly through the store's published contact details.

## 3. How Refunds Are Processed
- **The Platform never holds payment for any order** (Direct Seller
  Collection) — a Buyer pays a Seller directly, so a refund is likewise
  issued by the Seller directly to the Buyer, by whatever method they
  originally paid. The Platform is not a party to that transaction and does
  not process, hold, or forward refund payments.
- If the underlying order had already been marked paid and commission had
  already accrued, the Seller may ask the Platform to record a
  **commission-waiver adjustment** against that specific charge (e.g. the
  order was genuinely cancelled/refunded) — an admin reviews and records
  this as a `commission_waived` ledger entry; it adjusts what the Seller
  owes the Platform, never a payment the Platform makes to the Buyer.
  [Confirm the exact waiver-approval process with the finance/product owner
  before publishing — see `docs/SRS.md` FR-6.20.]
- Refunds for supplier-fulfilled orders may depend on the originating Supplier's own
  return/replacement process; the Seller remains the Buyer's point of contact.
- Where a dispute cannot be resolved between Buyer and Seller, the Platform's admin
  team may review the order (including any Trust & Safety flags already on file,
  `docs/SRS.md` §5.29) and make a determination, up to and including
  restricting or suspending the Seller's account under the Terms of
  Service's enforcement ladder.

## 4. Timeframes
[To be finalized: a specific window during which a Buyer may request a refund
(e.g. days from delivery), and the target turnaround time for a Seller to
respond, since resolution now happens directly between Buyer and Seller
rather than against a Platform-held hold period.]

## 5. Non-Refundable Circumstances
[To be defined per category/product type — e.g. custom or personalized
print-on-demand items may have different return eligibility than stock items. Needs
input from the Printify/supplier integration terms before finalizing.]

## 6. Bank/Wallet Disputes
Because payment happens directly between Buyer and Seller (bank transfer,
JazzCash, Easypaisa, or Cash on Delivery), a dispute over a specific payment
is between the Buyer and Seller (and, where applicable, their bank/wallet
provider) — the Platform is not a party to it and holds no funds to place on
hold. Where a pattern of disputes suggests a Trust & Safety concern
(`docs/SRS.md` §5.29), the Platform may review the Seller's account
independently of resolving any individual payment dispute.

## 7. Platform-Collected Payments Mode (dormant, not applicable to v1.0)
[Retained for the eventual reactivation of the Platform-Collected Payments
mode (`docs/SRS.md` §5.6d), under which the Platform would hold funds and a
payment-gateway chargeback process would apply. Not applicable while v1.0
operates under Direct Seller Collection — see §3 above.]

## 8. Changes to This Policy
Material changes will be published on this page with an updated version number and
date; the version in effect at the time of an order governs that order.

## 9. Contact
[Support/contact email to be added.]
