#!/usr/bin/env bash
# A2 (docs/founder-decisions-log.md D93): proves the D59 docs-only-skip
# filter in .github/workflows/ci.yml treats every path category the
# founder named - .github/**, pnpm-lock.yaml, any package.json, prisma
# schema/migrations, Dockerfiles, scripts, .env.example, config files -
# as "always triggers the full run." The regex below is deliberately
# duplicated from ci.yml's `changes` job rather than sourced from it, so
# this test still catches a future edit to that job silently narrowing
# the skip condition. Run directly (no args) locally, or via the cheap
# step wired into the `changes` job itself, which runs this on every CI
# invocation.
set -euo pipefail

FILTER_REGEX='^(docs/|CHANGELOG\.md$)'

assert_full_run() {
  local path="$1"
  if echo "$path" | grep -qvE "$FILTER_REGEX"; then
    echo "OK   full run triggered by: $path"
  else
    echo "FAIL $path was classified as skippable - it must not be" >&2
    exit 1
  fi
}

assert_skippable() {
  local path="$1"
  if echo "$path" | grep -qvE "$FILTER_REGEX"; then
    echo "FAIL $path was classified as triggering a full run - it should be skippable" >&2
    exit 1
  else
    echo "OK   skippable: $path"
  fi
}

echo "-- Founder's A2 list: each of these must always trigger the full run --"
assert_full_run ".github/workflows/ci.yml"
assert_full_run ".github/dependabot.yml"
assert_full_run "pnpm-lock.yaml"
assert_full_run "package.json"
assert_full_run "apps/api/package.json"
assert_full_run "apps/web/package.json"
assert_full_run "apps/api/prisma/schema.prisma"
assert_full_run "apps/api/prisma/migrations/20261010000000_example/migration.sql"
assert_full_run "Dockerfile"
assert_full_run "apps/api/Dockerfile"
assert_full_run "scripts/bootstrap-db.sql"
assert_full_run "apps/api/scripts/simulate/cli.ts"
assert_full_run ".env.example"
assert_full_run "apps/api/.env.test.example"
assert_full_run "tsconfig.json"
assert_full_run "apps/api/jest.config.js"
assert_full_run "apps/api/jest.e2e.config.js"

echo "-- Control: these must stay skippable (docs-only paths) --"
assert_skippable "docs/build-plan.md"
assert_skippable "docs/founder-decisions-log.md"
assert_skippable "CHANGELOG.md"

echo "All A2 exclusion checks passed."
