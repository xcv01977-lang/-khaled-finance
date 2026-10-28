import { describe, expect, it } from "vitest";
import { fmt, fmtSigned, parseAmount, toHalalas } from "@/lib/money";

describe("parseAmount", () => {
  it("reads plain, Arabic-Indic and separator forms", () => {
    expect(parseAmount("18")).toBe(1800);
    expect(parseAmount("١٨")).toBe(1800);
    expect(parseAmount("18.5")).toBe(1850);
    expect(parseAmount("٣٫٥")).toBe(350);
    expect(parseAmount("1,200")).toBe(120000);
  });
  it("rejects junk and more than two decimals", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12.345")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats whole and fractional riyals", () => {
    expect(fmt(124000)).toBe("1,240");
    expect(fmt(1850)).toBe("18.5");
  });
  it("signs with a real minus", () => {
    expect(fmtSigned(-12000)).toBe("−120");
    expect(fmtSigned(124000)).toBe("+1,240");
    expect(fmtSigned(0)).toBe("0");
  });
  it("avoids float drift", () => {
    expect(toHalalas(0.1 + 0.2)).toBe(30);
  });
});
