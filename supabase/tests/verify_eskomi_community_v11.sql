begin;
do $$
declare s uuid; a uuid; c uuid; p uuid; r integer; n bigint;
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
 if api.withdraw_community_post_v11(p,repeat('3',64),r)<>'withdrawn' then raise exception 'community withdrawal failed'; end if;
 if exists(select 1 from api.list_public_community_posts_v11(s,null,null)) then raise exception 'withdrawn community post leaked'; end if;
end $$;
rollback;
