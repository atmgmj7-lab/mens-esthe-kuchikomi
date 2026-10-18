-- Community safety follow-up: reports never silently unpublish a post.  An
-- operator must open a re-review and every step remains auditable.

alter table private.community_idempotency_v11 drop constraint if exists community_idempotency_v11_operation_check;
alter table private.community_idempotency_v11 add constraint community_idempotency_v11_operation_check check (operation in ('correction','post','community_report','community_appeal'));

create table private.community_post_reports_v11 (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  reporter_scope_hash text not null check (reporter_scope_hash ~ '^[0-9a-f]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other')),
  detail text not null default '' check (char_length(detail) <= 400),
  state text not null default 'received' check (state in ('received','reviewing','resolved','dismissed')),
  operator_reason text not null default '' check (char_length(operator_reason) <= 1000),
  revision integer not null default 1 check (revision > 0), created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(post_id, reporter_scope_hash, idempotency_hash)
);
create table private.community_post_appeals_v11 (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  reason text not null check (char_length(btrim(reason)) between 1 and 400),
  state text not null default 'received' check (state in ('received','reviewing','resolved','dismissed')),
  operator_reason text not null default '' check (char_length(operator_reason) <= 1000),
  revision integer not null default 1 check (revision > 0), created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(post_id, receipt_hash, idempotency_hash)
);
alter table private.community_post_reports_v11 enable row level security;
alter table private.community_post_appeals_v11 enable row level security;
revoke all on table private.community_post_reports_v11,private.community_post_appeals_v11 from public,anon,authenticated;

create function private.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(report_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid report credential' using errcode='22023'; end if;
 if p_reason_code not in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other') or char_length(btrim(coalesce(p_detail,'')))>400 then raise exception 'invalid report' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_post_id::text||chr(31)||p_reason_code||chr(31)||btrim(coalesce(p_detail,'')),'sha256'),'hex');
 if v_expected<>p_payload_hash then raise exception 'invalid report payload' using errcode='22023'; end if;
 select id,payload_hash into v_id,v_payload from private.community_post_reports_v11 where post_id=p_post_id and reporter_scope_hash=p_scope_hash and idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'report replay payload changed' using errcode='22023'; end if; return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 if not exists(select 1 from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id)) then raise exception 'post is unavailable' using errcode='P0002'; end if;
 insert into private.community_post_reports_v11(post_id,reporter_scope_hash,idempotency_hash,payload_hash,reason_code,detail) values(p_post_id,p_scope_hash,p_idempotency_hash,p_payload_hash,p_reason_code,btrim(coalesce(p_detail,''))) returning id into v_id;
 return query select report.id,report.revision,report.state,false from private.community_post_reports_v11 report where report.id=v_id;
end $$;

create function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
 select id into v_post from private.community_posts_v11 where receipt_hash=p_receipt_hash and moderation_state='rejected' and publication_state='draft' and withdrawn_at is null for key share;
 if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
 v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex'); if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
 select id,payload_hash into v_id,v_payload from private.community_post_appeals_v11 where post_id=v_post and receipt_hash=p_receipt_hash and idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if; return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return; end if;
 insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason) values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason)) returning id into v_id;
 return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;

create function private.review_community_report_v11(p_report_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_report private.community_post_reports_v11%rowtype; v_post_revision integer;
begin
 select * into v_report from private.community_post_reports_v11 where id=p_report_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'report changed' using errcode='40001'; end if;
 update private.community_post_reports_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_report_id returning revision into v_post_revision;
 if p_decision='reopen_review' then update private.community_posts_v11 set moderation_state='pending',publication_state='draft',published_at=null,operator_reason=btrim(p_reason),revision=revision+1 where id=v_report.post_id and moderation_state='approved' and publication_state='published' returning revision into v_post_revision; if not found then raise exception 'post changed' using errcode='40001'; end if; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_report.post_id,'report_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;

create function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer;
begin
 select * into v_appeal from private.community_post_appeals_v11 where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
 update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id returning revision into v_post_revision;
 if p_decision='reopen_review' then update private.community_posts_v11 set moderation_state='pending',publication_state='draft',operator_reason=btrim(p_reason),revision=revision+1 where id=v_appeal.post_id and moderation_state='rejected' and publication_state='draft' and withdrawn_at is null returning revision into v_post_revision; if not found then raise exception 'post changed' using errcode='40001'; end if; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;

create function private.list_operator_community_reports_v11() returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select report.id,post.id,coalesce(shop.name,area.name),post.body,report.reason_code,report.detail,report.state,report.revision,report.created_at from private.community_post_reports_v11 report join private.community_posts_v11 post on post.id=report.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by report.created_at asc $$;
create function private.list_operator_community_appeals_v11() returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select appeal.id,post.id,coalesce(shop.name,area.name),post.body,appeal.reason,appeal.state,appeal.revision,appeal.created_at from private.community_post_appeals_v11 appeal join private.community_posts_v11 post on post.id=appeal.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by appeal.created_at asc $$;

create function api.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(report_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_report_v11(p_post_id,p_reason_code,p_detail,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
create function api.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text) returns table(appeal_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_appeal_v11(p_receipt_hash,p_reason,p_idempotency_hash,p_payload_hash) $$;
create function api.review_community_report_v11(p_report_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.review_community_report_v11(p_report_id,p_decision,p_reason,p_expected_revision) $$;
create function api.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.review_community_appeal_v11(p_appeal_id,p_decision,p_reason,p_expected_revision) $$;
create function api.list_operator_community_reports_v11() returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_reports_v11() $$;
create function api.list_operator_community_appeals_v11() returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_appeals_v11() $$;
revoke all on function api.submit_community_report_v11(uuid,text,text,text,text,text),api.submit_community_appeal_v11(text,text,text,text),api.review_community_report_v11(uuid,text,text,integer),api.review_community_appeal_v11(uuid,text,text,integer),api.list_operator_community_reports_v11(),api.list_operator_community_appeals_v11() from public,anon,authenticated;
grant execute on function private.submit_community_report_v11(uuid,text,text,text,text,text),private.submit_community_appeal_v11(text,text,text,text),private.review_community_report_v11(uuid,text,text,integer),private.review_community_appeal_v11(uuid,text,text,integer),private.list_operator_community_reports_v11(),private.list_operator_community_appeals_v11(),api.submit_community_report_v11(uuid,text,text,text,text,text),api.submit_community_appeal_v11(text,text,text,text),api.review_community_report_v11(uuid,text,text,integer),api.review_community_appeal_v11(uuid,text,text,integer),api.list_operator_community_reports_v11(),api.list_operator_community_appeals_v11() to service_role;
notify pgrst,'reload schema';
