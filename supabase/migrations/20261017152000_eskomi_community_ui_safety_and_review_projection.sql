-- Complete the reviewed community/correction surface without changing any
-- historic migration.  All browser traffic is mediated by server routes;
-- these RPCs remain service_role-only and keep sensitive receipts private.

alter table private.community_idempotency_v11 add column if not exists payload_hash text;
alter table private.community_idempotency_v11 add constraint community_idempotency_payload_hash_format
  check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$');

create table private.community_moderation_events_v11 (
  id bigint generated always as identity primary key,
  entity_kind text not null check (entity_kind in ('correction','community_post')),
  entity_id uuid not null,
  action text not null,
  reason text not null default '' check (char_length(reason) <= 1000),
  operator_actor text not null,
  revision integer not null check (revision > 0),
  created_at timestamptz not null default now()
);
create index community_moderation_events_entity_idx on private.community_moderation_events_v11(entity_kind,entity_id,created_at desc);
alter table private.community_moderation_events_v11 enable row level security;
revoke all on table private.community_moderation_events_v11 from public,anon,authenticated;
grant select,insert on table private.community_moderation_events_v11 to service_role;

create or replace function private.community_target_is_public_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid)
returns boolean language sql security definer set search_path=private,app,pg_temp as $$
 select case
   when p_scope_kind='shop' then exists(
     select 1 from app.shops shop left join private.managed_shops managed on managed.app_shop_id=shop.id
     where shop.id=p_shop_id and shop.publication_status='published'
       and (managed.id is null or managed.publication_state='published')
   )
   when p_scope_kind='area' then exists(select 1 from app.areas area where area.id=p_area_id and area.is_published)
   else false
 end
$$;

create or replace function private.resolve_public_community_target_v11(p_scope_kind text,p_slug text)
returns table(scope_kind text,target_id uuid,target_name text)
language sql security definer set search_path=private,app,pg_temp as $$
 select 'shop'::text,shop.id,shop.name from app.shops shop left join private.managed_shops managed on managed.app_shop_id=shop.id
 where p_scope_kind='shop' and shop.slug=p_slug and shop.publication_status='published'
   and (managed.id is null or managed.publication_state='published')
 union all
 select 'area'::text,area.id,area.name from app.areas area
 where p_scope_kind='area' and area.slug=p_slug and area.is_published
 limit 1
$$;

drop function if exists private.submit_store_correction_v11(uuid,text,text,text,text,text);
drop function if exists private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text);
drop function if exists api.submit_store_correction_v11(uuid,text,text,text,text,text);
drop function if exists api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text);

create function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
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
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('correction',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select request.id,request.revision,request.state,false from private.store_correction_requests_v11 request where request.id=v_id;
end $$;

create function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
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
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('post',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select post.id,post.revision,post.moderation_state,false from private.community_posts_v11 post where post.id=v_id;
end $$;

create or replace function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post
 where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published'
   and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id) for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create or replace function private.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null)
returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.body,post.revision,post.published_at,count(reaction.*) filter(where reaction.value='like'),count(reaction.*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash)
 from private.community_posts_v11 post
 left join app.shops shop on shop.id=post.shop_id
 left join private.managed_shops managed on managed.app_shop_id=shop.id
 left join app.areas area on area.id=post.area_id
 left join private.community_reactions_v11 reaction on reaction.post_id=post.id and reaction.expires_at>now()
 where post.moderation_state='approved' and post.publication_state='published'
   and ((p_shop_id is not null and post.shop_id=p_shop_id and shop.publication_status='published' and (managed.id is null or managed.publication_state='published'))
     or (p_area_id is not null and post.area_id=p_area_id and area.is_published))
 group by post.id order by post.published_at desc limit 30
$$;

create or replace function private.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 update private.store_correction_requests_v11 request set state=p_state,operator_reason=btrim(p_reason),revision=request.revision+1,resolved_at=case when p_state in ('applied','closed') then now() else null end
 where request.id=p_request_id and request.revision=p_expected_revision and p_state in ('reviewing','applied','closed') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 if not found then raise exception 'correction changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('correction',p_request_id,p_state,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_state;
end $$;

create or replace function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1
 where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 if not found then raise exception 'community post changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',p_post_id,p_decision,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_decision;
end $$;

