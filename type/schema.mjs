import find from '../polyfills/find';
import objectValues from '../polyfills/objectValues';
import inspect from '../jsutils/inspect';
import toObjMap from '../jsutils/toObjMap';
import devAssert from '../jsutils/devAssert';
import instanceOf from '../jsutils/instanceOf';
import isObjectLike from '../jsutils/isObjectLike';
import defineToStringTag from '../jsutils/defineToStringTag';
import { __Schema } from './introspection';
import { GraphQLDirective, isDirective, specifiedDirectives } from './directives';
import { isObjectType, isInterfaceType, isUnionType, isInputObjectType, getNamedType } from './definition';
/**
 * Test if the given value is a GraphQL schema.
 */

// eslint-disable-next-line no-redeclare
export function isSchema(schema) {
  return instanceOf(schema, GraphQLSchema);
}
export function assertSchema(schema) {
  if (!isSchema(schema)) {
    throw new Error("Expected ".concat(inspect(schema), " to be a GraphQL schema."));
  }

  return schema;
}
/**
 * Schema Definition
 *
 * A Schema is created by supplying the root types of each type of operation,
 * query and mutation (optional). A schema definition is then supplied to the
 * validator and executor.
 *
 * Example:
 *
 *     const MyAppSchema = new GraphQLSchema({
 *       query: MyAppQueryRootType,
 *       mutation: MyAppMutationRootType,
 *     })
 *
 * Note: When the schema is constructed, by default only the types that are
 * reachable by traversing the root types are included, other types must be
 * explicitly referenced.
 *
 * Example:
 *
 *     const characterInterface = new GraphQLInterfaceType({
 *       name: 'Character',
 *       ...
 *     });
 *
 *     const humanType = new GraphQLObjectType({
 *       name: 'Human',
 *       interfaces: [characterInterface],
 *       ...
 *     });
 *
 *     const droidType = new GraphQLObjectType({
 *       name: 'Droid',
 *       interfaces: [characterInterface],
 *       ...
 *     });
 *
 *     const schema = new GraphQLSchema({
 *       query: new GraphQLObjectType({
 *         name: 'Query',
 *         fields: {
 *           hero: { type: characterInterface, ... },
 *         }
 *       }),
 *       ...
 *       // Since this schema references only the `Character` interface it's
 *       // necessary to explicitly list the types that implement it if
 *       // you want them to be included in the final schema.
 *       types: [humanType, droidType],
 *     })
 *
 * Note: If an array of `directives` are provided to GraphQLSchema, that will be
 * the exact list of directives represented and allowed. If `directives` is not
 * provided then a default set of the specified directives (e.g. @include and
 * @skip) will be used. If you wish to provide *additional* directives to these
 * specified directives, you must explicitly declare them. Example:
 *
 *     const MyAppSchema = new GraphQLSchema({
 *       ...
 *       directives: specifiedDirectives.concat([ myCustomDirective ]),
 *     })
 *
 */

export var GraphQLSchema =
/*#__PURE__*/
function () {
  // Used as a cache for validateSchema().
  function GraphQLSchema(config) {
    // If this schema was built from a source known to be valid, then it may be
    // marked with assumeValid to avoid an additional type system validation.
    if (config && config.assumeValid) {
      this.__validationErrors = [];
    } else {
      this.__validationErrors = undefined; // Otherwise check for common mistakes during construction to produce
      // clear and early error messages.

      isObjectLike(config) || devAssert(0, 'Must provide configuration object.');
      !config.types || Array.isArray(config.types) || devAssert(0, "\"types\" must be Array if provided but got: ".concat(inspect(config.types), "."));
      !config.directives || Array.isArray(config.directives) || devAssert(0, '"directives" must be Array if provided but got: ' + "".concat(inspect(config.directives), "."));
    }

    this.extensions = config.extensions && toObjMap(config.extensions);
    this.astNode = config.astNode;
    this.extensionASTNodes = config.extensionASTNodes;
    this._queryType = config.query;
    this._mutationType = config.mutation;
    this._subscriptionType = config.subscription; // Provide specified directives (e.g. @include and @skip) by default.

    this._directives = config.directives || specifiedDirectives; // Build type map now to detect any errors within this schema.

    var initialTypes = [this._queryType, this._mutationType, this._subscriptionType, __Schema].concat(config.types); // Keep track of all types referenced within the schema.

    var typeMap = Object.create(null); // First by deeply visiting all initial types.

    typeMap = initialTypes.reduce(typeMapReducer, typeMap); // Then by deeply visiting all directive types.

    typeMap = this._directives.reduce(typeMapDirectiveReducer, typeMap); // Storing the resulting map for reference by the schema.

    this._typeMap = typeMap;
    this._subTypeMap = Object.create(null); // Keep track of all implementations by interface name.

    this._implementations = collectImplementations(objectValues(typeMap));
  }

  var _proto = GraphQLSchema.prototype;

  _proto.getQueryType = function getQueryType() {
    return this._queryType;
  };

  _proto.getMutationType = function getMutationType() {
    return this._mutationType;
  };

  _proto.getSubscriptionType = function getSubscriptionType() {
    return this._subscriptionType;
  };

  _proto.getTypeMap = function getTypeMap() {
    return this._typeMap;
  };

  _proto.getType = function getType(name) {
    return this.getTypeMap()[name];
  };

  _proto.getPossibleTypes = function getPossibleTypes(abstractType) {
    return isUnionType(abstractType) ? abstractType.getTypes() : this.getImplementations(abstractType).objects;
  };

  _proto.getImplementations = function getImplementations(interfaceType) {
    return this._implementations[interfaceType.name];
  } // @deprecated: use isSubType instead - will be removed in v16.
  ;

  _proto.isPossibleType = function isPossibleType(abstractType, possibleType) {
    /* istanbul ignore next */
    return this.isSubType(abstractType, possibleType);
  };

  _proto.isSubType = function isSubType(abstractType, maybeSubType) {
    var map = this._subTypeMap[abstractType.name];

    if (map === undefined) {
      map = Object.create(null);

      if (isUnionType(abstractType)) {
        for (var _i2 = 0, _abstractType$getType2 = abstractType.getTypes(); _i2 < _abstractType$getType2.length; _i2++) {
          var type = _abstractType$getType2[_i2];
          map[type.name] = true;
        }
      } else {
        var implementations = this.getImplementations(abstractType);

        for (var _i4 = 0, _implementations$obje2 = implementations.objects; _i4 < _implementations$obje2.length; _i4++) {
          var _type = _implementations$obje2[_i4];
          map[_type.name] = true;
        }

        for (var _i6 = 0, _implementations$inte2 = implementations.interfaces; _i6 < _implementations$inte2.length; _i6++) {
          var _type2 = _implementations$inte2[_i6];
          map[_type2.name] = true;
        }
      }

      this._subTypeMap[abstractType.name] = map;
    }

    return map[maybeSubType.name] !== undefined;
  };

  _proto.getDirectives = function getDirectives() {
    return this._directives;
  };

  _proto.getDirective = function getDirective(name) {
    return find(this.getDirectives(), function (directive) {
      return directive.name === name;
    });
  };

  _proto.toConfig = function toConfig() {
    return {
      query: this.getQueryType(),
      mutation: this.getMutationType(),
      subscription: this.getSubscriptionType(),
      types: objectValues(this.getTypeMap()),
      directives: this.getDirectives().slice(),
      extensions: this.extensions,
      astNode: this.astNode,
      extensionASTNodes: this.extensionASTNodes,
      assumeValid: this.__validationErrors !== undefined
    };
  };

  return GraphQLSchema;
}(); // Conditionally apply `[Symbol.toStringTag]` if `Symbol`s are supported

