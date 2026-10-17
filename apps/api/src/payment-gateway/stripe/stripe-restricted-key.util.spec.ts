import { BadRequestException } from "@nestjs/common";
import { assertStripeRestrictedKey } from "./stripe-restricted-key.util";

describe("assertStripeRestrictedKey", () => {
  it("accepts a restricted key", () => {
    expect(() => assertStripeRestrictedKey("rk_test_abc123")).not.toThrow();
  });

  it("rejects a secret key with a message naming the sk_/rk_ distinction", () => {
    expect(() => assertStripeRestrictedKey("sk_test_abc123")).toThrow(BadRequestException);
    expect(() => assertStripeRestrictedKey("sk_live_abc123")).toThrow(/restricted key/);
  });

  it("rejects anything that isn't rk_-prefixed", () => {
    expect(() => assertStripeRestrictedKey("whsec_abc123")).toThrow(BadRequestException);
    expect(() => assertStripeRestrictedKey("")).toThrow(BadRequestException);
    expect(() => assertStripeRestrictedKey("pk_test_abc123")).toThrow(BadRequestException);
  });
});
