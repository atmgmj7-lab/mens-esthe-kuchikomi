-- Private corrections and manually moderated community posts.  They never
-- participate in ratings, review counts, offers, or ranking inputs.

create table private.store_correction_requests_v11 (
  id uuid primary key default gen_random_uuid(), shop_id uuid not null references app.shops(id) on delete restrict,
  field_key text not null check (field_key in ('name','category','price','hours','access','official_url','image','other')),
  proposed_value text not null check (char_length(btrim(proposed_value)) between 1 and 1000),
  source_url text check (source_url is null or (char_length(source_url)<=2048 and source_url ~ '^https://')),
  state text not null default 'received' check (state in ('received','reviewing','applied','closed')),
  operator_reason text not null default '' check (char_length(operator_reason)<=1000), revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table private.community_posts_v11 (
  id uuid primary key default gen_random_uuid(), scope_kind text not null check (scope_kind in ('shop','area')),
  shop_id uuid references app.shops(id) on delete restrict, area_id uuid references app.areas(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 400 and body !~ E'[\\n\\r]{3,}'),
  revision integer not null default 1 check (revision>0), moderation_state text not null default 'pending' check (moderation_state in ('pending','approved','rejected')),
  publication_state text not null default 'draft' check (publication_state in ('draft','published','withdrawn')),
  operator_reason text not null default '' check (char_length(operator_reason)<=1000), receipt_hash text not null unique check (receipt_hash ~ '^[0-9a-f]{64}$'),
  ip_risk_tag text not null check (ip_risk_tag ~ '^[0-9a-f]{64}$'), ip_risk_expires_at timestamptz not null,
  created_at timestamptz not null default now(), published_at timestamptz, withdrawn_at timestamptz,
  check ((scope_kind='shop' and shop_id is not null and area_id is null) or (scope_kind='area' and area_id is not null and shop_id is null)),
  check ((publication_state='published') = (moderation_state='approved'))
);
create table private.community_reactions_v11 (
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  browser_tag_hash text not null check (browser_tag_hash ~ '^[0-9a-f]{64}$'), value text not null check (value in ('like','dislike')),
  expires_at timestamptz not null, updated_at timestamptz not null default now(), primary key(post_id,browser_tag_hash)
);
create table private.community_idempotency_v11 (
  operation text not null check (operation in ('correction','post')), scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'), entity_id uuid not null, created_at timestamptz not null default now(),
  primary key(operation,scope_hash,key_hash)
);
alter table private.store_correction_requests_v11 enable row level security;
alter table private.community_posts_v11 enable row level security;
alter table private.community_reactions_v11 enable row level security;
alter table private.community_idempotency_v11 enable row level security;

create function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text)
returns table(request_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid correction credential' using errcode='22023'; end if;
 select entity_id into v_id from private.community_idempotency_v11 where operation='correction' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then return query select correction.id,correction.revision,correction.state from private.store_correction_requests_v11 correction where correction.id=v_id; return; end if;
 if not exists(select 1 from app.shops shop where shop.id=p_shop_id and shop.publication_status='published') then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_field_key not in ('name','category','price','hours','access','official_url','image','other') or char_length(btrim(coalesce(p_proposed_value,''))) not between 1 and 1000 or (p_source_url is not null and (char_length(p_source_url)>2048 or p_source_url !~ '^https://')) then raise exception 'invalid correction' using errcode='22023'; end if;
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id) values('correction',p_scope_hash,p_idempotency_hash,v_id);
 return query select correction.id,correction.revision,correction.state from private.store_correction_requests_v11 correction where correction.id=v_id;
end $$;

