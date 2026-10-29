// Finds groups in a regular expression that a backtracking engine can match in exponentially many
// ways: a group repeated without bound whose own content can repeat too, with at most one part that
// must match, such as `(\w+\s?)*`, `(\s*\w+)+`, or `(.*,)+`. A failing match then tries every way to
// split the text between the repetitions. A second required part, as in `(\d+,)*`, or a single one
// the repeated part cannot match, as in `([01]_*)+`, marks where each repetition starts, so those
// are not reported. It reads the pattern text only and never runs it on input.

type Quantifier = { min: number; max: number; possessive: boolean };
// `atom` is the item without its quantifier, such as `[01]` in `[01]+`.
type Item = {
  kind: "atom" | "group" | "lookaround";
  alternatives?: Item[][];
  quantifier?: Quantifier;
  source: string;
  atom?: string;
  atomic?: boolean;
};

const maxPatternLength = 2_000;

export function ambiguousGroup(pattern: string): string | undefined {
  if (pattern.length > maxPatternLength) {
    return undefined;
  }
  let found: string | undefined;
  try {
    const parser = new Parser(pattern);
    const items = parser.sequence();
    const visit = (sequence: Item[]) => {
      for (const item of sequence) {
        if (found !== undefined) {
          return;
        }
        if (item.kind === "group" && item.alternatives !== undefined) {
          if (isAmbiguous(item)) {
            found = item.source;
            return;
          }
          item.alternatives.forEach(visit);
        }
      }
    };
    visit(items);
  } catch {
    return undefined;
  }
  return found;
}

function isAmbiguous(group: Item): boolean {
  const quantifier = group.quantifier;
  if (quantifier === undefined || quantifier.max !== Infinity || quantifier.possessive || group.atomic) {
    return false;
  }
  // Alternation, as in `(a|b)*`, needs overlapping branches to be ambiguous, which is not checked.
  if (group.alternatives?.length !== 1) {
    return false;
  }
  const sequence = (group.alternatives[0] ?? []).filter((item) => item.kind !== "lookaround");
  const required = sequence.filter((item) => (item.quantifier?.min ?? 1) >= 1);
  const unbounded = sequence.filter((item) => item.quantifier?.max === Infinity && !item.quantifier.possessive && !item.atomic);
  if (unbounded.length === 0 || required.length > 1) {
    return false;
  }
  const [anchor] = required;
  // No required part, or the required part repeats itself, as in `(\w+\s?)*`.
  if (anchor === undefined || unbounded.includes(anchor)) {
    return true;
  }
  // A single fixed required part: ambiguous only when a repeated part can match how it starts.
  return unbounded.some((item) => overlaps(item, anchor));
}

// Characters that tell character classes apart, to test whether two of them share one.
const probes = [..." !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~", "\t", "\n", "\r", "\u00e9", "\u4e2d"];

function overlaps(repeated: Item, anchor: Item): boolean {
  const firsts = firstAtoms(anchor);
  if (repeated.kind !== "atom" || repeated.atom === undefined || firsts === undefined) {
    return true;
  }
  const left = singleCharacter(repeated.atom);
  const rights = firsts.map(singleCharacter);
  if (left === undefined || rights.some((right) => right === undefined)) {
    return true;
  }
  return probes.some((char) => left.test(char) && rights.some((right) => right?.test(char)));
}

// The atoms an item can start with: its own, or the first of each alternative of a group, as `\/`
// for `(\/\/.*$|\/\*...)`. Undefined when an alternative is empty or starts with an optional part.
function firstAtoms(item: Item): string[] | undefined {
  if (item.kind === "atom") {
    return item.atom === undefined ? undefined : [item.atom];
  }
  const atoms: string[] = [];
  for (const alternative of item.alternatives ?? []) {
    const start = alternative.find((entry) => entry.kind !== "lookaround");
    const nested = start === undefined || (start.quantifier?.min ?? 1) === 0 ? undefined : firstAtoms(start);
    if (nested === undefined) {
      return undefined;
    }
    atoms.push(...nested);
  }
  return atoms.length > 0 ? atoms : undefined;
}

// One character class or character as a pattern of its own, or undefined when it is not one.
function singleCharacter(atom: string): RegExp | undefined {
  try {
    return new RegExp(`^(?:${atom})$`, "u");
  } catch {
    try {
      return new RegExp(`^(?:${atom})$`);
    } catch {
      return undefined;
    }
  }
}

class Parser {
  private index = 0;

  constructor(private readonly text: string) {}

  sequence(): Item[] {
    return this.alternatives()[0] ?? [];
  }

  private alternatives(): Item[][] {
    const alternatives: Item[][] = [[]];
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (char === ")") {
        break;
      }
      if (char === "|") {
        this.index += 1;
        alternatives.push([]);
        continue;
      }
      const start = this.index;
      const item = this.atom();
      item.atom = this.text.slice(start, this.index);
      item.quantifier = this.quantifier();
      item.source = this.text.slice(start, this.index);
      alternatives.at(-1)?.push(item);
    }
    return alternatives;
  }

  private atom(): Item {
    const char = this.text[this.index];
    if (char === "\\") {
      this.index += 2;
      return { kind: "atom", source: "" };
    }
    if (char === "[") {
      this.index += 1;
      if (this.text[this.index] === "^") {
        this.index += 1;
      }
      if (this.text[this.index] === "]") {
        this.index += 1;
      }
      while (this.index < this.text.length && this.text[this.index] !== "]") {
        this.index += this.text[this.index] === "\\" ? 2 : 1;
      }
      this.index += 1;
      return { kind: "atom", source: "" };
    }
    if (char === "(") {
      this.index += 1;
      let lookaround = false;
      let atomic = false;
      if (this.text[this.index] === "?") {
        const rest = this.text.slice(this.index, this.index + 4);
        lookaround = /^\?(?:[=!]|<[=!])/.test(rest);
        atomic = rest.startsWith("?>");
        // Skip the group's flags or name: `?:`, `?=`, `?<name>`, `?P<name>`, `?i:`.
        const header = /^\?(?:P?<[A-Za-z_]\w*>|'[A-Za-z_]\w*'|<[=!]|[=!:>]|[a-zA-Z-]+[:)])/.exec(this.text.slice(this.index));
        this.index += header?.[0].length ?? 1;
        if (header?.[0].endsWith(")")) {
          return { kind: "lookaround", source: "" };
        }
      }
      const alternatives = this.alternatives();
      this.index += 1;
      return { kind: lookaround ? "lookaround" : "group", alternatives, atomic, source: "" };
    }
    this.index += 1;
    return { kind: "atom", source: "" };
  }

  private quantifier(): Quantifier | undefined {
    const rest = this.text.slice(this.index);
    const match = /^(?:([*+?])|\{(\d+)(?:(,)(\d*))?\})([?+]?)/.exec(rest);
    if (match === null) {
      return undefined;
    }
    this.index += match[0].length;
    const [, symbol, low, comma, high, suffix] = match;
    const possessive = suffix === "+";
    if (symbol === "*") {
      return { min: 0, max: Infinity, possessive };
    }
    if (symbol === "+") {
      return { min: 1, max: Infinity, possessive };
    }
    if (symbol === "?") {
      return { min: 0, max: 1, possessive };
    }
    const min = Number(low);
    return { min, max: comma === undefined ? min : high === "" ? Infinity : Number(high), possessive };
  }
}
