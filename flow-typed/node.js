declare class Process extends events$EventEmitter {
  env : { [key: string] : string | void, ... };
}

declare var process: Process;