drop function if exists private.list_operator_corrections_v11();
drop function if exists private.list_operator_community_posts_v11();
drop function if exists api.list_operator_corrections_v11();
drop function if exists api.list_operator_community_posts_v11();
create function private.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select request.id,shop.name,request.field_key,request.proposed_value,request.source_url,request.state,request.revision,request.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='correction' and event.entity_id=request.id),'[]'::jsonb)
 from private.store_correction_requests_v11 request join app.shops shop on shop.id=request.shop_id order by request.created_at asc
$$;
create function private.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.publication_state,post.revision,post.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id),'[]'::jsonb)
 from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by post.created_at asc
$$;

-- The active revision is the only score public readers, widgets, and the
-- moderation queue may show.  Legacy assessment rows are not a score source.
create or replace function api.list_public_review_experience_publications(p_shop_slug text,p_limit integer default 20,p_offset integer default 0)
returns table(public_handle uuid,rating smallint,body text,display_name text,therapist_display_name text,published_at timestamptz)
language sql security invoker set search_path=private,app,pg_temp as $$
 select publication.public_handle,nullif(revision.assessment_snapshot->>'shopRating','')::smallint,revision.experience_comment,revision.nickname,publication.therapist_display_name_snapshot,publication.published_at
 from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
 join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
 left join private.managed_shops managed on managed.app_shop_id=shop.id
 where shop.slug=p_shop_slug and publication.publication_state='published' and (managed.id is null or managed.publication_state='published')
 order by publication.published_at desc limit greatest(1,least(p_limit,20)) offset greatest(p_offset,0)
$$;

create or replace function private.list_review_moderation_v11()
returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
 select experience.id,experience.moderation_revision,experience.state,shop.name,revision.experience_comment,nullif(revision.assessment_snapshot->>'shopRating','')::smallint,experience.created_at
 from private.review_experiences experience join app.shops shop on shop.id=experience.shop_id join lateral(select * from private.review_experience_revisions history where history.experience_id=experience.id order by history.revision desc limit 1) revision on true
 where experience.state in ('submitted','approved','withdrawn') order by experience.created_at asc
$$;

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
 return query select p_experience_id,v_current.revision+1,'pending'::text;
end $$;

create function api.resolve_public_community_target_v11(p_scope_kind text,p_slug text) returns table(scope_kind text,target_id uuid,target_name text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.resolve_public_community_target_v11(p_scope_kind,p_slug) $$;
create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(request_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(post_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
-- Retain the previous server-only signatures for already deployed callers.
-- New HTTP routes always use the named, payload-bound overloads above.
create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text) returns table(request_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select request_id,revision,state from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash,encode(extensions.digest(p_shop_id::text||chr(31)||p_field_key||chr(31)||btrim(coalesce(p_proposed_value,''))||chr(31)||coalesce(nullif(btrim(p_source_url),''),''),'sha256'),'hex')) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select post_id,revision,state from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash,encode(extensions.digest(p_scope_kind||chr(31)||coalesce(p_shop_id,p_area_id)::text||chr(31)||btrim(coalesce(p_body,'')),'sha256'),'hex')) $$;
create function api.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_corrections_v11() $$;
create function api.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11() $$;

revoke all on function private.community_target_is_public_v11(text,uuid,uuid),private.resolve_public_community_target_v11(text,text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.withdraw_community_post_v11(uuid,text,integer),private.react_to_community_post_v11(uuid,text,text,integer),private.list_public_community_posts_v11(uuid,uuid,text),private.moderate_store_correction_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.list_operator_corrections_v11(),private.list_operator_community_posts_v11(),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.resolve_public_community_target_v11(text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.list_public_review_experience_publications(text,integer,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) from public,anon,authenticated;
grant execute on function private.community_target_is_public_v11(text,uuid,uuid),private.resolve_public_community_target_v11(text,text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.withdraw_community_post_v11(uuid,text,integer),private.react_to_community_post_v11(uuid,text,text,integer),private.list_public_community_posts_v11(uuid,uuid,text),private.moderate_store_correction_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.list_operator_corrections_v11(),private.list_operator_community_posts_v11(),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.resolve_public_community_target_v11(text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.list_public_review_experience_publications(text,integer,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) to service_role;
notify pgrst,'reload schema';
