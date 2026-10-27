// Error classes mapped to exit codes by tools/lib/cli.ts.
//   1 = usage / unexpected failure    2 = rejected by a domain rule    3 = the log itself is invalid
export class UsageError extends Error {}
export class Rejection extends Error {}
export class LogInvalid extends Error {}
