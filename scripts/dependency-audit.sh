#!/usr/bin/env bash
# CI's "dependency-audit" job (.github/workflows/ci.yml) - the blocking
# `pnpm audit --audit-level=critical` gate, SRS §14.12. Runs through this
# script instead of a bare npm-script one-liner so the two exceptions below
# carry a real, version-controlled, auditable justification instead of a
# silent ignore-list buried in package.json.
#
# `pnpm.auditConfig.ignoreCves` (the field name pnpm's own docs reference
# for this purpose) was tried first and confirmed NOT respected by the
# pnpm version this repo pins (10.33.0 - `pnpm audit` still failed with
# both advisories listed). `pnpm audit --ignore <GHSA-id>` is the
# mechanism actually implemented in that version (confirmed via
# `pnpm audit --help`; https://pnpm.io/10.x/cli/audit), so that's what
# this script uses.
#
# Both exceptions below are for next@14.2.35 (apps/web), investigated and
# documented in full in docs/security-audit-report.md's "5. Next.js
# dependency CVEs" section and docs/SRS.md's Risk Register #29 - this
# script's comments are the short version, that's the long version.
set -euo pipefail

# GHSA-p293-qw3h-jr36 - Next.js Image Optimization API path-traversal RCE,
# Windows-hosted servers only. This platform's entire deployment story is
# Linux (both Dockerfiles build FROM node:20-alpine; docker-compose.yml's
# whole stack is a Linux VPS) - no Windows deployment path exists anywhere
# in this repo, so this CVE has no code path that can ever execute here.
GHSA_WINDOWS_PATH_TRAVERSAL="GHSA-p293-qw3h-jr36"

# GHSA-2xp9-vwfh-vxw4 - Next.js Image Optimization API RCE when AVIF files
# are processed. Not reachable in this codebase for two independent
# reasons: (1) AVIF is never enabled - apps/web/next.config.js has no
# `images.formats` override, and (2) even if it were, next/image is used
# in exactly 2 files (ImageStack.tsx, DeviceMockup.tsx), both marketing
# components fed only hardcoded local build assets, never a remote/user-
# suppliable URL - every path serving real externally-sourced imagery
# (product photos, logos, D-Studio previews, etc.) deliberately uses a
# plain <img> instead, bypassing Next's Image Optimization API entirely.
GHSA_AVIF_IMAGE_OPTIMIZATION_RCE="GHSA-2xp9-vwfh-vxw4"

# TODO(next-15-upgrade): both exceptions above are scoped to next@14.2.35
# specifically and must be re-evaluated (very likely deleted outright) the
# moment the tracked Next.js 14->15 major-version upgrade lands (React 19
# + full regression pass, deliberately its own dedicated task - see
# docs/SRS.md Risk Register #29). Don't carry these forward blindly into a
# post-upgrade audit run.
exec pnpm audit --audit-level=critical \
  --ignore "$GHSA_WINDOWS_PATH_TRAVERSAL" \
  --ignore "$GHSA_AVIF_IMAGE_OPTIMIZATION_RCE"
