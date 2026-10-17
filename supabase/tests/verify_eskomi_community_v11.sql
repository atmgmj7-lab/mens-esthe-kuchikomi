begin;
do $$
declare s uuid; a uuid; c uuid; p uuid; p2 uuid; p3 uuid; replayed boolean; r integer; n bigint;
begin
 insert into app.shops(slug,canonical_path,name,publication_status,published_at) values('v11-community','/shops/v11-community/','Community fixture','published',now()) returning id into s;
 insert into app.areas(slug,name,is_published,published_at) values('v11-community','Community area',true,now()) returning id into a;
 select request_id into c from api.submit_store_correction_v11(s,'hours','営業時間を確認してください',null,repeat('1',64),repeat('2',64));
 if (select request_id from api.submit_store_correction_v11(s,'hours','営業時間を確認してください',null,repeat('1',64),repeat('2',64)))<>c then raise exception 'correction idempotency failed'; end if;
 if api.moderate_store_correction_v11(c,'applied','operator checked',1)<>'applied' then raise exception 'correction moderation failed'; end if;
 select post_id,revision into p,r from api.submit_community_post_v11('shop',s,null,'未確認の利用者情報です',repeat('3',64),repeat('4',64),repeat('5',64),repeat('6',64));
 if exists(select 1 from api.list_public_community_posts_v11(s,null,null)) then raise exception 'pending community post leaked'; end if;
 if api.moderate_community_post_v11(p,'approved','safe',r)<>'approved' then raise exception 'community moderation failed'; end if;
 select revision into r from private.community_posts_v11 where id=p;
 perform api.react_to_community_post_v11(p,repeat('7',64),'like',r); perform api.react_to_community_post_v11(p,repeat('7',64),'like',r);
 select like_count into n from api.list_public_community_posts_v11(s,null,repeat('7',64)) where post_id=p;
 if n<>1 then raise exception 'reaction repeated count'; end if;
 -- Public readers and reactions must re-check the target, not merely the
 -- post approval state. A hidden shop may not leave its text accessible.
 update app.shops set publication_status='review' where id=s;
 if exists(select 1 from api.list_public_community_posts_v11(s,null,null)) then raise exception 'unpublished shop community post leaked'; end if;
 begin
   perform api.react_to_community_post_v11(p,repeat('7',64),'dislike',r);
   raise exception 'reaction accepted for unpublished shop';
 exception when serialization_failure then null;
 end;
 update app.shops set publication_status='published' where id=s;
 -- The payload-bound overload is the actual PostgREST route. A lost response
 -- replays only with the original body and receipt hash.
 select result.post_id,result.revision,result.replayed into p2,r,replayed from api.submit_community_post_v11('area',null,a,'再送安全な未確認情報',repeat('8',64),repeat('9',64),repeat('a',64),repeat('b',64),encode(extensions.digest('area'||chr(31)||a::text||chr(31)||'再送安全な未確認情報','sha256'),'hex')) result;
 if replayed then raise exception 'first community submission was replayed'; end if;
 select result.replayed into replayed from api.submit_community_post_v11('area',null,a,'再送安全な未確認情報',repeat('8',64),repeat('9',64),repeat('a',64),repeat('b',64),encode(extensions.digest('area'||chr(31)||a::text||chr(31)||'再送安全な未確認情報','sha256'),'hex')) result;
 if not replayed then raise exception 'lost-response community replay failed'; end if;
 begin
   perform api.submit_community_post_v11('area',null,a,'差し替え本文',repeat('8',64),repeat('9',64),repeat('a',64),repeat('b',64),encode(extensions.digest('area'||chr(31)||a::text||chr(31)||'差し替え本文','sha256'),'hex'));
   raise exception 'community replay payload substitution succeeded';
 exception when invalid_parameter_value then null;
 end;
 select result.revision into r from api.withdraw_community_post_by_receipt_v11(repeat('8',64)) result;
 if (select publication_state from private.community_posts_v11 where id=p2)<>'withdrawn' then raise exception 'pending community receipt withdrawal failed'; end if;
 select post_id,revision into p3,r from api.submit_community_post_v11('area',null,a,'運営非公開化の確認用',repeat('d',64),repeat('e',64),repeat('f',64),repeat('0',64),encode(extensions.digest('area'||chr(31)||a::text||chr(31)||'運営非公開化の確認用','sha256'),'hex'));
 if api.moderate_community_post_v11(p3,'approved','safe',r)<>'approved' then raise exception 'community approve failed'; end if;
 select revision into r from private.community_posts_v11 where id=p3;
 if api.moderate_community_post_v11(p3,'hidden','operator hide',r)<>'hidden' then raise exception 'operator community hide decision failed'; end if;
 if (select publication_state from private.community_posts_v11 where id=p3)<>'withdrawn' then raise exception 'operator community hide publication state failed: %',(select publication_state from private.community_posts_v11 where id=p3); end if;
 begin
   perform api.moderate_community_post_v11(p3,'approved','stale retry',r);
   raise exception 'stale approval revived hidden post';
 exception when serialization_failure then null;
 end;
 if has_function_privilege('public','private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text)','execute') or has_function_privilege('anon','private.list_public_community_posts_v11(uuid,uuid,text)','execute') then raise exception 'community private function has public execute'; end if;
 select revision into r from private.community_posts_v11 where id=p;
 if api.withdraw_community_post_v11(p,repeat('3',64),r)<>'withdrawn' then raise exception 'community withdrawal failed'; end if;
 if exists(select 1 from api.list_public_community_posts_v11(s,null,null)) then raise exception 'withdrawn community post leaked'; end if;
end $$;
rollback;
