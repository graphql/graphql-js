# GraphQL.js

A referência de implementação do JavaScript para GraphQL, uma linguagem de consulta para APIs criadas pelo Facebook.

[![npm version](https://badge.fury.io/js/graphql.svg)](https://badge.fury.io/js/graphql)
[![Build Status](https://travis-ci.org/graphql/graphql-js.svg?branch=master)](https://travis-ci.org/graphql/graphql-js?branch=master)
[![Coverage Status](https://codecov.io/gh/graphql/graphql-js/branch/master/graph/badge.svg)](https://codecov.io/gh/graphql/graphql-js)

Veja mais na documentação completa em https://graphql.org/ e
https://graphql.org/graphql-js/.

Procurando por ajuda? Contacte a [comunidade](https://graphql.org/community/).


## Começando

Uma visão geral do GraphQL em geral está disponível no
[Leia-me](https://github.com/facebook/graphql/blob/master/README.md) da [Especificações do GraphQL](https://github.com/facebook/graphql).

Essa visão geral descreve um conjunto simples de exemplos GraphQL, os quais possuem seus [testes](src/__tests__) neste repositório. Uma boa maneira de começar este repositório é caminhar através do README e dos testes correspondentes em paralelo.

### Utilizando o GraphQL.js

Instalando o GraphQL.js a partir do npm (Node Package Manager)

Com yarn:

```sh
yarn add graphql
```

ou alternativamente utilizando o npm:

```sh
npm install --save graphql
```

O GraphQL.js fornece dois recursos importantes: o de construir um esquema de tipos e o de servir consultas contra esse tipo de esquema.

Primeiro, crie um esquema do tipo GraphQL que seja mapeado para sua base de código.

```js
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString
} from 'graphql';

var schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      hello: {
        type: GraphQLString,
        resolve() {
          return 'world';
        }
      }
    }
  })
});
```

Isso define um esquema simples com um tipo e um campo, que retora um valor fixo. A função `resolve` pode retornar um valor, uma promessa,
ou uma série de promessas. Um exemplo mais complexo está incluído no topo do nível da pasta de [testes](src/__tests__).

Em seguida, exiba o resultado de uma consulta nesse esquema de tipos.

```js
var query = '{ hello }';

graphql(schema, query).then(result => {

  console.log(result);
  // {
  //   data: { hello: "world" }
  // }

});
```

Isso executa uma consulta buscando o campo definido. A função `graphql` vai primeiro certifique-se de que a consulta é sintática e semanticamente válida antes de se executar, retornando erros caso necessário.

```js
var query = '{ boyhowdy }';

graphql(schema, query).then(result => {
  
  console.log(result);
  // {
  //   errors: [
  //     { message: 'Cannot query field boyhowdy on RootQueryType',
  //       locations: [ { line: 1, column: 3 } ] }
  //   ]
  // }


});
```

### Quer andar no limite?

O branch do `npm` deste repositório é mantido automaticamente para estar atualizado com o último commit do `master` que passar em todos os testes. Isto é recomenda-se usar as versões do npm por muitas razões, mas se você quiser usar a última versão ainda não lançada do graphql-js, você pode fazer isso diretamente neste ramo:

```
npm install graphql@git://github.com/graphql/graphql-js.git#npm
```

### Utilizando em um navegador

GraphQL.js é uma biblioteca de propósito geral e pode ser usada em um servidor Node ou em um navegador. Como exemplo, o [GraphiQL](https://github.com/graphql/graphiql/) ferramenta construída com GraphQL.js!

Ao construir um projeto usando o GraphQL.js com [webpack](https://webpack.js.org) ou
[rollup](https://github.com/rollup/rollup) deve-se apenas incluir as partes da biblioteca que você usa. Isso se dá porque o GraphQL.js é distribuído com o CommonJS (`require()`) e ESModule (`import`). Certifique-se de que as configurações de compilação personalizadas procuram os arquivos `.mjs`!

### Contribuindo

Nós ativamente recebemos pedidos, aprenda como [contribuir](https://github.com/graphql/graphql-js/blob/master/.github/CONTRIBUTING.md).

### Changelog

As alterações são rastreadas em [GitHub releases](https://github.com/graphql/graphql-js/releases).

### License

GraphQL.js is [MIT-licensed](https://github.com/graphql/graphql-js/blob/master/LICENSE).
