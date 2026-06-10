/**
 * Migra imagens do site antigo portobsb.com.br para public/images/
 * e atualiza data/database.json com caminhos consistentes.
 *
 * Uso:
 *   node scripts/migrate-porto-images.js          # dry-run
 *   node scripts/migrate-porto-images.js --apply  # baixa, limpa e grava JSON
 *   node scripts/migrate-porto-images.js --apply --sync  # + MongoDB
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'data', 'database.json');
const GALLERY_ROOT = path.join(ROOT, 'public', 'images', 'gallery');
const PLANTA_ROOT = path.join(ROOT, 'public', 'images', 'planta');
const APPLY = process.argv.includes('--apply');
const SYNC_MONGO = process.argv.includes('--sync');
const PORTO_BASE = 'http://www.portobsb.com.br/institucional/App_Themes/Default/Imagens';

/** URLs confirmadas no site Porto (HTML + validação de conteúdo). */
const PORTO_MANIFEST = {
  monumental: {
    cover: { url: `${PORTO_BASE}/detalhe_imovel/foto_ficha.png`, file: 'ficha-tecnica.png', alt: 'Monumental Center' },
    gallery: [
      { url: `${PORTO_BASE}/detalhe_imovel/foto_ficha.png`, file: 'ficha-tecnica.png', alt: 'Monumental Center — apresentação' },
      { url: `${PORTO_BASE}/empreendimentos/foto_imovel_monumental.jpg`, file: 'listagem.jpg', alt: 'Monumental Center — Lago Norte' }
    ],
    plantas: [
      { url: `${PORTO_BASE}/detalhe_imovel/monumental/plantas/planta_quadrada.jpg`, file: 'planta-quadrada.jpg', alt: 'Planta quadrada', title: 'Planta Quadrada' },
      { url: `${PORTO_BASE}/detalhe_imovel/monumental/plantas/planta_retangular.jpg`, file: 'planta-retangular.jpg', alt: 'Planta retangular', title: 'Planta Retangular' }
    ]
  },
  cosmopolitan: {
    cover: { url: `${PORTO_BASE}/cosmo/fachada.png`, file: 'fachada.png', alt: 'Fachada Cosmopolitan' },
    gallery: [
      { url: `${PORTO_BASE}/cosmo/fachada.png`, file: 'fachada.png', alt: 'Fachada Cosmopolitan' }
    ],
    plantas: [],
    /** Arquivos locais já enviados (áreas comuns — não existem no Porto). */
    preserveGallery: [
      { from: /piscina.*\.jpg$/i, file: 'piscina.jpg', alt: 'Área de lazer — piscina' },
      { from: /gourmet.*\.jpg$/i, file: 'gourmet.jpg', alt: 'Área gourmet' },
      { from: /quadra.*\.jpg$/i, file: 'quadra.jpg', alt: 'Área esportiva' }
    ],
    preservePlanta: [
      { from: /^planta1\.png$/i, file: 'planta-tipo-1.png', alt: 'Planta tipo 1', title: 'Planta Tipo 1' }
    ]
  },
  'barao-maua': {
    cover: { file: 'fachada-externa.png', alt: 'Barão Mauá — SIG' },
    gallery: [
      { url: `${PORTO_BASE}/empreendimentos/foto_imovel_Barao.jpg`, file: 'listagem.jpg', alt: 'Barão Mauá — vista do empreendimento' }
    ],
    plantas: [],
    preserveGallery: [
      { from: /^aerea1\.png$/i, file: 'vista-aerea-1.png', alt: 'Vista aérea 1' },
      { from: /^aerea2\.png$/i, file: 'vista-aerea-2.png', alt: 'Vista aérea 2' },
      { from: /^externa\.png$/i, file: 'fachada-externa.png', alt: 'Fachada externa' },
      { from: /^externanoturna\.png$/i, file: 'fachada-noturna.png', alt: 'Fachada noturna' }
    ],
    preservePlanta: [
      { from: /^planta1\.png$/i, file: 'planta-nivel-1.png', alt: 'Planta comercial nível 1', title: 'Planta Comercial Nível 1' },
      { from: /^planta2\.png$/i, file: 'planta-implantacao.png', alt: 'Implantação geral', title: 'Implantação Geral' }
    ]
  },
  'barao-rio-branco': {
    cover: { url: `${PORTO_BASE}/home/foto_imovel_baraoriobranco.jpg`, file: 'capa.jpg', alt: 'Barão do Rio Branco — SIG' },
    gallery: [
      { url: `${PORTO_BASE}/home/foto_imovel_baraoriobranco.jpg`, file: 'capa.jpg', alt: 'Barão do Rio Branco — SIG' }
    ],
    plantas: []
  },
  'chateau-valois': {
    cover: { url: `${PORTO_BASE}/chateau_valois/foto_apresentacao_chateau_valois.jpg`, file: 'capa.jpg', alt: 'Chateau Valois — Águas Claras' },
    gallery: [
      { url: `${PORTO_BASE}/chateau_valois/foto_apresentacao_chateau_valois.jpg`, file: 'capa.jpg', alt: 'Chateau Valois — Águas Claras' },
      { url: `${PORTO_BASE}/empreendimentos/chateu.jpg`, file: 'listagem.jpg', alt: 'Chateau Valois — listagem' }
    ],
    plantas: []
  },
  metropolitan: {
    cover: { url: `${PORTO_BASE}/metropolitan/foto_apresentacao_metropolitan.jpg`, file: 'capa.jpg', alt: 'Metropolitan — Águas Claras' },
    gallery: [
      { url: `${PORTO_BASE}/metropolitan/foto_apresentacao_metropolitan.jpg`, file: 'capa.jpg', alt: 'Metropolitan — Águas Claras' },
      { url: `${PORTO_BASE}/empreendimentos/metro.jpg`, file: 'listagem.jpg', alt: 'Metropolitan — vista' }
    ],
    plantas: []
  },
  olympique: {
    cover: { url: `${PORTO_BASE}/detalhe_imovel/foto_ficha_olympique.png`, file: 'ficha-tecnica.png', alt: 'Olympique — Guará' },
    gallery: [
      { url: `${PORTO_BASE}/detalhe_imovel/foto_ficha_olympique.png`, file: 'ficha-tecnica.png', alt: 'Olympique — apresentação' }
    ],
    plantas: []
  }
};

