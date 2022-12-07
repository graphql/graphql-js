export interface IAbortSignal {
  aborted: boolean;
  addEventListener: (type: string, handler: () => void) => void;
  removeEventListener: (type: string, handler: () => void) => void;
}

export interface IAbortController {
  signal: IAbortSignal;
  abort: (reason?: any) => void;
}

// We need to polyfill abort controller in case of Node@14 which doesn't have it
/* c8 ignore start */
export const AbortController: new () => IAbortController =
  // eslint-disable-next-line no-undef
  global.AbortController ||
  // This is a dummy implementation that doesn't actually abort anything
  class DummyAbortController implements IAbortController {
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

export const hasAbortControllerSupport =
  // eslint-disable-next-line no-undef
  Boolean(global.AbortController);

/* c8 ignore stop */
