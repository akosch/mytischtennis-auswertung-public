export const LEAGUE_LABELS = new Map([
  ["BL1", "1. Bundesliga"], ["BL2", "2. Bundesliga"], ["BL3", "3. Bundesliga"],
  ["RL", "Regionalliga"], ["OL", "Oberliga"], ["VOL", "Verbandsoberliga"],
  ["BaL", "Badenliga"], ["VL", "Verbandsliga"], ["VK", "Verbandsklasse"],
  ["BL", "Bezirksliga"], ["BK", "Bezirksklasse"], ["KL", "Kreisliga"],
  ["KK A", "Kreisklasse A"], ["KK B", "Kreisklasse B"], ["KK C", "Kreisklasse C"],
  ["KK D", "Kreisklasse D"], ["KK E", "Kreisklasse E"],
]);

export const CUP_LABELS = new Map([
  ["A", "A-Pokal"], ["B", "B-Pokal"], ["C", "C-Pokal"], ["D", "D-Pokal"],
]);

const ROMAN_TEAM_NUMBERS = new Map([
  ["I", 1], ["II", 2], ["III", 3], ["IV", 4], ["V", 5],
  ["VI", 6], ["VII", 7], ["VIII", 8], ["IX", 9], ["X", 10],
  ["XI", 11], ["XII", 12], ["XIII", 13], ["XIV", 14], ["XV", 15],
  ["XVI", 16], ["XVII", 17], ["XVIII", 18], ["XIX", 19], ["XX", 20],
]);
const ROMAN_TEAM_SUFFIX = new RegExp(
  `\\s+(${[...ROMAN_TEAM_NUMBERS.keys()].sort((left, right) => right.length - left.length).join("|")})\\s*$`,
  "iu",
);
const ROMAN_NUMBER_TOKEN = new RegExp(
  `\\b(${[...ROMAN_TEAM_NUMBERS.keys()].sort((left, right) => right.length - left.length).join("|")})\\b`,
  "giu",
);

export function normalizeRomanNumerals(value) {
  return String(value ?? "").replace(
    ROMAN_NUMBER_TOKEN,
    (match) => String(ROMAN_TEAM_NUMBERS.get(match.toUpperCase())),
  );
}

function formatTeamName(value) {
  const team = String(value ?? "").trim();
  const roman = team.match(ROMAN_TEAM_SUFFIX);
  if (roman) {
    const club = team.slice(0, roman.index).trim();
    return `${club} ${ROMAN_TEAM_NUMBERS.get(roman[1].toUpperCase())}`;
  }
  if (/\s+(?:[1-9]|1\d|20)\s*$/u.test(team)) return team;
  return `${team} 1`;
}

export function formatCompetition(value, type) {
  const competition = String(value ?? "").normalize("NFKC").trim();
  if (!String(type ?? "").toLocaleLowerCase("de").includes("mannschaft")) return competition;
  const separator = competition.indexOf("|");
  if (separator < 0) return competition;
  const prefix = competition.slice(0, separator).trim();
  const teams = competition.slice(separator + 1).trim().split(/\s*:\s*/u);
  if (teams.length < 2 || teams.some((team) => !team)) return competition;
  return `${prefix} | ${teams.map(formatTeamName).join(" : ")}`;
}

export function competitionTeams(value, type) {
  if (!String(type ?? "").toLocaleLowerCase("de").includes("mannschaft")) return [];
  const competition = formatCompetition(value, type);
  const separator = competition.indexOf("|");
  if (separator < 0) return [];
  return competition.slice(separator + 1).trim().split(/\s*:\s*/u).filter(Boolean);
}
