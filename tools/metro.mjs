// nearest_metro free text names one station many ways: "Nørreport",
// "Nørreport St.", "Nørreport Station". Station-graph routing needs equal
// stations to share one value, so every spelling collapses to the bare name.
// A parenthesis holds a mode or an access note ("(Metro)", "(then bus 9A)")
// and is dropped with the station word that trails the name.
const ACCESS_NOTE = /\s*\([^)]*\)/g;
const STATION_WORD = /\s+(?:St-train station|Metro Station|Station|St\.|St)$/i;

export function canonicalMetro(raw) {
  if (typeof raw !== "string") return raw;
  return raw.replace(ACCESS_NOTE, "").replace(STATION_WORD, "").replace(/\s+/g, " ").trim();
}