const SKIP_DIRS = new Set(['teste', 'README.md']);

function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 30000, headers: { 'User-Agent': 'APC-Migrate/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(new URL(res.headers.location, url).href).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} para ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout: ${url}`)); });
  });
}

function isValidImage(buffer, contentType) {
  if (!buffer || buffer.length < 400) return false;
  if (contentType && contentType.startsWith('image/')) return true;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const isGif = buffer.slice(0, 3).toString() === 'GIF';
  return isJpeg || isPng || isGif;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function webPath(type, projectId, filename) {
  const folder = type === 'planta' ? 'planta' : 'gallery';
  return `/images/${folder}/${projectId}/${filename}`;
}

function hashBuffer(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => !f.startsWith('.') && f !== 'README.md');
}

function clearProjectDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of listFiles(dir)) {
    fs.unlinkSync(path.join(dir, f));
  }
}

function readPreserveLocalFiles(srcDir, rules) {
  const preserved = [];
  if (!fs.existsSync(srcDir)) return preserved;
  for (const rule of rules) {
    const match = listFiles(srcDir).find((f) => rule.from.test(f));
    if (!match) continue;
    preserved.push({
      buffer: fs.readFileSync(path.join(srcDir, match)),
      rule,
      original: match
    });
  }
  return preserved;
}

function writePreservedFiles(targetDir, preserved, type, projectId, results, usedHashes) {
  for (const { buffer, rule, original } of preserved) {
    const h = hashBuffer(buffer);
    if (usedHashes.has(h)) continue;
    usedHashes.add(h);
    results.push({
      type,
      projectId,
      file: rule.file,
      src: webPath(type, projectId, rule.file),
      alt: rule.alt,
      title: rule.title || '',
      source: `local:${original}`,
      bytes: buffer.length
    });
    if (APPLY) fs.writeFileSync(path.join(targetDir, rule.file), buffer);
  }
}

