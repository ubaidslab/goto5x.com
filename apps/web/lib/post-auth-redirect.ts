"use client";

import { api } from "./dashboard-api";

interface StoreSummary {
  id: string;
}

/**
 * The access token's own payload already carries `sellerId`/`supplierId`
 * (AuthService.issueTokens()) - decoding it client-side to branch the
 * post-login redirect needs no new backend endpoint. Never used for
 * anything security-sensitive (every real request is still authorized by
 * the backend re-validating the token itself); this is purely "which
 * landing page do we send this browser to."
 */
function decodeAccessTokenPayload(token: string): { sellerId?: string; supplierId?: string } {
  try {
    const [, payloadB64] = token.split(".");
    return JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 0.1) - login never
 * redirected anywhere at all, so a seller was left sitting on the same
 * small centered auth card after a successful login/MFA-verify, with no
 * path forward - the only page in the whole app that could rescue a
 * zero-store seller (the Module 16 onboarding wizard) is itself nested
 * under a URL that requires an existing storeId, so it was unreachable for
 * exactly the person it exists to help. This is the one shared redirect
 * every successful-auth code path now calls: a supplier lands on the
 * supplier portal; an existing seller lands on their first store (where
 * the onboarding wizard picks up automatically if it isn't complete yet);
 * a brand-new seller with zero stores lands on `/stores/new` to create one.
 */
export async function redirectAfterAuth(router: { push: (href: string) => void }, accessToken: string): Promise<void> {
  const { supplierId } = decodeAccessTokenPayload(accessToken);
  if (supplierId) {
    router.push("/supplier");
    return;
  }

  try {
    const stores = await api.get<StoreSummary[]>("/stores");
    router.push(stores.length > 0 ? `/stores/${stores[0].id}` : "/stores/new");
  } catch {
    // A failed /stores read shouldn't strand the seller on the auth page -
    // /stores/new re-fetches the list itself and handles this the same way.
    router.push("/stores/new");
  }
}
