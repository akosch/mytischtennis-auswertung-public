import {
  classFromCompetition,
  encounterGroups,
  filterGames,
  individualTtrChange,
  leagueFromCompetition,
  longestResultSeries,
  numericValue,
  opponentStats,
  parseGermanDate,
  resultTotals,
} from "./shared/stats.js?v=6";
import { decryptJson } from "./shared/crypto.js";
import { setupSingleSelect } from "./shared/filter-controls.js?v=1";
import { CUP_LABELS, competitionTeams, formatCompetition, LEAGUE_LABELS } from "./shared/competition.js?v=2";
import {
  availablePlayerClubs,
  playerOptionLabel,
  sortedPlayerEntries,
} from "./shared/player-selection.js";
import { resultsHeadingText, ttrDifference, ttrSummary } from "./shared/result-view.js?v=2";
import {
  ENCOUNTER_DETAIL_COLUMNS,
  ENCOUNTER_TABLE_COLUMNS,
  GAME_TABLE_COLUMNS,
  OPPONENT_DETAIL_COLUMNS,
  OPPONENT_TABLE_COLUMNS,
} from "./shared/result-tables.js?v=2";
import {
  createCell as td,
  createChangeCell,
  createDateCell as dateCell,
  createDetailsRow,
  createMetric as metric,
  createMetricButton,
  createMetricGroup,
  createMetricSeparator,
  createResultCell,
  createSetBalanceCell,
  createSetScoresCell,
  createSeriesHeadingRow,
  createSortableTableHead,
  setupScrollProxy,
  setupStickyResultsHeader,
  createToggleRow,
  headingClass,
} from "./shared/result-renderer.js?v=4";

const elements = {
  status: document.querySelector("#status"),
  passwordDialog: document.querySelector("#passwordDialog"),
  passwordForm: document.querySelector("#passwordForm"),
  passwordInput: document.querySelector("#passwordInput"),
  cancelPassword: document.querySelector("#cancelPassword"),
  resultsHeading: document.querySelector("#resultsHeading"),
  calculationNote: document.querySelector("#calculationNote"),
  clubFilter: document.querySelector("#clubFilter"),
  clubFilterSummary: document.querySelector("#clubFilterSummary"),
  clubFilterOptions: document.querySelector("#clubFilterOptions"),
  playerSelect: document.querySelector("#playerSelect"),
  playerFilter: document.querySelector("#playerFilter"),
  playerFilterSummary: document.querySelector("#playerFilterSummary"),
  playerFilterOptions: document.querySelector("#playerFilterOptions"),
  togglePlayers: document.querySelector("#togglePlayers"),
  playerControls: document.querySelector("#playerControls"),
  toggleFilters: document.querySelector("#toggleFilters"),
  filters: document.querySelector("#filters"),
  query: document.querySelector("#query"),
  teamFilter: document.querySelector("#teamFilter"),
  teamFilterSummary: document.querySelector("#teamFilterSummary"),
  teamFilterOptions: document.querySelector("#teamFilterOptions"),
  eventQuery: document.querySelector("#eventQuery"),
  from: document.querySelector("#from"),
  to: document.querySelector("#to"),
  type: document.querySelector("#type"),
  typeFilter: document.querySelector("#typeFilter"),
  typeFilterSummary: document.querySelector("#typeFilterSummary"),
  typeFilterOptions: document.querySelector("#typeFilterOptions"),
  leagueFilter: document.querySelector("#leagueFilter"),
  leagueFilterSummary: document.querySelector("#leagueFilterSummary"),
  leagueFilterOptions: document.querySelector("#leagueFilterOptions"),
  competitionClass: document.querySelector("#competitionClass"),
  classFilter: document.querySelector("#classFilter"),
  classFilterSummary: document.querySelector("#classFilterSummary"),
  classFilterOptions: document.querySelector("#classFilterOptions"),
  opponentTtrFrom: document.querySelector("#opponentTtrFrom"),
  opponentTtrTo: document.querySelector("#opponentTtrTo"),
  ownTtrFrom: document.querySelector("#ownTtrFrom"),
  ownTtrTo: document.querySelector("#ownTtrTo"),
  setCount: document.querySelector("#setCount"),
  setCountFilter: document.querySelector("#setCountFilter"),
  setCountFilterSummary: document.querySelector("#setCountFilterSummary"),
  setCountFilterOptions: document.querySelector("#setCountFilterOptions"),
  summary: document.querySelector("#summary"),
  viewButtons: document.querySelectorAll("[data-view]"),
  expandActions: document.querySelector("#expandActions"),
  expandAll: document.querySelector("#expandAll"),
  collapseAll: document.querySelector("#collapseAll"),
  resultsScroll: document.querySelector("#resultsScroll"),
  resultsScrollTop: document.querySelector("#resultsScrollTop"),
  resultsSection: document.querySelector("#resultsSection"),
  resultsStickyHeader: document.querySelector("#resultsStickyHeader"),
  resultsTable: document.querySelector("#resultsTable"),
};

