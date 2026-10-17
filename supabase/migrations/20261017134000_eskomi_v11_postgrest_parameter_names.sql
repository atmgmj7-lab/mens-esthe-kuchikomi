-- PostgREST matches JSON object keys to exposed argument names.  Positional
-- wrappers (`$1`) lose those names, so retain the v1.1 API contract here.
create or replace function api.create_review_submission_context(
  p_entry_handle uuid, p_session_secret_hash text, p_context_fingerprint text
) returns table (entry_handle uuid, shop_slug text, shop_name text, therapist_display_name text, expires_at timestamptz)
language sql security invoker set search_path = private, api, pg_temp as $$ select * from private.create_review_submission_context(p_entry_handle,p_session_secret_hash,p_context_fingerprint) $$;
create or replace function api.submit_review_experience_v11(
  p_entry_handle uuid, p_session_secret_hash text, p_idempotency_hash text, p_request_fingerprint text, p_receipt_hash text, p_ip_shop_hash text, p_shop_rating smallint, p_common_comment text, p_guest_display_name text, p_therapist_rating smallint
) returns table (experience_id uuid, replayed boolean, receipt_expires_at timestamptz)
language sql security invoker set search_path = private, api, pg_temp as $$ select * from private.submit_review_experience_v11(p_entry_handle,p_session_secret_hash,p_idempotency_hash,p_request_fingerprint,p_receipt_hash,p_ip_shop_hash,p_shop_rating,p_common_comment,p_guest_display_name,p_therapist_rating) $$;
create or replace function api.store_review_secret_replay(
  p_session_hash text,p_idempotency_hash text,p_ciphertext text,p_nonce text,p_key_version text
) returns void language sql security invoker set search_path=private,api,pg_temp as $$ select private.store_review_secret_replay(p_session_hash,p_idempotency_hash,p_ciphertext,p_nonce,p_key_version) $$;
create or replace function api.fetch_review_secret_replay(p_session_hash text,p_idempotency_hash text)
returns table(ciphertext text,nonce text,key_version text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.fetch_review_secret_replay(p_session_hash,p_idempotency_hash) $$;
notify pgrst,'reload schema';
