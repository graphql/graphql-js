import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../__testUtils__/dedent';

import mapValue from '../../jsutils/mapValue';

import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { separateOperations } from '../separateOperations';

describe('separateOperations', () => {
  it('separates one AST into multiple, maintaining document order', () => {
    const ast = parse(`
      {
        ...Y
        ...X
      }

      query One {
        foo
        bar
        ...A
        ...X
      }

      fragment A on T {
        field
        ...B
      }

      fragment X on T {
        fieldX
      }

      query Two {
        ...A
        ...Y
        baz
      }

      fragment Y on T {
        fieldY
      }

      fragment B on T {
        something
      }
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      '': dedent`
        {
          ...Y
          ...X
        }

        fragment X on T {
          fieldX
        }

        fragment Y on T {
          fieldY
        }
      `,
      One: dedent`
        query One {
          foo
          bar
          ...A
          ...X
        }

        fragment A on T {
          field
          ...B
        }

        fragment X on T {
          fieldX
        }

        fragment B on T {
          something
        }
      `,
      Two: dedent`
        fragment A on T {
          field
          ...B
        }

        query Two {
          ...A
          ...Y
          baz
        }

        fragment Y on T {
          fieldY
        }

        fragment B on T {
          something
        }
      `,
    });
  });

  it('survives circular dependencies', () => {
    const ast = parse(`
      query One {
        ...A
      }

      fragment A on T {
        ...B
      }

      fragment B on T {
        ...A
      }

      query Two {
        ...B
      }
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      One: dedent`
        query One {
          ...A
        }

        fragment A on T {
          ...B
        }

        fragment B on T {
          ...A
        }
      `,
      Two: dedent`
        fragment A on T {
          ...B
        }

        fragment B on T {
          ...A
        }

        query Two {
          ...B
        }
      `,
    });
  });

  it('distinguish query and fragment names', () => {
    const ast = parse(`
      {
        ...NameClash
      }

      fragment NameClash on T {
        oneField
      }

      query NameClash {
        ...ShouldBeSkippedInFirstQuery
      }

      fragment ShouldBeSkippedInFirstQuery on T {
        twoField
      }
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      '': dedent`
        {
          ...NameClash
        }

        fragment NameClash on T {
          oneField
        }
      `,
      NameClash: dedent`
        query NameClash {
          ...ShouldBeSkippedInFirstQuery
        }

        fragment ShouldBeSkippedInFirstQuery on T {
          twoField
        }
      `,
    });
  });

  it('handles unknown fragments', () => {
    const ast = parse(`
      {
        ...Unknown
        ...Known
      }

      fragment Known on T {
        someField
      }
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      '': dedent`
        {
          ...Unknown
          ...Known
        }

        fragment Known on T {
          someField
        }
      `,
    });
  });
});
## Contributing

### Start contributing right now:

We accept a lot of [different contributions](CONTRIBUTING.md/#types-of-contributions-memo), including some that don't require you to write a single line of code.

#### Click **make a contribution** from docs

As you're using the GitHub Docs, you may find something in an article that you'd like to add to, update, or change. Click on **make a contribution** to navigate directly to that article in the codebase, so that you can begin making your contribution.

<img src="./assets/images/contribution_cta.png" width="400">

#### Open an issue

If you've found a problem, you can open an issue using a [template](https://github.com/github/docs/issues/new/choose).

#### Solve an issue

If you have a solution to one of the open issues, you will need to fork the repository and submit a PR using the [template](https://github.com/github/docs/blob/main/CONTRIBUTING.md#pull-request-template) that is visible automatically in the pull request body. For more details about this process, please check out [Getting Started with Contributing](/CONTRIBUTING.md).

#### Join us in discussions

We use GitHub Discussions to talk about all sorts of topics related to documentation and this site. For example: if you'd like help troubleshooting a PR, have a great new idea, or want to share something amazing you've learned in our docs, join us in [discussions](https://github.com/github/docs/discussions).

#### And that's it!

That's how you can get started easily as a member of the GitHub Documentation community. :sparkles:

If you want to know more, or you're making a more complex contribution, check out [Getting Started with Contributing](/CONTRIBUTING.md).

There are a few more things to know when you're getting started with this repo:

1. If you're having trouble with your GitHub account, contact [Support](https://support.github.com/contact).
2. We do not accept pull requests for translated content - see [CONTRIBUTING.md](/CONTRIBUTING.md) for more information.

## READMEs

In addition to the README you're reading right now, this repo includes other READMEs that describe the purpose of each subdirectory in more detail:

- [content/README.md](content/README.md)
- [contributing/README.md](contributing/README.md)
- [data/README.md](data/README.md)
- [data/reusables/README.md](data/reusables/README.md)
- [data/variables/README.md](data/variables/README.md)
- [includes/liquid-tags/README.md](includes/liquid-tags/README.md)
- [includes/README.md](includes/README.md)
- [javascripts/README.md](javascripts/README.md)
- [layouts/README.md](layouts/README.md)
- [lib/liquid-tags/README.md](lib/liquid-tags/README.md)
- [middleware/README.md](middleware/README.md)
- [script/README.md](script/README.md)
- [stylesheets/README.md](stylesheets/README.md)
- [tests/README.md](tests/README.md)

## License

The GitHub product documentation in the assets, content, and data folders are licensed under a [CC-BY license](LICENSE).

All other code in this repository is licensed under a [MIT license](LICENSE-CODE).

When using the GitHub logos, be sure to follow the [GitHub logo guidelines](https://github.com/logos).
