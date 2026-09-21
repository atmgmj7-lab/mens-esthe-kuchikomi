alter table app.reviews
  add column if not exists review_tags text[] not null default '{}'::text[];

alter table app.reviews
  drop constraint if exists reviews_review_tags_valid;
alter table app.reviews
  add constraint reviews_review_tags_valid check (
    cardinality(review_tags) <= 6
    and review_tags <@ array['skilled_staff', 'clean_space', 'relaxing', 'good_value', 'easy_booking', 'repeat_visit', 'wait_concern', 'price_concern', 'other']::text[]
  );

create or replace function private.submit_review_with_tags(
  p_wp_shop_id bigint,
  p_body text,
  p_rating smallint,
  p_nickname text,
  p_source_url text,
  p_idempotency_key_hash text,
  p_abuse_key_hash text,
  p_abuse_window_started_at timestamptz,
  p_abuse_window_expires_at timestamptz,
  p_rating_price smallint default null,
  p_rating_service smallint default null,
  p_rating_cleanliness smallint default null,
  p_visit_period text default null,
  p_revisit_intent text default null,
  p_email text default null,
  p_campaign_token uuid default null,
  p_tags text[] default '{}'::text[]
)
returns table (review_id uuid, created boolean)
language plpgsql security definer set search_path = pg_catalog
as $$
declare v_result record;
begin
  if p_tags is null or cardinality(p_tags) > 6
    or p_tags <@ array['skilled_staff', 'clean_space', 'relaxing', 'good_value', 'easy_booking', 'repeat_visit', 'wait_concern', 'price_concern', 'other']::text[] is not true
    or cardinality(p_tags) <> cardinality(array(select distinct tag from unnest(p_tags) as tag)) then
    raise exception using errcode = '22023', message = 'Review tags are invalid';
  end if;
  select * into v_result from private.submit_review(
    p_wp_shop_id, p_body, p_rating, p_nickname, p_source_url, p_idempotency_key_hash,
    p_abuse_key_hash, p_abuse_window_started_at, p_abuse_window_expires_at, p_rating_price,
    p_rating_service, p_rating_cleanliness, p_visit_period, p_revisit_intent, p_email, p_campaign_token
  );
  update app.reviews set review_tags = p_tags where id = v_result.review_id;
  return query select v_result.review_id, v_result.created;
end;
$$;

create or replace function api.submit_review_with_tags(
  p_wp_shop_id bigint, p_body text, p_rating smallint, p_nickname text, p_source_url text,
  p_idempotency_key_hash text, p_abuse_key_hash text, p_abuse_window_started_at timestamptz,
  p_abuse_window_expires_at timestamptz, p_rating_price smallint default null,
  p_rating_service smallint default null, p_rating_cleanliness smallint default null,
  p_visit_period text default null, p_revisit_intent text default null, p_email text default null,
  p_campaign_token uuid default null, p_tags text[] default '{}'::text[]
)
returns table (review_id uuid, created boolean)
language sql security invoker set search_path = pg_catalog
as $$ select * from private.submit_review_with_tags(
  p_wp_shop_id, p_body, p_rating, p_nickname, p_source_url, p_idempotency_key_hash,
  p_abuse_key_hash, p_abuse_window_started_at, p_abuse_window_expires_at, p_rating_price,
  p_rating_service, p_rating_cleanliness, p_visit_period, p_revisit_intent, p_email, p_campaign_token, p_tags
) $$;

revoke all on function private.submit_review_with_tags(bigint, text, smallint, text, text, text, text, timestamptz, timestamptz, smallint, smallint, smallint, text, text, text, uuid, text[]) from public, anon, authenticated;
grant execute on function private.submit_review_with_tags(bigint, text, smallint, text, text, text, text, timestamptz, timestamptz, smallint, smallint, smallint, text, text, text, uuid, text[]) to service_role;
revoke all on function api.submit_review_with_tags(bigint, text, smallint, text, text, text, text, timestamptz, timestamptz, smallint, smallint, smallint, text, text, text, uuid, text[]) from public, anon, authenticated;
grant execute on function api.submit_review_with_tags(bigint, text, smallint, text, text, text, text, timestamptz, timestamptz, smallint, smallint, smallint, text, text, text, uuid, text[]) to service_role;
