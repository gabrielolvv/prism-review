// How far, in lines, a policy statement may reach from the line being checked.
const statementWindow = 25;

// The text of the policy statement the line is in: up to the nearest statement start before it and
// the next one after it, within a window.
export function statementAround(contents: string[], index: number): string {
  const start = /^\s*-\s*["']?(?:Sid|Effect|Action|Principal|Resource)["']?\s*:|^\s*statement\s*\{|["']Sid["']\s*:|\bnew\s+(?:iam\.)?PolicyStatement\s*\(|^\s*\{\s*$|^\s*(?:resource|data|module)\s+"|^\s*dynamic\s+"statement"|^\s*content\s*\{/;
  let first = index;
  for (let before = index - 1; before >= Math.max(0, index - statementWindow); before -= 1) {
    first = before;
    if (start.test(contents[before] ?? "")) {
      break;
    }
  }
  let last = index;
  for (let after = index + 1; after < Math.min(contents.length, index + statementWindow); after += 1) {
    if (start.test(contents[after] ?? "")) {
      break;
    }
    last = after;
  }
  return contents.slice(first, last + 1).join("\n");
}
