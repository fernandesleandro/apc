/**
 * Fetch e extração de conteúdo textual dos manuais portobsb.
 */
const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'strong', 'b', 'em', 'i',
  'br', 'blockquote', 'hr', 'sup', 'sub', 'section'
]);

function slugifyManualSlug(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'capitulo';
}

function chapterSlugFromHref(href, title) {
  try {
    const url = new URL(href);
    const manualMatch = url.pathname.match(/\/manual\/[^/]+\/(.+)/i);
    if (manualMatch) {
      const pathSlug = slugifyManualSlug(manualMatch[1].replace(/\.[^.]+$/i, ''));
      if (pathSlug && pathSlug.length > 2 && !['htm', 'html', 'index', 'menu', 'inicio'].includes(pathSlug)) {
        return pathSlug.slice(0, 120);
      }
    }
  } catch {
    // ignora URL inválida
  }

  const file = String(href || '').split('/').pop().replace(/\.[^.]+$/i, '');
  const fromFile = slugifyManualSlug(file);
  if (fromFile && !['htm', 'html', 'index', 'menu', 'inicio'].includes(fromFile)) return fromFile;
  return slugifyManualSlug(title) || slugifyManualSlug(href);
}

function decodeContentEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const entities = {
        aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä',
        eacute: 'é', ecirc: 'ê', iacute: 'í', oacute: 'ó', ocirc: 'ô',
        otilde: 'õ', ouml: 'ö', uacute: 'ú', uuml: 'ü', ccedil: 'ç',
        Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
        Ccedil: 'Ç', Atilde: 'Ã', Otilde: 'Õ', Ntilde: 'Ñ', nbsp: ' ', amp: '&',
      };
      return entities[name] || match;
    });
}

function detectCharset(htmlHead) {
  const match = String(htmlHead).match(/charset\s*=\s*["']?([^"'\s>;]+)/i);
  if (!match) return 'utf-8';
  const charset = match[1].toLowerCase();
  if (charset === 'iso-8859-1' || charset === 'windows-1252' || charset === 'latin1') return 'latin1';
  return charset;
}

function decodeBuffer(buffer, htmlHead) {
  const charset = detectCharset(htmlHead);
  try {
    return new TextDecoder(charset === 'latin1' ? 'latin1' : charset).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

async function fetchManualHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AP-Construcoes-Manual/1.0' },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const head = new TextDecoder('latin1').decode(buffer.slice(0, 4096));
  return decodeBuffer(buffer, head);
}

function isFramesetPage(html) {
  return /<frameset\b/i.test(html);
}

function extractFrameSources(html, pageUrl) {
  const frames = [];
  const re = /<frame\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      frames.push(new URL(match[1], pageUrl).href);
    } catch {
      // ignora URL inválida
    }
  }
  return frames;
}

function resolveManualUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href.replace(/%5F/gi, '_');
  } catch {
    return '';
  }
}

