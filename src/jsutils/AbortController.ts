export interface IAbortController {
  abort: (reason?: unknown) => void;
  signal: IAbortSignal;
}

export interface IEvent {
  target: any;
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
