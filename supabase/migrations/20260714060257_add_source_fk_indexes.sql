create index if not exists content_revisions_source_id_idx
  on app.content_revisions (source_id);

create index if not exists contents_source_id_idx
  on app.contents (source_id);

create index if not exists shop_source_links_source_id_idx
  on app.shop_source_links (source_id);
