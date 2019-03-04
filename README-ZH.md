# GraphQL.js

GraphQL.js是GraphQL的JavaScript参考实现。GraphQL是由Facebook开发的一组API查询语言。

[![npm version](https://badge.fury.io/js/graphql.svg)](https://badge.fury.io/js/graphql)
[![Build Status](https://travis-ci.org/graphql/graphql-js.svg?branch=master)](https://travis-ci.org/graphql/graphql-js?branch=master)
[![Coverage Status](https://codecov.io/gh/graphql/graphql-js/branch/master/graph/badge.svg)](https://codecov.io/gh/graphql/graphql-js)

完整的文档可以查看 https://graphql.org/ 和
https://graphql.org/graphql-js/。

如需帮助，还可以寻求[社区资源](https://graphql.org/community/)。


## 起步

GraphQL的概述可以查看[GraphQL](https://github.com/facebook/graphql)的[文档](https://github.com/facebook/graphql/blob/master/README.md)。文档里面描述了一组简单的GraphQL例子以及对应的[测试文件](src/__tests__)。一个比较好的起步方式就是对照文档，把对应的测试过一遍。

### 使用GraphQL.js

npm安装GraphQL.js

使用yarn:

```sh
yarn add graphql
```

或者使用npm:

```sh
npm install --save graphql
```

GraphQL.js提供了两个重要的特性：创建一个类型结构（type schema），以及提供基于该类型结构的查询服务。

首先，创建一个GraphQL类型结构，映射到你的代码库。

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

上面的代码定义了一个简单的结构，包含了一个字段和一种类型，返回一个固定值。`resolve`方法可以返回一个值或者一个Promise，或者一个Promise数组。更复杂的例子可以在顶层的[tests](src/__tests__)目录中查看。

然后，为这个类型结构对应的查询（query）提供服务。

```js
var query = '{ hello }';

graphql(schema, query).then(result => {

  // Prints
  // {
  //   data: { hello: "world" }
  // }
  console.log(result);

});
```

上面的代码运行了一个查询，获取声明字段的值。`graphql`方法首先会检查这个查询是否符合语法和语义，如果符合就执行查询，否则就报错。

```js
var query = '{ boyhowdy }';

graphql(schema, query).then(result => {

  // Prints
  // {
  //   errors: [
  //     { message: 'Cannot query field boyhowdy on RootQueryType',
  //       locations: [ { line: 1, column: 3 } ] }
  //   ]
  // }
  console.log(result);

});
```

### 想要走在最前沿？

和npm一样，本仓库的`npm`分支会自动与`master`分支上通过所有测试的最新提交保持一致。由于种种原因，我们更推荐使用部署到npm上的构建，但是如果你想使用graphql-js的最新的未发布的版本，也可以直接使用这个分支来添加依赖：

```
npm install graphql@git://github.com/graphql/graphql-js.git#npm
```

### 使用浏览器

GraphQL.js是一个通用的库，可以在Node服务器和浏览器中使用。比如[GraphiQL](https://github.com/graphql/graphiql/)工具就是基于GraphQL.js构建的。

通过[webpack](https://webpack.js.org)或[rollup](https://github.com/rollup/rollup)来使用GraphQL.js时，工程只会引入你所用到的部分。因为GraphQL.js是通过CommonJS (`require()`)和ESModule (`import`)文件来管理模块的。自定义构建配置需要在`.mjs`文件中设置。

### 贡献

非常欢迎提PR，查看如何提供[贡献](https://github.com/graphql/graphql-js/blob/master/.github/CONTRIBUTING.md)。

### 更新日志

查看[GitHub releases](https://github.com/graphql/graphql-js/releases).

### License

GraphQL.js is [MIT-licensed](https://github.com/graphql/graphql-js/blob/master/LICENSE).
