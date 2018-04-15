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

### hapi-auth-jwt2

If you are using [hapi-auth-jwt2](https://github.com/dwyl/hapi-auth-jwt2) this plugin will read the token from that. In that case you'd want to be sure you are passing the same secret and necessary configuration to hapi-postgraphile, and if you're using jwt2 cookies the same security caveats as below will apply.

If you do use this approach, also remember that you likely want to allow unauthenticated calls to the graphql endpoint as well. In that case consider passing a route option to hapi-postgraphile, like:

```
route: {
  options: {
    auth: {
      mode: 'try'
    }
  }
}
```

### Cookie authentication

You can also set up your endpoint to store a cookie containing your JWT.

When setting up an authentication cookie you should also review the `authenticate.verifyOrigin` setting.

You must provide a `cookieAuthentication.name`, which is the name of your cookie, and should review the `authenticate.loginOperationName`, `authenticate.logoutOperationName`, and `authenticate.tokenDataPath` options to ensure your queries and responses are handled. The default settings mirror the results you'd have following this [tutorial](https://www.graphile.org/postgraphile/postgresql-schema-design/).

### Security and CSRF mitigation

Using the default settings should give you a reasonable level of security against CSRF attacks. These settings rely solely on the `Authorization` header, and should be immune to the most common exploits. Cookies are very convenient in some settings, but come with an added security risk, especially given the level of access a GraphQL endpoint typically has to the underlying database.

If you do choose to use cookie authentication you can use the `authentication.verifyOrigin` checking to ensure that your request is coming from an allowed origin based on your server's CORS policy. The plugin will check hapi's `request.info.cors.isOriginMatch` to ensure you have a valid origin. This can happen either on every request, `always`, or just on requests that contain the origin header — the `present` setting, which is a sensible default.

**For a secure setup with cookies you must do the following**

1.  Ensure your route has a secure CORS policy in place either at the server level or through a route option you pass to this plugin. Read about setting your [server CORS policy](https://hapijs.com/api#server.options.routes) and / or your [route CORS policy](https://hapijs.com/api#route.options.cors). **Setting `cors: true` or `cors: ['*']` is not secure!**

2.  Set the `hapi-postgraphile` config option `authentication.verifyOrigin` to `always` or `present`. If you do not update this value and you enable cookies the value will be upgraded to `present` for you and a warning will be thrown.

3.  Ensure your cookie is using the `isSecure` and `httpOnly` options (both defaults) to prevent against manipulation and domain forgery.

4.  Consider also using anti-CSRF tokens like those provided by [crumb](https://github.com/hapijs/crumb).

Read the CSRF [Prevention Cheat Sheet](https://goo.gl/Gfv4Mt) for more detail.

### Token refresh support (using cookie authentication)

If you do use cookie authentication, I've included token refresh functionality.
At a basic level this would allow you to create and call a `refreshToken`
mutation, which is expected to read from the `jwt_claims` and return a `jwtToken`
very similar to the reference `authenticate` mutation. In your PG function you
might simply verify that the claimed identity still exists and is allowed, or
you might check a session table to ensure they are still allowed access.

For example:

```sql
create or replace function forum_example.refresh_token() returns forum_example.jwt_token as $$
declare
  account forum_example_private.person_account;
begin
  select a.* into account
  from forum_example_private.person_account as a
  where a.person_id = current_setting('jwt.claims.person_id')::text;

  if FOUND and (account.suspended <> true) then
    return ('forum_example_user', account.person_id)::forum_example.jwt_token;
  else
    return null;
  end if;
end;
$$ language plpgsql strict security definer;

grant execute on function forum_example.refresh_token() to forum_example_user;
```

By defining the `authenticate.refreshTokenOperationName` and
`authenticate.refreshTokenDataPath` you can have your new token re-stated.

#### Stale (jwtToken.sat support)

If you return a jwtToken with a `sat` ("stale at") property this plugin will
compare that value with the current time and refresh if necessary. `sat`, like
other JWT properties, should be a UNIX epoch time in seconds.

This approach assumes you have the decoded token available in your
`request.auth.credentials` object — like the one provided by `hapi-auth-jwt2`.
You could also create your own auth strategy to decode the token and populate
this value, but be aware that `postgraphile` itself does not expose the
decoded token itself.

The refresh will happen during the `onPreResponse` extension point. You will
need to supply an `authenticate.refreshTokenQuery` GraphQL query string, which
will be invoked when the stale conditions are met.

The following is an example of an authentication PG type and function that
provides a valid JWT that could be refreshed sometime after it becomes stale
and before it expires:

```sql
create type forum_example.jwt_token as (
  role text,
  person_id text,
  exp int,
  sat int
);

create or replace function forum_example.authenticate(
  email text,
  password text
) returns forum_example.jwt_token as $$
declare
  account forum_example_private.person_account;
  epoch_time int;
  expires_in int default 1800;
  stale_in int default 900;
begin
  select a.* into account
  from forum_example_private.person_account as a
  where a.email = $1;

  if (account.suspended <> true) and (account.password_hash = crypt(password, account.password_hash)) then
    epoch_time := extract(epoch from now());
    -- 30 minute expiration, 15 minutes until stale
    return ('forum_example_user', account.person_id, epoch_time + expires_in, epoch_time + stale_in)::forum_example.jwt_token;
  else
    raise exception 'invalid login';
  end if;
end;
$$ language plpgsql strict security definer;
```

> Don't set your stale time too close to your expiration time to avoid issues.

### (Nearly) All the options

Defaults shown.

```javascript
{
  pgConfig: '', // connection string or obj
  pgOptions: null, // object to merge with config, for pg tuning, etc
  schemaName: 'public',
  schemaOptions: {
    // options from postgraphile
  },
  route: {
    path: '/graphql',
    options: null // options to pass to your route handler, merged with (and some overwritten by) the plugin's route options
  },
  cacheAllowedOperations: null, // pass array of strings
  cacheConfig: { // null by default
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
    getTokenOperationName: 'getToken', // your login or operation mutation
    getTokenDataPath: 'data.getToken.jwtToken',
    refreshTokenOperationName: 'refreshToken', // if you choose to use the refreshToken functionality
    refreshTokenDataPath: 'data.refreshToken.jwtToken',
    refreshTokenQuery: undefined, // if you want to use the refreshToken functionality, put your graphql mutation string here
    refreshTokenVariables: undefined, // if your query requires any variables, object here
    clearTokenOperationName: 'clearToken'
  },
  headerAuthentication: {
    headerName: 'Authorization',
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
  }
}
```

## Native bindings

`hapi-postgraphile` will use the native `pg` bindings if you have `pg-native` installed as a peer.

## Methods

* `postgraphile.performQuery(graphqlQuery, [options])`

  * `graphqlQuery`: `{query, variables, operationName}`
  * `options`: `{jwtToken, [schemaOptions]}` — the options object can provide the JWT for the request and override any of the global schemaOptions if needed.

* `postgraphile.performQueryWithCache(graphqlQuery)`

  * `graphqlQuery`: `{query, variables, operationName}`
  * cached queries cannot use options — they are ultimately uncacheable with a simple key/val lookup, and we'd also run into issues with JWT authentication.

## Requirements

* node.js >= 8.6
* PostgreSQL >= 9.6 (tested with 9.6, developed with 10.2)
* [hapi](https://github.com/hapijs/hapi) v17 as a peer dependency
* [pg](https://github.com/brianc/node-postgres) module as a peer dependency
