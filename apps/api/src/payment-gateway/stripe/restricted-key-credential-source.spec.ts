import { RestrictedKeyCredentialSource } from "./restricted-key-credential-source";

describe("RestrictedKeyCredentialSource", () => {
  it("resolves to the connection's own apiKey with no connected account", () => {
    const source = new RestrictedKeyCredentialSource();
    expect(source.resolve({ apiKey: "rk_test_abc", merchantId: null })).toEqual({ apiKey: "rk_test_abc" });
  });
});
