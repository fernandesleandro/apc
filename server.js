require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// ===== CONFIGURAÇÃO MULTER =====
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// ===== MONGOOSE SCHEMAS =====
const AdminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  email: { type: String, required: true }
});

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

const Admin = mongoose.model('Admin', AdminSchema);

const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

// ===== SESSION CONFIGURATION =====
app.use(session({
  
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  }
  res.redirect('/admin/login');
};

const isNotAuthenticated = (req, res, next) => {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  next();
};

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

  // Criar admin padrão se não existir
  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@apconstrucoes.com.br'
    });
    console.log('Admin padrão criado: username=admin, password=admin123');
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
// ===== ROTAS DE AUTENTICAÇÃO =====

app.get('/admin/login', isNotAuthenticated, (req, res) => {
  res.render('admin-login', { error: req.query.error });
});

app.post('/admin/login', isNotAuthenticated, async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    
    if (!admin) {
      return res.redirect('/admin/login?error=invalid');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.redirect('/admin/login?error=invalid');
    }

    req.session.admin = { id: admin._id, username: admin.username };
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.redirect('/admin/login?error=server');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/admin/dashboard');
    }
    res.redirect('/admin/login');
  });
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
  const project = await Project.findOne({ id: slug });
  let page = await Page.findOne({ id: slug });

  if (!page) {
    if (project) {
      const mappedPage = await Page.findOne({ id: project.id }) || await Page.findOne({ id: 'monumental' });
      if (mappedPage) {
        const detailData = JSON.parse(JSON.stringify(mappedPage.details || {}));
        detailData.heroImage = project.image || (mappedPage.hero && mappedPage.hero.image);

        const gallery = await Gallery.findOne({ projectId: project.id });
        if (gallery) {
          detailData.galleryImages = gallery.images;
        }
        return res.render('project', { page: mappedPage, nav: settings.nav, footer: settings.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
      }
    }
    return res.status(404).send('Página não encontrada');
  }

  const detailData = JSON.parse(JSON.stringify(page.details || {}));
  detailData.heroImage = (project && project.image) || (page.hero && page.hero.image);

  const gallery = await Gallery.findOne({ projectId: page.id });
  if (gallery) {
    detailData.galleryImages = gallery.images;
  }
  res.render('project', { page, nav: settings.nav, footer: settings.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

// Legacy routes; use /obras/:slug instead
app.get('/monumental', (req, res) => res.redirect('/obras/monumental'));
app.get('/cosmopolitan', (req, res) => res.redirect('/obras/cosmopolitan'));

app.get('/admin', isAuthenticated, async (req, res) => {
  res.redirect('/admin/dashboard');
});

app.get('/admin/dashboard', isAuthenticated, async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const pages = await Page.find();
    const projects = await Project.find();
    const galleries = await Gallery.find();
    
    res.render('admin-dashboard', { 
      nav: settings.nav, 
      footer: settings.footer, 
      pages,
      projects,
      galleries,
      username: req.session.admin.username
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    res.status(500).send('Erro ao carregar dashboard');
  }
});

// ===== ROTAS PARA EDITAR PÁGINAS =====

app.get('/admin/edit-page/:id', isAuthenticated, async (req, res) => {
  try {
    const page = await Page.findOne({ id: req.params.id });
    if (!page) {
      return res.status(404).send('Página não encontrada');
    }
    res.render('admin-edit-page', { page, username: req.session.admin.username });
  } catch (error) {
    console.error('Erro ao carregar página:', error);
    res.status(500).send('Erro ao carregar página');
  }
});

app.post('/admin/save-page/:id', isAuthenticated, async (req, res) => {
  try {
    const pageData = req.body;
    
    // Parse details JSON
    if (typeof pageData.details === 'string') {
      pageData.details = JSON.parse(pageData.details);
    }
    if (typeof pageData.hero === 'string') {
      pageData.hero = JSON.parse(pageData.hero);
    }
    if (typeof pageData.content === 'string') {
      pageData.content = JSON.parse(pageData.content);
    }

    await Page.findOneAndUpdate({ id: req.params.id }, pageData, { new: true });
    res.json({ success: true, message: 'Página atualizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar página:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar página' });
  }
});

// ===== ROTAS PARA EDITAR PROJETOS =====

app.get('/admin/edit-project/:id', isAuthenticated, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id });
    if (!project) {
      return res.status(404).send('Projeto não encontrado');
    }
    res.render('admin-edit-project', { project, username: req.session.admin.username });
  } catch (error) {
    console.error('Erro ao carregar projeto:', error);
    res.status(500).send('Erro ao carregar projeto');
  }
});

app.post('/admin/save-project/:id', isAuthenticated, upload.single('imageFile'), async (req, res) => {
  try {
    const projectData = { ...req.body };
    
    // Se um arquivo foi enviado, ele sobrescreve o campo de imagem
    if (req.file) {
      projectData.image = `/uploads/${req.file.filename}`;
    }

    await Project.findOneAndUpdate({ id: req.params.id }, projectData, { new: true });
    
    // Sincronizar imagem com o Hero da página para garantir que a alteração apareça
    if (projectData.image) {
      await Page.findOneAndUpdate({ id: req.params.id }, { "hero.image": projectData.image });
    }

    res.json({ success: true, message: 'Projeto atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao salvar projeto:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar projeto' });
  }
});

