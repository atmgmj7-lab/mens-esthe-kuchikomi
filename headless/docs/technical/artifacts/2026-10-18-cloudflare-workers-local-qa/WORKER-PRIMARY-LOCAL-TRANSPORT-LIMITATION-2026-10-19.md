# Workers primary local transport limitation

The Supabase-primary application contract and Node/Docker fixture adapter were
verified independently, but the current `wrangler dev --local` / workerd
fixture cannot perform the equivalent primary directory HTTP subrequest.

Evidence:

- The local PostgREST adapter returned the directory RPC successfully from a
  Node process in the same fixture container.
- The Workerd application returned the fail-closed primary-directory error for
  both the Node loopback adapter and the Docker service hostname.
- A direct internal IP is not a valid workaround. Cloudflare documents that
  Worker subrequests cannot fetch an IP address directly; they require a URL
  with a hostname. See the official known-issues page.

The runner now refuses this unsupported Workers-primary combination before it
can create a misleading 500 result. It does not relax Docker networking, use a
host network, expose a port, create DNS records, or contact production.

## Required supported path for full Worker HTTP QA

Provide a non-production HTTPS hostname resolvable by Workerd that routes only
to the isolated fixture adapter, then run the same primary HTTP assertions.
That requires an explicit environment/network approval because it changes the
current isolated-network boundary. It must not use the production Supabase
hostname or credentials.

## Current safe QA evidence

- Unit/contract test: `test:supabase-primary-public-directory`.
- Isolated PostgREST RPC coverage and primary public/draft fixtures.
- Ordinary Workers HTTP E2E for review public/private boundaries and operator
  unlisting, recorded separately.

No host restart is required or expected to resolve this runtime limitation.
