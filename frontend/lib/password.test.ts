import { describe, expect, it } from "vitest";
import { passwordScore } from "./password";

describe("password strength", () => {
  it("flags short passwords", () => { expect(passwordScore("")).toBe(0); expect(passwordScore("abc123")).toBe(1); });
  it("rewards length, case and digits", () => {
    expect(passwordScore("abcdefgh")).toBe(1);
    expect(passwordScore("abcdefg1")).toBe(2);
    expect(passwordScore("Abcdefg1")).toBe(3);
    expect(passwordScore("Abcdefghijk1")).toBe(4);
  });
});
