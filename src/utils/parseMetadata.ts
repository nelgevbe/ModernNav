export interface PageMetadata {
  title: string;
  description: string;
  icon: string;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function getMetaContent(html: string, property: string): string {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*['"]?${property}['"]?[^>]+content\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i"
  );
  const match = html.match(regex);
  if (match) return decodeEntities((match[1] ?? match[2] ?? "").trim());

  const reversed = new RegExp(
    `<meta[^>]+content\\s*=\\s*(?:"([^"]*)"|'([^']*)')[^>]+(?:property|name)\\s*=\\s*['"]?${property}['"]?`,
    "i"
  );
  const revMatch = html.match(reversed);
  return revMatch ? decodeEntities((revMatch[1] ?? revMatch[2] ?? "").trim()) : "";
}

function getTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].trim()) : "";
}

function matchLinkHref(html: string, relPattern: string): string {
  const regex = new RegExp(
    `<link[^>]+rel\\s*=\\s*["']${relPattern}["'][^>]+href\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i"
  );
  const match = html.match(regex);
  if (match) return (match[1] ?? match[2] ?? "").trim();

  const reversed = new RegExp(
    `<link[^>]+href\\s*=\\s*(?:"([^"]*)"|'([^']*)')[^>]+rel\\s*=\\s*["']${relPattern}["']`,
    "i"
  );
  const revMatch = html.match(reversed);
  return revMatch ? (revMatch[1] ?? revMatch[2] ?? "").trim() : "";
}

function getIcon(html: string, baseUrl: string): string {
  const candidates = [
    matchLinkHref(html, "apple-touch-icon"),
    matchLinkHref(html, "icon"),
    matchLinkHref(html, "shortcut\\s+icon"),
    getMetaContent(html, "og:image"),
  ];
  for (const raw of candidates) {
    if (raw) return resolveUrl(raw, baseUrl);
  }
  return "";
}

function resolveUrl(raw: string, baseUrl: string): string {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    return raw;
  }
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return raw;
  }
}

export function parseMetadata(html: string, baseUrl: string): PageMetadata {
  const title = getMetaContent(html, "og:title") || getTitle(html);
  const description = getMetaContent(html, "og:description") || getMetaContent(html, "description");
  const icon = getIcon(html, baseUrl);

  return { title, description, icon };
}