// ===== ROTAS PARA UPLOAD DE IMAGENS E EDITAR PLANTA =====

app.get('/admin/edit-planta/:projectId', isAuthenticated, async (req, res) => {
  try {
    const page = await Page.findOne({ id: req.params.projectId });
    const gallery = await Gallery.findOne({ projectId: req.params.projectId });
    
    if (!page) {
      return res.status(404).send('Projeto não encontrado');
    }

    res.render('admin-edit-planta', { 
      page,
      gallery: gallery || { images: [] },
      projectId: req.params.projectId,
      username: req.session.admin.username
    });
  } catch (error) {
    console.error('Erro ao carregar planta:', error);
    res.status(500).send('Erro ao carregar planta');
  }
});

app.post('/admin/upload-planta/:projectId', isAuthenticated, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    const { alt, title, subtitle } = req.body;

    let gallery = await Gallery.findOne({ projectId: req.params.projectId });
    if (!gallery) {
      gallery = new Gallery({ projectId: req.params.projectId, images: [] });
    }

    gallery.images.push({
      src: imagePath,
      alt: alt || 'Imagem'
    });

    await gallery.save();

    // Atualizar página com novo título/subtítulo da planta
    if (title || subtitle) {
      const page = await Page.findOne({ id: req.params.projectId });
      if (page && page.details) {
        if (title) page.details.plantaTitle = title;
        if (subtitle) page.details.plantaSubtitle = subtitle;
        await page.save();
      }
    }

    res.json({ success: true, message: 'Imagem enviada com sucesso!', path: imagePath });
  } catch (error) {
    console.error('Erro ao enviar imagem:', error);
    res.status(500).json({ success: false, message: 'Erro ao enviar imagem' });
  }
});

app.post('/admin/update-planta/:projectId', isAuthenticated, async (req, res) => {
  try {
    const { plantaTitle, plantaSubtitle, highlights, details } = req.body;

    const page = await Page.findOne({ id: req.params.projectId });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
    }

    if (!page.details) page.details = {};
    if (plantaTitle) page.details.plantaTitle = plantaTitle;
    if (plantaSubtitle) page.details.plantaSubtitle = plantaSubtitle;
    if (highlights) page.details.plantaHighlights = Array.isArray(highlights) ? highlights : [highlights];
    if (details) page.details.plantaDescription = details;

    await page.save();
    res.json({ success: true, message: 'Planta atualizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar planta:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar planta' });
  }
});

app.post('/admin/delete-planta-image/:projectId/:filename', isAuthenticated, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    // Remover do sistema de arquivos
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remover do banco de dados
    const gallery = await Gallery.findOne({ projectId: req.params.projectId });
    if (gallery) {
      gallery.images = gallery.images.filter(img => !img.src.includes(filename));
      await gallery.save();
    }

    res.json({ success: true, message: 'Imagem removida com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover imagem:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover imagem' });
  }
});

// ===== ROTA ANTIGA (MANTIDA PARA COMPATIBILIDADE) =====

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

// ===== ROTAS PARA GERENCIAR PROJETOS =====

app.post('/admin/create-project', isAuthenticated, async (req, res) => {
  try {
    const { id, title, description, badge, href, image } = req.body;

    if (!id || !title) {
      return res.json({ success: false, message: 'ID e Título são obrigatórios' });
    }

    // Verificar se já existe projeto com esse ID
    const existingProject = await Project.findOne({ id });
    if (existingProject) {
      return res.json({ success: false, message: 'Um projeto com este ID já existe' });
    }

    const newProject = new Project({
      id,
      title,
      description,
      badge: badge || '',
      href: href || `/obras/${id}`,
      image: image || ''
    });

    await newProject.save();

    // Criar página correspondente
    const newPage = new Page({
      id,
      title,
      description,
      hero: {
        title: title,
        subtitle: '',
        image: image || ''
      },
      details: {
        detailTag: badge || '',
        summaryItems: [],
        plantaTitle: 'Distribuição de Espaços',
        plantaGallery: [],
        plantaDescription: '',
        plantaHighlights: []
      }
    });

    await newPage.save();

    res.json({ success: true, message: 'Projeto criado com sucesso!', projectId: id });
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.json({ success: false, message: 'Erro ao criar projeto' });
  }
});

app.post('/admin/delete-project/:id', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;

    // Verificar se é um projeto padrão (não permitir deletar)
    const defaultProjects = ['monumental', 'cosmopolitan', 'barao-maua'];
    if (defaultProjects.includes(projectId)) {
      return res.json({ success: false, message: 'Projetos padrão não podem ser deletados' });
    }

    // Deletar projeto
    await Project.deleteOne({ id: projectId });

    // Deletar página correspondente
    await Page.deleteOne({ id: projectId });

    // Deletar galeria
    await Gallery.deleteOne({ projectId: projectId });

    res.json({ success: true, message: 'Projeto deletado com sucesso!' });
  } catch (error) {
    console.error('Erro ao deletar projeto:', error);
    res.json({ success: false, message: 'Erro ao deletar projeto' });
  }
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
