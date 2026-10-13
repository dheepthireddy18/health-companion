import { describe, expect, it } from "vitest";
import { addDays, ago, localDate, to12h } from "./api";

describe("date helpers", () => {
  it("formats local dates without UTC drift", () => expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05"));
  it("adds days across month ends", () => expect(addDays("2026-01-31", 1)).toBe("2026-02-01"));
  it("converts to 12 hour time", () => {
    expect(to12h("00:05")).toBe("12:05 AM");
    expect(to12h("13:30")).toBe("1:30 PM");
  });
  it("shows relative time for chat lists", () => {
    const now = new Date(2026, 5, 10, 12, 0);
    expect(ago(new Date(2026, 5, 10, 11, 59, 40).toISOString(), now)).toBe("just now");
    expect(ago(new Date(2026, 5, 10, 11, 15).toISOString(), now)).toBe("45m");
    expect(ago(new Date(2026, 5, 10, 7, 0).toISOString(), now)).toBe("5h");
    expect(ago(new Date(2026, 5, 8, 12, 0).toISOString(), now)).toBe("2d");
  });
});
