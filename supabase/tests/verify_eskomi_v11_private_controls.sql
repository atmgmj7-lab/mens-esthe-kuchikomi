-- Disposable PostgreSQL verification for v1.1 private receipt/session and
-- technical burst controls.  The transaction never retains a fixture.
begin;

do $$
declare
  v_shop uuid;
  v_experience uuid;
  v_opened uuid;
  v_expiry timestamptz;
  v_allowed boolean;
  v_retry integer;
begin
  insert into app.shops(slug, canonical_path, name)
  values ('v11-private-controls-fixture', '/shops/v11-private-controls-fixture/', 'V11 private controls fixture')
  returning id into v_shop;
  insert into private.review_experiences(shop_id, guest_display_name, edit_receipt_hash)
  values (v_shop, null, repeat('a', 64)) returning id into v_experience;
  insert into private.review_edit_receipts(experience_id, secret_hash)
  values (v_experience, repeat('b', 64));

  select experience_id, expires_at into v_opened, v_expiry
  from private.open_review_edit_session(repeat('b', 64), repeat('c', 64), repeat('d', 64));
  if v_opened <> v_experience or v_expiry <= now() then
    raise exception 'valid edit receipt did not open a short-lived session';
  end if;

  for i in 1..5 loop
    select allowed, retry_after_seconds into v_allowed, v_retry
    from private.claim_review_entry_rate_limit(repeat('e', 64), lpad(i::text, 64, '0'), 5);
    if not v_allowed then raise exception 'rate limit rejected request % before its hourly limit', i; end if;
  end loop;
  select allowed, retry_after_seconds into v_allowed, v_retry
  from private.claim_review_entry_rate_limit(repeat('e', 64), repeat('f', 64), 5);
  if v_allowed or v_retry <= 0 then raise exception 'rate limit did not reject the sixth distinct request'; end if;
  select allowed into v_allowed
  from private.claim_review_entry_rate_limit(repeat('e', 64), lpad('1', 64, '0'), 5);
  if not v_allowed then raise exception 'idempotent retry consumed another burst slot'; end if;
end;
$$;

rollback;
