// @flow strict

'use strict';

// @noflow

const path = require('path');
const fs = require('fs');

const { HashMap } = require('./helper');

// Create a new Hashmap to store file names and declarations
const mp = new HashMap();

// All the rules that are required by plugin
const ExportNamedDeclaration = {
  enter(babelPath, state) {
    if (babelPath.node.declaration) {
      return handleDeclaration(babelPath, state);
    }

    if (babelPath.node.specifiers) {
      return handleNodeSpecifiers(
        babelPath.node.specifiers,
        state,
        babelPath.node.source ? babelPath.node.source.value : undefined,
      );
    }
  },
};

const ExportAllDeclaration = {
  enter(babelPath, state) {
    mp.add(
      '*',
      state,
      babelPath.node.source ? babelPath.node.source.value : undefined,
    );
  },
};

module.exports = function() {
  return {
    visitor: {
      ExportNamedDeclaration,
      ExportAllDeclaration,
      ExportDefaultDeclaration: ExportNamedDeclaration,
      Program: {
        exit() {
          return writeToJSON();
        },
      },
    },
  };
};

// Helper functions for the rules
function handleDeclaration(babelPath, state) {
  switch (babelPath.node.declaration.type) {
    case 'VariableDeclaration':
      return handleVariableDeclarations(
        babelPath.node.declaration,
        state,
        babelPath.node.source ? babelPath.node.source.value : undefined,
      );
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return handleFunctionDeclarations(
        babelPath.node.declaration,
        state,
        babelPath.node.source ? babelPath.node.source.value : undefined,
      );
  }
}

function handleNodeSpecifiers(specifiers, state, source) {
  return specifiers.forEach(specifier => {
    switch (specifier.type) {
      case 'ExportSpecifier':
        mp.add(specifier.local.name, state, source);
        break;
      case 'ExportNamespaceSpecifier':
        mp.add('*', state, source);
        break;
    }
  });
}

function handleVariableDeclarations(variableDeclaration, state, source) {
  variableDeclaration.declarations.forEach(declaration =>
    mp.add(declaration.id.name, state, source),
  );
}

function handleFunctionDeclarations(declaration, state, source) {
  return mp.add(declaration.id.name, state, source);
}

// To write final result to JSON file
function writeToJSON() {
  if (!fs.existsSync(path.join(__dirname, '/map.json'))) {
    fs.writeFileSync(path.join(__dirname, '/map.json'), JSON.stringify({}));
  }
  const exportedValues = require(path.join(__dirname, '/map.json'));
  for (const key of mp.keys()) {
    exportedValues[key] = exportedValues[key] || [];

    exportedValues[key] = exportedValues[key].concat(Array.from(mp.get(key)));

    exportedValues[key] = Array.from(new Set(exportedValues[key]));
  }

  fs.writeFileSync(
    path.join(__dirname, '/map.json'),
    JSON.stringify(exportedValues),
  );
}
