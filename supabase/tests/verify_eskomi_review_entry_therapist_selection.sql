-- Disposable PostgreSQL acceptance coverage for general-link therapist
-- selection.  This executes the same RPC implementation used by PostgREST;
-- it intentionally tests behaviour that static source checks cannot prove.
begin;

do $$
declare
  v_shop_a uuid;
  v_shop_b uuid;
  v_therapist_a uuid;
  v_therapist_b uuid;
  v_assignment_a uuid;
  v_assignment_b uuid;
  v_general_link uuid;
  v_other_link uuid;
  v_dedicated_link uuid;
  v_experience uuid;
  v_unavailable boolean;
  v_name text;
  v_count integer;
begin
  insert into app.shops(slug, canonical_path, name, publication_status, published_at)
  values ('therapist-select-a', '/shops/therapist-select-a/', 'Therapist selection A', 'published', now())
  returning id into v_shop_a;
  insert into app.shops(slug, canonical_path, name, publication_status, published_at)
  values ('therapist-select-b', '/shops/therapist-select-b/', 'Therapist selection B', 'published', now())
  returning id into v_shop_b;
  insert into app.therapists(stable_key) values ('therapist-select-a') returning id into v_therapist_a;
  insert into app.therapists(stable_key) values ('therapist-select-b') returning id into v_therapist_b;
  insert into app.therapist_assignments(therapist_id, shop_id, display_name)
  values (v_therapist_a, v_shop_a, 'A担当') returning id into v_assignment_a;
  insert into app.therapist_assignments(therapist_id, shop_id, display_name)
  values (v_therapist_b, v_shop_b, 'B担当') returning id into v_assignment_b;
  insert into private.review_entry_links(shop_id, link_kind, created_by)
  values (v_shop_a, 'shop_qr', 'therapist selection SQL test') returning public_handle into v_general_link;
  insert into private.review_entry_links(shop_id, link_kind, created_by)
  values (v_shop_b, 'shop_qr', 'therapist selection SQL test') returning public_handle into v_other_link;

  -- A general link may select exactly one current assignment from its own
  -- shop. The reusable link itself stays assignment-free.
  perform private.create_review_submission_context(v_general_link, repeat('a', 64), repeat('b', 64), v_assignment_a);
  select result.experience_id into v_experience
  from private.submit_review_experience_v11(
    v_general_link, repeat('a', 64), repeat('c', 64), repeat('d', 64), repeat('e', 64), repeat('f', 64),
    4::smallint, '店舗と担当を一回の体験として評価します。', '投稿者', 5::smallint
  ) as result;
  if (select therapist_assignment_id is null from private.review_entry_links where public_handle=v_general_link) is not true then
    raise exception 'general link was mutated by a selected therapist';
  end if;
  if (select count(*) from private.review_assessments where experience_id=v_experience and target_kind='shop') <> 1
    or (select count(*) from private.review_assessments where experience_id=v_experience and target_kind='therapist' and therapist_assignment_id=v_assignment_a and shop_id=v_shop_a) <> 1 then
    raise exception 'same-shop selected therapist was not persisted with the store assessment';
  end if;

  -- A cross-shop assignment cannot be selected, and a context from shop A
  -- cannot be replayed against a different entry handle.
  begin
    perform private.create_review_submission_context(v_general_link, repeat('1', 64), repeat('2', 64), v_assignment_b);
    raise exception 'cross-shop therapist context unexpectedly succeeded';
  exception when sqlstate 'P0002' then null;
  end;
  perform private.create_review_submission_context(v_general_link, repeat('3', 64), repeat('4', 64), null);
  begin
    perform private.submit_review_experience_v11(
      v_other_link, repeat('3', 64), repeat('5', 64), repeat('6', 64), repeat('7', 64), repeat('8', 64),
      4::smallint, 'tampered target', null::text, null::smallint
    );
    raise exception 'cross-shop entry-handle tampering unexpectedly succeeded';
  exception when unique_violation then null;
  end;

  -- When a dedicated assignment ends, the same link resolves as store-only;
  -- it cannot be silently remapped or used to submit a therapist score.
  insert into private.review_entry_links(shop_id, therapist_assignment_id, link_kind, created_by)
  values (v_shop_a, v_assignment_a, 'therapist_link', 'therapist selection SQL test') returning public_handle into v_dedicated_link;
  update app.therapist_assignments set lifecycle_state='retired', active_until=now() where id=v_assignment_a;
  select therapist_display_name, therapist_unavailable into v_name, v_unavailable
  from private.create_review_submission_context(v_dedicated_link, repeat('9', 64), repeat('0', 64), null);
  if v_name is not null or v_unavailable is not true then raise exception 'ended dedicated link did not become store-only context'; end if;
  begin
    perform private.submit_review_experience_v11(
      v_dedicated_link, repeat('9', 64), repeat('a', 63) || '0', repeat('b', 63) || '0', repeat('c', 63) || '0', repeat('d', 63) || '0',
      4::smallint, 'ended forged therapist score', null::text, 5::smallint
    );
    raise exception 'ended assignment accepted a forged therapist score';
  exception when invalid_parameter_value then null;
  end;
  select result.experience_id into v_experience
  from private.submit_review_experience_v11(
    v_dedicated_link, repeat('9', 64), repeat('a', 63) || '1', repeat('b', 63) || '1', repeat('c', 63) || '1', repeat('d', 63) || '1',
    3::smallint, '担当が退店したため店舗のみ評価します。', null::text, null::smallint
  ) as result;
  select count(*) into v_count from private.review_assessments where experience_id=v_experience and target_kind='therapist';
  if v_count <> 0 then raise exception 'ended assignment was saved to the store-only experience'; end if;
end;
$$;

rollback;
