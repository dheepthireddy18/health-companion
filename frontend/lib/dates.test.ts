import { describe, expect, it } from "vitest";
import { addDays, localDate, to12h } from "./api";

describe("date helpers", () => {
  it("formats local dates without UTC drift", () => expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05"));
  it("adds days across month ends", () => expect(addDays("2026-01-31", 1)).toBe("2026-02-01"));
  it("converts to 12 hour time", () => {
    expect(to12h("00:05")).toBe("12:05 AM");
    expect(to12h("13:30")).toBe("1:30 PM");
  });
});
