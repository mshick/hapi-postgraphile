# hapi-postgraphile [![Build Status](https://travis-ci.org/mshick/hapi-postgraphile.svg?branch=master)](https://travis-ci.org/mshick/hapi-postgraphile) [![npm version](https://badge.fury.io/js/hapi-postgraphile.svg)](https://badge.fury.io/js/hapi-postgraphile)
A [Postgraphile](https://www.graphile.org/postgraphile/) plugin for HAPI.

## Installation

```bash
npm install hapi-postgraphile
```

## Config

```javascript
const server = hapi.server({port: 5000});

await server.register({
  plugin,
  options: {
    pgConfig: 'postgresql://user@localhost/db',
    schemaName: 'forum_example',
    schemaOptions: {
      jwtSecret: 'keyboard_kitten',
      jwtPgTypeIdentifier: 'forum_example.jwt_token',
      pgDefaultRole: 'forum_example_anonymous'
    }
  },
  route: '/graphql'
});
```

## Usage

This module exposes one endpoint, by default at `/graphql`. This endpoint will accept GraphQL queries, mutations, and will read an `Authorization` header with a `Bearer <jwtToken>` value.

You should be able to walk through the excellent schema design tutorial [here](https://www.graphile.org/postgraphile/postgresql-schema-design/) and use this endpoint for all of the requests using a tool like `GraphiQL`.

## Advanced configuration

All of the options documented [here](https://www.graphile.org/postgraphile/usage-schema/) are passed through to the `createPostGraphileSchema` function when provided in the `schemaOptions` config property.

## Native bindings

`hapi-postgraphile` will use the native `pg` bindings if you have them installed as a peer.

## Methods

-   `postgraphile.performQuery(graphqlRequest, [options])`

    * `graphqlRequest`: `{query, variables, operationName}`
    * `options`: `{jwtToken, [schemaOptions]}` — the options object can provide the JWT for the request and override any of the global schemaOptions if needed.

## Requirements

*   node.js >= 8.6
*   PostgresQL >= 9.6 (tested with 9.6)
*   [HAPI](https://github.com/hapijs/hapi) v17 as a peer dependency
*   [pg](https://github.com/brianc/node-postgres) module as a peer dependency
