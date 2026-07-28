import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toTruthyDataAttribute } from "@/lib/utils/dom-attribute";

describe("toTruthyDataAttribute", () => {
  it("returns true only for truthy values", () => {
    expect(toTruthyDataAttribute(true)).toBe(true);
    expect(toTruthyDataAttribute(false)).toBeUndefined();
    expect(toTruthyDataAttribute(undefined)).toBeUndefined();
  });
});

describe("boolean attribute SSR", () => {
  it("omits aria-invalid when normalized from false", () => {
    const html = renderToString(
      React.createElement("input", {
        id: "password",
        "aria-invalid": toTruthyDataAttribute(false),
      }),
    );

    expect(html).not.toContain("aria-invalid");
  });

  it("renders aria-invalid when normalized from true", () => {
    const html = renderToString(
      React.createElement("input", {
        id: "password",
        "aria-invalid": toTruthyDataAttribute(true),
      }),
    );

    expect(html).toContain('aria-invalid="true"');
  });

  it("omits data-invalid on field wrappers when normalized from false", () => {
    const html = renderToString(
      React.createElement("div", {
        role: "group",
        "data-invalid": toTruthyDataAttribute(false),
      }),
    );

    expect(html).not.toContain("data-invalid");
  });
});
