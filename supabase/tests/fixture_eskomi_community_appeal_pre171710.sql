-- Persisted before 171710/171720: one target is provable and one has been
-- superseded by a visitor withdrawal.  The latter must never be reopened.
do $$
declare v_area uuid; v_post_bound uuid; v_post_manual uuid; v_revision integer;
begin
  insert into app.areas(slug,name,is_published,published_at) values('upgrade-appeal-area','Upgrade appeal area',true,now()) returning id into v_area;
  select post_id,revision into v_post_bound,v_revision from api.submit_community_post_v11('area',null,v_area,'upgrade-bound-appeal',repeat('1',64),repeat('2',64),repeat('3',64),repeat('4',64),encode(extensions.digest('area'||chr(31)||v_area::text||chr(31)||'upgrade-bound-appeal','sha256'),'hex'));
  perform api.moderate_community_post_v11(v_post_bound,'rejected','pre-upgrade rejection',v_revision);
  perform api.submit_community_appeal_v11(repeat('1',64),'pre-upgrade bound appeal',repeat('5',64),encode(extensions.digest(repeat('1',64)||chr(31)||'pre-upgrade bound appeal','sha256'),'hex'));
  select post_id,revision into v_post_manual,v_revision from api.submit_community_post_v11('area',null,v_area,'upgrade-manual-appeal',repeat('6',64),repeat('7',64),repeat('8',64),repeat('9',64),encode(extensions.digest('area'||chr(31)||v_area::text||chr(31)||'upgrade-manual-appeal','sha256'),'hex'));
  perform api.moderate_community_post_v11(v_post_manual,'rejected','pre-upgrade rejection',v_revision);
  perform api.submit_community_appeal_v11(repeat('6',64),'pre-upgrade stale appeal',repeat('a',64),encode(extensions.digest(repeat('6',64)||chr(31)||'pre-upgrade stale appeal','sha256'),'hex'));
  select revision into v_revision from private.community_posts_v11 where id=v_post_manual;
  perform api.withdraw_community_post_v11(v_post_manual,repeat('6',64),v_revision);
end $$;
