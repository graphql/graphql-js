function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (typeof call === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

// FIXME:
// flowlint uninitialized-instance-property:off
import isObjectLike from "../jsutils/isObjectLike.mjs";
import { SYMBOL_TO_STRING_TAG } from "../polyfills/symbols.mjs";
import { getLocation } from "../language/location.mjs";
import { printLocation, printSourceLocation } from "../language/printLocation.mjs";
/**
 * A GraphQLError describes an Error found during the parse, validate, or
 * execute phases of performing a GraphQL operation. In addition to a message
 * and stack trace, it also includes information about the locations in a
 * GraphQL document and/or execution result that correspond to the Error.
 */

export let GraphQLError = /*#__PURE__*/function (_Error) {
  _inherits(GraphQLError, _Error);

  var _super = _createSuper(GraphQLError);

  /**
   * A message describing the Error for debugging purposes.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   *
   * Note: should be treated as readonly, despite invariant usage.
   */

  /**
   * An array of { line, column } locations within the source GraphQL document
   * which correspond to this error.
   *
   * Errors during validation often contain multiple locations, for example to
   * point out two things with the same name. Errors during execution include a
   * single location, the field which produced the error.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */

  /**
   * An array describing the JSON-path into the execution response which
   * corresponds to this error. Only included for errors during execution.
   *
   * Enumerable, and appears in the result of JSON.stringify().
   */

  /**
   * An array of GraphQL AST Nodes corresponding to this error.
   */

  /**
   * The source GraphQL document for the first location of this error.
   *
   * Note that if this Error represents more than one node, the source may not
   * represent nodes after the first node.
   */

  /**
   * An array of character offsets within the source GraphQL document
   * which correspond to this error.
   */

  /**
   * The original error thrown from a field resolver during execution.
   */

  /**
   * Extension fields to add to the formatted error.
   */
  function GraphQLError(message, nodes, source, positions, path, originalError, extensions) {
    var _this;

    _classCallCheck(this, GraphQLError);

    _this = _super.call(this, message); // Compute list of blame nodes.

    const _nodes = Array.isArray(nodes) ? nodes.length !== 0 ? nodes : undefined : nodes ? [nodes] : undefined; // Compute locations in the source for the given nodes/positions.


    let _source = source;

    if (!_source && _nodes) {
      _source = _nodes[0].loc?.source;
    }

    let _positions = positions;

    if (!_positions && _nodes) {
      _positions = _nodes.reduce((list, node) => {
        if (node.loc) {
          list.push(node.loc.start);
        }

        return list;
      }, []);
    }

    if (_positions && _positions.length === 0) {
      _positions = undefined;
    }

    let _locations;

    if (positions && source) {
      _locations = positions.map(pos => getLocation(source, pos));
    } else if (_nodes) {
      _locations = _nodes.reduce((list, node) => {
        if (node.loc) {
          list.push(getLocation(node.loc.source, node.loc.start));
        }

        return list;
      }, []);
    }

    let _extensions = extensions;

    if (_extensions == null && originalError != null) {
      const originalExtensions = originalError.extensions;

      if (isObjectLike(originalExtensions)) {
        _extensions = originalExtensions;
      }
    }

    Object.defineProperties(_assertThisInitialized(_this), {
      name: {
        value: 'GraphQLError'
      },
      message: {
        value: message,
        // By being enumerable, JSON.stringify will include `message` in the
        // resulting output. This ensures that the simplest possible GraphQL
        // service adheres to the spec.
        enumerable: true,
        writable: true
      },
      locations: {
        // Coercing falsy values to undefined ensures they will not be included
        // in JSON.stringify() when not provided.
        value: _locations ?? undefined,
        // By being enumerable, JSON.stringify will include `locations` in the
        // resulting output. This ensures that the simplest possible GraphQL
        // service adheres to the spec.
        enumerable: _locations != null
      },
      path: {
        // Coercing falsy values to undefined ensures they will not be included
        // in JSON.stringify() when not provided.
        value: path ?? undefined,
        // By being enumerable, JSON.stringify will include `path` in the
        // resulting output. This ensures that the simplest possible GraphQL
        // service adheres to the spec.
        enumerable: path != null
      },
      nodes: {
        value: _nodes ?? undefined
      },
      source: {
        value: _source ?? undefined
      },
      positions: {
        value: _positions ?? undefined
      },
      originalError: {
        value: originalError
      },
      extensions: {
        // Coercing falsy values to undefined ensures they will not be included
        // in JSON.stringify() when not provided.
        value: _extensions ?? undefined,
        // By being enumerable, JSON.stringify will include `path` in the
        // resulting output. This ensures that the simplest possible GraphQL
        // service adheres to the spec.
        enumerable: _extensions != null
      }
    }); // Include (non-enumerable) stack trace.

    if (originalError?.stack) {
      Object.defineProperty(_assertThisInitialized(_this), 'stack', {
        value: originalError.stack,
        writable: true,
        configurable: true
      });
      return _possibleConstructorReturn(_this);
    } // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2317')


    if (Error.captureStackTrace) {
      Error.captureStackTrace(_assertThisInitialized(_this), GraphQLError);
    } else {
      Object.defineProperty(_assertThisInitialized(_this), 'stack', {
        value: Error().stack,
        writable: true,
        configurable: true
      });
    }

    return _this;
  }

  _createClass(GraphQLError, [{
    key: "toString",
    value: function toString() {
      return printError(this);
    } // FIXME: workaround to not break chai comparisons, should be remove in v16
    // $FlowFixMe Flow doesn't support computed properties yet

  }, {
    key: SYMBOL_TO_STRING_TAG,
    get: function () {
      return 'Object';
    }
  }]);

  return GraphQLError;
}( /*#__PURE__*/_wrapNativeSuper(Error));
/**
 * Prints a GraphQLError to a string, representing useful location information
 * about the error's position in the source.
 */

export function printError(error) {
  let output = error.message;

  if (error.nodes) {
    for (const node of error.nodes) {
      if (node.loc) {
        output += '\n\n' + printLocation(node.loc);
      }
    }
  } else if (error.source && error.locations) {
    for (const location of error.locations) {
      output += '\n\n' + printSourceLocation(error.source, location);
    }
  }

  return output;
}
