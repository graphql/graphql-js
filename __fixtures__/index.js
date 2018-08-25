"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bigSchemaIntrospectionResult = exports.bigSchemaSDL = void 0;

var _path = require("path");

var _fs = require("fs");

function readLocalFile(filename) {
  return (0, _fs.readFileSync)((0, _path.join)(__dirname, filename), 'utf8');
}

var bigSchemaSDL = readLocalFile('github-schema.graphql');
exports.bigSchemaSDL = bigSchemaSDL;
var bigSchemaIntrospectionResult = JSON.parse(readLocalFile('github-schema.json'));
exports.bigSchemaIntrospectionResult = bigSchemaIntrospectionResult;