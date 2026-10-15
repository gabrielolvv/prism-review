const maxListedLines = 5;

// Formats "Line 4" or "Lines 4, 9, 12 and 3 more" from unsorted line numbers.
export function describeLines(lines: number[]): { text: string; plural: boolean } {
  const sorted = [...new Set(lines)].sort((left, right) => left - right);
  const listed = sorted.slice(0, maxListedLines).join(", ");
  const more = sorted.length > maxListedLines ? ` and ${sorted.length - maxListedLines} more` : "";
  const plural = sorted.length > 1;

  return { text: `${plural ? "Lines" : "Line"} ${listed}${more}`, plural };
}
