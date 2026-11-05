// The one place a trip day is named in words. The Itinerary heading and the
// rating sheet both print it, so the two cannot drift apart.
export function formatDayHeading(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