async function migrateProject(projectId, spec, report) {
  const galleryDir = path.join(GALLERY_ROOT, projectId);
  const plantaDir = path.join(PLANTA_ROOT, projectId);
  const galleryResults = [];
  const plantaResults = [];
  const usedHashes = new Set();

  const preservedGallery = readPreserveLocalFiles(galleryDir, spec.preserveGallery || []);
  const preservedPlanta = readPreserveLocalFiles(plantaDir, spec.preservePlanta || []);

  if (APPLY) {
    ensureDir(galleryDir);
    ensureDir(plantaDir);
    clearProjectDir(galleryDir);
    clearProjectDir(plantaDir);
  }

  for (const item of spec.gallery || []) {
    try {
      const { buffer, contentType } = await download(item.url);
      if (!isValidImage(buffer, contentType)) {
        report.warnings.push(`${projectId}: imagem inválida ${item.url}`);
        continue;
      }
      const h = hashBuffer(buffer);
      if (usedHashes.has(h)) continue;
      usedHashes.add(h);
      galleryResults.push({
        type: 'gallery',
        projectId,
        file: item.file,
        src: webPath('gallery', projectId, item.file),
        alt: item.alt,
        source: item.url,
        bytes: buffer.length
      });
      if (APPLY) fs.writeFileSync(path.join(galleryDir, item.file), buffer);
    } catch (e) {
      report.errors.push(`${projectId} gallery ${item.file}: ${e.message}`);
    }
  }

  for (const item of spec.plantas || []) {
    try {
      const { buffer, contentType } = await download(item.url);
      if (!isValidImage(buffer, contentType)) {
        report.warnings.push(`${projectId}: planta inválida ${item.url}`);
        continue;
      }
      const h = hashBuffer(buffer);
      if (usedHashes.has(h)) continue;
      usedHashes.add(h);
      plantaResults.push({
        type: 'planta',
        projectId,
        file: item.file,
        src: webPath('planta', projectId, item.file),
        alt: item.alt,
        title: item.title || '',
        source: item.url,
        bytes: buffer.length
      });
      if (APPLY) fs.writeFileSync(path.join(plantaDir, item.file), buffer);
    } catch (e) {
      report.errors.push(`${projectId} planta ${item.file}: ${e.message}`);
    }
  }

  writePreservedFiles(galleryDir, preservedGallery, 'gallery', projectId, galleryResults, usedHashes);
  writePreservedFiles(plantaDir, preservedPlanta, 'planta', projectId, plantaResults, usedHashes);

  const coverFile = spec.cover?.file;
  const coverEntry = galleryResults.find((g) => g.file === coverFile)
    || galleryResults.slice().sort((a, b) => b.bytes - a.bytes)[0]
    || galleryResults[0];

  return {
    projectId,
    cover: coverEntry?.src || '',
    gallery: galleryResults.map(({ src, alt }) => ({ src, alt })),
    plantas: plantaResults.map(({ src, alt, title }) => ({ src, alt, title }))
  };
}

function removeOrphans() {
  const validProjects = new Set(Object.keys(PORTO_MANIFEST));
  for (const root of [GALLERY_ROOT, PLANTA_ROOT]) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        if (entry.name === 'README.md' && APPLY) fs.unlinkSync(path.join(root, entry.name));
        continue;
      }
      if (SKIP_DIRS.has(entry.name) || !validProjects.has(entry.name)) {
        if (APPLY) fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
        console.log(`  removido: ${path.join(root, entry.name)}`);
      }
    }
  }
}

