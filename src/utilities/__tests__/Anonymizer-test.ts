import { webcrypto } from 'node:crypto';

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { Anonymizer } from '../Anonymizer';

async function expectAnonymized(document: string) {
  const anonymizer = new Anonymizer({
    hashSalt: 'graphql-js/',
    hashFunction: (data) => webcrypto.subtle.digest('SHA-256', data),
  });
  return expect(print(await anonymizer.anonymizeDocumentNode(parse(document))));
}

// test with schema, query => snapshot + test the same result
// test with invalid query due to arg mismatch (if argument replaced to the same became valid)
// test with coercion from string to int/float
// test with introspection query with type
describe('Anonymizer', () => {
  it('can be Object.toStringified', () => {
    const anonymizer = new Anonymizer({});

    expect(Object.prototype.toString.call(anonymizer)).to.equal(
      '[object Anonymizer]',
    );
  });

  it('work', async () => {
    const anonymizer = new Anonymizer({
      hashSalt: 'graphql-js/',
      hashFunction: (data) => webcrypto.subtle.digest('SHA-256', data),
    });
    const hashed = await anonymizer.anonymizeStringValue('test');
    expect(hashed).to.equal('h_dBtROL5GGqP7VAoLl1CvQzrdgLUtOFRuqWCAhvWK8H0');
  });

  it('work', async () => {
    (
      await expectAnonymized(`
      query TestQuery($arg: String) {
        foo(arg: $arg)
        bar {
          baz @skip(if: false)
        }
      }
    `)
    ).to.equal(dedent`
      query h_SJZgrQ0qER6XA2In0BvjgikiGyzS947FiPj0KVuWuqo($h_nVaZrh9Oups9oZLouxgQFpHNTo1kxlaa3dI8D5PBIdc: String) {
        h_qbuzhEKLs429KQhe60wLZOP746k8mU69s6K3YN8sORO(
          h_nVaZrh9Oups9oZLouxgQFpHNTo1kxlaa3dI8D5PBIdc: $h_nVaZrh9Oups9oZLouxgQFpHNTo1kxlaa3dI8D5PBIdc
        )
        h_I7FTvKWpQa6jnQb8LeHDG2AlHuFUkDwt2n2c4WA7efV {
          h_uua9CNLJ9uByOi4HQXucOoTNwop41vn8bLShit1u9in
        }
      }
    `);
  });
});
