/** Local emergency numbers by region. Falls back to 112, which works across most of the world's mobile networks. */
const NUMBERS: Record<string, string> = {
  US: "911", CA: "911", MX: "911", GB: "999", IE: "112", IN: "112", AU: "000", NZ: "111", ZA: "10177",
  SG: "995", AE: "998", JP: "119", CN: "120", BR: "192", DE: "112", FR: "15", ES: "112", IT: "118",
};

export function regionOf(locale: string): string | null {
  const m = locale.replace("_", "-").match(/-([A-Za-z]{2})\b/);
  return m ? m[1].toUpperCase() : null;
}

/** A number the patient saved in Settings always wins over the guess from the browser locale. */
export function emergencyNumber(saved: string | null | undefined, locale = "en-US"): string {
  if (saved && saved.trim()) return saved.trim();
  const region = regionOf(locale);
  return (region && NUMBERS[region]) || "112";
}
