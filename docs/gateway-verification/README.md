# Gateway verification evidence

D86/D95 (founder decisions, 2026-10-10): a payment gateway's status in
`apps/api/src/payment-gateway/gateway-registry.ts` only moves from
`verifying` to `live` when both of these exist:

1. **A passing contract-test suite** against the provider's real API
   (not the fake-adapter e2e coverage that already exists for
   connect/toggle/credential-handling - a real integration proof).
2. **A file in this directory**, `<provider-key>.md`, written by whoever
   ran that verification, covering at minimum:
   - Date and environment verified in (sandbox vs. production
     merchant credentials).
   - What was tested (a real successful charge, a real failed/declined
     charge, a real refund if applicable, webhook/callback handling if
     the provider has one).
   - Who verified it and how reproducible the verification is (a
     script, a runbook, or a one-off manual check against a sandbox
     account - say which).
   - Any limitation the "live" status should carry (e.g. "verified for
     PKR only," "verified for amounts under X").

Both the registry entry and this file change together, in the same
reviewed PR - neither one alone is sufficient. This directory has no
entries yet: none of the four legacy gateways (Raast, Easypaisa,
JazzCash, bank transfer) have ever had a real integration verified
against them, which is exactly why B3 moved them from "live and
ungated" to `verifying` (Risk #50) rather than leaving the existing
per-connection `isActive` toggle as the only gate.

Demoting a provider back to `verifying` (a regression, a provider
outage, a contract change) does not require deleting its evidence file
- keep it, and note the regression and the new review date at the top
of the same file instead, so the history of what was once proven isn't
lost.
