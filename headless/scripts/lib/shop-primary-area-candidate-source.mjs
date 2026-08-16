function headerValue(headers, name) {
  if (headers && typeof headers.get === "function") return headers.get(name);
  if (!headers || typeof headers !== "object") return null;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const value = key ? headers[key] : null;
  return Array.isArray(value) ? value[0] : value;
}

function requiredHeaderInteger(headers, name, url, minimum) {
  const raw = headerValue(headers, name);
  const value = raw === null || raw === undefined || raw === "" ? null : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`WordPress response is missing valid ${name}: ${url}`);
  }
  return value;
}

function parsePage(raw, url) {
  const status = Number(raw?.status);
  if (!Number.isSafeInteger(status) || status < 200 || status >= 300) {
    throw new Error(`WordPress public read failed: ${status || "unknown"} ${url}`);
  }
  let rows;
  try {
    rows = typeof raw.body === "string" ? JSON.parse(raw.body) : raw.body;
  } catch {
    throw new Error(`WordPress public read returned invalid JSON: ${url}`);
  }
  if (!Array.isArray(rows)) throw new Error(`WordPress public read returned a non-array payload: ${url}`);
  return {
    rows,
    total: requiredHeaderInteger(raw.headers, "x-wp-total", url, 0),
    totalPages: requiredHeaderInteger(raw.headers, "x-wp-totalpages", url, 1),
    responseDate: headerValue(raw.headers, "date"),
  };
}

export async function fetchAllWordPressPages({ apiBase, path, requestPage }) {
  if (typeof requestPage !== "function") throw new Error("WordPress public read requires a page requester");
  const rows = [];
  let expectedTotal = null;
  let expectedPages = null;
  let responseDate = null;
  let page = 1;

  do {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${apiBase}${path}${separator}page=${page}`;
    const result = parsePage(await requestPage(url), url);
    if (expectedTotal === null) {
      expectedTotal = result.total;
      expectedPages = result.totalPages;
      responseDate = result.responseDate;
    } else if (result.total !== expectedTotal || result.totalPages !== expectedPages) {
      throw new Error(`WordPress pagination changed during public read: ${url}`);
    }
    rows.push(...result.rows);
    page += 1;
  } while (page <= expectedPages);

  if (rows.length !== expectedTotal) {
    throw new Error(`WordPress public read was incomplete: expected ${expectedTotal}, received ${rows.length}`);
  }
  const ids = rows.map((row) => row?.id);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error(`WordPress public read returned an invalid ID: ${path}`);
  if (new Set(ids).size !== ids.length) throw new Error(`WordPress public read returned duplicate IDs: ${path}`);
  return { rows, total: expectedTotal, totalPages: expectedPages, responseDate };
}