const singleSelectSync = {
  player: setupSingleSelect({
    select: elements.playerSelect,
    details: elements.playerFilter,
    summary: elements.playerFilterSummary,
    options: elements.playerFilterOptions,
  }),
  type: setupSingleSelect({
    select: elements.type,
    details: elements.typeFilter,
    summary: elements.typeFilterSummary,
    options: elements.typeFilterOptions,
  }),
  competitionClass: setupSingleSelect({
    select: elements.competitionClass,
    details: elements.classFilter,
    summary: elements.classFilterSummary,
    options: elements.classFilterOptions,
  }),
  setCount: setupSingleSelect({
    select: elements.setCount,
    details: elements.setCountFilter,
    summary: elements.setCountFilterSummary,
    options: elements.setCountFilterOptions,
  }),
};

const state = {
  captures: {},
  activeDatasetKey: null,
  selectedClubs: new Set(),
  selectedTeams: new Set(),
  selectedLeagues: new Set(),
  view: "opponents",
  expandedByView: {
    opponents: new Set(),
    encounters: new Set(),
  },
  resultSelection: new Set(),
  ttrSelection: null,
  seriesMode: null,
  sorts: {
    opponents: { key: "games", direction: "desc" },
    games: { key: "date", direction: "desc" },
    encounters: { key: "date", direction: "desc" },
  },
};

const viewScrollPositions = {
  opponents: { top: 0, left: 0, pageLeft: 0 },
  encounters: { top: 0, left: 0, pageLeft: 0 },
  games: { top: 0, left: 0, pageLeft: 0 },
};

function expandedKeysFor(view = state.view) {
  return state.expandedByView[view] ?? state.expandedByView.opponents;
}

function rememberViewScroll(view) {
  viewScrollPositions[view] = {
    top: window.scrollY,
    left: elements.resultsScroll?.scrollLeft ?? 0,
    pageLeft: window.scrollX,
  };
}

function restoreViewScroll(view) {
  const saved = viewScrollPositions[view] ?? { top: 0, left: 0, pageLeft: 0 };
  requestAnimationFrame(() => {
    window.scrollTo({ left: saved.pageLeft, top: saved.top, behavior: "auto" });
    for (const scroll of [elements.resultsScroll, elements.resultsScrollTop]) {
      if (scroll) scroll.scrollLeft = saved.left;
    }
  });
}

function playerLabel(capture, key) {
  const player = capture?.player ?? {};
  return [player.name, player.club].filter(Boolean).join(" · ") || key;
}

function currentCapture() {
  return state.captures[state.activeDatasetKey] ?? null;
}

function requestPassword() {
  return new Promise((resolve) => {
    const finish = (value) => {
      elements.passwordInput.value = "";
      if (elements.passwordDialog.open) elements.passwordDialog.close();
      resolve(value);
    };
    const submit = (event) => {
      event.preventDefault();
      finish(elements.passwordInput.value);
    };
    const cancel = () => finish(null);
    elements.passwordForm.addEventListener("submit", submit, { once: true });
    elements.cancelPassword.addEventListener("click", cancel, { once: true });
    elements.passwordDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancel();
    }, { once: true });
    elements.passwordDialog.showModal();
    elements.passwordInput.focus();
  });
}

