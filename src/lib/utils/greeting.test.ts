import { describe, expect, it } from "vitest";
import { getFirstName, getTimeOfDayGreeting } from "./greeting";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("returns first and last initials for full names", () => {
    expect(getInitials("Harrison Oduro")).toBe("HO");
    expect(getInitials("Mary Baah")).toBe("MB");
  });
});

describe("getTimeOfDayGreeting", () => {
  it("uses morning, afternoon, and evening periods", () => {
    expect(
      getTimeOfDayGreeting("Harrison", new Date("2026-01-01T09:00:00")),
    ).toBe("Good Morning, Harrison 👋");
    expect(
      getTimeOfDayGreeting("Harrison", new Date("2026-01-01T14:00:00")),
    ).toBe("Good Afternoon, Harrison 👋");
    expect(
      getTimeOfDayGreeting("Harrison", new Date("2026-01-01T19:00:00")),
    ).toBe("Good Evening, Harrison 👋");
  });

  it("extracts first name from full name", () => {
    expect(getFirstName("Harrison Oduro")).toBe("Harrison");
  });
});
