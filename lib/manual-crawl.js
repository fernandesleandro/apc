/**
 * Crawl de links de capítulos nos manuais portobsb (usado pelo admin e scripts).
 */
const SKIP_HREF = /^(#|javascript:|mailto:|$)/i;
const SKIP_TEXT = /^(voltar|back|index\.htm?|manual_proprietario|manual_areascomuns)$/i;

function decodeHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function inferDocType(title, href) {
  const text = String(title || '').toLowerCase();
  if (/habite|habitise/.test(text) || /\.pdf($|\?)/i.test(href || '')) return 'habite-se';
  if (/desenhos/.test(text)) return 'desenhos';
  if (/propriet/.test(text)) return 'proprietario';
  if (/áreas comuns|areas comuns/.test(text)) return 'areas-comuns';
  return 'documento';
}

function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href.replace(/%5F/gi, '_');
  } catch {
    return '';
  }
}

function getManualRoot(href) {
  const match = String(href).match(/^(https?:\/\/[^/]+\/manual\/[^/]+)/i);
  return match ? match[1].toLowerCase() : '';
}

function normalizeHref(href) {
  return String(href || '').split('#')[0].trim();
}

function isSameManual(href, root) {
  const normalized = normalizeHref(href).toLowerCase();
  return normalized.startsWith(root + '/') || normalized === root;
}

function shouldSkipLink(href, text, pageUrl) {
  if (!href || SKIP_HREF.test(href)) return true;
  const clean = decodeHtml(text);
  if (!clean || clean.length < 2) return true;
  if (SKIP_TEXT.test(clean.replace(/\s+/g, ''))) return true;
  if (/^img\b|images\//i.test(href)) return true;
  const resolved = normalizeHref(href);
  if (resolved === normalizeHref(pageUrl)) return true;
  if (/index\.html?$/i.test(resolved) && /voltar/i.test(clean)) return true;
  return false;
}

function getLinkTitle(fullTag, innerHtml, href) {
  let text = decodeHtml(innerHtml);
  if (!text || text.length < 2) {
    const altMatch = fullTag.match(/alt=["']([^"']+)["']/i);
    if (altMatch) text = decodeHtml(altMatch[1]);
  }
  if (!text || text.length < 2) {
    const file = String(href || '').split('/').pop().replace(/\.[^.]+$/, '');
    text = decodeHtml(file.replace(/[_-]+/g, ' ').trim());
  }
  return text;
}

function extractFrameSources(html, pageUrl) {
  const frames = [];
  const re = /<frame\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    frames.push(resolveUrl(match[1], pageUrl));
  }
  return frames;
}

function extractLinksFromHtml(html, pageUrl, manualRoot) {
  const found = new Map();
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const fullTag = match[0];
    const href = resolveUrl(match[1], pageUrl);
    const text = getLinkTitle(fullTag, match[2], href);
    if (shouldSkipLink(href, text, pageUrl)) continue;
    if (!isSameManual(href, manualRoot)) continue;
    if (/\.(jpg|jpeg|png|gif|css|js)($|\?)/i.test(href)) continue;

    const key = normalizeHref(href).toLowerCase();
    if (!found.has(key) || (text.length > (found.get(key).title || '').length)) {
      found.set(key, { title: text, href: normalizeHref(href) });
    }
  }
  return found;
}

function mergeLinkMaps(...maps) {
  const found = new Map();
  for (const map of maps) {
    for (const [key, link] of map) {
      if (!found.has(key) || (link.title.length > (found.get(key).title || '').length)) {
        found.set(key, link);
      }
    }
  }
  return found;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AP-Construcoes-Manual-Crawler/1.0' },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function collectManualLinks(pageUrl, manualRoot) {
  const html = await fetchHtml(pageUrl);
  let found = extractLinksFromHtml(html, pageUrl, manualRoot);

  const frameUrls = extractFrameSources(html, pageUrl);
  for (const frameUrl of frameUrls) {
    try {
      const frameHtml = await fetchHtml(frameUrl);
      found = mergeLinkMaps(found, extractLinksFromHtml(frameHtml, frameUrl, manualRoot));
    } catch (error) {
      console.warn(`[MANUAL-CRAWL] frame ${frameUrl}: ${error.message}`);
    }
  }

  if (found.size === 0 && manualRoot) {
    for (const menuPath of ['/menu.htm', '/index.htm', '/manual_proprietario/menu.htm']) {
      try {
        const menuHtml = await fetchHtml(manualRoot + menuPath);
        found = mergeLinkMaps(found, extractLinksFromHtml(menuHtml, manualRoot + menuPath, manualRoot));
        if (found.size > 0) break;
      } catch {
        // menu opcional
      }
    }
  }

  return [...found.values()];
}

async function crawlDocumentChildren(doc) {
  const href = doc.href;
  if (!href || /\.pdf($|\?)/i.test(href)) {
    return [];
  }

  const manualRoot = getManualRoot(href);
  if (!manualRoot) {
    return [];
  }

  const links = await collectManualLinks(href, manualRoot);
  return links
    .filter((link) => normalizeHref(link.href).toLowerCase() !== normalizeHref(href).toLowerCase())
    .map((link) => ({ title: link.title, href: link.href }))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}

module.exports = {
  crawlDocumentChildren,
  inferDocType,
  normalizeHref
};