function buildDatabaseUpdates(results) {
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const byId = Object.fromEntries(results.map((r) => [r.projectId, r]));

  data.projectGalleries = data.projectGalleries || {};
  data.plantaGalleries = data.plantaGalleries || {};

  for (const [id, r] of Object.entries(byId)) {
    if (r.gallery.length) data.projectGalleries[id] = r.gallery;
    else delete data.projectGalleries[id];
    if (r.plantas.length) data.plantaGalleries[id] = r.plantas;
    else delete data.plantaGalleries[id];
  }

  const projectMeta = {
    monumental: { title: 'Monumental Center', description: 'Comercial multiusuário no Lago Norte — 198 salas, 2 lojas e 222 vagas.', badge: 'Lançamento', category: 'comercial' },
    cosmopolitan: { title: 'Cosmopolitan', description: 'Empreendimento misto em Águas Claras — apartamentos, lojas e salas comerciais.', category: 'misto' },
    'barao-maua': { title: 'Barão Mauá', description: '108 salas, 2 lojas, 2 salões e 376 vagas no SIG.', badge: 'Entregue', category: 'comercial' },
    'barao-rio-branco': { title: 'Barão do Rio Branco', description: 'Salas comerciais no SIG — empreendimento entregue.', badge: 'Entregue', category: 'comercial' },
    'chateau-valois': { title: 'Chateau Valois', description: 'Apartamentos de 2 e 3 quartos em Águas Claras — entregue.', badge: 'Entregue', category: 'residencial' },
    metropolitan: { title: 'Metropolitan', description: 'Apartamentos de 2 e 3 quartos em Águas Claras — entregue.', badge: 'Entregue', category: 'residencial' },
    olympique: { title: 'Olympique', description: 'Apartamentos de 2 e 3 quartos no Guará — entregue.', badge: 'Entregue', category: 'residencial' }
  };

  const existingIds = new Set((data.projects || []).map((p) => p.id));
  data.projects = data.projects || [];

  for (const [id, meta] of Object.entries(projectMeta)) {
    const r = byId[id];
    if (!r) continue;
    const base = {
      id,
      title: meta.title,
      description: meta.description,
      image: r.cover,
      href: `/obras/${id}`,
      category: meta.category
    };
    if (meta.badge) base.badge = meta.badge;

    const idx = data.projects.findIndex((p) => p.id === id);
    if (idx >= 0) data.projects[idx] = { ...data.projects[idx], ...base };
    else data.projects.push(base);
  }

  for (const page of data.pages || []) {
    const r = byId[page.id];
    if (!r || !r.cover) continue;
    page.hero = page.hero || {};
    page.hero.image = r.cover;
    if (page.id === 'cosmopolitan' && page.hero.image.includes('unsplash')) {
      page.hero.image = r.cover;
    }
  }

  return data;
}

function addDeliveredPages(data, resultsById) {
  const delivered = [
    {
      id: 'barao-rio-branco',
      title: 'Barão do Rio Branco | AP Construções',
      description: 'Salas comerciais no SIG — SIG Quadra 01, lotes 495, 505 e 515. Empreendimento entregue.',
      hero: { title: 'Barão do Rio Branco', subtitle: 'Salas comerciais no SIG — Brasília/DF' },
      details: {
        detailTag: 'Empreendimento Entregue',
        summaryItems: [
          { label: 'Endereço', value: 'SIG Quadra 01, lotes 495, 505 e 515 — Brasília/DF' },
          { label: 'Tipologia', value: 'Salas comerciais' }
        ]
      }
    },
    {
      id: 'chateau-valois',
      title: 'Chateau Valois | AP Construções',
      description: 'Apartamentos de 2 e 3 quartos em Águas Claras. Empreendimento entregue.',
      hero: { title: 'Chateau Valois', subtitle: 'Residencial em Águas Claras — Brasília/DF' },
      details: {
        detailTag: 'Empreendimento Entregue',
        summaryItems: [
          { label: 'Endereço', value: 'Rua 36 Sul, Lote 17 — Águas Claras/DF' },
          { label: 'Tipologia', value: 'Apartamentos de 2 e 3 quartos' }
        ]
      }
    },
    {
      id: 'metropolitan',
      title: 'Metropolitan | AP Construções',
      description: 'Apartamentos de 2 e 3 quartos em Águas Claras. Empreendimento entregue.',
      hero: { title: 'Metropolitan', subtitle: 'Residencial em Águas Claras — Brasília/DF' },
      details: {
        detailTag: 'Empreendimento Entregue',
        summaryItems: [
          { label: 'Endereço', value: 'Rua das Pitangueiras, Lote 10 — Águas Claras/DF' },
          { label: 'Tipologia', value: 'Apartamentos de 2 e 3 quartos' }
        ]
      }
    },
    {
      id: 'olympique',
      title: 'Olympique | AP Construções',
      description: 'Apartamentos de 2 e 3 quartos no Guará. Empreendimento entregue.',
      hero: { title: 'Olympique', subtitle: 'Residencial no Guará — Brasília/DF' },
      details: {
        detailTag: 'Empreendimento Entregue',
        summaryItems: [
          { label: 'Endereço', value: 'Área Especial 04, Lotes G/H — Av. Contorno, Guará/DF' },
          { label: 'Tipologia', value: 'Apartamentos de 2 e 3 quartos' }
        ]
      }
    }
  ];

  const pageIds = new Set((data.pages || []).map((p) => p.id));
  for (const p of delivered) {
    const cover = resultsById[p.id]?.cover;
    if (cover) p.hero.image = cover;
    if (!pageIds.has(p.id)) data.pages.push(p);
    else {
      const existing = data.pages.find((x) => x.id === p.id);
      if (existing && cover) {
        existing.hero = { ...existing.hero, image: cover };
      }
    }
  }

  const barao = data.pages.find((p) => p.id === 'barao-maua');
  if (barao?.details) barao.details.detailTag = 'Empreendimento Entregue';

  const cosmo = data.pages.find((p) => p.id === 'cosmopolitan');
  if (cosmo) {
    cosmo.description = 'Empreendimento misto em Águas Claras com apartamentos, lojas e salas comerciais. Habite-se obtido em 2014.';
    if (cosmo.hero) cosmo.hero.subtitle = 'Águas Claras — apartamentos, lojas e salas comerciais';
    if (cosmo.details?.summaryItems) {
      const addr = cosmo.details.summaryItems.find((i) => i.label === 'Endereço');
      if (addr) addr.value = 'Rua das Paineiras, Lote 3 — Águas Claras/DF';
    }
  }

  return data;
}

