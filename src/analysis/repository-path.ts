export function normalizeRepositoryPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

export function isSafeRepositoryPath(path: string): boolean {
  const normalized = normalizeRepositoryPath(path);

  return (
    normalized.length > 0 &&
    !/^[A-Za-z]:/.test(normalized) &&
    normalized.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}
