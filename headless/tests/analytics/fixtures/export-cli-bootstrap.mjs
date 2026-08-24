globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.hostname === "wordpress.test" && url.pathname.startsWith("/wp-json/")) {
    return Response.json([], {
      headers: { "X-WP-Total": "0", "X-WP-TotalPages": "1" },
    });
  }
  if (url.origin === "https://mens-esthe-kuchikomi.com") {
    const canonical = `${url.origin}${url.pathname}`;
    return new Response(
      `<!doctype html><html><head><title>Fixture</title><link rel="canonical" href="${canonical}"></head><body><h1>Fixture</h1></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  throw new Error("Synthetic export fixture rejected outbound request");
};
