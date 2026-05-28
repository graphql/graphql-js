type TerminalRecord =
  | { readonly kind: 'done'; readonly value: unknown }
  | { readonly kind: 'error'; readonly error: unknown };

/** Creates one iterable that records a source and another that replays it. */
export function createReplayableIterablePair<T>(
  iterable: Iterable<T>,
): readonly [Iterable<T>, Iterable<T>] {
  const iterator = iterable[Symbol.iterator]();
  const values: Array<T> = [];
  let terminalRecord: TerminalRecord | undefined;

  const recordingIterator: Iterator<T, unknown, unknown> = {
    next() {
      if (terminalRecord !== undefined) {
        return replayTerminalRecord(terminalRecord);
      }

      try {
        return recordIteratorResult(iterator.next());
      } catch (error) {
        recordError(error);
        throw error;
      }
    },
    return(value?: unknown) {
      if (terminalRecord !== undefined) {
        return replayTerminalRecord(terminalRecord);
      }

      if (iterator.return === undefined) {
        return recordIteratorResult({ done: true, value });
      }
      return recordIteratorResult(iterator.return(value));
    },
  };

  return [
    {
      [Symbol.iterator]() {
        return recordingIterator;
      },
    },
    createReplayIterable(values, () => terminalRecord),
  ];

  function recordIteratorResult(
    result: IteratorResult<T, unknown>,
  ): IteratorResult<T, unknown> {
    if (result.done === true) {
      terminalRecord = { kind: 'done', value: result.value };
    } else {
      values.push(result.value);
    }
    return result;
  }

  function recordError(error: unknown): void {
    terminalRecord = { kind: 'error', error };
  }
}

/** Creates one async iterable that records a source and another that replays it. */
export function createReplayableAsyncIterablePair<T>(
  iterable: AsyncIterable<T>,
): readonly [AsyncIterable<T>, AsyncIterable<T>] {
  const iterator = iterable[Symbol.asyncIterator]();
  const values: Array<T> = [];
  let terminalRecord: TerminalRecord | undefined;

  const recordingIterator: AsyncIterator<T, unknown, unknown> = {
    async next() {
      if (terminalRecord !== undefined) {
        return replayTerminalRecord(terminalRecord);
      }

      try {
        return recordIteratorResult(await iterator.next());
      } catch (error) {
        recordError(error);
        throw error;
      }
    },
    async return(value?: unknown) {
      if (terminalRecord !== undefined) {
        return replayTerminalRecord(terminalRecord);
      }

      if (iterator.return === undefined) {
        return recordIteratorResult({ done: true, value });
      }
      return recordIteratorResult(await iterator.return(value));
    },
  };

  return [
    {
      [Symbol.asyncIterator]() {
        return recordingIterator;
      },
    },
    createReplayAsyncIterable(values, () => terminalRecord),
  ];

  function recordIteratorResult(
    result: IteratorResult<T, unknown>,
  ): IteratorResult<T, unknown> {
    if (result.done === true) {
      terminalRecord = { kind: 'done', value: result.value };
    } else {
      values.push(result.value);
    }
    return result;
  }

  function recordError(error: unknown): void {
    terminalRecord = { kind: 'error', error };
  }
}

function createReplayIterable<T>(
  values: ReadonlyArray<T>,
  getTerminalRecord: () => TerminalRecord | undefined,
): Iterable<T> {
  return {
    [Symbol.iterator]() {
      let index = 0;
      return {
        next(): IteratorResult<T, unknown> {
          if (index < values.length) {
            return { done: false, value: values[index++] };
          }

          const terminalRecord = getTerminalRecord();
          if (terminalRecord !== undefined) {
            return replayTerminalRecord(terminalRecord);
          }

          throw new Error(
            'Expected iterable input to be recorded before replaying it.',
          );
        },
      };
    },
  };
}

function createReplayAsyncIterable<T>(
  values: ReadonlyArray<T>,
  getTerminalRecord: () => TerminalRecord | undefined,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        next(): Promise<IteratorResult<T, unknown>> {
          if (index < values.length) {
            return Promise.resolve({ done: false, value: values[index++] });
          }

          const terminalRecord = getTerminalRecord();
          if (terminalRecord !== undefined) {
            return replayTerminalRecordAsync(terminalRecord);
          }

          return Promise.reject(
            new Error(
              'Expected async iterable input to be recorded before replaying it.',
            ),
          );
        },
      };
    },
  };
}

function replayTerminalRecord<T>(
  terminalRecord: TerminalRecord,
): IteratorResult<T, unknown> {
  if (terminalRecord.kind === 'done') {
    return { done: true, value: terminalRecord.value };
  }
  throw terminalRecord.error;
}

function replayTerminalRecordAsync<T>(
  terminalRecord: TerminalRecord,
): Promise<IteratorResult<T, unknown>> {
  return Promise.resolve().then(() => replayTerminalRecord(terminalRecord));
}
