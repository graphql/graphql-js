'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isSpecifiedDirective =
  exports.specifiedDirectives =
  exports.GraphQLOneOfDirective =
  exports.GraphQLSpecifiedByDirective =
  exports.GraphQLDeprecatedDirective =
  exports.DEFAULT_DEPRECATION_REASON =
  exports.GraphQLStreamDirective =
  exports.GraphQLDeferDirective =
  exports.GraphQLSkipDirective =
  exports.GraphQLIncludeDirective =
  exports.GraphQLDirective =
  exports.assertDirective =
  exports.isDirective =
    void 0;
const inspect_js_1 = require('../jsutils/inspect.js');
const instanceOf_js_1 = require('../jsutils/instanceOf.js');
const toObjMap_js_1 = require('../jsutils/toObjMap.js');
const directiveLocation_js_1 = require('../language/directiveLocation.js');
const assertName_js_1 = require('./assertName.js');
const definition_js_1 = require('./definition.js');
const scalars_js_1 = require('./scalars.js');
/**
 * Test if the given value is a GraphQL directive.
 */
function isDirective(directive) {
  return (0, instanceOf_js_1.instanceOf)(directive, GraphQLDirective);
}
exports.isDirective = isDirective;
function assertDirective(directive) {
  if (!isDirective(directive)) {
    throw new Error(
      `Expected ${(0, inspect_js_1.inspect)(
        directive,
      )} to be a GraphQL directive.`,
    );
  }
  return directive;
}
exports.assertDirective = assertDirective;
/**
 * Directives are used by the GraphQL runtime as a way of modifying execution
 * behavior. Type system creators will usually not create these directly.
 */
class GraphQLDirective {
  constructor(config) {
    this.name = (0, assertName_js_1.assertName)(config.name);
    this.description = config.description;
    this.locations = config.locations;
    this.isRepeatable = config.isRepeatable ?? false;
    this.extensions = (0, toObjMap_js_1.toObjMap)(config.extensions);
    this.astNode = config.astNode;
    const args = config.args ?? {};
    this.args = (0, definition_js_1.defineArguments)(args);
  }
  get [Symbol.toStringTag]() {
    return 'GraphQLDirective';
  }
  toConfig() {
    return {
      name: this.name,
      description: this.description,
      locations: this.locations,
      args: (0, definition_js_1.argsToArgsConfig)(this.args),
      isRepeatable: this.isRepeatable,
      extensions: this.extensions,
      astNode: this.astNode,
    };
  }
  toString() {
    return '@' + this.name;
  }
  toJSON() {
    return this.toString();
  }
}
exports.GraphQLDirective = GraphQLDirective;
/**
 * Used to conditionally include fields or fragments.
 */
exports.GraphQLIncludeDirective = new GraphQLDirective({
  name: 'include',
  description:
    'Directs the executor to include this field or fragment only when the `if` argument is true.',
  locations: [
    directiveLocation_js_1.DirectiveLocation.FIELD,
    directiveLocation_js_1.DirectiveLocation.FRAGMENT_SPREAD,
    directiveLocation_js_1.DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLBoolean),
      description: 'Included when true.',
    },
  },
});
/**
 * Used to conditionally skip (exclude) fields or fragments.
 */
exports.GraphQLSkipDirective = new GraphQLDirective({
  name: 'skip',
  description:
    'Directs the executor to skip this field or fragment when the `if` argument is true.',
  locations: [
    directiveLocation_js_1.DirectiveLocation.FIELD,
    directiveLocation_js_1.DirectiveLocation.FRAGMENT_SPREAD,
    directiveLocation_js_1.DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLBoolean),
      description: 'Skipped when true.',
    },
  },
});
/**
 * Used to conditionally defer fragments.
 */
exports.GraphQLDeferDirective = new GraphQLDirective({
  name: 'defer',
  description:
    'Directs the executor to defer this fragment when the `if` argument is true or undefined.',
  locations: [
    directiveLocation_js_1.DirectiveLocation.FRAGMENT_SPREAD,
    directiveLocation_js_1.DirectiveLocation.INLINE_FRAGMENT,
  ],
  args: {
    if: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLBoolean),
      description: 'Deferred when true or undefined.',
      defaultValue: true,
    },
    label: {
      type: scalars_js_1.GraphQLString,
      description: 'Unique name',
    },
  },
});
/**
 * Used to conditionally stream list fields.
 */
exports.GraphQLStreamDirective = new GraphQLDirective({
  name: 'stream',
  description:
    'Directs the executor to stream plural fields when the `if` argument is true or undefined.',
  locations: [directiveLocation_js_1.DirectiveLocation.FIELD],
  args: {
    if: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLBoolean),
      description: 'Stream when true or undefined.',
      defaultValue: true,
    },
    label: {
      type: scalars_js_1.GraphQLString,
      description: 'Unique name',
    },
    initialCount: {
      defaultValue: 0,
      type: scalars_js_1.GraphQLInt,
      description: 'Number of items to return immediately',
    },
  },
});
/**
 * Constant string used for default reason for a deprecation.
 */
exports.DEFAULT_DEPRECATION_REASON = 'No longer supported';
/**
 * Used to declare element of a GraphQL schema as deprecated.
 */
exports.GraphQLDeprecatedDirective = new GraphQLDirective({
  name: 'deprecated',
  description: 'Marks an element of a GraphQL schema as no longer supported.',
  locations: [
    directiveLocation_js_1.DirectiveLocation.FIELD_DEFINITION,
    directiveLocation_js_1.DirectiveLocation.ARGUMENT_DEFINITION,
    directiveLocation_js_1.DirectiveLocation.INPUT_FIELD_DEFINITION,
    directiveLocation_js_1.DirectiveLocation.ENUM_VALUE,
  ],
  args: {
    reason: {
      type: scalars_js_1.GraphQLString,
      description:
        'Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).',
      defaultValue: exports.DEFAULT_DEPRECATION_REASON,
    },
  },
});
/**
 * Used to provide a URL for specifying the behavior of custom scalar definitions.
 */
exports.GraphQLSpecifiedByDirective = new GraphQLDirective({
  name: 'specifiedBy',
  description: 'Exposes a URL that specifies the behavior of this scalar.',
  locations: [directiveLocation_js_1.DirectiveLocation.SCALAR],
  args: {
    url: {
      type: new definition_js_1.GraphQLNonNull(scalars_js_1.GraphQLString),
      description: 'The URL that specifies the behavior of this scalar.',
    },
  },
});
/**
 * Used to indicate an Input Object is a OneOf Input Object.
 */
exports.GraphQLOneOfDirective = new GraphQLDirective({
  name: 'oneOf',
  description:
    'Indicates exactly one field must be supplied and this field must not be `null`.',
  locations: [directiveLocation_js_1.DirectiveLocation.INPUT_OBJECT],
  args: {},
});
/**
 * The full list of specified directives.
 */
exports.specifiedDirectives = Object.freeze([
  exports.GraphQLIncludeDirective,
  exports.GraphQLSkipDirective,
  exports.GraphQLDeprecatedDirective,
  exports.GraphQLSpecifiedByDirective,
  exports.GraphQLOneOfDirective,
]);
function isSpecifiedDirective(directive) {
  return exports.specifiedDirectives.some(
    ({ name }) => name === directive.name,
  );
}
exports.isSpecifiedDirective = isSpecifiedDirective;
