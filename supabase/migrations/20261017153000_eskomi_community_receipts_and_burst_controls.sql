-- Receipt-only withdrawal, operator hiding, and bounded anonymous mutation
-- controls.  This is additive and intentionally does not use IP as a denial
-- key: a shared connection must not reject unrelated visitors.

create table private.community_burst_limits_v11 (
  limit_key text primary key check (limit_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  event_count integer not null default 0 check (event_count >= 0),
  updated_at timestamptz not null default now()
);
alter table private.community_burst_limits_v11 enable row level security;
revoke all on table private.community_burst_limits_v11 from public,anon,authenticated;
grant select,insert,update on table private.community_burst_limits_v11 to service_role;

create function private.assert_community_burst_v11(p_limit_key text,p_max_events integer,p_window interval)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
declare v_row private.community_burst_limits_v11%rowtype;
begin
  if p_limit_key !~ '^[0-9a-f]{64}$' or p_max_events<1 or p_window<=interval '0 seconds' then raise exception 'invalid community burst key' using errcode='22023'; end if;
  select * into v_row from private.community_burst_limits_v11 where limit_key=p_limit_key for update;
  if not found then
    insert into private.community_burst_limits_v11(limit_key,event_count) values(p_limit_key,1);
    return;
  end if;
  if v_row.window_started_at+p_window<=now() then
    update private.community_burst_limits_v11 set window_started_at=now(),event_count=1,updated_at=now() where limit_key=p_limit_key;
  elsif v_row.event_count>=p_max_events then
    raise exception 'community request rate limited' using errcode='54000';
  else
    update private.community_burst_limits_v11 set event_count=event_count+1,updated_at=now() where limit_key=p_limit_key;
  end if;
end $$;

create or replace function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(request_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid correction credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_shop_id::text||chr(31)||p_field_key||chr(31)||btrim(coalesce(p_proposed_value,''))||chr(31)||coalesce(nullif(btrim(p_source_url),''),''),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid correction payload' using errcode='22023'; end if;
 select entity_id,payload_hash into v_id,v_payload from private.community_idempotency_v11 where operation='correction' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then
   if v_payload is distinct from p_payload_hash then raise exception 'correction replay payload changed' using errcode='22023'; end if;
   return query select request.id,request.revision,request.state,true from private.store_correction_requests_v11 request where request.id=v_id; return;
 end if;
 if not private.community_target_is_public_v11('shop',p_shop_id,null) then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_field_key not in ('name','category','price','hours','access','official_url','image','other') or char_length(btrim(coalesce(p_proposed_value,''))) not between 1 and 1000 or (p_source_url is not null and (char_length(p_source_url)>2048 or p_source_url !~ '^https://')) then raise exception 'invalid correction' using errcode='22023'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('correction'||p_scope_hash,'sha256'),'hex'),5,interval '1 hour');
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('correction',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select request.id,request.revision,request.state,false from private.store_correction_requests_v11 request where request.id=v_id;
end $$;

create or replace function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(post_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_receipt text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_ip_risk_tag !~ '^[0-9a-f]{64}$' or p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_scope_kind||chr(31)||coalesce(p_shop_id,p_area_id)::text||chr(31)||btrim(coalesce(p_body,'')),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid community payload' using errcode='22023'; end if;
 select operation.entity_id,operation.payload_hash,post.receipt_hash into v_id,v_payload,v_receipt from private.community_idempotency_v11 operation join private.community_posts_v11 post on post.id=operation.entity_id where operation.operation='post' and operation.scope_hash=p_scope_hash and operation.key_hash=p_idempotency_hash for update of operation,post;
 if found then
   if v_payload is distinct from p_payload_hash or v_receipt<>p_receipt_hash then raise exception 'community replay credential changed' using errcode='22023'; end if;
   return query select post.id,post.revision,post.moderation_state,true from private.community_posts_v11 post where post.id=v_id; return;
 end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 400 or (p_scope_kind='shop' and (p_shop_id is null or p_area_id is not null)) or (p_scope_kind='area' and (p_area_id is null or p_shop_id is not null)) or not private.community_target_is_public_v11(p_scope_kind,p_shop_id,p_area_id) then raise exception 'community target is unavailable' using errcode='P0002'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('post'||p_scope_hash,'sha256'),'hex'),5,interval '1 hour');
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('post',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select post.id,post.revision,post.moderation_state,false from private.community_posts_v11 post where post.id=v_id;
end $$;

create or replace function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id) for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('reaction'||p_browser_tag_hash||p_post_id::text,'sha256'),'hex'),20,interval '1 minute');
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create function private.withdraw_community_post_by_receipt_v11(p_receipt_hash text)
returns table(post_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,pg_temp as $$
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community receipt' using errcode='22023'; end if;
 return query update private.community_posts_v11 post set publication_state='withdrawn',moderation_state=case when post.moderation_state='approved' then 'rejected' else post.moderation_state end,withdrawn_at=now(),revision=post.revision+1
  where post.receipt_hash=p_receipt_hash and post.publication_state<>'withdrawn'
  returning post.id,post.revision,post.moderation_state;
 if not found then raise exception 'community receipt is unavailable' using errcode='40001'; end if;
end $$;

create or replace function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 if p_decision='hidden' then
   update private.community_posts_v11 post set moderation_state='rejected',publication_state='withdrawn',withdrawn_at=now(),operator_reason=btrim(p_reason),revision=post.revision+1
   where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='approved' and post.publication_state='published' and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 else
   update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1
   where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 end if;
 if not found then raise exception 'community post changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',p_post_id,p_decision,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_decision;
end $$;

create or replace function private.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_current private.review_experience_revisions%rowtype; v_has boolean; v_state text;
begin
 perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id);
 select experience.state into v_state from private.review_experiences experience where experience.id=p_experience_id for update;
 if v_state not in ('submitted','approved') then raise exception 'review must be appealed, not edited' using errcode='40001'; end if;
 select * into v_current from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update;
 if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if;
 select exists(select 1 from private.review_assessments assessment where assessment.experience_id=p_experience_id and assessment.target_kind='therapist') into v_has;
 if (p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='') or char_length(btrim(coalesce(p_comment,'')))>400 or char_length(btrim(coalesce(p_nickname,'')))>30 or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and (p_therapist_rating not between 1 and 5 or not v_has)) then raise exception 'invalid review edit' using errcode='22023'; end if;
 insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state) values(p_experience_id,v_current.revision+1,nullif(btrim(p_nickname),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending');
 update private.review_experiences set state='submitted',reviewed_at=null,moderation_revision=moderation_revision+1 where id=p_experience_id;
 update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state='published';
 return query select p_experience_id,v_current.revision+1,'submitted'::text;
end $$;

create function api.withdraw_community_post_by_receipt_v11(p_receipt_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.withdraw_community_post_by_receipt_v11(p_receipt_hash) $$;
revoke all on function private.assert_community_burst_v11(text,integer,interval),private.withdraw_community_post_by_receipt_v11(text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.react_to_community_post_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_community_post_by_receipt_v11(text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.react_to_community_post_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) from public,anon,authenticated;
grant execute on function private.assert_community_burst_v11(text,integer,interval),private.withdraw_community_post_by_receipt_v11(text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.react_to_community_post_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_community_post_by_receipt_v11(text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.react_to_community_post_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) to service_role;
notify pgrst,'reload schema';
