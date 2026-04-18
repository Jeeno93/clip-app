export interface LinkPreview {
  title: string;
  description: string | null;
  imageUrl: string | null;
  url: string;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
}

function extractMeta(html: string, property: string): string | null {
  // Match <meta property="og:foo" content="..."> or with name=, or content first
  const patterns = [
    new RegExp(
      `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeHtmlEntities(m[1]).trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m && m[1]) return decodeHtmlEntities(m[1]).trim();
  return null;
}

function resolveImageUrl(imageUrl: string, pageUrl: string): string {
  try {
    if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    if (imageUrl.startsWith("//")) {
      const proto = pageUrl.startsWith("https") ? "https:" : "http:";
      return proto + imageUrl;
    }
    const u = new URL(imageUrl, pageUrl);
    return u.toString();
  } catch {
    return imageUrl;
  }
}

export async function fetchLinkPreview(
  url: string
): Promise<LinkPreview | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ClipBot/1.0; +https://clip.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    const ogTitle = extractMeta(html, "og:title");
    const ogDescription = extractMeta(html, "og:description");
    const ogImage = extractMeta(html, "og:image");
    const fallbackTitle = ogTitle ?? extractTitle(html);

    if (!fallbackTitle) return null;

    return {
      title: fallbackTitle,
      description: ogDescription,
      imageUrl: ogImage ? resolveImageUrl(ogImage, url) : null,
      url,
    };
  } catch {
    return null;
  }
}

export function isUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/i.test(trimmed);
}
