declare const PRISM_REVIEW_VERSION: string | undefined;

// scripts/bundle.mjs replaces PRISM_REVIEW_VERSION with the version in package.json; a build from
// source has none.
export const version = typeof PRISM_REVIEW_VERSION === "string" ? PRISM_REVIEW_VERSION : "development";
