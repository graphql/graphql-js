'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _validate = require('./validate');

Object.defineProperty(exports, 'validate', {
  enumerable: true,
  get: function get() {
    return _validate.validate;
  }
});

var _specifiedRules = require('./specifiedRules');

Object.defineProperty(exports, 'specifiedRules', {
  enumerable: true,
  get: function get() {
    return _specifiedRules.specifiedRules;
  }
});