#!/usr/bin/env node
/**
 * THE ISOLATION RULE (Templates module, v0.31 design phase; see
 * docs/architecture.md's Template Package Spec) - a storefront template
 * package may only touch presentation (colors, fonts, section content/
 * layout, logo). It must never import the fixed system components that own
 * cart/checkout/order-status/wallet/verification/payment logic - that
 * machinery lives entirely outside apps/web/app/storefront/templates/.
 *
 * This is a mechanical backstop, not just a code-review convention: it
 * statically scans every file under the templates directory for an import
 * whose resolved path falls inside a disallowed directory, and fails the
 * build if one is found. Run via `node scripts/check-template-isolation.js`;
 * wired into CI's typecheck job.
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(REPO_ROOT, "apps/web/app/storefront/templates");

const DISALLOWED_DIRS = [
  "apps/web/app/storefront/cart",
  "apps/web/app/storefront/checkout",
  "apps/web/app/storefront/order-status",
  "apps/web/app/(dashboard)/stores/[storeId]/wallet",
  "apps/web/app/(dashboard)/stores/[storeId]/order-verification",
  "apps/web/app/(dashboard)/stores/[storeId]/orders",
  "apps/web/app/(dashboard)/stores/[storeId]/pnl",
  "apps/api/src/orders",
  "apps/api/src/billing",
  "apps/api/src/order-verification",
].map((p) => path.resolve(REPO_ROOT, p));

function listSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    if (/\.(ts|tsx)$/.test(entry.name)) return [full];
    return [];
  });
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const importRe = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g;
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [importRe, requireRe]) {
    let match;
    while ((match = re.exec(source)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function isDisallowed(resolvedPath) {
  return DISALLOWED_DIRS.some((disallowed) => resolvedPath === disallowed || resolvedPath.startsWith(disallowed + path.sep));
}

function main() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.log("check-template-isolation: no templates directory found - nothing to check.");
    return;
  }

  const files = listSourceFiles(TEMPLATES_DIR);
  const violations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of extractImportSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue; // only relative imports can reach outside the package
      const resolved = path.resolve(path.dirname(file), specifier);
      if (isDisallowed(resolved)) {
        violations.push(`${path.relative(REPO_ROOT, file)} imports "${specifier}" -> ${path.relative(REPO_ROOT, resolved)}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("Template isolation violation(s) found - a template package must never import functional cart/checkout/order/billing/verification code:\n");
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }

  console.log(`check-template-isolation: OK (${files.length} file(s) scanned, 0 violations).`);
}

main();
