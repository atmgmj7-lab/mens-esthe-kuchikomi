-- Operator queues must not rely on PostgREST's global max_rows.  Pending work
-- is always a bounded, newest-first page; resolved history is opt-in.
drop function if exists private.list_operator_community_posts_v11();
drop function if exists private.list_operator_community_reports_v11();
drop function if exists private.list_operator_community_appeals_v11();
drop function if exists api.list_operator_community_posts_v11();
drop function if exists api.list_operator_community_reports_v11();
drop function if exists api.list_operator_community_appeals_v11();

create function private.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.publication_state,post.revision,post.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id),'[]'::jsonb)
 from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or post.moderation_state='pending'
 order by case when post.moderation_state='pending' then 0 else 1 end,post.created_at desc,post.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function private.list_operator_community_reports_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select report.id,post.id,coalesce(shop.name,area.name),post.body,report.reason_code,report.detail,report.state,report.revision,report.created_at
 from private.community_post_reports_v11 report join private.community_posts_v11 post on post.id=report.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or report.state in ('received','reviewing')
 order by case when report.state in ('received','reviewing') then 0 else 1 end,report.created_at desc,report.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function private.list_operator_community_appeals_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select appeal.id,post.id,coalesce(shop.name,area.name),post.body,appeal.reason,appeal.state,appeal.revision,appeal.created_at
 from private.community_post_appeals_v11 appeal join private.community_posts_v11 post on post.id=appeal.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or appeal.state in ('received','reviewing')
 order by case when appeal.state in ('received','reviewing') then 0 else 1 end,appeal.created_at desc,appeal.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function api.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11(p_limit,p_offset,p_include_resolved) $$;
create function api.list_operator_community_reports_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_reports_v11(p_limit,p_offset,p_include_resolved) $$;
create function api.list_operator_community_appeals_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_appeals_v11(p_limit,p_offset,p_include_resolved) $$;
create or replace function private.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(report_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid report credential' using errcode='22023'; end if;
 if p_reason_code not in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other') or char_length(btrim(coalesce(p_detail,'')))>400 then raise exception 'invalid report' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_post_id::text||chr(31)||p_reason_code||chr(31)||btrim(coalesce(p_detail,'')),'sha256'),'hex'); if p_payload_hash<>v_expected then raise exception 'invalid report payload' using errcode='22023'; end if;
 select report.id,report.payload_hash into v_id,v_payload from private.community_post_reports_v11 report where report.post_id=p_post_id and report.reporter_scope_hash=p_scope_hash and report.idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'report replay payload changed' using errcode='22023'; end if; return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 if not exists(select 1 from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id)) then raise exception 'post is unavailable' using errcode='P0002'; end if;
 select report.id into v_id from private.community_post_reports_v11 report where report.post_id=p_post_id and report.reporter_scope_hash=p_scope_hash and (report.state in ('received','reviewing') or report.created_at>now()-interval '10 minutes') order by report.created_at desc,report.id desc limit 1 for update;
 if found then return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 insert into private.community_post_reports_v11(post_id,reporter_scope_hash,idempotency_hash,payload_hash,reason_code,detail) values(p_post_id,p_scope_hash,p_idempotency_hash,p_payload_hash,p_reason_code,btrim(coalesce(p_detail,''))) returning id into v_id;
 return query select report.id,report.revision,report.state,false from private.community_post_reports_v11 report where report.id=v_id;
end $$;
revoke all on function private.list_operator_community_posts_v11(integer,integer,boolean),private.list_operator_community_reports_v11(integer,integer,boolean),private.list_operator_community_appeals_v11(integer,integer,boolean),api.list_operator_community_posts_v11(integer,integer,boolean),api.list_operator_community_reports_v11(integer,integer,boolean) from public,anon,authenticated;
grant execute on function private.list_operator_community_posts_v11(integer,integer,boolean),private.list_operator_community_reports_v11(integer,integer,boolean),private.list_operator_community_appeals_v11(integer,integer,boolean),private.submit_community_report_v11(uuid,text,text,text,text,text),api.list_operator_community_posts_v11(integer,integer,boolean),api.list_operator_community_reports_v11(integer,integer,boolean),api.list_operator_community_appeals_v11(integer,integer,boolean) to service_role;
notify pgrst,'reload schema';
