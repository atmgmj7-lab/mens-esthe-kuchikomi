-- Correctness fixes for the WordPress-independent Eskomi path.  These are
-- additive: legacy WordPress records remain read-only and are never changed.

-- A deleted legacy import may intentionally have no publication.  It is still
-- an active suppression tombstone, so both operator and public composition
-- lookups must derive state from managed_shops rather than an inner join.
create or replace function api.list_unlisted_managed_shop_legacy_identities()
returns table(existing_wp_shop_id bigint, shop_slug text)
language sql security invoker set search_path = private, pg_temp as $$
  select s.existing_wp_shop_id, s.shop_slug
  from private.managed_shops as s
  where s.publication_state in ('unlisted', 'deleted')
    and s.existing_wp_shop_id is not null
$$;

create or replace function api.list_managed_shop_legacy_listing_states()
returns table(existing_wp_shop_id bigint, shop_slug text, publication_state text)
language sql security invoker set search_path = private, pg_temp as $$
  select s.existing_wp_shop_id, s.shop_slug, s.publication_state
  from private.managed_shops as s
  where s.publication_state in ('unlisted', 'deleted')
    and s.existing_wp_shop_id is not null
  order by s.existing_wp_shop_id
$$;

-- A deleted tombstone is recoverable even when it was imported directly into
-- the archive and therefore has no publication.  Recovery is deliberately to
-- unlisted only; a separate reviewed publication is still required to publish.
create or replace function private.restore_archived_managed_shop_to_unlisted(
  p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text
) returns text language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_shop private.managed_shops%rowtype;
begin
  if char_length(trim(coalesce(p_actor_label, ''))) not between 1 and 120 then
    raise exception 'invalid managed shop archive restore actor' using errcode = '22023';
  end if;
  select * into v_shop
  from private.managed_shops
  where id = p_managed_shop_id
  for update;
  if not found then return 'not_found'; end if;
  if v_shop.current_revision <> p_expected_revision or v_shop.publication_state <> 'deleted' then
    return 'conflict';
  end if;
  update private.managed_shops
  set publication_state = 'unlisted', updated_at = now()
  where id = v_shop.id;
  insert into private.managed_shop_reviews(managed_shop_id, revision, decision, reviewer_label, note)
  values (v_shop.id, v_shop.current_revision, 'approved', trim(p_actor_label), '削除済みから掲載停止へ復元（再掲載は未実行）');
  return 'ok';
end;
$$;

-- Nullable legacy identity still rejects the invalid numeric values 0 and -1.
alter table private.partner_workspaces
  drop constraint if exists partner_workspaces_wp_shop_id_positive_check;
alter table private.partner_workspaces
  add constraint partner_workspaces_wp_shop_id_positive_check
  check (wp_shop_id is null or wp_shop_id > 0);

-- A benefit program may only be created for the canonical shop owned by its
-- workspace.  The composite key keeps this invariant in the database, even
-- when a future server adapter changes.
alter table private.partner_workspaces
  add constraint partner_workspaces_id_app_shop_key unique (id, app_shop_id);
alter table private.benefit_programs
  add constraint benefit_programs_workspace_shop_fk
  foreign key (workspace_id, shop_id)
  references private.partner_workspaces(id, app_shop_id)
  on delete restrict;

-- An approved experience can be withdrawn.  The state update, publication
-- archive, outstanding-code void, audit decision and outbox event happen in
-- this one function transaction so public lists and widget aggregates cannot
-- observe a partially withdrawn review.
alter table private.review_outbox
  drop constraint if exists review_outbox_event_type_check;
alter table private.review_outbox
  add constraint review_outbox_event_type_check
  check (event_type in ('review_submitted', 'review_approved', 'review_rejected', 'review_withdrawn', 'reply_submitted', 'benefit_issued', 'benefit_redeemed'));

