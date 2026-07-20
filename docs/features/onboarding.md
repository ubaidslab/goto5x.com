# Seller Onboarding

## What it does

A guided checklist that greets a brand-new seller instead of dropping them
into an empty dashboard, and a country gate that keeps signup limited to
regions the platform has actually launched in.

## How it works

- **The checklist.** Four steps — pick a theme (or explicitly keep the
  default), set a logo, add a first product, configure a domain (or
  explicitly keep the free subdomain) — shown on the dashboard home until
  all four are done. Once complete, it never comes back, even if the seller
  later removes their only product.
- **Regional gating.** Signup checks the applicant's country against an
  admin-managed allowed list. A blocked country never creates an account —
  the email and country are captured to a waitlist for future launch
  outreach instead, and the applicant sees a friendly "launching in your
  region soon" message, not an error.

## Settings keys

| Key | What it tunes |
|---|---|
| `auth.seller_signup_allowed_countries` | Which countries can sign up as a seller today |
