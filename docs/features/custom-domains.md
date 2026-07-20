# Custom Domains

## What it does

Lets a seller attach their own domain to their store instead of the free
`*.goto5x.com` subdomain, with automatic HTTPS.

## How it works

- A seller adds a domain and points its DNS at the platform; a verification
  check confirms ownership before it goes live.
- Once verified, TLS is provisioned and kept renewed automatically (Traefik
  dynamic configuration) — no manual certificate work, ever.
- A domain-upsell referral hook nudges a seller toward buying a domain
  through a partner registrar, tracked via a referral attribution parameter.

## Settings keys

| Key | What it tunes |
|---|---|
| `domains.verification_check_interval_hours` | How often pending domain verifications are rechecked |
