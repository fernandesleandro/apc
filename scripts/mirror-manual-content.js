/**
 * Espelha conteúdo textual dos manuais no MongoDB e monta páginas únicas por manual.
 * Uso:
 *   node scripts/mirror-manual-content.js              # capítulos + documentos
 *   node scripts/mirror-manual-content.js --force      # re-baixa capítulos
 *   node scripts/mirror-manual-content.js --reformat   # reformata HTML existente (sem tabelas)
 *   node scripts/mirror-manual-content.js --documents-only
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  chapterSlugFromHref,
  decodeHtmlEntities,
  fetchChapterContent,
  formatManualHtml,
  buildCombinedManualHtml
} = require('../lib/manual-content');

function presentChapterHtml(html) {
  const raw = String(html || '');
  if (raw.includes('manual-pdf-list')) return raw;
  return formatManualHtml(raw);
}

function needsPdfDirectoryRefetch(chapter, sourceHref) {
  if (!/\/(desenhos|imagens)\//i.test(String(sourceHref || ''))) return false;
  if (!chapter?.html) return true;
  if (chapter.html.includes('manual-pdf-list')) return false;
  return true;
}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ap_construcoes';
const DB_FILE = path.join(__dirname, '..', 'data', 'database.json');
const FORCE = process.argv.includes('--force');
const REFORMAT = process.argv.includes('--reformat');
const DOCUMENTS_ONLY = process.argv.includes('--documents-only');
const DELAY_MS = 150;

const ManualChapterSchema = new mongoose.Schema({
  sectionSlug: { type: String, required: true },
  sectionTitle: { type: String, required: true },
  docType: { type: String, required: true },
  docTitle: { type: String, required: true },
  slug: { type: String, required: true },
  title: { type: String, required: true },
  html: { type: String, default: '' },
  plainText: { type: String, default: '' },
  sourceHref: { type: String, required: true, unique: true },
  syncedAt: { type: Date, default: Date.now }
});

ManualChapterSchema.index({ sectionSlug: 1, docType: 1, slug: 1 }, { unique: true });

const ManualDocumentSchema = new mongoose.Schema({
  sectionSlug: { type: String, required: true },
  docType: { type: String, required: true },
  sectionTitle: { type: String, required: true },
  docTitle: { type: String, required: true },
  html: { type: String, default: '' },
  chapters: [{ slug: String, title: String, html: String }],
  toc: [{ slug: String, title: String }],
  chapterCount: { type: Number, default: 0 },
  layout: { type: String, default: 'tree' },
  syncedAt: { type: Date, default: Date.now }
});

ManualDocumentSchema.index({ sectionSlug: 1, docType: 1 }, { unique: true });

const ManualChapter = mongoose.model('ManualChapter', ManualChapterSchema);
const ManualDocument = mongoose.model('ManualDocument', ManualDocumentSchema);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHtmlChapter(href) {
  return href && !/\.pdf($|\?)/i.test(href);
}

function slugifySection(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'empreendimento';
}

async function upsertChapter(meta, content) {
  await ManualChapter.findOneAndUpdate(
    { sourceHref: meta.sourceHref },
    {
      ...meta,
      html: content.html,
      plainText: content.plainText,
      syncedAt: new Date()
    },
    { upsert: true, new: true }
  );
}

async function reformatExistingChapters() {
  const chapters = await ManualChapter.find({ html: { $ne: '' } }).lean();
  let updated = 0;
  for (const chapter of chapters) {
    if (chapter.html.includes('manual-pdf-list')) continue;
    const formatted = formatManualHtml(chapter.html);
    if (formatted !== chapter.html) {
      await ManualChapter.updateOne({ _id: chapter._id }, { html: formatted, syncedAt: new Date() });
      updated += 1;
    }
  }
  console.log(`\nReformatados ${updated} capítulo(s).`);
}

async function refetchPdfDirectories(page) {
  console.log('\nAtualizando pastas de desenhos (PDFs)...');
  let updated = 0;

  for (const section of page.content.sections) {
    const sectionSlug = section.slug || slugifySection(section.title);

    for (const doc of section.documents || []) {
      const docType = doc.type || 'documento';

      for (const child of doc.children || []) {
        if (!/\/(desenhos|imagens)\//i.test(child.href || '')) continue;

        const existing = await ManualChapter.findOne({ sourceHref: child.href }).lean();
        if (existing?.html?.includes('manual-pdf-list') && !FORCE) continue;

        const title = decodeHtmlEntities(child.title);
        process.stdout.write(`  → ${title}... `);
        try {
          const content = await fetchChapterContent(child.href);
          if (!content.html.includes('manual-pdf-list')) {
            console.log('sem PDFs');
            continue;
          }
          await ManualChapter.findOneAndUpdate(
            { sourceHref: child.href },
            {
              sectionSlug,
              sectionTitle: section.title,
              docType,
              docTitle: decodeHtmlEntities(doc.title),
              slug: chapterSlugFromHref(child.href, title),
              title,
              sourceHref: child.href,
              html: content.html,
              plainText: content.plainText,
              syncedAt: new Date()
            },
            { upsert: true }
          );
          updated += 1;
          console.log('ok');
        } catch (error) {
          console.log(`erro (${error.message})`);
        }

        await sleep(100);
      }
    }
  }

  console.log(`${updated} pasta(s) de PDF atualizada(s).`);
}

async function buildManualDocuments(page) {
  console.log('\nMontando páginas únicas por manual...');
  let built = 0;

  for (const section of page.content.sections) {
    const sectionSlug = section.slug || slugifySection(section.title);

    for (const doc of section.documents || []) {
      const docType = doc.type || 'documento';
      if (/\.pdf($|\?)/i.test(doc.href || '')) continue;
      if (!(doc.children || []).length) continue;

      const allStored = await ManualChapter.find({
        sectionSlug,
        docType,
        html: { $ne: '' }
      }).lean();
      const byHref = new Map(allStored.map((chapter) => [chapter.sourceHref.toLowerCase(), chapter]));

      const chapters = [];
      for (const child of doc.children) {
        if (!isHtmlChapter(child.href)) continue;
        const title = decodeHtmlEntities(child.title);
        const slug = chapterSlugFromHref(child.href, title);
        let stored = byHref.get(String(child.href).toLowerCase());

        if (!stored?.html || needsPdfDirectoryRefetch(stored, child.href) || FORCE) {
          try {
            const content = await fetchChapterContent(child.href);
            stored = {
              slug,
              title,
              html: content.html,
              sourceHref: child.href
            };
            await ManualChapter.findOneAndUpdate(
              { sourceHref: child.href },
              {
                sectionSlug,
                sectionTitle: section.title,
                docType,
                docTitle: decodeHtmlEntities(doc.title),
                slug,
                title,
                sourceHref: child.href,
                html: content.html,
                plainText: content.plainText,
                syncedAt: new Date()
              },
              { upsert: true }
            );
          } catch {
            if (!stored?.html) continue;
          }
        }

        if (!stored?.html) continue;
        chapters.push({
          slug,
          title,
          html: presentChapterHtml(stored.html)
        });
      }

      const filtered = chapters.filter((ch) => !/^(inicio|index|voltar|manual do propri|manual das áreas|manual de áreas|manual das areas)$/i.test(ch.title.trim()));

      if (!filtered.length) continue;

      const html = buildCombinedManualHtml(filtered);
      const toc = filtered.map((chapter) => ({ slug: chapter.slug, title: chapter.title }));
      await ManualDocument.findOneAndUpdate(
        { sectionSlug, docType },
        {
          sectionSlug,
          docType,
          sectionTitle: section.title,
          docTitle: decodeHtmlEntities(doc.title),
          html,
          chapters: filtered,
          toc,
          chapterCount: filtered.length,
          layout: 'tree-v2',
          syncedAt: new Date()
        },
        { upsert: true, new: true }
      );

      built += 1;
      console.log(`  ✓ ${section.title} — ${doc.title} (${filtered.length} tópicos)`);
    }
  }

  console.log(`\n${built} manual(is) completo(s) no banco.`);
}

async function mirrorChapters(page) {
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const section of page.content.sections) {
    const sectionSlug = section.slug || slugifySection(section.title);
    console.log(`\n${section.title}`);

    for (const doc of section.documents || []) {
      const docType = doc.type || 'documento';
      if (/\.pdf($|\?)/i.test(doc.href || '')) continue;

      for (const child of doc.children || []) {
        if (!isHtmlChapter(child.href)) continue;

        const title = decodeHtmlEntities(child.title);
        const slug = chapterSlugFromHref(child.href, title);
        const sourceHref = child.href;

        if (!FORCE) {
          const existing = await ManualChapter.findOne({ sourceHref }).lean();
          if (existing?.html) {
            skipped += 1;
            process.stdout.write(`  ○ ${title}\n`);
            continue;
          }
        }

        process.stdout.write(`  → ${title}... `);
        try {
          const content = await fetchChapterContent(sourceHref);
          await upsertChapter({
            sectionSlug,
            sectionTitle: section.title,
            docType,
            docTitle: decodeHtmlEntities(doc.title),
            slug,
            title,
            sourceHref
          }, content);
          processed += 1;
          console.log('ok');
        } catch (error) {
          failed += 1;
          console.log(`erro (${error.message})`);
        }

        await sleep(DELAY_MS);
      }
    }
  }

  const total = await ManualChapter.countDocuments();
  console.log(`\nCapítulos: ${processed} atualizado(s), ${skipped} já existente(s), ${failed} falha(s). Total: ${total}.`);
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const page = data.pages.find((p) => p.id === 'manual-proprietario');
  if (!page?.content?.sections?.length) {
    console.error('Página manual-proprietario não encontrada.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Conectado ao MongoDB.');

  if (REFORMAT) {
    await reformatExistingChapters();
  }

  if (!DOCUMENTS_ONLY) {
    await mirrorChapters(page);
  }

  await refetchPdfDirectories(page);
  await buildManualDocuments(page);
  await mongoose.disconnect();
  console.log('\nConcluído.');
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
