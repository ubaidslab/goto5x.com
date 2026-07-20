# Account Security

## What it does

Two-factor authentication and session management for seller accounts (admin
accounts have their own, always-required MFA since Module 1).

## How it works

- **2FA.** TOTP-based (any authenticator app), reusing the exact same
  mechanism built for admin MFA. Enforcement can be optional, required only
  for payout-adjacent actions, or required always — an admin-configurable
  policy, not a hard-coded rule.
- **Sessions & devices.** A seller sees every active session (device label,
  IP, first-seen/last-active) and can revoke any one individually. A
  concurrent-device limit applies platform-wide by default; a per-seller
  override is how the paid extra-device-slot add-on works (billed via the
  wallet — see `wallet-and-billing.md`).
- **Password reset.** Standard self-serve email-link flow.

## Settings keys

| Key | What it tunes |
|---|---|
| `auth.seller_mfa_enforcement` | `optional` / `required_for_payout_actions` / `required_always` |
| `auth.max_concurrent_devices` | Concurrent session limit (global/plan/seller-scoped) |
