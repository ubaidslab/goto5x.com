import { WhatsAppOtpAdapter } from "./whatsapp-otp.adapter";

describe("WhatsAppOtpAdapter", () => {
  const adapter = new WhatsAppOtpAdapter();

  it("builds a wa.me deep link with the OTP interpolated into the message, digits-only number", async () => {
    const result = await adapter.send({
      orderId: "order-1",
      storeName: "Test Store",
      buyerEmail: "buyer@example.com",
      buyerWhatsapp: "+92 300-1234567",
      otpCode: "654321",
      messageTemplate: "Your code is {{otp}}.",
    });
    expect(result.deepLink).toBe(`https://wa.me/923001234567?text=${encodeURIComponent("Your code is 654321.")}`);
  });

  it("throws when there is no buyer WhatsApp number to send to", async () => {
    await expect(
      adapter.send({
        orderId: "order-1",
        storeName: "Test Store",
        buyerEmail: "buyer@example.com",
        buyerWhatsapp: null,
        otpCode: "654321",
        messageTemplate: "Your code is {{otp}}.",
      }),
    ).rejects.toThrow("Cannot send a WhatsApp OTP without a buyer WhatsApp number.");
  });
});
