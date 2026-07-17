"use server";

import { cookies } from "next/headers";
import { unlockStorefront } from "../../lib/storefront-api";
import { unlockCookieName } from "./unlock-cookie";

export async function unlockStoreAction(
  hostname: string,
  storeId: string,
  password: string,
): Promise<{ success: boolean; message?: string }> {
  const token = await unlockStorefront(hostname, password);
  if (!token) {
    return { success: false, message: "Incorrect password." };
  }
  cookies().set(unlockCookieName(storeId), token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // matches the API's 24h unlock token TTL
  });
  return { success: true };
}
