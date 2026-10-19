-- 20261019-publication-manifest-v3: no mutation is emitted from a proposed manifest.
begin;
do $$
begin
  if current_setting('eskomi.publication_manifest_approval', true) <> '20261019-publication-manifest-v3' then
    raise exception 'explicit approved manifest token is required before any apply artifact can run';
  end if;
  raise exception 'application intentionally disabled: create a separately reviewed approved manifest and component-specific apply artifact';
end
$$;
rollback;
