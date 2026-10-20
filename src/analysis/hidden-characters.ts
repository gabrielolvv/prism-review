// Characters that change how text reads without being visible. Bidirectional controls can make
// code display differently from how it runs (Trojan Source, CVE-2021-42574); the others hide text.
// ZWJ and ZWNJ are left out because emoji and several scripts need them, and so are the
// left-to-right and right-to-left marks, which only mark direction.
const bidiControls = new Map<number, string>([
  [0x202a, "LEFT-TO-RIGHT EMBEDDING"],
  [0x202b, "RIGHT-TO-LEFT EMBEDDING"],
  [0x202c, "POP DIRECTIONAL FORMATTING"],
  [0x202d, "LEFT-TO-RIGHT OVERRIDE"],
  [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
  [0x2066, "LEFT-TO-RIGHT ISOLATE"],
  [0x2067, "RIGHT-TO-LEFT ISOLATE"],
  [0x2068, "FIRST STRONG ISOLATE"],
  [0x2069, "POP DIRECTIONAL ISOLATE"]
]);

const invisibleCharacters = new Map<number, string>([
  [0x200b, "ZERO WIDTH SPACE"],
  [0x2060, "WORD JOINER"],
  [0xfeff, "ZERO WIDTH NO-BREAK SPACE"]
]);

const byteOrderMark = 0xfeff;

export type HiddenCharacters = {
  // Labels in order of first appearance, such as "U+202E RIGHT-TO-LEFT OVERRIDE".
  labels: string[];
  reordersText: boolean;
};

export function isHiddenCodePoint(codePoint: number): boolean {
  return bidiControls.has(codePoint) || invisibleCharacters.has(codePoint) || isTagCharacter(codePoint);
}

// `allowLeadingBom` accepts a byte order mark as the first character, where it is normal.
export function findHiddenCharacters(text: string, allowLeadingBom = false): HiddenCharacters {
  const labels = new Set<string>();
  let reordersText = false;
  let index = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const atStart = index === 0;
    index += 1;

    if (codePoint === byteOrderMark && atStart && allowLeadingBom) {
      continue;
    }

    const bidiName = bidiControls.get(codePoint);
    if (bidiName) {
      labels.add(`${formatCodePoint(codePoint)} ${bidiName}`);
      reordersText = true;
    } else if (invisibleCharacters.has(codePoint)) {
      labels.add(`${formatCodePoint(codePoint)} ${invisibleCharacters.get(codePoint)}`);
    } else if (isTagCharacter(codePoint)) {
      labels.add("Unicode tag characters");
    }
  }

  return { labels: [...labels], reordersText };
}

export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

// Tag characters can spell out text that most editors and diff views do not display.
function isTagCharacter(codePoint: number): boolean {
  return codePoint >= 0xe0000 && codePoint <= 0xe007f;
}
