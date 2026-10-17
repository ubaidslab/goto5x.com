import { isDisposableEmailDomain } from "./disposable-email.util";

/** D116 item 5 (Stage 0) - "disposable-email block." */
describe("isDisposableEmailDomain", () => {
  it("flags a well-known disposable-email domain", () => {
    expect(isDisposableEmailDomain("someone@mailinator.com")).toBe(true);
    expect(isDisposableEmailDomain("someone@yopmail.com")).toBe(true);
    expect(isDisposableEmailDomain("SOMEONE@Mailinator.COM")).toBe(true);
  });

  it("flags a subdomain of a wildcard disposable domain", () => {
    expect(isDisposableEmailDomain("someone@inbox.10mail.org")).toBe(true);
  });

  it("does not flag an ordinary email domain", () => {
    expect(isDisposableEmailDomain("founder@gmail.com")).toBe(false);
    expect(isDisposableEmailDomain("buyer@uzeyn.com")).toBe(false);
  });

  it("does not throw on malformed input", () => {
    expect(isDisposableEmailDomain("not-an-email")).toBe(false);
    expect(isDisposableEmailDomain("")).toBe(false);
    expect(isDisposableEmailDomain("trailing-at@")).toBe(false);
  });
});
