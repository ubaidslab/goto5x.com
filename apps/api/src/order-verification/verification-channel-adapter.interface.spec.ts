import { interpolateTemplate } from "./verification-channel-adapter.interface";

describe("interpolateTemplate", () => {
  it("replaces every {{otp}} occurrence with the code", () => {
    expect(interpolateTemplate("Code: {{otp}}. Again: {{otp}}.", "654321")).toBe("Code: 654321. Again: 654321.");
  });

  it("returns the template unchanged when there is no OTP (prepaid_confirmation)", () => {
    expect(interpolateTemplate("No code needed for {{otp}} channel", null)).toBe(
      "No code needed for {{otp}} channel",
    );
  });
});