defineToStringTag(GraphQLSchema);

function collectImplementations(types) {
  var implementationsMap = Object.create(null);

  for (var _i8 = 0; _i8 < types.length; _i8++) {
    var type = types[_i8];

    if (isInterfaceType(type)) {
      if (implementationsMap[type.name] === undefined) {
        implementationsMap[type.name] = {
          objects: [],
          interfaces: []
        };
      } // Store implementations by interface.


      for (var _i10 = 0, _type$getInterfaces2 = type.getInterfaces(); _i10 < _type$getInterfaces2.length; _i10++) {
        var iface = _type$getInterfaces2[_i10];

        if (isInterfaceType(iface)) {
          var implementations = implementationsMap[iface.name];

          if (implementations === undefined) {
            implementationsMap[iface.name] = {
              objects: [],
              interfaces: [type]
            };
          } else {
            implementations.interfaces.push(type);
          }
        }
      }
    } else if (isObjectType(type)) {
      // Store implementations by objects.
      for (var _i12 = 0, _type$getInterfaces4 = type.getInterfaces(); _i12 < _type$getInterfaces4.length; _i12++) {
        var _iface = _type$getInterfaces4[_i12];

        if (isInterfaceType(_iface)) {
          var _implementations = implementationsMap[_iface.name];

          if (_implementations === undefined) {
            implementationsMap[_iface.name] = {
              objects: [type],
              interfaces: []
            };
          } else {
            _implementations.objects.push(type);
          }
        }
      }
    }
  }

  return implementationsMap;
}

function typeMapReducer(map, type) {
  if (!type) {
    return map;
  }

  var namedType = getNamedType(type);
  var seenType = map[namedType.name];

  if (seenType) {
    if (seenType !== namedType) {
      throw new Error("Schema must contain uniquely named types but contains multiple types named \"".concat(namedType.name, "\"."));
    }

    return map;
  }

  map[namedType.name] = namedType;
  var reducedMap = map;

  if (isUnionType(namedType)) {
    reducedMap = namedType.getTypes().reduce(typeMapReducer, reducedMap);
  } else if (isObjectType(namedType) || isInterfaceType(namedType)) {
    reducedMap = namedType.getInterfaces().reduce(typeMapReducer, reducedMap);

    for (var _i14 = 0, _objectValues2 = objectValues(namedType.getFields()); _i14 < _objectValues2.length; _i14++) {
      var field = _objectValues2[_i14];
      var fieldArgTypes = field.args.map(function (arg) {
        return arg.type;
      });
      reducedMap = fieldArgTypes.reduce(typeMapReducer, reducedMap);
      reducedMap = typeMapReducer(reducedMap, field.type);
    }
  } else if (isInputObjectType(namedType)) {
    for (var _i16 = 0, _objectValues4 = objectValues(namedType.getFields()); _i16 < _objectValues4.length; _i16++) {
      var _field = _objectValues4[_i16];
      reducedMap = typeMapReducer(reducedMap, _field.type);
    }
  }

  return reducedMap;
}

function typeMapDirectiveReducer(map, directive) {
  // Directives are not validated until validateSchema() is called.
  if (!isDirective(directive)) {
    return map;
  }

  return directive.args.reduce(function (_map, arg) {
    return typeMapReducer(_map, arg.type);
  }, map);
}
