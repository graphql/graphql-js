export const viralSDL = `\
schema {
  query: Query
}

type Query {
  viruses: [Virus!]
}

type Virus {
  name: String!
  knownMutations: [Mutation!]!
}

type Mutation {
  name: String!
  geneSequence: String!
}\
`;
