#!/usr/bin/env bash
set -euo pipefail

# Must run against the disposable PG17 database after all migrations. Each
# mutation uses a second psql connection and therefore proves the row locks
# are not merely present in source text.
container="${ESKOMI_PG17_CONTAINER:-eskomi-pg17-v11-replay-e2e}"
database="${ESKOMI_PG17_DATABASE:-eskomi_verify}"
psql_exec=(docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database")

fixture_sql="$(mktemp /tmp/eskomi-v11-race-fixture.XXXXXX.sql)"
mutation_log="$(mktemp /tmp/eskomi-v11-race-mutation.XXXXXX.log)"
trap 'rm -f "$fixture_sql" "$mutation_log"' EXIT
cat >"$fixture_sql" <<'SQL'
create temporary table v11_race_fixture(kind text primary key, workspace_id uuid, user_id uuid);
do $$
declare k text; s uuid; w uuid; u uuid;
begin
  foreach k in array array['revoked','role','workspace'] loop
    insert into app.shops(slug,canonical_path,name,publication_status,published_at)
      values('v11-race-'||k,'/shops/v11-race-'||k||'/','V11 race '||k,'published',now()) returning id into s;
    insert into private.partner_workspaces(wp_shop_id,app_shop_id,shop_slug,shop_name,canonical_url,state)
      values(null,s,'v11-race-'||k,'V11 race '||k,'https://mens-esthe-kuchikomi.com/shops/v11-race-'||k||'/','active_partner') returning id into w;
    u:=gen_random_uuid();
    insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at) values(w,u,'owner','active',now());
    insert into v11_race_fixture values(k,w,u);
  end loop;
end $$;
select kind||'|'||workspace_id||'|'||user_id from v11_race_fixture order by kind;
SQL
mapfile -t fixtures < <("${psql_exec[@]}" -A -t < "$fixture_sql")
if [[ "${#fixtures[@]}" != "3" ]]; then
  echo "v1.1 race fixture setup failed" >&2
  exit 1
fi

race() {
  local kind="$1" workspace="$2" user="$3" update_sql
  case "$kind" in
    revoked) update_sql="update private.partner_memberships set status='revoked',revoked_at=now() where workspace_id='$workspace' and auth_user_id='$user'" ;;
    role) update_sql="update private.partner_memberships set role='manager' where workspace_id='$workspace' and auth_user_id='$user'" ;;
    workspace) update_sql="update private.partner_workspaces set state='normal_listing' where id='$workspace'" ;;
  esac
  ( docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database" <<SQL
begin;
$update_sql;
select pg_sleep(1.5);
commit;
SQL
  ) &
  local changer_pid=$!
  sleep 0.2
  if docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database" >"$mutation_log" 2>&1 <<SQL
select * from private.save_partner_benefit_program_v11('$workspace','$user',0,'race','other',null,null,'fixture','Fixture','Fixture',now(),null,null,false);
SQL
  then
    wait "$changer_pid" || true
    echo "v1.1 race mutation unexpectedly succeeded after $kind" >&2
    return 1
  fi
  wait "$changer_pid"
}

for row in "${fixtures[@]}"; do
  IFS='|' read -r kind workspace user <<<"$row"
  race "$kind" "$workspace" "$user"
done
echo "Eskomi v1.1 two-connection membership/role/workspace mutation races: PASS"
