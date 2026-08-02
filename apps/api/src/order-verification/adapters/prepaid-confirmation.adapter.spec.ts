import { PrepaidConfirmationAdapter } from "./prepaid-confirmation.adapter";

describe("PrepaidConfirmationAdapter", () => {
  it("is a no-op send - there is no OTP or message for this channel (FR-37.4)", async () => {
    const adapter = new PrepaidConfirmationAdapter();
    const result = await adapter.send({
      orderId: "order-1",
      storeName: "Test Store",
      buyerEmail: "buyer@example.com",
      buyerWhatsapp: null,
      otpCode: null,
      messageTemplate: "unused",
    });
    expect(result).toEqual({});
  });

  it("declares its channel as prepaid_confirmation", () => {
    expect(new PrepaidConfirmationAdapter().channel).toBe("prepaid_confirmation");
  });
});
