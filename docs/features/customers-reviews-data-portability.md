# Customers, Reviews & Data Portability

## What it does

A lightweight CRM view of who's bought from a store, buyer product reviews,
and moving product data in and out via CSV.

## How it works

- **Customers.** A customer record is created/matched the moment an order
  is placed; their order count and total spend only update once that order
  is actually confirmed paid (Financial Truth Invariant) — a buyer who never
  pays never inflates a customer's stats.
- **Reviews.** Submitted from the buyer order-status page, no account
  needed. A review is only marked "verified purchase" if it's tied to a real
  order that's actually confirmed. A seller can approve or hide a review;
  a product's average rating updates immediately after.
- **CSV import/export.** Import maps a fixed set of core product fields;
  anything in the file that isn't mapped is listed explicitly so nothing
  silently gets dropped.
- **PDF invoices.** One clean, professional template, rendered once at order
  placement and cached — never regenerated, so it never drifts from what the
  buyer originally saw.

## Settings keys

None specific — this feature area has no tunable Settings Registry entries.