const resultCell = (game) => createResultCell(game, { positiveClass: "positive", negativeClass: "negative" });
const changeCell = (value) => createChangeCell(value, { positiveClass: "positive", negativeClass: "negative" });
function sortedItems(items, columns, sort) {
  const column = columns.find(({ key }) => key === sort.key) ?? columns[0];
  const direction = sort.direction === "asc" ? 1 : -1;
  const sourceOrder = new Map(items.map((item, index) => [item, index]));
  return [...items].sort((left, right) => {
    const leftValue = column.value(left);
    const rightValue = column.value(right);
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    const comparison = column.type === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), "de", { numeric: true });
    if (comparison) return direction * comparison;
    if (column.key === "date" && left.date === right.date) {
      return direction * (sourceOrder.get(left) - sourceOrder.get(right));
    }
    return 0;
  });
}

function sortableHeading(columns, sort, onSort, classForLabel = headingClass) {
  return createSortableTableHead(columns, {
    key: sort.key,
    direction: sort.direction,
    onSort: (key) => {
      if (sort.key === key) sort.direction = sort.direction === "asc" ? "desc" : "asc";
      else {
        sort.key = key;
        sort.direction = columns.find((column) => column.key === key)?.type === "number" ? "desc" : "asc";
      }
      onSort?.();
    },
    classForLabel,
  });
}

const opponentHeadingClass = (label) => label === "Sätze" ? "align-center" : headingClass(label);

function opponentColumns() {
  return [
    { key: "name", label: OPPONENT_TABLE_COLUMNS[0], type: "text", value: (stat) => stat.name },
    { key: "games", label: OPPONENT_TABLE_COLUMNS[1], type: "number", value: (stat) => stat.games },
    { key: "wins", label: OPPONENT_TABLE_COLUMNS[2], type: "number", value: (stat) => stat.wins },
    { key: "losses", label: OPPONENT_TABLE_COLUMNS[3], type: "number", value: (stat) => stat.losses },
    { key: "quote", label: OPPONENT_TABLE_COLUMNS[4], type: "number", value: (stat) => stat.games ? stat.wins / stat.games : 0 },
    { key: "resultSets", label: OPPONENT_TABLE_COLUMNS[5], type: "text", value: (stat) => stat.resultSets },
  ];
}

function gameColumns() {
  return [
    { key: "date", label: GAME_TABLE_COLUMNS[0], type: "date", value: (game) => parseGermanDate(game.date) ?? game.date },
    { key: "competition", label: GAME_TABLE_COLUMNS[1], type: "text", value: (game) => formatCompetition(game.competition, game.type) },
    { key: "opponent", label: GAME_TABLE_COLUMNS[2], type: "text", value: (game) => game.opponentName },
    { key: "score", label: GAME_TABLE_COLUMNS[3], type: "text", value: (game) => game.score },
    { key: "result", label: GAME_TABLE_COLUMNS[4], type: "text", value: (game) => game.won === true ? "Sieg" : game.won === false ? "Niederlage" : "–" },
    { key: "setScores", label: GAME_TABLE_COLUMNS[5], type: "text", sortable: false, value: (game) => game.setScores?.join(" ") || "–" },
    { key: "ownTtr", label: GAME_TABLE_COLUMNS[6], type: "number", value: (game) => numericValue(game.ttr) },
    { key: "opponentTtr", label: GAME_TABLE_COLUMNS[7], type: "number", value: (game) => numericValue(game.opponentTtr) },
    { key: "ttrDifference", label: GAME_TABLE_COLUMNS[8], type: "number", value: ttrDifference },
    { key: "change", label: GAME_TABLE_COLUMNS[9], type: "number", value: individualTtrChange },
  ];
}

function encounterColumns() {
  return [
    { key: "date", label: ENCOUNTER_TABLE_COLUMNS[0], type: "date", value: (encounter) => parseGermanDate(encounter.date) ?? encounter.date },
    { key: "competition", label: ENCOUNTER_TABLE_COLUMNS[1], type: "text", value: (encounter) => formatCompetition(encounter.competition, encounter.type) },
    { key: "balance", label: ENCOUNTER_TABLE_COLUMNS[2], type: "text", value: (encounter) => encounter.balance },
    { key: "type", label: ENCOUNTER_TABLE_COLUMNS[3], type: "text", value: (encounter) => encounter.type },
    { key: "ttr", label: ENCOUNTER_TABLE_COLUMNS[4], type: "number", value: (encounter) => numericValue(encounter.ttr) },
    { key: "change", label: ENCOUNTER_TABLE_COLUMNS[5], type: "number", value: (encounter) => numericValue(encounter.ttrChange) },
  ];
}

