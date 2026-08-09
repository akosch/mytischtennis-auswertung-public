import { numericValue } from "./stats.js";

export function displayValue(value) {
  return value === "" || value == null ? "–" : value;
}

export function displayChange(value) {
  if (value == null) return "–";
  const formatted = Math.abs(value).toLocaleString("de-DE", { maximumFractionDigits: 0 });
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function resultLabel(game) {
  if (game.won === true) return "Sieg";
  if (game.won === false) return "Niederlage";
  return "–";
}

export function ttrDifference(game) {
  const ownTtr = numericValue(game.ttr);
  const opponentTtr = numericValue(game.opponentTtr);
  return ownTtr == null || opponentTtr == null ? null : ownTtr - opponentTtr;
}

export function ttrSummary(games) {
  const ttrs = games.map((game) => numericValue(game.ttr)).filter((value) => value != null);
  return {
    wins: games.filter((game) => game.won === true).length,
    losses: games.filter((game) => game.won === false).length,
    lowestTtr: ttrs.length ? Math.min(...ttrs) : "–",
    highestTtr: ttrs.length ? Math.max(...ttrs) : "–",
    averageTtr: ttrs.length
      ? Math.round(ttrs.reduce((sum, value) => sum + value, 0) / ttrs.length)
      : "–",
  };
}

export function dateParts(value) {
  const [date, time] = String(displayValue(value)).split(/,\s*/, 2);
  return { date, time };
}

export function captureInfoText(label, gameCount, capturedAt) {
  const timestamp = new Date(capturedAt);
  const date = timestamp.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = timestamp.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${label} · ${gameCount} Spiele · eingelesen am ${date} um ${time} Uhr`;
}

export function resultsHeadingText(name, club, capturedAt) {
  if (!name || !capturedAt) return "Ergebnisse";
  const timestamp = new Date(capturedAt);
  const date = timestamp.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = timestamp.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const clubText = club ? ` (${club})` : "";
  return `Ergebnisse für ${name}${clubText} bis zum ${date} ${time} Uhr`;
}
