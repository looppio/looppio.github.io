// Include the list spacing between the first three visual lines. A long
// paragraph and three short bullets must both reveal three lines of text.
export function collapsedDisclosureHeight(lineHeight, rows, maxLines = 3) {
  if (!(lineHeight > 0) || !rows.length || !(maxLines > 0)) return 0;
  let remaining = maxLines;
  let height = 0;
  for (const row of rows) {
    const lines = Math.max(1, Math.round(row.height / lineHeight));
    const visible = Math.min(remaining, lines);
    height += Math.max(0, row.marginTop || 0) + visible * lineHeight;
    remaining -= visible;
    if (!remaining) break;
  }
  return height;
}