function detailsRow(games, colSpan, includeEventColumns) {
  return createDetailsRow({
    games,
    colSpan,
    className: includeEventColumns ? "opponent-details-table" : "encounter-details-table",
    labels: includeEventColumns ? OPPONENT_DETAIL_COLUMNS : ENCOUNTER_DETAIL_COLUMNS,
    renderGameCells: (game) => {
      const commonCells = [
        td(game.score, "align-center"),
        resultCell(game),
        createSetScoresCell(game),
        td(game.ttr, "align-center"),
        td(game.opponentTtr, "align-center"),
        changeCell(ttrDifference(game)),
        changeCell(individualTtrChange(game)),
      ];
      if (includeEventColumns) {
        return [
          dateCell(game.date),
          td(formatCompetition(game.competition, game.type), "align-left"),
          ...commonCells,
        ];
      }
      return [
        td(game.opponentName, "align-left"),
        ...commonCells,
      ];
    },
  });
}

function toggleRow(key, games, row, colSpan, includeEventColumns) {
  const expandedKeys = expandedKeysFor();
  const groupedRow = createToggleRow({
    key,
    cells: [...row.children],
    expanded: expandedKeys.has(key),
    onToggle: () => {
      if (expandedKeys.has(key)) expandedKeys.delete(key);
      else expandedKeys.add(key);
      render();
    },
  });
  return expandedKeys.has(key)
    ? [groupedRow, detailsRow(games, colSpan, includeEventColumns)]
    : [groupedRow];
}

function renderOpponents(games) {
  const table = elements.resultsTable;
  const columns = opponentColumns();
  const stats = sortedItems(opponentStats(games), columns, state.sorts.opponents);
  table.replaceChildren(sortableHeading(columns, state.sorts.opponents, render, opponentHeadingClass));
  const body = document.createElement("tbody");
  for (const stat of stats) {
    const row = document.createElement("tr");
    row.append(
      td(stat.name),
      td(stat.games, "center"),
      td(stat.wins, "center"),
      td(stat.losses, "center"),
      td(`${Math.round((stat.wins / stat.games) * 100)} %`, "center"),
      createSetBalanceCell(stat.resultSets),
    );
    body.append(...toggleRow(stat.key, stat.details, row, 6, true));
  }
  table.append(body);
}

function renderGames(games) {
  const table = elements.resultsTable;
  const columns = gameColumns();
  const seriesRuns = state.seriesMode
    ? longestResultSeries(
      filterGames(currentCapture()?.games ?? [], { ...filters(), results: [] }),
      state.seriesMode === "wins",
    )
    : [];
  const headColumns = state.seriesMode
    ? columns.map((column) => ({ ...column, sortable: false }))
    : columns;
  table.replaceChildren(sortableHeading(headColumns, state.sorts.games, render));
  const body = document.createElement("tbody");
  const appendGame = (game) => {
    const row = document.createElement("tr");
    row.append(
      dateCell(game.date),
      td(formatCompetition(game.competition, game.type), "align-left"),
      td(game.opponentName, "align-left"),
      td(game.score, "center"),
      resultCell(game),
      createSetScoresCell(game),
      td(game.ttr, "align-center"),
      td(game.opponentTtr, "align-center"),
      changeCell(ttrDifference(game)),
      changeCell(individualTtrChange(game)),
    );
    body.append(row);
  };
  if (state.seriesMode) {
    const seriesLabel = state.seriesMode === "wins" ? "Siegesserie" : "Niederlagenserie";
    for (const run of [...seriesRuns].reverse()) {
      body.append(createSeriesHeadingRow(`${seriesLabel} · ${run.length} Spiele`, columns.length));
      for (const game of [...run].reverse()) appendGame(game);
    }
  } else {
    for (const game of sortedItems(games, columns, state.sorts.games)) appendGame(game);
  }
  if (state.seriesMode && !seriesRuns.length) {
    table.append(emptyBody(columns.length));
    return;
  }
  table.append(body);
}

