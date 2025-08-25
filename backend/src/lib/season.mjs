// Determine season for a given latitude and date.
// Supports two modes:
// - 'meteorological' (default): fixed month ranges (Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn)
// - 'astronomical': approximate equinox/solstice cutoffs (uses UTC dates)
// The mode can be overridden by setting process.env.SEASON_MODE = 'astronomical'

function northSeasonMeteorological(month) {
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

function northSeasonAstronomical(date) {
  // approximate UTC dates for equinoxes/solstices (year-agnostic)
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  // Dates (approx): Mar 20 (spring), Jun 21 (summer), Sep 22 (autumn), Dec 21 (winter)
  const ymd = m * 100 + d;
  if (ymd >= 1221 || ymd < 320) return "winter";
  if (ymd >= 320 && ymd < 621) return "spring";
  if (ymd >= 621 && ymd < 922) return "summer";
  return "autumn";
}

export function getSeasonFor(lat, date = new Date(), mode) {
  const envMode =
    (process && process.env && process.env.SEASON_MODE) ||
    mode ||
    "meteorological";
  const month = date.getUTCMonth() + 1;
  const northSeason =
    envMode === "astronomical"
      ? northSeasonAstronomical(date)
      : northSeasonMeteorological(month);
  const hemisphere = lat < 0 ? "south" : "north";
  const season =
    lat < 0
      ? northSeason === "winter"
        ? "summer"
        : northSeason === "summer"
          ? "winter"
          : northSeason === "spring"
            ? "autumn"
            : "spring"
      : northSeason;
  return { season, hemisphere, mode: envMode };
}

export default { getSeasonFor };
