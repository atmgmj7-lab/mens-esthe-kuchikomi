import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Keep the adapter's dummy cache backends for offline preparation. Adding a
// shared Cloudflare cache binding requires a separate data-cache decision and
// must not broaden the existing private/no-store surfaces.
export default defineCloudflareConfig();
