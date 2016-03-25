/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  ScalarLeafs,
  noSubselectionAllowedMessage,
  requiredSubselectionMessage,
} from '../rules/ScalarLeafs';


function noScalarSubselection(field, type, line, column) {
  return {
    message: noSubselectionAllowedMessage(field, type),
    locations: [ { line, column } ],
  };
}

function missingObjSubselection(field, type, line, column) {
  return {
    message: requiredSubselectionMessage(field, type),
    locations: [ { line, column } ],
  };
}

describe('Validate: Scalar leafs', () => {

  it('valid scalar selection', () => {
    expectPassesRule(ScalarLeafs, `
      fragment scalarSelection on Dog {
        barks
      }
    `);
  });

  it('object type missing selection', () => {
    expectFailsRule(ScalarLeafs, `
      query directQueryOnObjectWithoutSubFields {
        human
      }
    `, [ missingObjSubselection('human', 'Human', 3, 9) ]);
  });

  it('interface type missing selection', () => {
    expectFailsRule(ScalarLeafs, `
      {
        human { pets }
      }
    `, [ missingObjSubselection('pets', '[Pet]', 3, 17) ]);
  });

  it('valid scalar selection with args', () => {
    expectPassesRule(ScalarLeafs, `
      fragment scalarSelectionWithArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('scalar selection not allowed on Boolean', () => {
    expectFailsRule(ScalarLeafs, `
      fragment scalarSelectionsNotAllowedOnBoolean on Dog {
        barks { sinceWhen }
      }
    `,
    [ noScalarSubselection('barks', 'Boolean', 3, 15) ] );
  });

  it('scalar selection not allowed on Enum', () => {
    expectFailsRule(ScalarLeafs, `
      fragment scalarSelectionsNotAllowedOnEnum on Cat {
        furColor { inHexdec }
      }
    `,
    [ noScalarSubselection('furColor', 'FurColor', 3, 18) ] );
  });

  it('scalar selection not allowed with args', () => {
    expectFailsRule(ScalarLeafs, `
      fragment scalarSelectionsNotAllowedWithArgs on Dog {
        doesKnowCommand(dogCommand: SIT) { sinceWhen }
      }
    `,
    [ noScalarSubselection('doesKnowCommand', 'Boolean', 3, 42) ] );
  });

  it('Scalar selection not allowed with directives', () => {
    expectFailsRule(ScalarLeafs, `
      fragment scalarSelectionsNotAllowedWithDirectives on Dog {
        name @include(if: true) { isAlsoHumanName }
      }
    `,
    [ noScalarSubselection('name', 'String', 3, 33) ] );
  });

  it('Scalar selection not allowed with directives and args', () => {
    expectFailsRule(ScalarLeafs, `
      fragment scalarSelectionsNotAllowedWithDirectivesAndArgs on Dog {
        doesKnowCommand(dogCommand: SIT) @include(if: true) { sinceWhen }
      }
    `,
    [ noScalarSubselection('doesKnowCommand', 'Boolean', 3, 61) ] );
  });

});
