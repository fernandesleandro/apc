require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();

// MongoDB Models Definition
const Page = mongoose.model('Page', new mongoose.Schema({
  id: String,
  title: String,
  description: String,
  hero: Object,
  details: Object,
  content: Object
}));

const Project = mongoose.model('Project', new mongoose.Schema({
  id: String,
  title: String,
  description: String,
  image: String,
  href: String,
  badge: String
}));

const Setting = mongoose.model('Setting', new mongoose.Schema({
  nav: Array,
  footer: Object
}));

const Gallery = mongoose.model('Gallery', new mongoose.Schema({
  projectId: String,
  images: Array
}));

const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Optional MongoDB connection (for future use)
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ap_construcoes';

// Simplified database initialization function
async function ensureDatabase() {
  const pageCount = await Page.countDocuments();
  if (pageCount === 0) {
    const dbFile = path.join(__dirname, 'data', 'database.json');
    if (fs.existsSync(dbFile)) {
      try {
        console.log('Banco MongoDB vazio. Migrando dados do database.json...');
        const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        
        // Seed Settings
        await Setting.findOneAndUpdate({}, { nav: data.nav, footer: data.footer }, { upsert: true });
        
        // Seed Pages and Projects
        if (data.pages && data.pages.length) await Page.insertMany(data.pages);
        if (data.projects && data.projects.length) await Project.insertMany(data.projects);
        
        // Seed Galleries
        if (data.galleries) {
          const galleryEntries = Object.keys(data.galleries).map(key => ({
            projectId: key,
            images: data.galleries[key]
          }));
          await Gallery.insertMany(galleryEntries);
        }
      } catch (e) {
        console.error('Erro ao carregar database.json:', e);
      }
    }
  }
}

// --- AJUSTE CONEXÃO SERVERLESS (VERCEL) ---
let isConnected = false;
async function connectToDatabase() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
    console.log('Conectado ao MongoDB com sucesso!');
    await ensureDatabase();
  } catch (err) {
    console.error('Erro ao conectar ao MongoDB:', err.message);
  }
}

// Middleware para conectar ao banco antes de processar qualquer rota
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});
// ------------------------------------------

app.get('/', async (req, res) => {
  const settings = await Setting.findOne();
  const page = await Page.findOne({ id: 'home' });
  const projects = await Project.find();
  res.render('home', { 
    page, 
    nav: settings.nav, 
    footer: settings.footer, 
    projects, 
    active: req.path, 
    requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` 
  });
});

app.get('/sobre', async (req, res) => {
  const settings = await Setting.findOne();
  const page = await Page.findOne({ id: 'sobre' });
  res.render('sobre', { page, nav: settings.nav, footer: settings.footer, detailData: {}, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/contato', async (req, res) => {
  const settings = await Setting.findOne();
  const page = await Page.findOne({ id: 'contato' });
  res.render('contato', { page, nav: settings.nav, footer: settings.footer, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/obras', async (req, res) => {
  const settings = await Setting.findOne();
  const projects = await Project.find();
  res.render('obras', { nav: settings.nav, footer: settings.footer, projects, active: '/obras', requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

// Generic route to serve project details under /obras/:slug
app.get('/obras/:slug', async (req, res) => {
  const settings = await Setting.findOne();
  const slug = req.params.slug;
  let page = await Page.findOne({ id: slug });

  if (!page) {
    const proj = await Project.findOne({ id: slug });
    if (proj) {
      const mappedPage = await Page.findOne({ id: proj.id }) || await Page.findOne({ id: 'monumental' });
      if (mappedPage) {
        const detailData = JSON.parse(JSON.stringify(mappedPage.details || {}));
        detailData.heroImage = detailData.heroImage || (mappedPage.hero && mappedPage.hero.image);

        const gallery = await Gallery.findOne({ projectId: proj.id });
        if (gallery) {
          detailData.galleryImages = gallery.images;
          if (!detailData.heroImage && gallery.images.length) detailData.heroImage = gallery.images[0].src;
        }
        return res.render('project', { page: mappedPage, nav: settings.nav, footer: settings.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
      }
    }
    return res.status(404).send('Página não encontrada');
  }

  const detailData = JSON.parse(JSON.stringify(page.details || {}));
  detailData.heroImage = detailData.heroImage || (page.hero && page.hero.image);

  const gallery = await Gallery.findOne({ projectId: page.id });
  if (gallery) {
    detailData.galleryImages = gallery.images;
    if (!detailData.heroImage && gallery.images.length) {
      detailData.heroImage = gallery.images[0].src;
    }
  }
  res.render('project', { page, nav: settings.nav, footer: settings.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

// Legacy routes; use /obras/:slug instead
app.get('/monumental', (req, res) => res.redirect('/obras/monumental'));
app.get('/cosmopolitan', (req, res) => res.redirect('/obras/cosmopolitan'));

app.get('/admin', async (req, res) => {
  const settings = await Setting.findOne();
  const pages = await Page.find();
  res.render('admin', { 
    nav: settings.nav, 
    footer: settings.footer, 
    pages: pages 
  });
});

app.post('/admin/save', async (req, res) => {
  const { nav, footerCompany, footerDescription, footerLinks, contactItems, pageDescriptions } = req.body;

  const update = {
    nav: Array.isArray(nav) ? nav : [nav],
    footer: {
      company: footerCompany,
      description: footerDescription,
      links: Array.isArray(footerLinks) 
        ? footerLinks.map((item, index) => ({ title: item.title || `Link ${index + 1}`, url: item.url || '/' }))
        : [{ title: footerLinks.title, url: footerLinks.url }],
      contact: Array.isArray(contactItems) ? contactItems : [contactItems]
    }
  };

  await Setting.findOneAndUpdate({}, update, { upsert: true });

  // Atualizar as descrições das páginas no MongoDB
  if (pageDescriptions) {
    for (const [id, description] of Object.entries(pageDescriptions)) {
      await Page.updateOne({ id }, { $set: { description } });
    }
  }

  res.redirect('/admin');
});

// --- INICIALIZAÇÃO ADAPTADA ---
// Só inicia o servidor com escuta de porta caso NÃO esteja na Vercel (produção)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

// Exporta o aplicativo Express para que a Vercel gerencie o roteamento Serverless
module.exports = app;
