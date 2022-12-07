export interface IAbortSignal {
  aborted: boolean;
  addEventListener: (type: string, handler: () => void) => void;
  removeEventListener: (type: string, handler: () => void) => void;
}

export interface IAbortController {
  signal: IAbortSignal;
  abort: (reason?: any) => void;
}

/* c8 ignore start */
export const AbortController: new () => IAbortController =
  // eslint-disable-next-line no-undef
  global.AbortController ||
  class MockAbortController implements IAbortController {
    private _signal: IAbortSignal = {
      aborted: false,
      addEventListener: () => null,
      removeEventListener: () => null,
    };

    public get signal(): IAbortSignal {
      return this._signal;
    }

    public abort(): void {
      this._signal.aborted = true;
    }
  };
/* c8 ignore stop */
