import { dateParts, displayChange, displayValue, resultLabel } from "./result-view.js";

export function createCell(value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = displayValue(value);
  if (className) cell.className = className;
  return cell;
}

export function createDateCell(value) {
  const cell = document.createElement("td");
  cell.className = "date-cell";
  const { date, time } = dateParts(value);
  const parts = document.createElement("span");
  parts.className = "date-parts";
  const datePart = document.createElement("span");
  datePart.className = "date-value";
  datePart.textContent = date;
  parts.append(datePart);
  if (time) {
    const timePart = document.createElement("span");
    timePart.className = "time-value";
    timePart.textContent = time;
    parts.append(timePart);
  }
  cell.append(parts);
  return cell;
}

export function createSetScoresCell(game) {
  const cell = document.createElement("td");
  cell.className = "set-scores align-left";
  if (!game.setScores?.length) {
    cell.textContent = "–";
    return cell;
  }

  const scores = document.createElement("span");
  scores.className = "set-scores-grid";
  for (const score of game.setScores) {
    const value = document.createElement("span");
    value.className = "set-score";
    const match = String(score).match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
    if (match) {
      const own = document.createElement("span");
      own.className = "set-score-own";
      own.textContent = match[1];
      const separator = document.createElement("span");
      separator.className = "set-score-separator";
      separator.textContent = ":";
      const opponent = document.createElement("span");
      opponent.className = "set-score-opponent";
      opponent.textContent = match[2];
      value.append(own, separator, opponent);
    } else {
      value.classList.add("set-score-unparsed");
      value.textContent = score;
    }
    scores.append(value);
  }
  cell.append(scores);
  return cell;
}

export function createSetBalanceCell(value) {
  const text = displayValue(value);
  const match = String(value ?? "").match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
  if (!match) return createCell(text, "align-center");

  const cell = document.createElement("td");
  cell.className = "align-center set-balance-cell";
  const balance = document.createElement("span");
  balance.className = "set-balance-grid";
  const own = document.createElement("span");
  own.textContent = match[1];
  const separator = document.createElement("span");
  separator.textContent = ":";
  const opponent = document.createElement("span");
  opponent.textContent = match[2];
  balance.append(own, separator, opponent);
  cell.append(balance);
  return cell;
}

export function setupScrollProxy(proxy, scroll, table) {
  if (!proxy || !scroll || !table) return;
  const spacer = proxy.firstElementChild;
  if (!spacer) return;

  const syncWidth = () => {
    spacer.style.width = `${table.scrollWidth}px`;
    proxy.hidden = table.scrollWidth <= scroll.clientWidth + 1;
    if (!proxy.hidden && proxy.scrollLeft !== scroll.scrollLeft) {
      proxy.scrollLeft = scroll.scrollLeft;
    }
  };
  if (!proxy.dataset.bound) {
    proxy.dataset.bound = "true";
    proxy.addEventListener("scroll", () => {
      if (scroll.scrollLeft !== proxy.scrollLeft) scroll.scrollLeft = proxy.scrollLeft;
    });
    scroll.addEventListener("scroll", () => {
      if (proxy.scrollLeft !== scroll.scrollLeft) proxy.scrollLeft = scroll.scrollLeft;
    });
  }
  if (!proxy._scrollResizeObserver && typeof ResizeObserver === "function") {
    proxy._scrollResizeObserver = new ResizeObserver(syncWidth);
    proxy._scrollResizeObserver.observe(table);
    proxy._scrollResizeObserver.observe(scroll);
  }
  queueMicrotask(syncWidth);
}

export function setupStickyResultsHeader(section, header) {
  if (!section || !header) return;
  const syncHeight = () => {
    section.style.setProperty("--results-sticky-offset", `${header.getBoundingClientRect().height}px`);
  };
  if (!header._stickyResultsHeaderBound) {
    header._stickyResultsHeaderBound = true;
    if (typeof ResizeObserver === "function") {
      header._stickyResultsHeaderResizeObserver = new ResizeObserver(syncHeight);
      header._stickyResultsHeaderResizeObserver.observe(header);
    }
    window.addEventListener("resize", syncHeight);
  }
  syncHeight();
}

export function createChangeCell(value, { positiveClass = "ttr-positive", negativeClass = "ttr-negative" } = {}) {
  const cell = createCell(displayChange(value), "align-center");
  if (value > 0) cell.classList.add(positiveClass);
  if (value < 0) cell.classList.add(negativeClass);
  return cell;
}

