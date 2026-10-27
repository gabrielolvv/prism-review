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

// Fixtures and test data hold fake keys and odd lockfiles on purpose.
const testDataDirectory = /(?:^|\/)(?:tests?|testdata|fixtures|__fixtures__|__tests__|__mocks__|spec)\//i;

export function isTestDataPath(path: string): boolean {
  return testDataDirectory.test(path);
}
