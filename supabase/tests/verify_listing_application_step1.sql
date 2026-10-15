begin;
select 1 / case when exists (select 1 from pg_tables where schemaname = 'private' and tablename = 'listing_applications') then 1 else 0 end;
select 1 / case when exists (select 1 from pg_tables where schemaname = 'private' and tablename = 'listing_application_assets') then 1 else 0 end;
select 1 / case when (select relrowsecurity from pg_class where oid = 'private.listing_applications'::regclass) then 1 else 0 end;
select 1 / case when (select public = false and file_size_limit = 5242880 from storage.buckets where id = 'listing-application-private') then 1 else 0 end;
select 1 / case when not has_table_privilege('anon', 'private.listing_applications', 'select') then 1 else 0 end;
select 1 / case when not has_table_privilege('authenticated', 'private.listing_application_assets', 'insert') then 1 else 0 end;
rollback;
