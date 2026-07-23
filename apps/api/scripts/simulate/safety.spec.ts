import { assertNotProduction } from "./safety";

describe("assertNotProduction (Module 21 simulation-tool safety net)", () => {
  const originalEnv = process.env.NODE_ENV;
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("refuses to run when NODE_ENV=production and --i-know is absent", () => {
    process.env.NODE_ENV = "production";
    assertNotProduction([]);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("allows running when NODE_ENV=production but --i-know is present", () => {
    process.env.NODE_ENV = "production";
    assertNotProduction(["seed", "--count", "100", "--i-know"]);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("allows running when NODE_ENV is not production, even without --i-know", () => {
    process.env.NODE_ENV = "development";
    assertNotProduction(["seed"]);
    expect(exitSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = "test";
    assertNotProduction(["seed"]);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
