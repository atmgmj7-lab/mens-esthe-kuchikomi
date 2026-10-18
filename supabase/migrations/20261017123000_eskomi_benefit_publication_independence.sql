-- A published-review withdrawal changes only the public projection.  It must
-- not retroactively reduce, void, or otherwise alter a benefit that was
-- already issued under an approved program's neutral eligibility rule.
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
    -- Deliberately do not mutate private.benefit_codes here.  Code issuance is
    -- rating-neutral and publication-independent; explicit program suspension
    -- or a separate fraud/terms action is required for any later revocation.
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

revoke all on function private.moderate_review_experience(uuid, text, text, text) from public, anon, authenticated;
grant execute on function private.moderate_review_experience(uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';
