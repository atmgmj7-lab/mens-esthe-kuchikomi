-- Close the pre-revision moderation callable surface and serialize a Partner
-- mutation with membership revocation (status is a non-key column, so KEY
-- SHARE was insufficient).
revoke execute on function private.moderate_review_experience_v11(uuid,text,text,text) from service_role;

create or replace function private.moderate_review_experience_v11(
  p_experience_id uuid,p_decision text,p_actor_label text,p_note text,p_expected_revision integer
) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_experience private.review_experiences%rowtype; v_revision private.review_experience_revisions%rowtype;
begin
  if p_expected_revision is null or p_expected_revision<1 or p_decision not in ('approved','rejected','withdrawn') or char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'invalid moderation decision' using errcode='22023'; end if;
  select * into v_experience from private.review_experiences experience where experience.id=p_experience_id for update;
  if not found then raise exception 'review experience not found' using errcode='P0002'; end if;
  if p_expected_revision<>v_experience.moderation_revision then raise exception 'review moderation changed' using errcode='40001'; end if;
  if v_experience.state in ('withdrawn','rejected') then raise exception 'review state is terminal' using errcode='40001'; end if;
  if v_experience.state='approved' and p_decision<>'withdrawn' then return 'approved'; end if;
  select * into v_revision from private.review_experience_revisions revision where revision.experience_id=v_experience.id order by revision.revision desc limit 1 for update;
  update private.review_experiences set state=p_decision,reviewed_at=now(),withdrawn_at=case when p_decision='withdrawn' then now() else null end,moderation_revision=moderation_revision+1,updated_at=now() where id=v_experience.id;
  update private.review_experience_revisions set moderation_state=case when p_decision='approved' then 'approved' when p_decision='withdrawn' then 'withdrawn' else 'rejected' end,reviewed_at=now() where id=v_revision.id;
  if p_decision='approved' then insert into app.review_experience_publications(experience_id,active_revision_id,shop_id,therapist_assignment_id,publication_state,published_at) values(v_experience.id,v_revision.id,v_experience.shop_id,(select therapist_assignment_id from private.review_assessments where experience_id=v_experience.id and target_kind='therapist'),'published',now()) on conflict(experience_id) do update set active_revision_id=excluded.active_revision_id,publication_state='published',published_at=now(),hidden_at=null,public_version=app.review_experience_publications.public_version+1,updated_at=now();
  elsif p_decision='withdrawn' then update app.review_experience_publications set publication_state='hidden',hidden_at=now(),public_version=public_version+1,updated_at=now() where experience_id=v_experience.id and publication_state<>'hidden'; end if;
  insert into private.review_moderation_decisions(experience_id,decision,actor_label,note) values(v_experience.id,p_decision,btrim(p_actor_label),nullif(btrim(coalesce(p_note,'')),''));
  insert into private.review_outbox(event_type,aggregate_id,payload) values(case when p_decision='approved' then 'review_approved' when p_decision='withdrawn' then 'review_withdrawn' else 'review_rejected' end,v_experience.id,jsonb_build_object('v11',true,'expectedRevision',p_expected_revision)); return p_decision;
end $$;
create or replace function private.assert_partner_therapist_membership(p_workspace_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
begin
  perform 1 from private.partner_memberships membership join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' and workspace.state in ('free_official_partner','active_partner') and workspace.app_shop_id is not null for update of membership;
  if not found then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
end $$;
grant execute on function private.moderate_review_experience_v11(uuid,text,text,text,integer) to service_role;
notify pgrst,'reload schema';
