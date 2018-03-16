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

### Caching

`hapi-postgraphile` can take advantage of your server cache. You will need to set up the cacheConfig parameters you pass to the plugin, and declare a list of allowed operation names. 

Caching in this way, via the simple key/val store is very limited and can only cache queries using default options, and cannot cash requests requiring JWT authentication.

### Authentication cookie

You can also set up your endpoint to store a cookie with your JWT. This is helpful for a more secure system. You must provide a few params: the cookieName, your authentication mutation operation name, and any cookie options. 

### (Nearly) All the options

Defaults shown.

```javascript
{
  route: {
    path: '/graphql',
    options: null
  },
  cacheAllowedOperations: null, // pass array of strings
  cacheConfig: {
    segment: '',
    expiresIn: 0,
    expiresAt: '',
    staleIn: 0,
    staleTimeout: 0,
    generateTimeout: 500
  },
  jwtAuthenticate: {
    headerName: 'authorization',
    tokenType: 'Bearer',
    operationName: 'authenticate',
    returnPath: 'data.authenticate.jwtToken',
    cookieName: 'token',
    cookieOptions: {
      // hapi cookie options here
    }
  },
  pgConfig: '', // connection string or obj
  pgOptions: null, // or obj, to merge with config
  schemaName: 'public',
  schemaOptions: {
    // options from postgraphile
  }
}
```

## Native bindings

`hapi-postgraphile` will use the native `pg` bindings if you have them installed as a peer.

## Methods

-   `postgraphile.performQuery(graphqlRequest, [options])`

    * `graphqlRequest`: `{query, variables, operationName}`
    * `options`: `{jwtToken, [schemaOptions]}` — the options object can provide the JWT for the request and override any of the global schemaOptions if needed.
    
-   `postgraphile.performQueryWithCache(graphqlRequest)`

    * `graphqlRequest`: `{query, variables, operationName}`
    * cached queries cannot use options — they are ultimately uncachabled with a simple key/val lookup, and we'd also run into issues with JWT authentication.

## Requirements

*   node.js >= 8.6
*   PostgresQL >= 9.6 (tested with 9.6)
*   [HAPI](https://github.com/hapijs/hapi) v17 as a peer dependency
*   [pg](https://github.com/brianc/node-postgres) module as a peer dependency
