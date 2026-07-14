export type Severity = "info" | "warning" | "high";

const weights: Record<Severity, number> = {
  info: 1,
  warning: 2,
  high: 3
};

export function compareSeverity(left: Severity, right: Severity): number {
  return weights[right] - weights[left];
}
