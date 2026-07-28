import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClientEnv = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

const mockServerEnv: { PAYMENT_EMAIL_DOMAIN?: string } = {};

vi.mock("@/config/env", () => ({
  env: {
    client: () => mockClientEnv,
    server: () => mockServerEnv,
  },
}));

import {
  deriveMemberPaymentEmail,
  deriveMemberPaymentEmailAddress,
  getPaymentEmailDomain,
  isPaystackCompatibleEmail,
} from "@/lib/payments/member-email";

describe("getPaymentEmailDomain", () => {
  beforeEach(() => {
    mockClientEnv.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete mockServerEnv.PAYMENT_EMAIL_DOMAIN;
  });

  it("uses PAYMENT_EMAIL_DOMAIN when configured", () => {
    mockServerEnv.PAYMENT_EMAIL_DOMAIN = "payments.gisintake28.org";
    expect(getPaymentEmailDomain()).toBe("payments.gisintake28.org");
  });

  it("derives domain from production app URL hostname", () => {
    mockClientEnv.NEXT_PUBLIC_APP_URL = "https://welfare.gisintake28.org";
    expect(getPaymentEmailDomain()).toBe("welfare.gisintake28.org");
  });

  it("falls back on localhost", () => {
    expect(getPaymentEmailDomain()).toBe("gis28welfare.org");
  });
});

describe("deriveMemberPaymentEmail", () => {
  beforeEach(() => {
    mockClientEnv.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete mockServerEnv.PAYMENT_EMAIL_DOMAIN;
  });

  it("derives email from service number for IS/13989", () => {
    expect(
      deriveMemberPaymentEmail({ serviceNumber: "IS/13989" }),
    ).toBe("IS13989@gis28welfare.org");
  });

  it("uses configured payment domain", () => {
    mockServerEnv.PAYMENT_EMAIL_DOMAIN = "payments.gisintake28.org";
    expect(
      deriveMemberPaymentEmail({ serviceNumber: "IS/13989" }),
    ).toBe("IS13989@payments.gisintake28.org");
  });
});

describe("deriveMemberPaymentEmailAddress", () => {
  beforeEach(() => {
    mockClientEnv.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete mockServerEnv.PAYMENT_EMAIL_DOMAIN;
  });

  it("prefers member email when available", () => {
    expect(
      deriveMemberPaymentEmailAddress({
        serviceNumber: "IS/13989",
        email: "mary@gmail.com",
      }),
    ).toBe("mary@gmail.com");
  });

  it("falls back to synthetic email when member email is absent", () => {
    expect(
      deriveMemberPaymentEmailAddress({
        serviceNumber: "IS/13989",
        email: null,
      }),
    ).toBe("IS13989@gis28welfare.org");
  });
});

describe("isPaystackCompatibleEmail", () => {
  it("rejects .local synthetic auth domains", () => {
    expect(isPaystackCompatibleEmail("IS13989@giswelfare.local")).toBe(false);
    expect(isPaystackCompatibleEmail("is13989@gis-welfare.local")).toBe(false);
  });

  it("accepts standard payment domains", () => {
    expect(isPaystackCompatibleEmail("IS13989@gis28welfare.org")).toBe(true);
    expect(isPaystackCompatibleEmail("IS13989@payments.gisintake28.org")).toBe(true);
  });
});
