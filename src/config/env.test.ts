import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe("env.server", () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it("parses without Hubtel credentials", async () => {
    delete process.env.HUBTEL_CLIENT_ID;
    delete process.env.HUBTEL_CLIENT_SECRET;
    delete process.env.HUBTEL_SENDER_ID;
    process.env.PAYSTACK_SECRET_KEY = "sk_test_paystack";

    const { env } = await import("@/config/env");
    const serverEnv = env.server();

    expect(serverEnv.PAYSTACK_SECRET_KEY).toBe("sk_test_paystack");
    expect("HUBTEL_CLIENT_ID" in serverEnv).toBe(false);
  });

  it("treats blank Hubtel placeholders as unset", async () => {
    process.env.HUBTEL_CLIENT_ID = "";
    process.env.HUBTEL_CLIENT_SECRET = "   ";
    process.env.HUBTEL_SENDER_ID = "";
    process.env.PAYSTACK_SECRET_KEY = "sk_test_paystack";

    const { env } = await import("@/config/env");
    expect(() => env.server()).not.toThrow();
    expect(env.server().PAYSTACK_SECRET_KEY).toBe("sk_test_paystack");
  });

  it("treats blank optional Paystack key as unset", async () => {
    process.env.PAYSTACK_SECRET_KEY = "";

    const { env } = await import("@/config/env");
    expect(env.server().PAYSTACK_SECRET_KEY).toBeUndefined();
  });
});

describe("getHubtelConfig", () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it("throws only when SMS config is requested without credentials", async () => {
    process.env.HUBTEL_CLIENT_ID = "";
    process.env.HUBTEL_CLIENT_SECRET = "";
    process.env.HUBTEL_SENDER_ID = "";

    const { getHubtelConfig, HubtelConfigurationError } = await import(
      "@/lib/integrations/hubtel/config"
    );

    expect(() => getHubtelConfig()).toThrow(HubtelConfigurationError);
  });

  it("returns config when all Hubtel credentials are present", async () => {
    process.env.HUBTEL_CLIENT_ID = "client-id";
    process.env.HUBTEL_CLIENT_SECRET = "client-secret";
    process.env.HUBTEL_SENDER_ID = "GIS";

    const { getHubtelConfig } = await import("@/lib/integrations/hubtel/config");

    expect(getHubtelConfig()).toEqual({
      HUBTEL_CLIENT_ID: "client-id",
      HUBTEL_CLIENT_SECRET: "client-secret",
      HUBTEL_SENDER_ID: "GIS",
    });
  });
});
