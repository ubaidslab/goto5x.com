import { buildWhatsAppDeepLink, interpolateWhatsAppTemplate } from "./whatsapp-link.util";

describe("buildWhatsAppDeepLink", () => {
  it("strips non-digit characters from the phone number and URL-encodes the message", () => {
    const link = buildWhatsAppDeepLink("+92 300-1234567", "Hi there! 50% off");
    expect(link).toBe(`https://wa.me/923001234567?text=${encodeURIComponent("Hi there! 50% off")}`);
  });

  it("FR-55.4 (Module 48) - a nullish phone omits the recipient segment, opening the share picker instead of a pre-addressed chat", () => {
    const link = buildWhatsAppDeepLink(null, "Check out this product!");
    expect(link).toBe(`https://wa.me/?text=${encodeURIComponent("Check out this product!")}`);
  });
});

describe("interpolateWhatsAppTemplate", () => {
  it("replaces every {{key}} placeholder with the matching value", () => {
    const result = interpolateWhatsAppTemplate("Order #{{order_number}} from {{store_name}}", {
      order_number: "ABC123",
      store_name: "Test Store",
    });
    expect(result).toBe("Order #ABC123 from Test Store");
  });

  it("leaves an unrecognized placeholder untouched rather than silently dropping it", () => {
    const result = interpolateWhatsAppTemplate("Hi {{buyer_name}}, order #{{order_number}}", { order_number: "X1" });
    expect(result).toBe("Hi {{buyer_name}}, order #X1");
  });
});