create or replace function private.moderate_review_experience(
  p_experience_id uuid, p_decision text, p_actor_label text, p_note text default null
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_experience private.review_experiences%rowtype;
  v_assessment private.review_assessments%rowtype;
begin
  if p_decision not in ('approved', 'rejected', 'withdrawn')
    or char_length(trim(coalesce(p_actor_label, ''))) not between 1 and 120 then
    raise exception 'invalid review moderation decision' using errcode = '22023';
  end if;
  select * into v_experience
  from private.review_experiences
  where id = p_experience_id
  for update;
  if not found then raise exception 'review experience not found' using errcode = 'P0002'; end if;

  if v_experience.state = 'withdrawn' or v_experience.state = 'rejected' then
    return v_experience.state;
  end if;
  if v_experience.state = 'approved' and p_decision <> 'withdrawn' then
    return v_experience.state;
  end if;

  update private.review_experiences
  set state = p_decision,
      reviewed_at = now(),
      withdrawn_at = case when p_decision = 'withdrawn' then now() else null end,
      updated_at = now()
  where id = v_experience.id;
  insert into private.review_moderation_decisions (experience_id, decision, actor_label, note)
  values (v_experience.id, p_decision, trim(p_actor_label), nullif(trim(coalesce(p_note, '')), ''));

  if p_decision = 'approved' then
    for v_assessment in
      select * from private.review_assessments where experience_id = v_experience.id
    loop
      insert into app.review_publications (assessment_id, shop_id, therapist_assignment_id, rating, body, display_name)
      values (v_assessment.id, v_assessment.shop_id, v_assessment.therapist_assignment_id, v_assessment.rating, v_assessment.body, v_experience.guest_display_name)
      on conflict (assessment_id) do update
        set archived_at = null, updated_at = now();
    end loop;
  elsif p_decision = 'withdrawn' then
    update app.review_publications
    set archived_at = now(), updated_at = now()
    where assessment_id in (
      select id from private.review_assessments where experience_id = v_experience.id
    ) and archived_at is null;
    update private.benefit_codes
    set state = 'void'
    where experience_id = v_experience.id and state = 'issued';
  end if;

  insert into private.review_outbox (event_type, aggregate_id, payload)
  values (
    case p_decision
      when 'approved' then 'review_approved'
      when 'withdrawn' then 'review_withdrawn'
      else 'review_rejected'
    end,
    v_experience.id,
    jsonb_build_object('decision', p_decision)
  );
  return p_decision;
end;
$$;

-- Public readers receive only approved projection fields.  The server adapter
-- keeps this service-role-only until the general public read cutover is
-- reviewed, while archived withdrawals disappear from the same query used by
-- page and widget views.
create or replace function api.list_public_review_publications(
  p_shop_slug text, p_limit integer default 20, p_offset integer default 0
) returns table (
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz
) language plpgsql security invoker set search_path = private, app, pg_temp as $$
begin
  if p_shop_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$'
    or p_limit not between 1 and 50 or p_offset < 0 then
    raise exception 'invalid public review request' using errcode = '22023';
  end if;
  return query
    select publication.public_handle, publication.rating, publication.body, publication.display_name,
      assignment.display_name, publication.published_at
    from app.review_publications as publication
    join app.shops as shop on shop.id = publication.shop_id
    left join app.therapist_assignments as assignment on assignment.id = publication.therapist_assignment_id
    where shop.slug = p_shop_slug and publication.archived_at is null
    order by publication.published_at desc, publication.id desc
    limit p_limit offset p_offset;
end;
$$;

revoke all on function private.restore_archived_managed_shop_to_unlisted(uuid, integer, text) from public, anon, authenticated;
revoke all on function private.moderate_review_experience(uuid, text, text, text) from public, anon, authenticated;
revoke all on function api.list_public_review_publications(text, integer, integer) from public, anon, authenticated;
revoke all on function api.list_unlisted_managed_shop_legacy_identities() from public, anon, authenticated;
revoke all on function api.list_managed_shop_legacy_listing_states() from public, anon, authenticated;
grant execute on function private.restore_archived_managed_shop_to_unlisted(uuid, integer, text) to service_role;
grant execute on function private.moderate_review_experience(uuid, text, text, text) to service_role;
grant execute on function api.list_public_review_publications(text, integer, integer) to service_role;
grant execute on function api.list_unlisted_managed_shop_legacy_identities() to service_role;
grant execute on function api.list_managed_shop_legacy_listing_states() to service_role;

notify pgrst, 'reload schema';
