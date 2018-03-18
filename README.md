# hapi-postgraphile [![Build Status](https://travis-ci.org/mshick/hapi-postgraphile.svg?branch=master)](https://travis-ci.org/mshick/hapi-postgraphile) [![npm version](https://badge.fury.io/js/hapi-postgraphile.svg)](https://badge.fury.io/js/hapi-postgraphile)
A [Postgraphile](https://www.graphile.org/postgraphile/) plugin for HAPI.

## Installation

```bash
npm install hapi-postgraphile
```

## Config

Here is a sample, minimal config using values that work with this [tutorial](https://www.graphile.org/postgraphile/postgresql-schema-design/). Yours will be different.

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
  }
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

### Cookie authentication 

You can also set up your endpoint to store a cookie containing your JWT. If you choose to do this your server's CORS policy will provide the basis for the origins allowed to make successful requests. Meaning, before a request is allowed to occur the plugin will check `request.info.cors.isOriginMatch`.

This should provide a reasonable level of security against CSRF attacks. When setting up an authentication cookie you should also review the `authenticate.verifyOrigin` setting, which controls when to verify origins. Options are `always`, `present` which will only verify the origin when the header is present (browser requests should always have this, other requests likely will not) or `never` which is unsafe when used in conjunction with cookies.

You must provide a `cookieAuthentication.name`, which is the name of your cookie, and should review the `authenticate.loginOperationName`, `authenticate.logoutOperationName`, and `authenticate.tokenDataPath` options to ensure your queries and responses are handled. The default settings mirror the results you'd have following this [tutorial](https://www.graphile.org/postgraphile/postgresql-schema-design/).

### (Nearly) All the options

Defaults shown.

```javascript
{
  route: {
    path: '/graphql',
    options: null // options to pass to your route handler, merged with (and some overwritten by) the plugin's route options
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
  authenticate: {
    verifyOrigin: 'never', // or 'always' or 'present'
    verifyOriginOverride: false, // By default origin will be verified if using cookie auth. This let's you keep it as 'never'.
    loginOperationName: 'authenticate',
    logoutOperationName: 'logout', 
    tokenDataPath: 'data.authenticate.jwtToken'
  },
  headerAuthentication: {
    headerName: 'authorization',
    tokenType: 'Bearer'
  },
  cookieAuthentication: { // by default this is null, to use cookies pass a name and any hapi cookie options — default options shown
    name: null,
    options: {
      encoding: 'none',
      isSecure: true,
      isHttpOnly: true,
      clearInvalid: false,
      strictHeader: true,
      path: '/'
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

`hapi-postgraphile` will use the native `pg` bindings if you have `pg-native` installed as a peer.

## Methods

-   `postgraphile.performQuery(graphqlQuery, [options])`

    *   `graphqlQuery`: `{query, variables, operationName}`
    *   `options`: `{jwtToken, [schemaOptions]}` — the options object can provide the JWT for the request and override any of the global schemaOptions if needed.
    
-   `postgraphile.performQueryWithCache(graphqlQuery)`

    *   `graphqlQuery`: `{query, variables, operationName}`
    *   cached queries cannot use options — they are ultimately uncacheable with a simple key/val lookup, and we'd also run into issues with JWT authentication.

## Requirements

*   node.js >= 8.6
*   PostgreSQL >= 9.6 (tested with 9.6, developed with 10.2)
*   [hapi](https://github.com/hapijs/hapi) v17 as a peer dependency
*   [pg](https://github.com/brianc/node-postgres) module as a peer dependency
