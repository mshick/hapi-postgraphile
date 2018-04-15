-- Our custom jwtToken type

create type forum_example.jwt_token as (
  role text,
  person_id text,
  exp int,
  sat int
);

-- Notications, for watched tables.

create or replace function forum_example_private.notify_trigger() returns trigger as $$
declare
  jsonb_diff jsonb;
  changed text;
begin
  if (TG_OP = 'INSERT') then
    perform pg_notify('watchers', 'schema=' || TG_TABLE_SCHEMA || '&table=' || TG_TABLE_NAME || '&when=' || TG_WHEN || '&new_id=' || NEW.id);
    return NEW;
  elsif (TG_OP = 'DELETE') then
    perform pg_notify('watchers', 'schema=' || TG_TABLE_SCHEMA || '&table=' || TG_TABLE_NAME || '&when=' || TG_WHEN || '&old_id=' || OLD.id);
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    select coalesce(
      (
        select ('{' || string_agg(to_json(key) || ':' || value, ',') || '}')
          from jsonb_each(to_jsonb(OLD))
          where not ('{' || to_json(key) || ':' || value || '}')::jsonb <@ to_jsonb(NEW)
      ),
      '{}')::jsonb into jsonb_diff;

    changed := array_to_string(array(select jsonb_object_keys(jsonb_diff)), ',');
    perform pg_notify('watchers', 'schema=' || TG_TABLE_SCHEMA || '&table=' || TG_TABLE_NAME || '&when=' || TG_WHEN || '&new_id=' || NEW.id || '&old_id=' || OLD.id || '&changed=' || changed);
    return NEW;
  end if;
end;
$$ language plpgsql;

-- Use to trigger the notification
create trigger person_notify_after after insert or update or delete
  on forum_example.person
  for each row
  execute procedure forum_example_private.notify_trigger();

-- Token functions

-- Authentication function

create or replace function forum_example.get_token(
  email text,
  password text
) returns forum_example.jwt_token as $$
declare
  account forum_example_private.person_account;
  epoch_time int;
  -- 30 minute expiration, 15 minutes until stale
  expires_in int default 1800;
  stale_in int default 900;
begin
  select a.* into account
  from forum_example_private.person_account as a
  where a.email = $1;

  if (account.password_hash = crypt(password, account.password_hash)) then
    epoch_time := extract(epoch from now());
    return ('forum_example_user', account.person_id, epoch_time + expires_in, epoch_time + stale_in)::forum_example.jwt_token;
  else
    raise exception 'invalid login';
  end if;
end;
$$ language plpgsql strict security definer;

grant execute on function forum_example.get_token(text, text) to forum_example_anonymous;

comment on function forum_example.get_token(text, text) is 'Creates a JWT token that will securely identify a person and give them certain permissions.';


-- Refresh function
-- Consider a session table with a token for verification

create or replace function forum_example.refresh_token() returns forum_example.jwt_token as $$
declare
  account forum_example_private.person_account;
  epoch_time int;
  -- 30 minute expiration, 15 minutes until stale
  expires_in int default 1800;
  stale_in int default 900;
begin
  select a.* into account
  from forum_example_private.person_account as a
  where a.person_id = current_setting('jwt.claims.person_id')::text;

  -- Test for a valid session, something like that...

  if FOUND then
    epoch_time := extract(epoch from now());
    return ('forum_example_user', account.person_id, epoch_time + expires_in, epoch_time + stale_in)::forum_example.jwt_token;
  else
    return null;
  end if;
end;
$$ language plpgsql strict security definer;

grant execute on function forum_example.refresh_token() to forum_example_user;

comment on function forum_example.refresh_token() is 'Refreshes a token for a person who currently has a valid token.';


-- Clearing the session

create or replace function forum_example.clear_token() returns boolean as $$
declare
  account forum_example_private.person_account;
begin
  select a.* into account
  from forum_example_private.person_account as a
  where a.person_id = current_setting('jwt.claims.person_id')::text;

  -- Clear a session...

  return FOUND;
end;
$$ language plpgsql strict security definer;

grant execute on function forum_example.clear_token() to forum_example_user;

comment on function forum_example.clear_token() is 'Clears the session, effectively logging the user out.';
