alter table private.listing_application_assets drop constraint listing_application_assets_object_key_check;
alter table private.listing_application_assets add constraint listing_application_assets_object_key_check
  check (object_key ~ '^listing-applications/[0-9a-f-]+/[0-9a-f-]+[.](png|jpe?g|webp)$');
