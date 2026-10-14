create or replace function api.get_partner_listing_review_queue()
returns jsonb language sql security definer set search_path=private,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('store_id',s.id,'shop_slug',s.shop_slug,'revision',r.revision,'shop_name',r.shop_name,'area',r.area,'website_url',r.website_url,'introduction',r.introduction,'state',r.state,'current_public',p.introduction) order by r.submitted_at), '[]'::jsonb)
 from private.listing_stores s join private.listing_store_revisions r on r.listing_store_id=s.id and r.revision=s.current_revision left join private.listing_store_publications p on p.listing_store_id=s.id where r.state='submitted'
$$;
revoke all on function api.get_partner_listing_review_queue() from public,anon,authenticated;
grant execute on function api.get_partner_listing_review_queue() to service_role;
