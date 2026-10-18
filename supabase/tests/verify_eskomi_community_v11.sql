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
 begin
   perform api.submit_community_appeal_v11(repeat('8',64),'本人撤回の復活は禁止',repeat('4',64),encode(extensions.digest(repeat('8',64)||chr(31)||'本人撤回の復活は禁止','sha256'),'hex'));
   raise exception 'self-withdrawn post became appealable';
 exception when no_data_found then null;
 end;
 select post_id,revision into p3,r from api.submit_community_post_v11('area',null,a,'運営非公開化の確認用',repeat('d',64),repeat('e',64),repeat('f',64),repeat('0',64),encode(extensions.digest('area'||chr(31)||a::text||chr(31)||'運営非公開化の確認用','sha256'),'hex'));
 if api.moderate_community_post_v11(p3,'approved','safe',r)<>'approved' then raise exception 'community approve failed'; end if;
 select revision into r from private.community_posts_v11 where id=p3;
 if api.moderate_community_post_v11(p3,'hidden','operator hide',r)<>'hidden' then raise exception 'operator community hide decision failed'; end if;
 if (select publication_state from private.community_posts_v11 where id=p3)<>'withdrawn' then raise exception 'operator community hide publication state failed: %',(select publication_state from private.community_posts_v11 where id=p3); end if;
 select result.appeal_id,result.revision,result.replayed into c,r,replayed from api.submit_community_appeal_v11(repeat('d',64),'非公開措置への異議です',repeat('1',64),encode(extensions.digest(repeat('d',64)||chr(31)||'非公開措置への異議です','sha256'),'hex')) result;
 if replayed or api.review_community_appeal_v11(c,'reopen_review','operator hide appeal',r)<>'reopen_review' then raise exception 'operator hidden post appeal failed'; end if;
 select result.replayed into replayed from api.submit_community_appeal_v11(repeat('d',64),'非公開措置への異議です',repeat('1',64),encode(extensions.digest(repeat('d',64)||chr(31)||'非公開措置への異議です','sha256'),'hex')) result;
 if not replayed or (select moderation_state from private.community_posts_v11 where id=p3)<>'pending' then raise exception 'appeal replay was coupled to later review state'; end if;
 begin
   perform api.moderate_community_post_v11(p3,'approved','stale retry',r);
   raise exception 'stale approval revived hidden post';
 exception when serialization_failure then null;
 end;
 if has_function_privilege('public','private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text)','execute') or has_function_privilege('anon','private.list_public_community_posts_v11(uuid,uuid,text)','execute') then raise exception 'community private function has public execute'; end if;
 select revision into r from private.community_posts_v11 where id=p;
 if api.withdraw_community_post_v11(p,repeat('3',64),r)<>'withdrawn' then raise exception 'community withdrawal failed'; end if;
 if exists(select 1 from api.list_public_community_posts_v11(s,null,null)) then raise exception 'withdrawn community post leaked'; end if;
 -- A report is idempotent, is private, and does not itself remove public text.
 select post_id,revision into p,r from api.submit_community_post_v11('shop',s,null,'通報・再審査の確認用',repeat('c',64),repeat('d',64),repeat('e',64),repeat('f',64),encode(extensions.digest('shop'||chr(31)||s::text||chr(31)||'通報・再審査の確認用','sha256'),'hex'));
 perform api.moderate_community_post_v11(p,'approved','safe',r);
 select result.report_id,result.revision,result.replayed into c,r,replayed from api.submit_community_report_v11(p,'personal_data','個人情報の疑い',repeat('1',64),repeat('2',64),encode(extensions.digest(p::text||chr(31)||'personal_data'||chr(31)||'個人情報の疑い','sha256'),'hex')) result;
 if replayed or not exists(select 1 from api.list_public_community_posts_v11(s,null,null) where post_id=p) then raise exception 'report should not auto-unpublish'; end if;
 select result.replayed into replayed from api.submit_community_report_v11(p,'personal_data','個人情報の疑い',repeat('1',64),repeat('2',64),encode(extensions.digest(p::text||chr(31)||'personal_data'||chr(31)||'個人情報の疑い','sha256'),'hex')) result;
 if not replayed then raise exception 'community report idempotency failed'; end if;
 if api.review_community_report_v11(c,'reopen_review','re-review required',r)<>'reopen_review' then raise exception 'community report reopen failed'; end if;
 if exists(select 1 from api.list_public_community_posts_v11(s,null,null) where post_id=p) or (select moderation_state from private.community_posts_v11 where id=p)<>'pending' then raise exception 'report reopen did not safely hide for review'; end if;
 select revision into r from private.community_posts_v11 where id=p; perform api.moderate_community_post_v11(p,'approved','reapproved',r);
 -- Appeals are receipt-bound and return a rejected post to pending review.
 select post_id,revision into p3,r from api.submit_community_post_v11('shop',s,null,'異議申立ての確認用',repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',64),encode(extensions.digest('shop'||chr(31)||s::text||chr(31)||'異議申立ての確認用','sha256'),'hex'));
 perform api.moderate_community_post_v11(p3,'rejected','not now',r);
 select result.appeal_id,result.revision,result.replayed into c,r,replayed from api.submit_community_appeal_v11(repeat('a',64),'事実確認をお願いします',repeat('3',64),encode(extensions.digest(repeat('a',64)||chr(31)||'事実確認をお願いします','sha256'),'hex')) result;
 if replayed then raise exception 'first community appeal replayed'; end if;
 select result.replayed into replayed from api.submit_community_appeal_v11(repeat('a',64),'事実確認をお願いします',repeat('3',64),encode(extensions.digest(repeat('a',64)||chr(31)||'事実確認をお願いします','sha256'),'hex')) result;
 if not replayed then raise exception 'community appeal idempotency failed'; end if;
 if api.review_community_appeal_v11(c,'reopen_review','appeal accepted',r)<>'reopen_review' then raise exception 'community appeal reopen failed'; end if;
 if (select moderation_state from private.community_posts_v11 where id=p3)<>'pending' or not exists(select 1 from private.community_moderation_events_v11 where entity_kind='community_post' and entity_id=p3 and action='appeal_reopen_review') then raise exception 'appeal history missing'; end if;
 -- A queue page stays bounded and puts a newly received item ahead of over
 -- 1000 resolved rows. Resolved history is only visible through its own page.
 insert into private.community_post_reports_v11(post_id,reporter_scope_hash,idempotency_hash,payload_hash,reason_code,detail,state,created_at)
 select p,encode(extensions.digest('queue-scope-'||g::text,'sha256'),'hex'),encode(extensions.digest('queue-key-'||g::text,'sha256'),'hex'),encode(extensions.digest('queue-payload-'||g::text,'sha256'),'hex'),'other','history','dismissed',now()-((1002-g)||' seconds')::interval from generate_series(1,1001) g;
 insert into private.community_post_reports_v11(post_id,reporter_scope_hash,idempotency_hash,payload_hash,reason_code,detail,state) values(p,repeat('9',64),repeat('a',64),repeat('b',64),'spam','new pending','received') returning id into c;
 if (select count(*) from api.list_operator_community_reports_v11(50,0,false))<>1 or (select report_id from api.list_operator_community_reports_v11(50,0,false) limit 1)<>c then raise exception 'pending report queue is not newest bounded page'; end if;
 if (select count(*) from api.list_operator_community_reports_v11(50,0,true))<>50 then raise exception 'resolved report history is not paginated'; end if;
end $$;
rollback;
