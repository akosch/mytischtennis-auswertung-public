const FALLBACK_CLUB = "Ohne Vereinsangabe";

export function playerClub(capture) {
  const club = String(capture?.player?.club ?? "").trim();
  return club || FALLBACK_CLUB;
}

export function playerName(capture, key = "") {
  return String(capture?.player?.name ?? key).trim() || "Unbekannter Spieler";
}

export function playerOptionLabel(capture, key) {
  return `${playerClub(capture)} · ${playerName(capture, key)}`;
}

export function availablePlayerClubs(captures) {
  return [...new Set(Object.values(captures ?? {}).map(playerClub))]
    .sort((left, right) => left.localeCompare(right, "de", { sensitivity: "base" }));
}

export function sortedPlayerEntries(captures, selectedClubs = new Set()) {
  const clubs = selectedClubs instanceof Set ? selectedClubs : new Set(selectedClubs);
  return Object.entries(captures ?? {})
    .filter(([, capture]) => clubs.size === 0 || clubs.has(playerClub(capture)))
    .sort(([leftKey, left], [rightKey, right]) => {
      const clubOrder = playerClub(left).localeCompare(playerClub(right), "de", { sensitivity: "base" });
      if (clubOrder !== 0) return clubOrder;
      const nameOrder = playerName(left, leftKey).localeCompare(playerName(right, rightKey), "de", { sensitivity: "base" });
      return nameOrder || leftKey.localeCompare(rightKey, "de");
    });
}
