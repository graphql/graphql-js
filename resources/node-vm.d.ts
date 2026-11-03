export {};

// Node 17's type definitions omit this experimental API. The runner uses only
// construction to validate module syntax, with --experimental-vm-modules.
declare module 'vm' {
  class SourceTextModule {
    constructor(code: string, options: { identifier: string });
  }
}
