do $$
declare v_snapshot text; v_name text;
begin
  select permission_policy_version into v_snapshot from private.therapist_assignment_rights_history where permission_policy_version='legacy-rights-v1';
  if v_snapshot<>'legacy-rights-v1' then raise exception 'legacy rights were not preserved as history'; end if;
  select subject_snapshot->>'therapistDisplayName' into v_name from private.review_experiences where edit_receipt_hash=repeat('a',64);
  if v_name<>'旧担当名' then raise exception 'legacy review subject snapshot was not backfilled'; end if;
  update app.therapist_assignments set display_name='新担当名' where display_name='旧担当名';
  select therapist_display_name into v_name from api.list_public_review_experience_publications('upgrade-fixture',20,0);
  if v_name<>'旧担当名' then raise exception 'public projection read current therapist name instead of snapshot'; end if;
  if has_function_privilege('service_role','api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint)','EXECUTE') then raise exception 'legacy v11 submit API remains callable'; end if;
end $$;