export function createResultCell(game, { positiveClass = "ttr-positive", negativeClass = "ttr-negative" } = {}) {
  const result = resultLabel(game);
  const label = result === "Sieg" ? "S" : result === "Niederlage" ? "N" : "–";
  const cell = createCell(label, "align-center");
  if (result === "Sieg") cell.classList.add(positiveClass);
  if (result === "Niederlage") cell.classList.add(negativeClass);
  return cell;
}

export function headingClass(label) {
  if (label === "Datum") return "align-center";
  if (label === "Veranstaltung" || label === "Punkte") return "align-left";
  if ([
    "Spiele", "Siege", "Niederlagen", "Quote", "Ergebnis", "S/N", "Sätze",
    "Gegner TTR", "Eigener TTR", "TTR", "TTR Differenz", "TTR +/-", "Bilanz", "Begegnung",
  ].includes(label)) return "align-center";
  return "";
}

export function createTableHead(labels, classForLabel = headingClass) {
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  for (const label of labels) {
    const cell = document.createElement("th");
    cell.textContent = label;
    const className = classForLabel(label);
    if (className) cell.className = className;
    row.append(cell);
  }
  head.append(row);
  return head;
}

export function createSortableTableHead(columns, { key, direction, onSort, classForLabel = headingClass }) {
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  for (const column of columns) {
    const cell = document.createElement("th");
    cell.dataset.columnKey = column.key;
    const className = classForLabel(column.label);
    if (className) cell.className = className;
    if (column.sortable === false) {
      cell.textContent = column.label;
      row.append(cell);
      continue;
    }
    const active = column.key === key;
    cell.setAttribute("aria-sort", active ? (direction === "asc" ? "ascending" : "descending") : "none");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sort-button";
    const label = document.createElement("span");
    label.className = "sort-label";
    label.textContent = column.label;
    const indicator = document.createElement("span");
    indicator.setAttribute("aria-hidden", "true");
    indicator.textContent = active ? (direction === "asc" ? "↑" : "↓") : "";
    button.append(label, indicator);
    button.addEventListener("click", () => onSort?.(column.key));
    cell.append(button);
    row.append(cell);
  }
  head.append(row);
  return head;
}

export function createMetric(label, value) {
  const item = document.createElement("div");
  item.className = "metric";
  const strong = document.createElement("strong");
  strong.textContent = displayValue(value);
  item.append(strong, document.createTextNode(label));
  return item;
}

export function createMetricButton(label, value, count, { pressed = false, onClick } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "metric metric-button";
  button.setAttribute("aria-pressed", String(pressed));
  const strong = document.createElement("strong");
  strong.textContent = displayValue(count);
  button.append(strong, document.createTextNode(label));
  if (onClick) button.addEventListener("click", onClick);
  return button;
}

export function createMetricGroup(...metrics) {
  const group = document.createElement("div");
  group.className = "summary-ttr-group";
  group.append(...metrics);
  return group;
}

export function createMetricSeparator() {
  const separator = document.createElement("span");
  separator.className = "summary-separator";
  separator.setAttribute("aria-hidden", "true");
  return separator;
}

export function createToggleRow({ key, cells, expanded = false, onToggle }) {
  const row = document.createElement("tr");
  row.dataset.key = key;
  row.tabIndex = 0;
  row.setAttribute("aria-expanded", String(expanded));
  if (expanded) row.classList.add("selected");
  const toggle = () => onToggle?.(key);
  row.addEventListener("click", toggle);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });
  row.append(...cells);
  return row;
}

export function createDetailsRow({ games, colSpan, className = "", labels, renderGameCells }) {
  const row = document.createElement("tr");
  row.className = "group-details-row";
  const cell = document.createElement("td");
  cell.colSpan = colSpan;
  const details = document.createElement("div");
  details.className = "inline-details";
  const scroll = document.createElement("div");
  scroll.className = "table-scroll";
  const table = document.createElement("table");
  if (className) table.className = className;
  const body = document.createElement("tbody");
  for (const game of games) {
    const gameRow = document.createElement("tr");
    gameRow.append(...renderGameCells(game));
    body.append(gameRow);
  }
  table.append(createTableHead(labels), body);
  const proxy = document.createElement("div");
  proxy.className = "table-scroll table-scroll-proxy";
  proxy.setAttribute("aria-hidden", "true");
  proxy.append(document.createElement("div"));
  scroll.append(table);
  details.append(proxy, scroll);
  setupScrollProxy(proxy, scroll, table);
  cell.append(details);
  row.append(cell);
  return row;
}

export function createSeriesHeadingRow(label, colSpan) {
  const row = document.createElement("tr");
  row.className = "series-heading-row";
  const cell = document.createElement("td");
  cell.colSpan = colSpan;
  cell.textContent = label;
  row.append(cell);
  return row;
}
