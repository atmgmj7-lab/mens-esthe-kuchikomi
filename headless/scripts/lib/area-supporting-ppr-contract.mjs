export function normalizeSupportingText(value) {
  return value.replace(/\s+/gu, " ").trim();
}

export function supportingHtmlText(value) {
  return normalizeSupportingText(
    value.replace(/<!--[^]*?-->/gu, "").replace(/<[^>]+>/gu, ""),
  );
}

export function rawSupportingDisclosureEvidence(html) {
  const marker = 'data-area-supporting-disclosure="true"';
  const markerIndex = html.indexOf(marker);
  const openIndex = html.lastIndexOf("<details", markerIndex);
  const closeIndex = html.indexOf("</details>", markerIndex);
  const disclosureHtml = openIndex >= 0 && closeIndex > openIndex
    ? html.slice(openIndex, closeIndex + "</details>".length)
    : "";
  const outsideHtml = disclosureHtml
    ? `${html.slice(0, openIndex)}${html.slice(closeIndex + "</details>".length)}`
    : html;
  const hiddenSegments = [...outsideHtml.matchAll(/<div hidden(?:="")? id="S:[^"]+">([^]*?)(?=<div hidden(?:="")? id="S:|$)/gu)]
    .map((match) => match[1]);
  const hiddenOpenMatches = openIndex >= 0
    ? [...html.slice(0, openIndex).matchAll(/<div hidden(?:="")? id="S:[^"]+">/gu)]
    : [];
  const lastHiddenOpen = hiddenOpenMatches.at(-1);
  let disclosureInsideHiddenSegment = false;
  if (lastHiddenOpen?.index !== undefined) {
    let depth = 0;
    for (const match of html.slice(lastHiddenOpen.index, openIndex).matchAll(/<\/?div\b[^>]*>/giu)) {
      if (/^<\/div/iu.test(match[0])) depth -= 1;
      else if (!/\/>$/u.test(match[0])) depth += 1;
      if (depth === 0) break;
    }
    disclosureInsideHiddenSegment = depth > 0;
  }
  return {
    disclosureHtml,
    disclosureText: supportingHtmlText(disclosureHtml),
    hiddenSegments,
    disclosureInsideHiddenSegment,
  };
}
