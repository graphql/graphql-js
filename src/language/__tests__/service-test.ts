import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Kind } from '../kinds';
import { parse } from '../parser';
import { print } from '../printer';

describe('Service Definition Parsing and Printing', () => {
  describe('parsing service definitions', () => {
    it('parses a simple service definition', () => {
      const doc = parse(`
        service {
          capability example.capability
        }
      `);

      expect(doc.definitions).to.have.length(1);
      const serviceDef = doc.definitions[0];
      expect(serviceDef.kind).to.equal(Kind.SERVICE_DEFINITION);

      if (serviceDef.kind === Kind.SERVICE_DEFINITION) {
        expect(serviceDef.entries).to.have.length(1);
        expect(serviceDef.entries?.[0].identifier.value).to.equal(
          'example.capability',
        );
        expect(serviceDef.entries?.[0].value).to.equal(undefined);
      }
    });

    it('parses service with capability value', () => {
      const doc = parse(`
        service {
          capability example.capability("Example value")
        }
      `);

      const serviceDef = doc.definitions[0];
      if (serviceDef.kind === Kind.SERVICE_DEFINITION) {
        expect(serviceDef.entries?.[0].identifier.value).to.equal(
          'example.capability',
        );
        expect(serviceDef.entries?.[0].value?.value).to.equal(
          'Example value',
        );
      }
    });

    it('parses service with description', () => {
      const doc = parse(`
        "My GraphQL Service"
        service {
          capability example.capability
        }
      `);

      const serviceDef = doc.definitions[0];
      if (serviceDef.kind === Kind.SERVICE_DEFINITION) {
        expect(serviceDef.description?.value).to.equal('My GraphQL Service');
      }
    });

    it('parses service with capability descriptions', () => {
      const doc = parse(`
        service {
          "Example capability description"
          capability example.capability
        }
      `);

      const serviceDef = doc.definitions[0];
      if (serviceDef.kind === Kind.SERVICE_DEFINITION) {
        expect(serviceDef.entries?.[0].description?.value).to.equal(
          'Example capability description',
        );
      }
    });

    it('parses service with multiple capabilities', () => {
      const doc = parse(`
        service {
          capability example.capability
          capability graphql.someFutureCapability
          capability org.example.customFeature("v2")
        }
      `);

      const serviceDef = doc.definitions[0];
      if (serviceDef.kind === Kind.SERVICE_DEFINITION) {
        expect(serviceDef.entries).to.have.length(3);
        expect(serviceDef.entries?.[0].identifier.value).to.equal(
          'example.capability',
        );
        expect(serviceDef.entries?.[0].value).to.equal(undefined);
        expect(serviceDef.entries?.[1].identifier.value).to.equal(
          'graphql.someFutureCapability',
        );
        expect(serviceDef.entries?.[1].value).to.equal(undefined);
        expect(serviceDef.entries?.[2].identifier.value).to.equal(
          'org.example.customFeature',
        );
        expect(serviceDef.entries?.[2].value?.value).to.equal('v2');
      }
    });

    it('parses service with directives', () => {
      const doc = parse(`
        service @deprecated {
          capability example.capability
        }
      `);

      const serviceDef = doc.definitions[0];
      if (serviceDef.kind === Kind.SERVICE_DEFINITION) {
        expect(serviceDef.directives).to.have.length(1);
        expect(serviceDef.directives?.[0].name.value).to.equal('deprecated');
      }
    });

    it('rejects qualified name with whitespace', () => {
      expect(() => parse('service { capability graphql. spec }')).to.throw(
        'Expected a qualified name',
      );
    });

    it('rejects single-component name as capability identifier', () => {
      expect(() => parse('service { capability graphql }')).to.throw(
        'Expected a qualified name with at least two components',
      );
    });
  });

  describe('parsing service extensions', () => {
    it('parses a service extension', () => {
      const doc = parse(`
        extend service {
          capability graphql.additionalFeature
        }
      `);

      expect(doc.definitions).to.have.length(1);
      const serviceExt = doc.definitions[0];
      expect(serviceExt.kind).to.equal(Kind.SERVICE_EXTENSION);

      if (serviceExt.kind === Kind.SERVICE_EXTENSION) {
        expect(serviceExt.entries).to.have.length(1);
        expect(serviceExt.entries?.[0].identifier.value).to.equal(
          'graphql.additionalFeature',
        );
      }
    });

    it('parses service extension with directives', () => {
      const doc = parse(`
        extend service @deprecated {
          capability example.capability
        }
      `);

      const serviceExt = doc.definitions[0];
      if (serviceExt.kind === Kind.SERVICE_EXTENSION) {
        expect(serviceExt.directives).to.have.length(1);
        expect(serviceExt.directives?.[0].name.value).to.equal('deprecated');
      }
    });
  });

  describe('printing service definitions', () => {
    it('prints a service definition', () => {
      const doc = parse(`
        service {
          capability example.capability
        }
      `);

      expect(print(doc)).to.equal(`service {
  capability example.capability
}`);
    });

    it('prints service with capability value', () => {
      const doc = parse(`
        service {
          capability example.capability("Example value")
        }
      `);

      expect(print(doc)).to.equal(`service {
  capability example.capability("Example value")
}`);
    });

    it('prints service with description', () => {
      const doc = parse(`
        "My Service"
        service {
          capability example.capability
        }
      `);

      expect(print(doc)).to.equal(`"My Service"
service {
  capability example.capability
}`);
    });

    it('prints service with capability description', () => {
      const doc = parse(`
        service {
          "A capability"
          capability example.capability
        }
      `);

      expect(print(doc)).to.equal(`service {
  "A capability"
  capability example.capability
}`);
    });

    it('prints service with directives', () => {
      const doc = parse(`
        service @deprecated {
          capability example.capability
        }
      `);

      expect(print(doc)).to.equal(`service @deprecated {
  capability example.capability
}`);
    });

    it('prints service extension', () => {
      const doc = parse(`
        extend service {
          capability graphql.newFeature
        }
      `);

      expect(print(doc)).to.equal(`extend service {
  capability graphql.newFeature
}`);
    });

    it('prints complex service definition', () => {
      const sdl = `
        """A GraphQL service with multiple capabilities"""
        service @deprecated(reason: "test") {
          """The main spec capability"""
          capability example.capability("Example value")
          capability graphql.someFutureCapability
          capability org.example.custom
        }
      `;
      const doc = parse(sdl);
      expect(print(doc)).to.equal(
        `"""A GraphQL service with multiple capabilities"""
service @deprecated(reason: "test") {
  """The main spec capability"""
  capability example.capability("Example value")
  capability graphql.someFutureCapability
  capability org.example.custom
}`,
      );
    });
  });
});
