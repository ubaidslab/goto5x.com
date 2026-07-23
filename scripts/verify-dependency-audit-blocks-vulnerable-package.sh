#!/usr/bin/env bash
# Module 21 (SRS §14.12 - "A dependency-vulnerability scan runs in CI and
# blocks a deliberately-introduced known-vulnerable dependency").
#
# This does NOT audit this repo's own dependency tree - that's `pnpm audit`
# in CI (see .github/workflows/ci.yml's "dependency-audit" job, gated at
# --audit-level=critical). This proves the AUDIT MECHANISM ITSELF actually
# blocks on a real, known-vulnerable package, using a throwaway fixture so
# the vulnerable package is never installed into this repo's own tree.
#
# minimist@0.0.8 is a long-published (2014), permanently-archived version
# with a well-known critical prototype-pollution advisory
# (GHSA-vh95-rmgr-6w4m / GHSA-xvch-5gv4-984h) - stable to depend on for a
# repeatable test, unlike a recently-disclosed CVE that might get patched
# out from under this script.
set -euo pipefail

FIXTURE_DIR="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

cat > "$FIXTURE_DIR/package.json" <<'EOF'
{
  "name": "dependency-audit-mechanism-fixture",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "minimist": "0.0.8"
  }
}
EOF

echo "Installing a known-vulnerable fixture package (minimist@0.0.8) in an isolated temp dir..."
npm install --prefix "$FIXTURE_DIR" --no-audit --no-fund --silent

echo "Running npm audit against the fixture - expecting it to FAIL (find the vulnerability)..."
if npm audit --prefix "$FIXTURE_DIR" --audit-level=high > /dev/null 2>&1; then
  echo "FAIL: dependency-audit mechanism did NOT flag a known-vulnerable package (minimist@0.0.8)." >&2
  echo "This means 'pnpm audit'/'npm audit' is not behaving as expected - investigate before trusting the CI gate." >&2
  exit 1
fi

echo "PASS: the audit mechanism correctly blocked on a known-vulnerable package."