function renderEncounters(games) {
  const table = elements.resultsTable;
  const columns = encounterColumns();
  table.replaceChildren(sortableHeading(columns, state.sorts.encounters, render));
  const body = document.createElement("tbody");
  for (const encounter of sortedItems(encounterGroups(games), columns, state.sorts.encounters)) {
    const row = document.createElement("tr");
    row.append(
      dateCell(encounter.date),
      td(formatCompetition(encounter.competition, encounter.type), "align-left"),
      td(encounter.balance, "center"),
      td(encounter.type, "center"),
      td(encounter.ttr, "center"),
      changeCell(numericValue(encounter.ttrChange)),
    );
    const detailGames = state.sorts.encounters.direction === "desc"
      ? [...encounter.games].reverse()
      : encounter.games;
    body.append(...toggleRow(encounter.key, detailGames, row, 6, false));
  }
  table.append(body);
}

function filters() {
  updateLeagueFilterState();
  return {
    query: elements.query.value,
    eventQuery: elements.eventQuery.value,
    teams: [...state.selectedTeams],
    from: elements.from.value,
    to: elements.to.value,
    type: elements.type.value,
    results: [...state.resultSelection],
    ownTtrExtremes: state.ttrSelection ? [state.ttrSelection] : [],
    leagues: elements.type.value === "Turnier" ? [] : [...state.selectedLeagues],
    competitionClass: elements.competitionClass.value,
    opponentTtrFrom: elements.opponentTtrFrom.value,
    opponentTtrTo: elements.opponentTtrTo.value,
    ownTtrFrom: elements.ownTtrFrom.value,
    ownTtrTo: elements.ownTtrTo.value,
    setCount: elements.setCount.value,
  };
}

function metricFilter(label, value, count) {
  return createMetricButton(label, value, count, {
    pressed: state.resultSelection.has(value),
    onClick: () => {
      if (state.resultSelection.has(value)) state.resultSelection.delete(value);
      else state.resultSelection.add(value);
      render();
    },
  });
}

function ttrMetricFilter(label, value, count) {
  return createMetricButton(label, value, count, {
    pressed: state.ttrSelection === value,
    onClick: () => {
      state.ttrSelection = state.ttrSelection === value ? null : value;
      render();
    },
  });
}

function seriesMetricFilter(label, mode, count) {
  const button = createMetricButton(label, mode, count, {
    pressed: state.seriesMode === mode,
    onClick: () => {
      state.seriesMode = state.seriesMode === mode ? null : mode;
      render();
    },
  });
  button.classList.add(mode === "wins" ? "series-wins" : "series-losses");
  const tooltip = mode === "wins" ? "Längste Siegesserie" : "Längste Niederlagenserie";
  button.title = tooltip;
  button.dataset.tooltip = tooltip;
  return button;
}