async function syncMongo(data) {
  const mongoose = require('mongoose');
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ap_construcoes';

  const projectSchema = new mongoose.Schema({ id: String, title: String, description: String, image: String, href: String, badge: String, category: String });
  const pageSchema = new mongoose.Schema({ id: String, title: String, description: String, hero: Object, details: Object, content: Object });
  const gallerySchema = new mongoose.Schema({ projectId: String, images: Array });

  const Project = mongoose.model('Project', projectSchema);
  const Page = mongoose.model('Page', pageSchema);
  const PlantaGallery = mongoose.model('PlantaGallery', gallerySchema);
  const ProjectGallery = mongoose.model('ProjectGallery', gallerySchema);

  await mongoose.connect(MONGO_URI);

  for (const p of data.projects) {
    await Project.updateOne({ id: p.id }, { $set: p }, { upsert: true });
    console.log(`  Mongo Project: ${p.id}`);
  }

  for (const page of data.pages) {
    if (!PORTO_MANIFEST[page.id] && !['barao-rio-branco', 'chateau-valois', 'metropolitan', 'olympique'].includes(page.id)) continue;
    await Page.updateOne(
      { id: page.id },
      { $set: { title: page.title, description: page.description, hero: page.hero, details: page.details } },
      { upsert: true }
    );
    console.log(`  Mongo Page: ${page.id}`);
  }

  for (const [projectId, images] of Object.entries(data.projectGalleries || {})) {
    await ProjectGallery.updateOne({ projectId }, { $set: { images } }, { upsert: true });
    console.log(`  Mongo ProjectGallery: ${projectId} (${images.length})`);
  }

  for (const [projectId, images] of Object.entries(data.plantaGalleries || {})) {
    await PlantaGallery.updateOne({ projectId }, { $set: { images } }, { upsert: true });
    console.log(`  Mongo PlantaGallery: ${projectId} (${images.length})`);
  }

  await mongoose.disconnect();
}

async function main() {
  console.log(APPLY ? '=== Migração Porto (APLICAR) ===' : '=== Migração Porto (dry-run) ===');
  const report = { errors: [], warnings: [], results: [] };

  if (APPLY) removeOrphans();

  for (const [projectId, spec] of Object.entries(PORTO_MANIFEST)) {
    console.log(`\n→ ${projectId}`);
    const result = await migrateProject(projectId, spec, report);
    report.results.push(result);
    console.log(`  capa: ${result.cover}`);
    console.log(`  galeria: ${result.gallery.length} | plantas: ${result.plantas.length}`);
    result.gallery.forEach((g) => console.log(`    ${g.src}`));
  }

  let data = buildDatabaseUpdates(report.results);
  data = addDeliveredPages(data, Object.fromEntries(report.results.map((r) => [r.projectId, r])));

  if (APPLY) {
    fs.writeFileSync(DB_FILE, `${JSON.stringify(data, null, 2)}\n`);
    console.log('\n✓ database.json atualizado');
    if (SYNC_MONGO) {
      console.log('\nSincronizando MongoDB...');
      try {
        await syncMongo(data);
      } catch (e) {
        console.warn('MongoDB não sincronizado:', e.message);
      }
    }
  } else {
    console.log('\n(dry-run) Use --apply para gravar arquivos e database.json');
  }

  if (report.errors.length) {
    console.log('\nErros:');
    report.errors.forEach((e) => console.log('  ✗', e));
  }
  if (report.warnings.length) {
    console.log('\nAvisos:');
    report.warnings.forEach((w) => console.log('  !', w));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
