# Public Web Site Health validation

`collectSiteHealth` is a server-only, bounded collector. It probes only the six fixed Eskomi paths under `https://mens-esthe-kuchikomi.com`, uses manual redirect handling and `no-store`, and does not accept an origin, URL, or path list from callers.

Each target retains its URL, HTTP status when received, UTC check timestamp, source state, and redacted warning code. A response is indexable only when the HTML document has a non-empty title, H1, and same-origin HTTPS canonical URL, and its robots tokens do not contain `noindex`.

Run the local synthetic validation without making a network request:

```bash
node --test headless/tests/analytics/site-health.test.mjs
```

The fixtures exercise normal/noindex metadata, mixed tag attributes and entities, missing and unsafe metadata, malformed/non-HTML input, redirects, HTTP and transport errors, body-read failures, timeout, fixed target boundaries, aggregation, and option validation.
