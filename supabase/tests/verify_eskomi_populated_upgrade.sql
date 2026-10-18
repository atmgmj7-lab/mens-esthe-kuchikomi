do $$
declare v_snapshot text; v_name text;
begin
  select permission_policy_version into v_snapshot from private.therapist_assignment_rights_history where permission_policy_version='legacy-rights-v1';
  if v_snapshot is not null then raise exception 'bf46aa1 did not yet contain therapist rights history'; end if;
  select subject_snapshot->>'therapistDisplayName' into v_name from private.review_experiences where edit_receipt_hash=repeat('a',64);
  if v_name<>'旧担当名' then raise exception 'legacy review subject snapshot was not backfilled'; end if;
  update app.therapist_assignments set display_name='新担当名' where display_name='旧担当名';
  select therapist_display_name into v_name from api.list_public_review_experience_publications('upgrade-fixture',20,0);
  if v_name<>'旧担当名' then raise exception 'public projection read current therapist name instead of snapshot'; end if;
  if has_function_privilege('service_role','api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint)','EXECUTE') then raise exception 'legacy v11 submit API remains callable'; end if;
end $$;
-- 171720 safely binds legacy appeals only when their exact current target can
-- be proven.  A superseding visitor withdrawal remains non-reopenable but can
-- be closed with a normal operator audit event.
do $$
declare v_bound private.community_post_appeals_v11%rowtype; v_manual private.community_post_appeals_v11%rowtype; v_temporal_a private.community_post_appeals_v11%rowtype; v_temporal_b private.community_post_appeals_v11%rowtype;
begin
  select * into v_bound from private.community_post_appeals_v11 where receipt_hash=repeat('1',64) and idempotency_hash=repeat('5',64);
  if v_bound.target_post_revision is null or v_bound.target_event_id is null or v_bound.state<>'received' then raise exception 'provable legacy appeal was not bound to its current target'; end if;
  if api.review_community_appeal_v11(v_bound.id,'dismiss','legacy target checked',v_bound.revision)<>'dismiss' then raise exception 'bound legacy appeal could not be closed'; end if;
  select * into v_manual from private.community_post_appeals_v11 where receipt_hash=repeat('6',64) and idempotency_hash=repeat('a',64);
  if v_manual.target_post_revision is not null or v_manual.state<>'reviewing' or v_manual.operator_reason !~ 'requires manual closure' then raise exception 'unprovable legacy appeal was not retained for manual closure'; end if;
  begin
    perform api.review_community_appeal_v11(v_manual.id,'reopen_review','must not infer withdrawal',v_manual.revision);
    raise exception 'legacy appeal reopened a visitor withdrawal';
  exception when serialization_failure then null;
  end;
  if api.review_community_appeal_v11(v_manual.id,'dismiss','manual close after withdrawal',v_manual.revision)<>'dismiss' then raise exception 'manual legacy appeal closure failed'; end if;
  if not exists(select 1 from private.community_moderation_events_v11 where entity_kind='community_post' and entity_id=v_manual.post_id and action='appeal_dismiss' and revision>0) then
    raise exception 'manual legacy appeal closure audit is absent for post %, state %, revision %',v_manual.post_id,(select state from private.community_post_appeals_v11 where id=v_manual.id),(select revision from private.community_post_appeals_v11 where id=v_manual.id);
  end if;
  select * into v_temporal_a from private.community_post_appeals_v11 where receipt_hash=repeat('b',64) and idempotency_hash=repeat('f',64);
  select * into v_temporal_b from private.community_post_appeals_v11 where receipt_hash=repeat('b',64) and idempotency_hash=repeat('0',64);
  if v_temporal_a.target_post_revision is not null or v_temporal_a.target_event_id is not null or v_temporal_a.state<>'reviewing' or v_temporal_a.operator_reason !~ 'target time cannot be proven' then
    raise exception 'older legacy appeal was guessed onto a later rejection';
  end if;
  if v_temporal_b.target_post_revision is null or v_temporal_b.target_event_id is null or v_temporal_b.state<>'received' then
    raise exception 'newer legacy appeal was not bound to its own current rejection';
  end if;
end $$;
