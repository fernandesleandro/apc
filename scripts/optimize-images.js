/**
 * Converte JPG/PNG em public/images para WebP otimizado e atualiza referências no MongoDB.
 *
 * Uso:
 *   node scripts/optimize-images.js --dry-run
 *   node scripts/optimize-images.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.join(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const DB_JSON = path.join(ROOT, 'data', 'database.json');

const SKIP_EXT = new Set(['.webp', '.svg', '.gif']);
const MAX_WIDTH = {
  banners: 1920,
  gallery: 1400,
  planta: 1800
};

function maxWidthFor(relPath) {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('/banners/')) return MAX_WIDTH.banners;
  if (normalized.includes('/planta/')) return MAX_WIDTH.planta;
  if (normalized.includes('/gallery/')) return MAX_WIDTH.gallery;
  return MAX_WIDTH.gallery;
}

function toPublicPath(absPath) {
  const rel = path.relative(path.join(ROOT, 'public'), absPath).replace(/\\/g, '/');
  return `/${rel}`;
}

function walkImages(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkImages(full));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (SKIP_EXT.has(ext)) continue;
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
    results.push(full);
  }
  return results;
}

function replacePathsInValue(value, mappings) {
  if (typeof value === 'string') {
    let next = value;
    for (const [from, to] of mappings) {
      if (next.includes(from)) next = next.split(from).join(to);
    }
    return next;
  }
  if (Array.isArray(value)) return value.map((item) => replacePathsInValue(item, mappings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = replacePathsInValue(val, mappings);
    }
    return out;
  }
  return value;
}

async function optimizeFile(absPath) {
  const rel = path.relative(IMAGES_DIR, absPath);
  const webpAbs = absPath.replace(/\.(jpe?g|png)$/i, '.webp');
  const before = fs.statSync(absPath).size;
  const maxWidth = maxWidthFor(rel);

  if (DRY_RUN) {
    return {
      from: toPublicPath(absPath),
      to: toPublicPath(webpAbs),
      before,
      after: null,
      saved: 0
    };
  }

  await sharp(absPath)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(webpAbs);

  const after = fs.statSync(webpAbs).size;
  fs.unlinkSync(absPath);

  return {
    from: toPublicPath(absPath),
    to: toPublicPath(webpAbs),
    before,
    after,
    saved: before - after
  };
}

async function updateMongo(mappings) {
  const uri = process.env.MONGODB_URI;
  if (!uri || !mappings.length) return;

  await mongoose.connect(uri);
  const collections = [
    mongoose.model('Project', new mongoose.Schema({}, { strict: false })),
    mongoose.model('Page', new mongoose.Schema({}, { strict: false })),
    mongoose.model('PlantaGallery', new mongoose.Schema({}, { strict: false })),
    mongoose.model('ProjectGallery', new mongoose.Schema({}, { strict: false }))
  ];

  for (const Model of collections) {
    const docs = await Model.find().lean();
    for (const doc of docs) {
      const updated = replacePathsInValue(doc, mappings);
      if (JSON.stringify(updated) !== JSON.stringify(doc)) {
        const { _id, ...rest } = updated;
        await Model.updateOne({ _id: doc._id }, { $set: rest });
      }
    }
  }

  await mongoose.disconnect();
}

function updateDatabaseJson(mappings) {
  if (!fs.existsSync(DB_JSON) || !mappings.length) return;
  let raw = fs.readFileSync(DB_JSON, 'utf8');
  const before = raw.length;
  for (const [from, to] of mappings) {
    raw = raw.split(from).join(to);
  }
  if (raw.length !== before && !DRY_RUN) {
    fs.writeFileSync(DB_JSON, raw, 'utf8');
  }
}

function updateStyleCss(mappings) {
  const cssPath = path.join(ROOT, 'public', 'style.css');
  let css = fs.readFileSync(cssPath, 'utf8');
  let changed = false;
  for (const [from, to] of mappings) {
    if (css.includes(from)) {
      css = css.split(from).join(to);
      changed = true;
    }
  }
  if (changed && !DRY_RUN) fs.writeFileSync(cssPath, css, 'utf8');
}

function updateServerConstants(mappings) {
  const serverPath = path.join(ROOT, 'server.js');
  let source = fs.readFileSync(serverPath, 'utf8');
  let changed = false;
  for (const [from, to] of mappings) {
    if (source.includes(from)) {
      source = source.split(from).join(to);
      changed = true;
    }
  }
  if (changed && !DRY_RUN) fs.writeFileSync(serverPath, source, 'utf8');
}

async function main() {
  const files = walkImages(IMAGES_DIR);
  if (!files.length) {
    console.log('Nenhuma imagem JPG/PNG encontrada em public/images.');
    return;
  }

  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Otimizando ${files.length} imagem(ns)...`);
  const results = [];
  for (const file of files) {
    const result = await optimizeFile(file);
    results.push(result);
    const saved = result.saved || 0;
    console.log(
      `  ${result.from} -> ${result.to}` +
      (DRY_RUN ? '' : ` (${Math.round(result.before / 1024)}KB -> ${Math.round(result.after / 1024)}KB, -${Math.round(saved / 1024)}KB)`)
    );
  }

  const mappings = results.map((r) => [r.from, r.to]);
  const totalSaved = results.reduce((sum, r) => sum + (r.saved || 0), 0);

  if (!DRY_RUN) {
    await updateMongo(mappings);
    updateDatabaseJson(mappings);
    updateStyleCss(mappings);
    updateServerConstants(mappings);
  }

  console.log(`\nConcluído. Economia estimada: ${Math.round(totalSaved / 1024)} KB`);
  if (DRY_RUN) console.log('Execute sem --dry-run para aplicar.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
