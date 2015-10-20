/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse } from '../parser';
import { readFileSync } from 'fs';
import { print } from '../printer';
import { join } from 'path';

describe('Printer', () => {
  it('does not alter ast', () => {
    var ast = parse(kitchenSink);
    var astCopy = JSON.parse(JSON.stringify(ast));
    print(ast);
    expect(ast).to.deep.equal(astCopy);
  });

  it('prints minimal ast', () => {
    var ast = { kind: 'Field', name: { kind: 'Name', value: 'foo' } };
    expect(print(ast)).to.equal('foo');
  });

  it('produces helpful error messages', () => {
    var badAst1 = { random: 'Data' };
    expect(() => print(badAst1)).to.throw(
      'Invalid AST Node: {"random":"Data"}'
    );
  });


  var kitchenSink = readFileSync(
    join(__dirname, '/kitchen-sink.graphql'),
    { encoding: 'utf8' }
  );

  it('prints kitchen sink', () => {

    var ast = parse(kitchenSink);

    var printed = print(ast);

    expect(printed).to.equal(
  `query queryName($foo: ComplexType, $site: Site = MOBILE) {
  whoever123is: node(id: [123, 456]) {
    id
    ... on User @defer {
      field2 {
        id
        alias: field1(first: 10, after: $foo) @include(if: $foo) {
          id
          ...frag
        }
      }
    }
    ... @skip(unless: $foo) {
      id
    }
    ... {
      id
    }
  }
}

mutation likeStory {
  like(story: 123) @defer {
    story {
      id
    }
  }
}

subscription StoryLikeSubscription($input: StoryLikeSubscribeInput) {
  storyLikeSubscribe(input: $input) {
    story {
      likers {
        count
      }
      likeSentence {
        text
      }
    }
  }
}

fragment frag on Friend {
  foo(size: $size, bar: $b, obj: {key: "value"})
}

{
  unnamed(truthy: true, falsey: false)
  query
}
`);

  });
});
