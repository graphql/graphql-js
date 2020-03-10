// @flow strict

'use strict';
const path = require('path');

class HashMap {
  constructor() {
    this._map = new Map();
  }

  add(value, state, source) {
    let filepath = path.resolve(state.file.opts.filename);
    if (source) {
      const pathArray = state.file.opts.filename.split('/');
      const directoryPath = pathArray.slice(0, pathArray.length - 1).join('/');
      filepath = require.resolve(path.resolve(directoryPath, source));
    }
    if (!this._map.has(filepath)) {
      this._map.set(filepath, new Set());
    }
    this._map.get(filepath).add(value);
  }

  get(key) {
    return this._map.get(key);
  }

  keys() {
    return this._map.keys();
  }
}

module.exports = { HashMap };
