import { describe, expect, it } from "vitest";
import { emergencyNumber, regionOf } from "./emergency";

describe("emergencyNumber", () => {
  it("prefers the number saved by the patient", () => expect(emergencyNumber(" 108 ", "en-US")).toBe("108"));
  it("maps the browser region to a local number", () => {
    expect(emergencyNumber(null, "en-US")).toBe("911");
    expect(emergencyNumber(null, "en-GB")).toBe("999");
    expect(emergencyNumber("", "hi-IN")).toBe("112");
    expect(emergencyNumber(undefined, "en_AU")).toBe("000");
  });
  it("falls back to 112 for unknown regions", () => {
    expect(emergencyNumber(null, "xx-ZZ")).toBe("112");
    expect(emergencyNumber(null, "en")).toBe("112");
  });
  it("extracts regions", () => {
    expect(regionOf("pt-br")).toBe("BR");
    expect(regionOf("en")).toBeNull();
  });
});
