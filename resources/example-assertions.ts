import { strict as assert } from 'assert';

import { expectJSON } from '../src/__testUtils__/expectJSON';

export class ExampleAssertion {
  private readonly _location: string;
  private _started = 0;
  private _completed = 0;

  constructor(location: string) {
    this._location = location;
  }

  start(): this {
    this._started++;
    return this;
  }

  record<T>(value: T): T {
    this._completed++;
    return value;
  }

  value<T>(actual: T, expected: unknown): T {
    expectJSON(actual, this._location).toDeepEqual(expected);
    return this.record(actual);
  }

  threw(thrown: boolean): void {
    assert.ok(thrown, 'Missing expected exception: ' + this._location);
    this.record(undefined);
  }

  verify(): void {
    assert.equal(
      this._completed,
      this._started,
      'Example assertion did not complete: ' + this._location,
    );
    assert.ok(
      this._started > 0,
      'Example assertion was not executed: ' + this._location,
    );
  }
}