function render() {
  const capture = currentCapture();
  const games = filterGames(capture?.games ?? [], filters());
  const stats = opponentStats(games);
  const wins = games.filter((game) => game.won === true).length;
  const losses = games.filter((game) => game.won === false).length;
  const { ownSets, opponentSets, ownPoints, opponentPoints } = resultTotals(games);
  const { lowestTtr, highestTtr, averageTtr } = ttrSummary(games);
  const seriesGames = filterGames(capture?.games ?? [], { ...filters(), results: [] });
  const longestWinSeries = longestResultSeries(seriesGames, true);
  const longestLossSeries = longestResultSeries(seriesGames, false);
  const seriesGroup = createMetricGroup(
    seriesMetricFilter("S-Serie", "wins", longestWinSeries[0]?.length ?? 0),
    seriesMetricFilter("N-Serie", "losses", longestLossSeries[0]?.length ?? 0),
  );
  seriesGroup.hidden = state.view !== "games";
  elements.summary.replaceChildren(
    metric("Gegner", stats.length),
    createMetricSeparator(),
    metric("Spiele", games.length),
    metricFilter("Siege", "won", wins),
    metricFilter("Niederlagen", "lost", losses),
    metric("Quote", games.length ? `${Math.round((wins / games.length) * 100)} %` : "–"),
    metric("Sätze", `${ownSets} : ${opponentSets}`),
    metric("Punkte", `${ownPoints} : ${opponentPoints}`),
    createMetricGroup(
      ttrMetricFilter("Niedrigster TTR", "lowest", lowestTtr),
      ttrMetricFilter("Höchster TTR", "highest", highestTtr),
      metric("Ø TTR", averageTtr),
    ),
    seriesGroup,
  );
  for (const button of elements.viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  }
  elements.expandActions.hidden = state.view === "games";
  if (state.view === "games") renderGames(games);
  else if (state.view === "encounters") renderEncounters(games);
  else renderOpponents(games);
  elements.resultsTable.dataset.view = state.view;
  elements.calculationNote.hidden = state.view !== "encounters";
  setupStickyResultsHeader(elements.resultsSection, elements.resultsStickyHeader);
  setupScrollProxy(elements.resultsScrollTop, elements.resultsScroll, elements.resultsTable);
}

function populateFilters() {
  const games = currentCapture()?.games ?? [];
  const replaceOptions = (element, values, labels = new Map()) => {
    const current = element.value;
    element.replaceChildren(new Option("Alle", ""));
    for (const value of [...new Set(values.filter(Boolean))].sort()) {
      element.append(new Option(labels.get(value) ?? value, value));
    }
    element.value = values.includes(current) ? current : "";
  };
  replaceOptions(elements.type, games.map((game) => game.type));
  singleSelectSync.type();
  populateTeams();
  populateLeagues();
  replaceOptions(elements.competitionClass, games.map((game) => classFromCompetition(game.competition)));
  singleSelectSync.competitionClass();
}

function populateLeagues() {
  const available = new Set(
    (currentCapture()?.games ?? []).map((game) => leagueFromCompetition(game.competition)).filter(Boolean),
  );
  state.selectedLeagues = new Set([...state.selectedLeagues].filter((league) => available.has(league)));
  elements.leagueFilterOptions.replaceChildren();
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "multi-select-clear";
  clear.textContent = "Alle Ligen";
  clear.addEventListener("click", () => {
    state.selectedLeagues.clear();
    populateLeagues();
    render();
  });
  elements.leagueFilterOptions.append(clear);

  const appendSeparator = () => {
    const separator = document.createElement("div");
    separator.className = "multi-select-separator";
    separator.textContent = "──────────";
    elements.leagueFilterOptions.append(separator);
  };
  const appendLeague = (code, label) => {
    const option = document.createElement("label");
    option.className = "multi-select-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = code;
    checkbox.checked = state.selectedLeagues.has(code);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedLeagues.add(code);
      else state.selectedLeagues.delete(code);
      updateLeagueFilterSummary();
      render();
    });
    const text = document.createElement("span");
    text.textContent = label;
    option.append(checkbox, text);
    elements.leagueFilterOptions.append(option);
  };
  for (const [code, label] of [...LEAGUE_LABELS].filter(([code]) => available.has(code))) {
    appendLeague(code, label);
  }
  const cups = [...CUP_LABELS].filter(([code]) => available.has(code));
  if (cups.length) {
    appendSeparator();
    for (const [code, label] of cups) appendLeague(code, label);
  }
  const unknown = [...available]
    .filter((code) => !LEAGUE_LABELS.has(code) && !CUP_LABELS.has(code))
    .sort((left, right) => left.localeCompare(right, "de"));
  if (unknown.length) {
    appendSeparator();
    for (const code of unknown) appendLeague(code, code);
  }
  updateLeagueFilterSummary();
}

function updateLeagueFilterSummary() {
  const leagues = [...state.selectedLeagues];
  elements.leagueFilterSummary.textContent = leagues.length === 0
    ? "Alle Ligen"
    : leagues.length === 1 ? [...LEAGUE_LABELS, ...CUP_LABELS].find(([code]) => code === leagues[0])?.[1] ?? leagues[0]
      : `${leagues.length} Ligen ausgewählt`;
}

