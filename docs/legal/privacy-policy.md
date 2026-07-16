> **DRAFT — NOT LEGAL ADVICE.** This document is a starting point for a Pakistani
> lawyer to review, correct, and finalize before goto5x.com launches, specifically
> against Pakistan's data-protection framework (see `docs/SRS.md` §13, open question 2).
> It has not been reviewed by counsel. Do not publish it as-is.

# goto5x.com — Privacy Policy (Draft)

**Last updated:** [date] · **Version:** draft-1

## 1. What This Policy Covers
This policy describes how goto5x.com ("the Platform") collects, uses, and protects
personal data belonging to Sellers, Suppliers, and Buyers who use stores hosted on
the Platform.

## 2. Data We Collect
- **Sellers/Suppliers:** account details, business information, KYC/identity
  verification documents, bank/Raast payout account details, store content, order
  and sales data.
- **Buyers:** name, shipping address, email, phone (where provided), and order
  contents, collected at checkout for the purpose of fulfilling that order. Buyers
  are not required to create an account.
- **Automatically collected:** basic technical data (IP address, device/browser
  information) for security, fraud prevention, and analytics purposes.

## 3. How We Use Data
- To operate Seller stores, process orders, and forward fulfillment information to
  the relevant Supplier.
- To process payments, commission, holds, and payouts, including fraud/risk
  assessment (e.g. the risk summary shown to admin reviewers before a payout is
  approved — see `docs/SRS.md` FR-6.9).
- To send transactional communications (order confirmations, shipping updates,
  payout status) — the Buyer order-status link uses a secure, unguessable token
  rather than any predictable identifier.
- To maintain an audit log of administrative actions for security and accountability
  (`admin_audit_logs` — this log is never used to profile Buyers; it records
  platform-operations actions, not shopping behavior).

## 4. Data Sharing
- **With Suppliers:** the minimum order and shipping information needed to fulfill
  an order.
- **With payment processors:** transaction data necessary to process a payment;
  goto5x.com does not store raw card details.
- **With Google (Drive import):** only where a Seller explicitly connects their
  Google Drive account to import media; goto5x.com accesses only what the Seller
  authorizes.
- **With the Template Store** (a separate marketplace product, `docs/SRS.md`
  §5.24a): when a Seller purchases a premium template there, that product calls a
  signed goto5x.com API to unlock the template on the Seller's account. This flow
  carries no Buyer data and no Seller financial data — only the minimum
  information needed to identify which Seller account should receive the
  template.
- **With a Seller's connected Social Media SaaS** (a separate product, `docs/SRS.md`
  §5.24b): only if a Seller explicitly connects it from their dashboard's
  "Marketing" section. Once connected, that product can read the Seller's own
  product data (title, price, images, storefront URL — the same information
  already public on the Seller's storefront) through a Seller-scoped access token
  the Seller can revoke at any time. No Buyer data is shared through this
  connection.
- We do not sell personal data to third parties.

## 5. Data Retention
- Order and financial records are retained as required for accounting, tax, and
  dispute-resolution purposes. [Confirm exact retention periods with counsel and
  applicable Pakistani record-keeping requirements.]
- Impersonation sessions and admin actions are retained indefinitely in the
  immutable audit log for accountability.

## 6. Security Measures
- Tenant data isolation is enforced both in application logic and at the database
  level (Row-Level Security), so one Seller's data is never accessible through
  another Seller's account.
- Payment data is handled by licensed payment processors; goto5x.com never stores
  raw card numbers.
- Administrative access requires mandatory multi-factor authentication, and every
  administrative action is logged immutably.
- [Add specifics on encryption at rest/in transit once finalized with the technical
  team — see `docs/SRS.md` §6.5.]

## 7. Your Rights
[This section needs counsel input specific to whichever Pakistani data-protection
law is in force at launch (SRS §13, open question 2) — likely to cover rights of
access, correction, and deletion requests, and how to submit them.]

## 8. Changes to This Policy
Material changes will be published on this page with an updated version number and
date.

## 9. Contact
[Support/contact/data-protection email to be added.]
