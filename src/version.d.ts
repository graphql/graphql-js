/**
 * A string containing the version of the GraphQL.js library
 */
export const version: string;
/**
 * An object containing the components of the GraphQL.js version string
 */
export const versionInfo: Readonly<{
  major: number;
  minor: number;
  patch: number;
  preReleaseTag: string | null;
}>;
