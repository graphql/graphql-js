export function getIntrospectionQuery(options) {
    const optionsWithDefault = {
        descriptions: true,
        specifiedByUrl: false,
        directiveIsRepeatable: false,
        schemaDescription: false,
        inputValueDeprecation: false,
        experimentalDirectiveDeprecation: false,
        oneOf: false,
        typeDepth: 9,
        ...options,
    };
    const descriptions = optionsWithDefault.descriptions ? 'description' : '';
    const specifiedByUrl = optionsWithDefault.specifiedByUrl
        ? 'specifiedByURL'
        : '';
    const directiveIsRepeatable = optionsWithDefault.directiveIsRepeatable
        ? 'isRepeatable'
        : '';
    const schemaDescription = optionsWithDefault.schemaDescription
        ? descriptions
        : '';
    function inputDeprecation(str) {
        return optionsWithDefault.inputValueDeprecation ? str : '';
    }
    function experimentalDirectiveDeprecation(str) {
        return optionsWithDefault.experimentalDirectiveDeprecation ? str : '';
    }
    const oneOf = optionsWithDefault.oneOf ? 'isOneOf' : '';
    function ofType(level, indent) {
        if (level <= 0) {
            return '';
        }
        if (level > 100) {
            throw new Error('Please set typeDepth to a reasonable value between 0 and 100; the default is 9.');
        }
        return `
${indent}ofType {
${indent}  name
${indent}  kind${ofType(level - 1, indent + '  ')}
${indent}}`;
    }
    return `
    query IntrospectionQuery {
      __schema {
        ${schemaDescription}
        queryType { name kind }
        mutationType { name kind }
        subscriptionType { name kind }
        types {
          ...FullType
        }
        directives${experimentalDirectiveDeprecation('(includeDeprecated: true)')} {
          name
          ${descriptions}
          ${directiveIsRepeatable}
          ${experimentalDirectiveDeprecation('isDeprecated')}
          ${experimentalDirectiveDeprecation('deprecationReason')}
          locations
          args${inputDeprecation('(includeDeprecated: true)')} {
            ...InputValue
          }
        }
      }
    }

    fragment FullType on __Type {
      kind
      name
      ${descriptions}
      ${specifiedByUrl}
      ${oneOf}
      fields(includeDeprecated: true) {
        name
        ${descriptions}
        args${inputDeprecation('(includeDeprecated: true)')} {
          ...InputValue
        }
        type {
          ...TypeRef
        }
        isDeprecated
        deprecationReason
      }
      inputFields${inputDeprecation('(includeDeprecated: true)')} {
        ...InputValue
      }
      interfaces {
        ...TypeRef
      }
      enumValues(includeDeprecated: true) {
        name
        ${descriptions}
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        ...TypeRef
      }
    }

    fragment InputValue on __InputValue {
      name
      ${descriptions}
      type { ...TypeRef }
      defaultValue
      ${inputDeprecation('isDeprecated')}
      ${inputDeprecation('deprecationReason')}
    }

    fragment TypeRef on __Type {
      kind
      name${ofType(optionsWithDefault.typeDepth, '      ')}
    }
  `;
}
//# sourceMappingURL=getIntrospectionQuery.mjs.map