function extractPdfListingHtml(html, pageUrl) {
  const found = new Map();
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = re.exec(html)) !== null) {
    const href = resolveManualUrl(match[1], pageUrl);
    const text = decodeContentEntities(String(match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (!href || !/\.pdf($|\?)/i.test(href)) continue;
    if (/index\.(php|html?)/i.test(href)) continue;

    const title = text.replace(/\.pdf$/i, '').trim() || href.split('/').pop().replace(/\.pdf$/i, '');
    if (!title || /^voltar$/i.test(title)) continue;

    found.set(href.toLowerCase(), { title, href });
  }

  if (!found.size) return null;

  const items = [...found.values()].sort((a, b) =>
    a.title.localeCompare(b.title, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );

  const listItems = items.map((item) => (
    `<li><a href="${item.href}" class="manual-pdf-link" target="_blank" rel="noopener noreferrer">` +
    `<span class="manual-pdf-link-icon" aria-hidden="true">PDF</span>` +
    `<span class="manual-pdf-link-text">${item.title}</span>` +
    `</a></li>`
  )).join('\n');

  return (
    `<section class="manual-pdf-list">` +
    `<p class="manual-pdf-list-intro">${items.length} arquivo(s) PDF disponível(is) para download ou visualização.</p>` +
    `<ul class="manual-pdf-items">${listItems}</ul>` +
    `</section>`
  );
}

function extractPageHeading(html) {
  const match = String(html || '').match(/class=["'][^"']*style20[^"']*["'][^>]*>([\s\S]*?)<\//i)
    || String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return '';
  return decodeContentEntities(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractContentBlock(html) {
  const patterns = [
    /<div[^>]*class=["'][^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*)/i,
    /<div[^>]*class=["'][^"']*col-md-9[^"']*["'][^>]*>([\s\S]*)/i,
    /<body[^>]*>([\s\S]*?)<\/body>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    let block = match[1];
    block = block.replace(/<div[^>]*class=["'][^"']*\bnuvens\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
    block = block.replace(/<center>[\s\S]*?<\/center>/gi, '');
    block = block.replace(/<ul[^>]*class=["'][^"']*nav[^"']*["'][\s\S]*?<\/ul>/gi, '');
    if (block.replace(/<[^>]+>/g, '').trim().length > 40) return block;
  }
  return '';
}

function stripRawHtml(html, { keepTables = false } = {}) {
  let result = String(html || '');
  result = result.replace(/<script[\s\S]*?<\/script>/gi, '');
  result = result.replace(/<style[\s\S]*?<\/style>/gi, '');
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  result = result.replace(/<img\b[^>]*>/gi, '');
  result = result.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
  result = result.replace(/<object\b[\s\S]*?<\/object>/gi, '');
  result = result.replace(/<embed\b[^>]*>/gi, '');
  result = result.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  result = result.replace(/\s(bgcolor|style|class|width|height|cellpadding|cellspacing|align|border|valign|colspan|rowspan|id|name)=["'][^"']*["']/gi, '');
  result = result.replace(/<(div|span)\b[^>]*>/gi, '');
  result = result.replace(/<\/(div|span)>/gi, '');

  const tableTags = new Set(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
  result = result.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (tag, name) => {
    const lower = name.toLowerCase();
    const closing = tag.startsWith('</');
    if (keepTables && tableTags.has(lower)) return closing ? `</${lower}>` : `<${lower}>`;
    if (tableTags.has(lower)) return '';
    if (lower === 'section' && !closing) return '<section class="manual-block">';
    if (!ALLOWED_TAGS.has(lower)) return '';
    return closing ? `</${lower}>` : `<${lower}>`;
  });

  return result;
}

function stripInnerText(html) {
  return decodeContentEntities(String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function cellsFromRow(rowHtml) {
  const cells = [];
  const re = /<t[dh]>([\s\S]*?)<\/t[dh]>/gi;
  let match;
  while ((match = re.exec(rowHtml)) !== null) cells.push(match[1].trim());
  return cells;
}

function rowsFromTable(tableHtml) {
  const rows = [];
  const re = /<tr>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = re.exec(tableHtml)) !== null) rows.push(match[1]);
  return rows;
}

function flattenTablesToReadableHtml(html) {
  let result = String(html || '');
  let previous = '';

  while (previous !== result) {
    previous = result;
    result = result.replace(/<table>([\s\S]*?)<\/table>/gi, (_, tableInner) => {
      const chunks = [];

      for (const rowHtml of rowsFromTable(tableInner)) {
        const cells = cellsFromRow(rowHtml);
        if (!cells.length) continue;

        if (cells.some((cell) => /<table/i.test(cell))) {
          chunks.push(flattenTablesToReadableHtml(cells.join('')));
          continue;
        }

        if (cells.length === 1) {
          const cell = cells[0];
          if (/^<h[1-6]/i.test(cell)) {
            chunks.push(cell);
          } else {
            const text = stripInnerText(cell);
            if (text && !/^voltar$/i.test(text)) {
              if (cell.includes('<p') || cell.includes('<ul') || cell.includes('<ol')) chunks.push(cell);
              else chunks.push(`<h3>${text}</h3>`);
            }
          }
          continue;
        }

        const label = stripInnerText(cells[0]);
        const body = flattenTablesToReadableHtml(cells.slice(1).join(''));
        if (label && body) {
          chunks.push(`<section class="manual-block"><h4>${label}</h4>${body}</section>`);
        } else if (body) {
          chunks.push(body);
        } else if (label && !/^voltar$/i.test(label)) {
          chunks.push(`<p><strong>${label}</strong></p>`);
        }
      }

      return chunks.join('\n');
    });
  }

  return result
    .replace(/<\/?(table|thead|tbody|tr|th|td)>/gi, '')
    .replace(/<\/section>\s*<section class="manual-block">/gi, '');
}

function normalizeWhitespace(html) {
  return String(html || '')
    .replace(/\u00a0/g, ' ')
    .replace(/(<\/(p|h[1-6]|li|section)>)\s*(?=<)/gi, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/>\s*Voltar\s*$/i, '>')
    .replace(/(<\/[^>]+>)\s*Voltar\s*(<)/gi, '$1$2')
    .trim();
}

function formatManualHtml(html) {
  const stripped = stripRawHtml(html, { keepTables: true });
  const flattened = flattenTablesToReadableHtml(stripped);
  const cleaned = stripRawHtml(flattened);
  const normalized = normalizeWhitespace(cleaned);
  return decodeContentEntities(normalized);
}

function extractTextContentFromHtml(html, pageUrl) {
  if (isFramesetPage(html)) {
    const frames = extractFrameSources(html, pageUrl);
    const contentFrame = frames.find((src) => !/\/menu\.htm/i.test(src) && !/index\.htm/i.test(src));
    if (contentFrame) {
      return { needsFetch: true, nextUrl: contentFrame };
    }
  }

  const pdfListing = extractPdfListingHtml(html, pageUrl);
  if (pdfListing) {
    const heading = extractPageHeading(html);
    const htmlOut = heading
      ? `<h3>${heading}</h3>${pdfListing}`
      : pdfListing;
    return { html: htmlOut, plainText: heading || 'Lista de PDFs' };
  }

  const block = extractContentBlock(html);
  if (!block) return { html: '', plainText: '' };

  const cleaned = formatManualHtml(block);
  const plainText = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { html: cleaned, plainText };
}

async function fetchChapterContent(sourceHref) {
  let url = sourceHref;
  let html = await fetchManualHtml(url);
  let extracted = extractTextContentFromHtml(html, url);

  if (extracted.needsFetch && extracted.nextUrl) {
    url = extracted.nextUrl;
    html = await fetchManualHtml(url);
    extracted = extractTextContentFromHtml(html, url);
  }

  if (!extracted.html && !extracted.plainText) {
    throw new Error('Conteúdo não encontrado na página');
  }

  return {
    html: extracted.html,
    plainText: extracted.plainText,
    fetchedFrom: url
  };
}

function buildManualPath(sectionSlug, docType) {
  return `/acesso-cliente/manual-proprietario/${sectionSlug}/${docType}`;
}

function buildChapterPath(sectionSlug, docType, chapterSlug) {
  return `${buildManualPath(sectionSlug, docType)}#${chapterSlug}`;
}

function buildCombinedManualHtml(chapters) {
  return (chapters || [])
    .filter((chapter) => chapter?.html)
    .map((chapter) => (
      `<details class="manual-chapter-panel" id="${chapter.slug}" name="manual-topico">` +
      `<summary class="manual-chapter-summary">${chapter.title}</summary>` +
      `<div class="manual-chapter-body">${chapter.html}</div>` +
      `</details>`
    ))
    .join('\n');
}

module.exports = {
  slugifyManualSlug,
  chapterSlugFromHref,
  decodeHtmlEntities: decodeContentEntities,
  decodeContentEntities,
  fetchManualHtml,
  fetchChapterContent,
  extractTextContentFromHtml,
  formatManualHtml,
  buildManualPath,
  buildChapterPath,
  buildCombinedManualHtml
};