function updateTeamFilterSummary() {
  const teams = [...state.selectedTeams];
  elements.teamFilterSummary.textContent = teams.length === 0
    ? "Alle Mannschaften"
    : teams.length === 1 ? teams[0] : `${teams.length} ausgewählt`;
}

function populateTeams() {
  const available = [...new Set(
    (currentCapture()?.games ?? []).flatMap((game) => competitionTeams(game.competition, game.type)),
  )].sort((left, right) => left.localeCompare(right, "de"));
  state.selectedTeams = new Set([...state.selectedTeams].filter((team) => available.includes(team)));
  elements.teamFilterOptions.replaceChildren();

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "multi-select-clear";
  clear.textContent = "Alle Mannschaften";
  clear.addEventListener("click", () => {
    state.selectedTeams.clear();
    populateTeams();
    render();
  });
  elements.teamFilterOptions.append(clear);

  for (const team of available) {
    const option = document.createElement("label");
    option.className = "multi-select-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = team;
    checkbox.checked = state.selectedTeams.has(team);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedTeams.add(team);
      else state.selectedTeams.delete(team);
      updateTeamFilterSummary();
      render();
    });
    const text = document.createElement("span");
    text.textContent = team;
    option.append(checkbox, text);
    elements.teamFilterOptions.append(option);
  }
  updateTeamFilterSummary();
}

function updateLeagueFilterState() {
  const disabled = elements.type.value === "Turnier";
  elements.leagueFilter.classList.toggle("is-disabled", disabled);
  elements.leagueFilter.setAttribute("aria-disabled", String(disabled));
  if (disabled) {
    elements.leagueFilter.open = false;
    elements.leagueFilterSummary.textContent = "Bei Turnier nicht verfügbar";
  } else {
    updateLeagueFilterSummary();
  }
}

function selectDataset(key) {
  const entries = sortedPlayerEntries(state.captures, state.selectedClubs);
  const visibleKeys = new Set(entries.map(([entryKey]) => entryKey));
  state.activeDatasetKey = key && visibleKeys.has(key) ? key : null;
  const capture = currentCapture();
  elements.playerSelect.value = state.activeDatasetKey ?? "";
  elements.resultsHeading.textContent = capture
    ? resultsHeadingText(capture.player?.name ?? playerLabel(capture, state.activeDatasetKey), capture.player?.club ?? "", capture.capturedAt)
    : "Ergebnisse";
  state.expandedByView.opponents.clear();
  state.expandedByView.encounters.clear();
  state.seriesMode = null;
  state.resultSelection.clear();
  state.ttrSelection = null;
  populateFilters();
  render();
}

function updateClubFilterSummary() {
  const clubs = [...state.selectedClubs];
  elements.clubFilterSummary.textContent = clubs.length === 0
    ? "Alle Vereine"
    : clubs.length === 1 ? clubs[0] : `${clubs.length} Vereine ausgewählt`;
}

function populateClubFilter() {
  const available = availablePlayerClubs(state.captures);
  state.selectedClubs = new Set([...state.selectedClubs].filter((club) => available.includes(club)));
  elements.clubFilterOptions.replaceChildren();

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "multi-select-clear";
  clear.textContent = "Alle Vereine";
  clear.addEventListener("click", () => {
    state.selectedClubs.clear();
    populateClubFilter();
    const entries = sortedPlayerEntries(state.captures, state.selectedClubs);
    const nextKey = state.activeDatasetKey
      ? entries.some(([key]) => key === state.activeDatasetKey) ? state.activeDatasetKey : entries[0]?.[0] ?? null
      : null;
    populateDatasets(nextKey);
    selectDataset(nextKey);
  });
  elements.clubFilterOptions.append(clear);

  for (const club of available) {
    const label = document.createElement("label");
    label.className = "multi-select-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = club;
    checkbox.checked = state.selectedClubs.has(club);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedClubs.add(club);
      else state.selectedClubs.delete(club);
      updateClubFilterSummary();
      const entries = sortedPlayerEntries(state.captures, state.selectedClubs);
      const nextKey = state.activeDatasetKey
        ? entries.some(([key]) => key === state.activeDatasetKey) ? state.activeDatasetKey : entries[0]?.[0] ?? null
        : null;
      populateDatasets(nextKey);
      selectDataset(nextKey);
    });
    const text = document.createElement("span");
    text.textContent = club;
    label.append(checkbox, text);
    elements.clubFilterOptions.append(label);
  }
  updateClubFilterSummary();
}