create function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text)
returns table(post_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_ip_risk_tag !~ '^[0-9a-f]{64}$' or p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community credential' using errcode='22023'; end if;
 select entity_id into v_id from private.community_idempotency_v11 where operation='post' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then return query select post.id,post.revision,post.moderation_state from private.community_posts_v11 post where post.id=v_id; return; end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 400 or (p_scope_kind='shop' and (p_shop_id is null or p_area_id is not null)) or (p_scope_kind='area' and (p_area_id is null or p_shop_id is not null)) then raise exception 'invalid community post' using errcode='22023'; end if;
 if p_scope_kind='shop' and not exists(select 1 from app.shops shop where shop.id=p_shop_id and shop.publication_status='published') then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_scope_kind='area' and not exists(select 1 from app.areas area where area.id=p_area_id and area.is_published) then raise exception 'area is unavailable' using errcode='P0002'; end if;
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id) values('post',p_scope_hash,p_idempotency_hash,v_id);
 return query select post.id,post.revision,post.moderation_state from private.community_posts_v11 post where post.id=v_id;
end $$;

create function private.withdraw_community_post_v11(p_post_id uuid,p_receipt_hash text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
begin
 update private.community_posts_v11 post set publication_state='withdrawn',moderation_state=case when post.moderation_state='approved' then 'rejected' else post.moderation_state end,withdrawn_at=now(),revision=post.revision+1
  where post.id=p_post_id and post.receipt_hash=p_receipt_hash and post.revision=p_expected_revision and post.publication_state<>'withdrawn';
 if not found then raise exception 'community post changed' using errcode='40001'; end if; return 'withdrawn';
end $$;

create function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create function private.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null)
returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security definer set search_path=private,pg_temp as $$
 select post.id,post.body,post.revision,post.published_at,count(reaction.*) filter(where reaction.value='like'),count(reaction.*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash)
 from private.community_posts_v11 post left join private.community_reactions_v11 reaction on reaction.post_id=post.id and reaction.expires_at>now()
 where post.moderation_state='approved' and post.publication_state='published' and ((p_shop_id is not null and post.shop_id=p_shop_id) or (p_area_id is not null and post.area_id=p_area_id))
 group by post.id order by post.published_at desc limit 30
$$;

create function private.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select request.id,shop.name,request.field_key,request.proposed_value,request.source_url,request.state,request.revision,request.created_at from private.store_correction_requests_v11 request join app.shops shop on shop.id=request.shop_id where request.state in ('received','reviewing') order by request.created_at $$;
create function private.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.revision,post.created_at from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id where post.moderation_state='pending' and post.publication_state='draft' order by post.created_at $$;
create function private.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$ begin update private.store_correction_requests_v11 request set state=p_state,operator_reason=btrim(p_reason),revision=request.revision+1,resolved_at=case when p_state in ('applied','closed') then now() else null end where request.id=p_request_id and request.revision=p_expected_revision and p_state in ('reviewing','applied','closed') and char_length(btrim(coalesce(p_reason,'')))<=1000; if not found then raise exception 'correction changed' using errcode='40001'; end if; return p_state; end $$;
create function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$ begin update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1 where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000; if not found then raise exception 'community post changed' using errcode='40001'; end if; return p_decision; end $$;

create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text) returns table(request_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash) $$;
create function api.withdraw_community_post_v11(p_post_id uuid,p_receipt_hash text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_community_post_v11(p_post_id,p_receipt_hash,p_expected_revision) $$;
create function api.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer) returns table(like_count bigint,dislike_count bigint,my_value text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.react_to_community_post_v11(p_post_id,p_browser_tag_hash,p_value,p_expected_revision) $$;
create function api.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null) returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_public_community_posts_v11(p_shop_id,p_area_id,p_browser_tag_hash) $$;
create function api.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_corrections_v11() $$;
create function api.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11() $$;
create function api.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_store_correction_v11(p_request_id,p_state,p_reason,p_expected_revision) $$;
create function api.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_community_post_v11(p_post_id,p_decision,p_reason,p_expected_revision) $$;
revoke all on table private.store_correction_requests_v11,private.community_posts_v11,private.community_reactions_v11,private.community_idempotency_v11 from public,anon,authenticated;
revoke all on function api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';
