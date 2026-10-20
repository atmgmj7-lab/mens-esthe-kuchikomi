-- This file is run after the new migration in one transaction against a local
-- v1.1 fixture. It intentionally leaves no schema or data changes behind.
do $$
begin
  if has_table_privilege('anon', 'private.review_experiences', 'select')
    or has_table_privilege('anon', 'private.review_experience_revisions', 'select')
    or has_table_privilege('anon', 'app.review_experience_publications', 'select') then
    raise exception 'anon must not receive direct review-table read access';
  end if;
  if not has_function_privilege('anon', 'api.list_public_review_experience_publications_global(integer,integer,text)', 'execute')
    or not has_function_privilege('anon', 'api.count_public_review_experience_publications_global(text)', 'execute')
    or not has_function_privilege('anon', 'api.list_public_shop_detail_reviews_v11(text,integer,integer)', 'execute')
    or not has_function_privilege('anon', 'api.get_public_shop_detail_review_summary_v11(text)', 'execute') then
    raise exception 'anon public review read grants are incomplete';
  end if;
end
$$;

set local role anon;
select count(*) >= 0 as anon_can_read_global_projection
from api.list_public_review_experience_publications_global(20, 0, null);
select api.count_public_review_experience_publications_global(null) >= 0 as anon_can_count_global_projection;
select count(*) >= 0 as anon_can_read_shop_projection
from api.list_public_shop_detail_reviews_v11('fixture-partner-store', 20, 0);
select count(*) >= 0 as anon_can_read_shop_summary
from api.get_public_shop_detail_review_summary_v11('fixture-partner-store');
reset role;
