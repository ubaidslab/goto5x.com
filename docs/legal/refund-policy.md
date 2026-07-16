> **DRAFT — NOT LEGAL ADVICE.** This document is a starting point for a Pakistani
> lawyer to review, correct, and finalize before goto5x.com launches. It has not
> been reviewed by counsel. Do not publish it as-is. See `docs/SRS.md` §13, open
> question 2.

# goto5x.com — Refund Policy (Draft)

**Last updated:** [date] · **Version:** draft-1

## 1. Who This Applies To
Each Seller store on goto5x.com sets its own refund terms for its own products,
which must be at least as protective of Buyers as this baseline policy. Where a
Seller has not published a more specific policy, this baseline applies.

## 2. Requesting a Refund
A Buyer can look up their order status via the secure link sent at checkout (no
account required) and initiate a refund or dispute request from that page, or by
contacting the Seller directly through the store's published contact details.

## 3. How Refunds Are Processed
- A refund is recorded on the Platform as a `refund_adjustment` entry against the
  relevant sale in the Seller's ledger — it reduces the Seller's balance, not the
  Platform's; the Platform's 3% commission on the refunded portion is reversed
  accordingly. [Confirm the exact commission-reversal mechanics with the finance/
  product owner before publishing — see `docs/SRS.md` FR-6.5.]
- Refunds for supplier-fulfilled orders may depend on the originating Supplier's own
  return/replacement process; the Seller remains the Buyer's point of contact.
- Where a dispute cannot be resolved between Buyer and Seller, the Platform's admin
  team may review the order (including any risk/fraud flags already on file) and
  make a determination, including freezing the associated funds pending resolution.

## 4. Timeframes
[To be finalized: a specific window during which a Buyer may request a refund
(e.g. days from delivery), and the target turnaround time for a Seller/Platform to
respond. This should be set consistently with the per-transaction hold period so
that, wherever possible, a dispute can be resolved before the corresponding funds
would otherwise become available to the Seller — see `docs/SRS.md` FR-6.2, FR-6.5.]

## 5. Non-Refundable Circumstances
[To be defined per category/product type — e.g. custom or personalized
print-on-demand items may have different return eligibility than stock items. Needs
input from the Printify/supplier integration terms before finalizing.]

## 6. Chargebacks
A payment-gateway chargeback initiated directly with a Buyer's bank or card issuer
is handled according to the payment gateway's own dispute process; the Platform may
place a hold on the related funds in the Seller's ledger while a chargeback is
active. [Confirm liability allocation between Platform, Seller, and gateway with
counsel and the Safepay merchant agreement before publishing.]

## 7. Changes to This Policy
Material changes will be published on this page with an updated version number and
date; the version in effect at the time of an order governs that order.

## 8. Contact
[Support/contact email to be added.]
