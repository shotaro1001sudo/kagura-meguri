// Final location gate after geocoding. Existing pending/manual records are never promoted.
export function quarantineUnlocated(events) {
  const held = [];
  const rows = events.map((e) => {
    if (!e.auto || e.status !== "published") return e;
    if (Number.isFinite(e.lat) && Number.isFinite(e.lng) && Math.abs(e.lat) <= 90 && Math.abs(e.lng) <= 180) return e;
    const row = { ...e, status: "pending", holdReasons: [...(e.holdReasons ?? []), "緯度経度を確認できないため保留。会場の位置を確認してください"] };
    held.push(row);
    return row;
  });
  return { events: rows, held };
}
