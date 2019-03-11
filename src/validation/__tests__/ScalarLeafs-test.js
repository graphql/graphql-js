/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectValidationErrors } from './harness';
import {
  ScalarLeafs,
  noSubselectionAllowedMessage,
  requiredSubselectionMessage,
} from '../rules/ScalarLeafs';

function expectErrors(queryStr) {
  return expectValidationErrors(ScalarLeafs, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function noScalarSubselection(field, type, line, column) {
  return {
    message: noSubselectionAllowedMessage(field, type),
    locations: [{ line, column }],
  };
}

function missingObjSubselection(field, type, line, column) {
  return {
    message: requiredSubselectionMessage(field, type),
    locations: [{ line, column }],
  };
}

describe('Validate: Scalar leafs', () => {
  it('valid scalar selection', () => {
    expectValid(`
      fragment scalarSelection on Dog {
        barks
      }
    `);
  });

  it('object type missing selection', () => {
    expectErrors(`
      query directQueryOnObjectWithoutSubFields {
        human
      }
    `).to.deep.equal([missingObjSubselection('human', 'Human', 3, 9)]);
  });

  it('interface type missing selection', () => {
    expectErrors(`
      {
        human { pets }
      }
    `).to.deep.equal([missingObjSubselection('pets', '[Pet]', 3, 17)]);
  });

  it('valid scalar selection with args', () => {
    expectValid(`
      fragment scalarSelectionWithArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('scalar selection not allowed on Boolean', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedOnBoolean on Dog {
        barks { sinceWhen }
      }
    `).to.deep.equal([noScalarSubselection('barks', 'Boolean', 3, 15)]);
  });

  it('scalar selection not allowed on Enum', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedOnEnum on Cat {
        furColor { inHexdec }
      }
    `).to.deep.equal([noScalarSubselection('furColor', 'FurColor', 3, 18)]);
  });

  it('scalar selection not allowed with args', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedWithArgs on Dog {
        doesKnowCommand(dogCommand: SIT) { sinceWhen }
      }
    `).to.deep.equal([
      noScalarSubselection('doesKnowCommand', 'Boolean', 3, 42),
    ]);
  });

  it('Scalar selection not allowed with directives', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedWithDirectives on Dog {
        name @include(if: true) { isAlsoHumanName }
      }
    `).to.deep.equal([noScalarSubselection('name', 'String', 3, 33)]);
  });

  it('Scalar selection not allowed with directives and args', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedWithDirectivesAndArgs on Dog {
        doesKnowCommand(dogCommand: SIT) @include(if: true) { sinceWhen }
      }
    `).to.deep.equal([
      noScalarSubselection('doesKnowCommand', 'Boolean', 3, 61),
    ]);
  });
});
