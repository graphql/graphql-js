declare class Process {
  env : { [key: string] : string | void, ... };
}

declare var process: Process;
