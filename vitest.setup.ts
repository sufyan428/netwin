// @testing-library/jest-dom is intentionally not used here: as of this
// project's pinned vitest@4.1.11, jest-dom's expect.extend() registration
// silently fails to attach matchers ("Invalid Chai property" at call time),
// which reproduces even with chai forced to v5 via a package.json override —
// so it isn't a simple version-range fix. Tests use plain DOM assertions
// (screen.getByText/queryByText + truthiness) instead of .toBeInTheDocument().
export {};
