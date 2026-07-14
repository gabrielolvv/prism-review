const weights = {
    info: 1,
    warning: 2,
    high: 3
};
export function compareSeverity(left, right) {
    return weights[right] - weights[left];
}
