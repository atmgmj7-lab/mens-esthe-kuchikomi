-- `withdrawn` predates the appeal flow and is used for both a visitor's own
-- withdrawal and an operator hide.  The immutable moderation event is the
-- discriminator: only an operator `hidden` event may be appealed.
create or replace function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
 select post.id into v_post from private.community_posts_v11 post
 where post.receipt_hash=p_receipt_hash and post.moderation_state='rejected'
   and ((post.publication_state='draft' and post.withdrawn_at is null)
     or (post.publication_state='withdrawn' and exists(select 1 from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id and event.action='hidden')))
 for key share;
 if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
 v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex'); if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
 select appeal.id,appeal.payload_hash into v_id,v_payload from private.community_post_appeals_v11 appeal where appeal.post_id=v_post and appeal.receipt_hash=p_receipt_hash and appeal.idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if; return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return; end if;
 insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason) values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason)) returning id into v_id;
 return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;

create or replace function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer;
begin
 select * into v_appeal from private.community_post_appeals_v11 where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
 update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id returning revision into v_post_revision;
 if p_decision='reopen_review' then
   update private.community_posts_v11 post set moderation_state='pending',publication_state='draft',withdrawn_at=null,operator_reason=btrim(p_reason),revision=revision+1
   where post.id=v_appeal.post_id and post.moderation_state='rejected'
     and ((post.publication_state='draft' and post.withdrawn_at is null)
       or (post.publication_state='withdrawn' and exists(select 1 from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id and event.action='hidden')))
   returning revision into v_post_revision;
   if not found then raise exception 'post changed' using errcode='40001'; end if;
 end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;
revoke all on function private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';
