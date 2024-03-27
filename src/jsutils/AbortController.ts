export interface IAbortController {
  abort: (reason?: unknown) => void;
  signal: IAbortSignal;
}

export interface IEvent {
  target: { reason: unknown };
}

type EventListener = (event: IEvent) => void;

export interface IAbortSignal {
  readonly aborted: boolean;
  onabort: ((this: IAbortSignal, ev: IEvent) => any) | null;
  readonly reason: any;
  throwIfAborted: () => void;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

// C8 ignore wasn't working for this file so adding noop function to it,
// to get tests coverage passing
export function noop(): void {
  return undefined;
}