function populateDatasets(preferredKey = state.activeDatasetKey) {
  const entries = sortedPlayerEntries(state.captures, state.selectedClubs);
  const options = [new Option("Bitte Spieler auswählen", "")];
  if (entries.length) {
    options.push(...entries.map(([key, capture]) => new Option(playerOptionLabel(capture, key), key)));
  } else {
    const empty = new Option("Keine passenden Spieler", "");
    empty.disabled = true;
    options.push(empty);
  }
  elements.playerSelect.replaceChildren(
    ...options,
  );
  elements.playerSelect.disabled = entries.length === 0;
  elements.playerSelect.value = entries.some(([key]) => key === preferredKey) ? preferredKey : "";
  singleSelectSync.player();
}

async function loadData() {
  try {
    const response = await fetch("./data/results.enc.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const encrypted = await response.json();
    const password = await requestPassword();
    if (password == null) throw new Error("Passphrase nicht eingegeben");
    const payload = await decryptJson(encrypted, password);
    if (payload?.format !== "mytischtennis-web-results" || payload?.version !== 1 || !payload.captures) {
      throw new Error("unbekanntes Datenformat");
    }
    state.captures = payload.captures;
    state.activeDatasetKey = null;
    populateClubFilter();
    populateDatasets(null);
    selectDataset(null);
    elements.status.textContent = "";
  } catch (error) {
    elements.status.textContent = `Die Ergebnisdaten konnten nicht geladen werden (${error.message}).`;
    elements.playerSelect.disabled = true;
    elements.resultsTable.replaceChildren();
  }
}

elements.playerSelect.addEventListener("change", () => selectDataset(elements.playerSelect.value));
elements.playerSelect.addEventListener("input", () => selectDataset(elements.playerSelect.value));
elements.togglePlayers.addEventListener("click", () => {
  const hidden = elements.playerControls.hidden;
  elements.playerControls.hidden = !hidden;
  elements.togglePlayers.textContent = hidden ? "Ausblenden" : "Einblenden";
  elements.togglePlayers.setAttribute("aria-expanded", String(hidden));
});
elements.toggleFilters.addEventListener("click", () => {
  const hidden = elements.filters.hidden;
  elements.filters.hidden = !hidden;
  elements.toggleFilters.textContent = hidden ? "Ausblenden" : "Einblenden";
  elements.toggleFilters.setAttribute("aria-expanded", String(hidden));
});
document.addEventListener("click", (event) => {
  for (const details of [
    elements.clubFilter,
    elements.playerFilter,
    elements.teamFilter,
    elements.leagueFilter,
    elements.typeFilter,
    elements.classFilter,
    elements.setCountFilter,
  ]) {
    if (details?.open && !details.contains(event.target)) details.open = false;
  }
});
for (const button of elements.viewButtons) {
  button.addEventListener("click", () => {
    rememberViewScroll(state.view);
    if (button.dataset.view !== "games") state.seriesMode = null;
    state.view = button.dataset.view;
    render();
    restoreViewScroll(state.view);
  });
}
elements.expandAll.addEventListener("click", () => {
  const games = filterGames(currentCapture()?.games ?? [], filters());
  const keys = state.view === "encounters"
    ? encounterGroups(games).map((encounter) => encounter.key)
    : opponentStats(games).map((stat) => stat.key);
  for (const key of keys) expandedKeysFor().add(key);
  render();
});
elements.collapseAll.addEventListener("click", () => {
  expandedKeysFor().clear();
  render();
});
for (const input of elements.filters.querySelectorAll("input, select")) {
  input.addEventListener("input", render);
  input.addEventListener("change", render);
}

let resizeRenderTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeRenderTimer);
  resizeRenderTimer = setTimeout(() => render(), 100);
});

loadData();
