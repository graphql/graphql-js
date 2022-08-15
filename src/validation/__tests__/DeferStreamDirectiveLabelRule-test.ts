import { describe, it } from 'mocha';

import { DeferStreamDirectiveLabelRule } from '../rules/DeferStreamDirectiveLabelRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(DeferStreamDirectiveLabelRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Defer/Stream directive on root field', () => {
  it('Defer fragments with no label', () => {
    expectValid(`
      {
        dog {
          ...dogFragmentA @defer
          ...dogFragmentB @defer
        }
      }
      fragment dogFragmentA on Dog {
        name
      }
      fragment dogFragmentB on Dog {
        nickname
      }
    `);
  });

  it('Defer fragments, one with label, one without', () => {
    expectValid(`
      {
        dog {
          ...dogFragmentA @defer(label: "fragA")
          ...dogFragmentB @defer
        }
      }
      fragment dogFragmentA on Dog {
        name
      }
      fragment dogFragmentB on Dog {
        nickname
      }
    `);
  });

  it('Defer fragment with variable label', () => {
    expectErrors(`
    query($label: String) {
      dog {
        ...dogFragmentA @defer(label: $label)
        ...dogFragmentB @defer(label: "fragA")
      }
    }
    fragment dogFragmentA on Dog {
      name
    }
    fragment dogFragmentB on Dog {
      nickname
    }
    `).toDeepEqual([
      {
        message: 'Directive "defer"\'s label argument must be a static string.',
        locations: [{ line: 4, column: 25 }],
      },
    ]);
  });

  it('Defer fragments with different labels', () => {
    expectValid(`
    {
      dog {
        ...dogFragmentA @defer(label: "fragB")
        ...dogFragmentB @defer(label: "fragA")
      }
    }
    fragment dogFragmentA on Dog {
      name
    }
    fragment dogFragmentB on Dog {
      nickname
    }
    `);
  });
  it('Defer fragments with same label', () => {
    expectErrors(`
    {
      dog {
        ...dogFragmentA @defer(label: "fragA")
        ...dogFragmentB @defer(label: "fragA")
      }
    }
    fragment dogFragmentA on Dog {
      name
    }
    fragment dogFragmentB on Dog {
      nickname
    }
    `).toDeepEqual([
      {
        message: 'Defer/Stream directive label argument must be unique.',
        locations: [
          { line: 4, column: 25 },
          { line: 5, column: 25 },
        ],
      },
    ]);
  });
  it('Defer and stream with no label', () => {
    expectValid(`
      {
        dog {
          ...dogFragment @defer
        }
        pets @stream(initialCount: 0) @stream {
          name
        }
      }
      fragment dogFragment on Dog {
        name
      }
    `);
  });
  it('Stream with variable label', () => {
    expectErrors(`
      query ($label: String!) {
        dog {
          ...dogFragment @defer
        }
        pets @stream(initialCount: 0) @stream(label: $label) {
          name
        }
      }
      fragment dogFragment on Dog {
        name
      }
      `).toDeepEqual([
      {
        message:
          'Directive "stream"\'s label argument must be a static string.',
        locations: [{ line: 6, column: 39 }],
      },
    ]);
  });
  it('Defer and stream with the same label', () => {
    expectErrors(`
      {
        dog {
          ...dogFragment @defer(label: "MyLabel")
        }
        pets @stream(initialCount: 0) @stream(label: "MyLabel") {
          name
        }
      }
      fragment dogFragment on Dog {
        name
      }
      `).toDeepEqual([
      {
        message: 'Defer/Stream directive label argument must be unique.',
        locations: [
          { line: 4, column: 26 },
          { line: 6, column: 39 },
        ],
      },
    ]);
  });
});
