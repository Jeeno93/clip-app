export interface LinkPreview {
  title: string;
  description: string | null;
  imageUrl: string | null;
  url: string;
  fullText?: string;
}

// Maximum length of the extracted article body we keep in storage. The
// per-provider truncation in summarize.ts will cut this further at AI call
// time, but we keep enough text on disk so different providers can each take
// what they're able to handle.
const MAX_FULL_TEXT = 50000;

const HTTP_TIMEOUT_MS = 10000;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&hellip;/g, "…")
    .replace(/&middot;/g, "·")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    // &amp; must be last — otherwise we re-decode entities inside attribute
    // values that themselves contained encoded ampersands.
    .replace(/&amp;/g, "&");
}

function extractMeta(html: string, property: string): string | null {
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

/**
 * Find the substring of `html` covering a balanced <tag>…</tag> block whose
 * opening tag matches `attrPredicate`. Walks the tags forward counting
 * nesting so it correctly handles inner <div>s — a non-greedy regex would
 * otherwise stop at the first `</div>` and return only a fragment of the
 * article body.
 *
 * Returns null if no matching balanced block is found.
 */
function findBalancedBlock(
  html: string,
  tagName: string,
  attrPredicate: (openTag: string) => boolean
): string | null {
  const tagRe = new RegExp(`<\\s*\\/?${tagName}\\b[^>]*>`, "gi");
  let candidateStart = -1;
  let depth = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    const isClose = /^<\s*\//.test(tag);
    const isSelfClosing = /\/\s*>$/.test(tag);

    if (!isClose) {
      if (candidateStart === -1 && attrPredicate(tag)) {
        candidateStart = m.index;
        depth = isSelfClosing ? 0 : 1;
        if (depth === 0) {
          return html.slice(candidateStart, m.index + tag.length);
        }
      } else if (candidateStart !== -1 && !isSelfClosing) {
        depth += 1;
      }
    } else if (candidateStart !== -1) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(candidateStart, m.index + tag.length);
      }
    }
  }
  return null;
}

/**
 * Try to find the main article container in the cleaned HTML by checking,
 * in order: Habr-specific class names, generic article containers, then
 * <article>, then <main>. Returns the matched HTML chunk, or null.
 *
 * Uses a balanced-tag scanner for <div>-based selectors so nested <div>s
 * inside the article body don't get cut off.
 */
function findMainContent(clean: string): string | null {
  const classMatchers: Array<(openTag: string) => boolean> = [
    // Habr (current and legacy):
    (t) => /class=["'][^"']*\barticle-formatted-body\b/i.test(t),
    (t) => /class=["'][^"']*\btm-article-body\b/i.test(t),
    // Generic article containers:
    (t) =>
      /class=["'][^"']*(?:^|[\s"'])(?:article-body|article-content|post-body|entry-content)(?:$|[\s"'-])/i.test(
        t
      ),
  ];
  for (const predicate of classMatchers) {
    const block = findBalancedBlock(clean, "div", predicate);
    if (block) return block;
  }

  // <article> and <main> rarely nest themselves; the simple non-greedy
  // pattern is good enough and the balanced scanner would also work.
  const articleMatch = clean.match(/<article\b[\s\S]*?<\/article>/i);
  if (articleMatch) return articleMatch[0];

  const mainMatch = clean.match(/<main\b[\s\S]*?<\/main>/i);
  if (mainMatch) return mainMatch[0];

  return null;
}

/**
 * Strip elements (with their content) whose class= or id= attribute mentions
 * any of the given junk keywords (comments, sidebars, ads, share buttons,
 * etc.). Works for div / section / aside / span tags.
 */
function stripJunkByClassOrId(html: string): string {
  const junk =
    "comment|comments|sidebar|widget|banner|advertisement|ads|advert|social|share|sharing|related|recommend|subscribe|newsletter|popup|cookie|menu|breadcrumb";
  const tags = ["div", "section", "aside", "span"];
  let out = html;
  for (const tag of tags) {
    // Use look-behind / look-ahead to require a real attribute-value
    // boundary (quote, whitespace, dash or underscore) around the junk
    // token. This correctly catches `class="comments-section"` (token at
    // the start of the value, preceded by the opening quote) and rejects
    // unrelated names like `class="commentary"` or `class="menubar"`.
    const re = new RegExp(
      `<${tag}\\b[^>]*(?:class|id)=["'][^"']*?(?<=["'\\s_-])(?:${junk})(?=["'\\s_-])[^"']*?["'][\\s\\S]*?<\\/${tag}>`,
      "gi"
    );
    out = out.replace(re, " ");
  }
  return out;
}

async function extractFullText(html: string): Promise<string> {
  // 1. Strip whole structural / non-content elements with their bodies.
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // 2. Strip junk containers (comments, sidebars, ads, share, …).
  clean = stripJunkByClassOrId(clean);

  // 3. Pick the most likely "main content" container.
  const contentHtml = findMainContent(clean) ?? clean;

  // 4. Strip remaining tags and decode HTML entities.
  const text = decodeHtmlEntities(contentHtml.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, MAX_FULL_TEXT);
}

export async function fetchLinkPreview(
  url: string
): Promise<LinkPreview | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClipBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ru,en;q=0.9",
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

    const fullText = await extractFullText(html);

    return {
      title: fallbackTitle,
      description: ogDescription,
      imageUrl: ogImage ? resolveImageUrl(ogImage, url) : null,
      url,
      fullText,
    };
  } catch {
    return null;
  }
}

export function isUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/i.test(trimmed);
}
