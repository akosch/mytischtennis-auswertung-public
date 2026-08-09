import { formatCompetition, normalizeRomanNumerals } from "./competition.js";

export function parseGermanDate(value) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function competitionCategory(value) {
  if (!value?.includes("|")) return { league: "", competitionClass: "" };
  const category = value.split("|", 1)[0].trim();
  const separator = category.indexOf("-");
  if (separator < 0) return { league: category, competitionClass: "" };
  return {
    league: category.slice(0, separator).trim(),
    competitionClass: category.slice(separator + 1).trim(),
  };
}

function normalizeSearchText(value) {
  return normalizeRomanNumerals(String(value ?? "").normalize("NFKC"))
    .toLocaleLowerCase("de")
    .replace(/\s+/gu, " ")
    .trim();
}

export function leagueFromCompetition(value) {
  return competitionCategory(value).league;
}

export function classFromCompetition(value) {
  return competitionCategory(value).competitionClass;
}

export function numericValue(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const match = normalized.match(/[+-]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function roundToWholeNumber(value) {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function individualTtrChange(game) {
  const oldTtr = numericValue(game.ttr);
  const changeConstant = numericValue(game.changeConstant);
  const opponentTtr = numericValue(game.opponentTtr);
  if (
    oldTtr == null
    || changeConstant == null
    || opponentTtr == null
    || typeof game.won !== "boolean"
  ) return null;

  const winProbability = 1 / (1 + (10 ** ((opponentTtr - oldTtr) / 150)));
  return roundToWholeNumber(((game.won ? 1 : 0) - winProbability) * changeConstant);
}

function encounterKey(game) {
  return JSON.stringify([
    game.date,
    game.competition,
    game.changeConstant,
    game.balance,
    game.expectedTotal,
    game.type,
    game.ttr,
    game.ttrChange,
  ]);
}

export function encounterGroups(games) {
  const encounters = new Map();
  for (const game of games) {
    const key = encounterKey(game);
    const encounter = encounters.get(key) ?? {
      key,
      date: game.date,
      competition: game.competition,
      changeConstant: game.changeConstant,
      balance: game.balance,
      expectedTotal: game.expectedTotal,
      type: game.type,
      ttr: game.ttr,
      ttrChange: game.ttrChange,
      games: [],
    };
    encounter.games.push(game);
    encounters.set(key, encounter);
  }
  return [...encounters.values()];
}

export function filterGames(games, filters = {}) {
  const query = normalizeSearchText(filters.query);
  const eventQuery = normalizeSearchText(filters.eventQuery ?? filters.clubQuery);
  const teams = Array.isArray(filters.teams)
    ? filters.teams.map(normalizeSearchText).filter(Boolean)
    : [];
  const opponentTtrFrom = filters.opponentTtrFrom === "" || filters.opponentTtrFrom == null
    ? null
    : Number(filters.opponentTtrFrom);
  const opponentTtrTo = filters.opponentTtrTo === "" || filters.opponentTtrTo == null
    ? null
    : Number(filters.opponentTtrTo);
  const ownTtrFrom = filters.ownTtrFrom === "" || filters.ownTtrFrom == null
    ? null
    : Number(filters.ownTtrFrom);
  const ownTtrTo = filters.ownTtrTo === "" || filters.ownTtrTo == null
    ? null
    : Number(filters.ownTtrTo);
  const filtered = games.filter((game) => {
    const date = parseGermanDate(game.date);
    const ownTtr = Number(String(game.ttr ?? "").match(/\d+/)?.[0]) || null;
    const setCount = Number.isInteger(game.ownSets) && Number.isInteger(game.opponentSets)
      ? game.ownSets + game.opponentSets
      : null;
    if (query && !normalizeSearchText(game.opponentName).includes(query)) return false;
    const competition = normalizeSearchText(formatCompetition(game.competition, game.type));
    if (eventQuery && !competition.includes(eventQuery)) return false;
    if (teams.length && !teams.some((team) => competition.includes(team))) return false;
    if (filters.from && date && date < filters.from) return false;
    if (filters.to && date && date > filters.to) return false;
    if (filters.type && game.type !== filters.type) return false;
    const leagues = Array.isArray(filters.leagues)
      ? filters.leagues
      : filters.league ? [filters.league] : [];
    if (leagues.length && !leagues.includes(leagueFromCompetition(game.competition))) return false;
    if (filters.competitionClass && classFromCompetition(game.competition) !== filters.competitionClass) return false;
    if (opponentTtrFrom != null && (game.opponentTtr == null || game.opponentTtr < opponentTtrFrom)) return false;
    if (opponentTtrTo != null && (game.opponentTtr == null || game.opponentTtr > opponentTtrTo)) return false;
    if (ownTtrFrom != null && (ownTtr == null || ownTtr < ownTtrFrom)) return false;
    if (ownTtrTo != null && (ownTtr == null || ownTtr > ownTtrTo)) return false;
    if (filters.setCount !== "" && filters.setCount != null && setCount !== Number(filters.setCount)) return false;
    const results = Array.isArray(filters.results)
      ? filters.results
      : filters.result ? [filters.result] : [];
    if (results.length) {
      const result = game.won === true ? "won" : game.won === false ? "lost" : null;
      if (!results.includes(result)) return false;
    }
    return true;
  });
  const extremes = filters.ownTtrExtremes ?? [];
  if (!extremes.length) return filtered;
  const ttrs = filtered.map((game) => numericValue(game.ttr)).filter((value) => value != null);
  if (!ttrs.length) return [];
  const lowest = Math.min(...ttrs);
  const highest = Math.max(...ttrs);
  return filtered.filter((game) => {
    const ownTtr = numericValue(game.ttr);
    return extremes.some((extreme) => (extreme === "lowest" && ownTtr === lowest)
      || (extreme === "highest" && ownTtr === highest));
  });
}

export function opponentStats(games) {
  const opponents = new Map();
  for (const game of games) {
    const key = game.opponentId || `name:${game.opponentName}`;
    const current = opponents.get(key) ?? {
      key,
      opponentId: game.opponentId,
      name: game.opponentName,
      games: 0,
      wins: 0,
      losses: 0,
      unknown: 0,
      ownTtr: game.ttr,
      opponentTtr: game.opponentTtr,
      ownSets: 0,
      opponentSets: 0,
      resultSets: "0 : 0",
      ttrDifference: numericValue(game.ttr) != null && numericValue(game.opponentTtr) != null
        ? numericValue(game.ttr) - numericValue(game.opponentTtr)
        : null,
      details: [],
    };
    current.games += 1;
    if (game.won === true) current.wins += 1;
    else if (game.won === false) current.losses += 1;
    else current.unknown += 1;
    current.details.push(game);
    if (Number.isInteger(game.ownSets)) current.ownSets += game.ownSets;
    if (Number.isInteger(game.opponentSets)) current.opponentSets += game.opponentSets;
    current.resultSets = `${current.ownSets} : ${current.opponentSets}`;
    opponents.set(key, current);
  }
  return Array.from(opponents.values()).sort(
    (a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name, "de"),
  );
}

export function resultTotals(games) {
  const totals = {
    ownSets: 0,
    opponentSets: 0,
    ownPoints: 0,
    opponentPoints: 0,
  };
  for (const game of games) {
    if (Number.isInteger(game.ownSets)) totals.ownSets += game.ownSets;
    if (Number.isInteger(game.opponentSets)) totals.opponentSets += game.opponentSets;
    for (const score of game.setScores ?? []) {
      const match = String(score).match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
      if (!match) continue;
      totals.ownPoints += Number(match[1]);
      totals.opponentPoints += Number(match[2]);
    }
  }
  return totals;
}

function dateTimeKey(value) {
  const match = String(value ?? "").match(/^(\d{2})\.(\d{2})\.(\d{4})(?:,\s*(\d{2}:\d{2}))?/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}T${match[4] ?? "00:00"}`;
}

export function longestResultSeries(games, won) {
  const sourceOrder = new Map(games.map((game, index) => [game, index]));
  const chronological = [...games].sort((left, right) => {
    const leftDate = dateTimeKey(left.date);
    const rightDate = dateTimeKey(right.date);
    if (leftDate && rightDate && leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    if (leftDate && !rightDate) return -1;
    if (!leftDate && rightDate) return 1;
    return sourceOrder.get(left) - sourceOrder.get(right);
  });
  const runs = [];
  let current = [];
  for (const game of chronological) {
    if (game.won === won) current.push(game);
    else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  const longest = Math.max(0, ...runs.map((run) => run.length));
  return longest ? runs.filter((run) => run.length === longest) : [];
}
