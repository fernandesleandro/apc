require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// ===== CONFIGURAÇÃO MULTER E PATHS DE IMAGENS =====
const UPLOAD_DIR_FALLBACK = path.join(__dirname, 'public', 'uploads'); // Fallback para uploads genéricos
const projectGalleryBase = path.join(__dirname, 'public', 'images', 'gallery'); // Galeria geral do projeto
const plantaBase = path.join(__dirname, 'public', 'images', 'planta'); // Imagens de planta

if (!fs.existsSync(UPLOAD_DIR_FALLBACK)) {
  fs.mkdirSync(UPLOAD_DIR_FALLBACK, { recursive: true });
}
if (!fs.existsSync(projectGalleryBase)) {
  fs.mkdirSync(projectGalleryBase, { recursive: true });
}

// Configuração de tipos MIME permitidos
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Helper: gerar nome de pasta seguro (slug)
function sanitizeFolderName(name) {
  if (!name) return 'unknown';
  const slug = name.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return slug || 'unknown';
}

// Gera web path relativo ao diretório public, garantindo barras corretas
function toWebPath(filePath) {
  const rel = path.relative(path.join(__dirname, 'public'), filePath);
  return '/' + rel.replace(/\\/g, '/');
}

/**
 * Middleware factory para upload de imagens para pastas específicas de projeto.
 * @param {string} fieldName O nome do campo no formulário que contém o arquivo.
 * @param {'planta' | 'gallery' | 'project_main'} type O tipo de imagem para determinar a pasta de destino.
 */
function uploadForProject(fieldName, type = 'gallery') {
  return (req, res, next) => {
    const projectKey = (req.params && (req.params.projectId || req.params.id)) || req.body.id || req.body.projectId || req.body.title || 'unknown';
    const folder = sanitizeFolderName(projectKey);
    let dest;
    if (type === 'planta') {
      dest = path.join(plantaBase, folder);
    } else if (type === 'gallery') {
      dest = path.join(projectGalleryBase, folder, 'detalhe');
    } else if (type === 'project_main') {
      dest = path.join(projectGalleryBase, folder);
    } else {
      dest = UPLOAD_DIR_FALLBACK; // Fallback
    }

    try {
      fs.mkdirSync(dest, { recursive: true }); // Garante que a pasta exista
    } catch (e) {
      console.error('[ERROR] Falha ao criar pasta do projeto:', dest, e);
    }

    // Define o storage dinâmico para esta requisição
    const dynamicStorage = multer.diskStorage({
      destination: (r, f, cb) => {
        console.log(`[MULTER] Uploading to: ${dest}`);
        cb(null, dest);
      },
      filename: (r, f, cb) => {
        const sanitizedName = f.originalname
          .toLowerCase()
          .normalize('NFD').replace(/\p{Diacritic}/gu, '')
          .replace(/[^a-z0-9.-]/g, '-')
          .replace(/-+/g, '-');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(sanitizedName);
        const baseName = path.basename(sanitizedName, ext);
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
      }
    });

    // Define o filtro de arquivo
    const fileFilter = (r, f, cb) => {
      if (!ALLOWED_MIMES.includes(f.mimetype)) {
        return cb(new Error(`Tipo de arquivo não permitido: ${f.mimetype}. Use JPG, PNG, WebP ou GIF.`), false);
      }
      cb(null, true);
    };

    // Cria o uploader para esta requisição
    const uploader = multer({ storage: dynamicStorage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } }).single(fieldName);
    
    // Executa o upload
    uploader(req, res, (err) => {
      if (err) {
        console.error(`[MULTER ERROR] ${err.message}`);
        return next(err);
      }
      if (req.file) {
        console.log(`[DYNAMIC UPLOAD] field=${fieldName} saved to ${req.file.path}`);
      } else {
        console.log(`[DYNAMIC UPLOAD] No file uploaded for field ${fieldName}`);
      }
      next();
    });
  };
}

// ===== MONGOOSE SCHEMAS =====
const AdminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  email: { type: String, required: true }
});

const Page = mongoose.model('Page', new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: String,
  hero: Object,
  details: Object, // Este campo conterá detalhes textuais do projeto, não arrays de imagens
  content: Object
}));

const Project = mongoose.model('Project', new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: String,
  image: String, // Imagem de capa do projeto
  href: String,
  badge: String,
  category: String, // Novo campo para categoria do projeto
  createdAt: { type: Date, default: Date.now }
}));

const Setting = mongoose.model('Setting', new mongoose.Schema({
  nav: Array,
  footer: Object
}));

// Modelo para imagens de Planta/Implantação
const PlantaGallery = mongoose.model('PlantaGallery', new mongoose.Schema({
  projectId: { type: String, unique: true, required: true },
  images: Array // Array de { src, alt, title, uploadedAt }
}));

// Modelo para imagens da Galeria Geral do Projeto
const ProjectGallery = mongoose.model('ProjectGallery', new mongoose.Schema({
  projectId: { type: String, unique: true, required: true },
  images: Array // Array de { src, alt, title, uploadedAt }
}));

const Admin = mongoose.model('Admin', AdminSchema);

const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE DE DESABILITAR CACHE (DESENVOLVIMENTO) =====
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('ETag', '');
  next();
});

// ===== MIDDLEWARE DE LOGGING =====
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

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

// ===== MIDDLEWARE DE ERRO PARA MULTER =====
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({ success: false, message: 'Arquivo muito grande. Máximo: 50MB' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Limite de arquivos excedido' });
    }
    return res.status(400).json({ success: false, message: `Erro de upload: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
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
        if (data.pages && data.pages.length) {
          // Remove plantaGallery from page.details before seeding
          const cleanedPages = data.pages.map(p => {
            if (p.details && p.details.plantaGallery) {
              const { plantaGallery, ...restDetails } = p.details;
              return { ...p, details: restDetails };
            }
            return p;
          });
          await Page.insertMany(cleanedPages);
        }
        if (data.projects && data.projects.length) await Project.insertMany(data.projects);
        
        // Seed PlantaGalleries
        if (data.plantaGalleries) {
          const plantaGalleryEntries = Object.keys(data.plantaGalleries).map(key => ({
            projectId: key,
            images: data.plantaGalleries[key]
          }));
          await PlantaGallery.insertMany(plantaGalleryEntries);
        }

        // Seed ProjectGalleries
        if (data.projectGalleries) {
          const projectGalleryEntries = Object.keys(data.projectGalleries).map(key => ({
            projectId: key,
            images: data.projectGalleries[key]
          }));
          await ProjectGallery.insertMany(projectGalleryEntries);
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
      // If no specific page for the project, try to use a default page structure
      const defaultPage = await Page.findOne({ id: 'default-project-template' }) || await Page.findOne({ id: 'monumental' });
      if (defaultPage) {
        const detailData = JSON.parse(JSON.stringify(defaultPage.details || {}));
        detailData.heroImage = project.image || (defaultPage.hero && defaultPage.hero.image);

        const plantaGallery = await PlantaGallery.findOne({ projectId: project.id });
        if (plantaGallery) {
          detailData.plantaGallery = plantaGallery.images;
        }
        const projectGallery = await ProjectGallery.findOne({ projectId: project.id });
        if (projectGallery) {
          detailData.galleryImages = projectGallery.images;
        }
        return res.render('project', { page: defaultPage, nav: settings.nav, footer: settings.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
      }
    }
    return res.status(404).send('Página não encontrada');
  }

  const detailData = JSON.parse(JSON.stringify(page.details || {}));
  detailData.heroImage = (project && project.image) || (page.hero && page.hero.image);

  const plantaGallery = await PlantaGallery.findOne({ projectId: page.id });
  if (plantaGallery) {
    detailData.plantaGallery = plantaGallery.images;
  }
  const projectGallery = await ProjectGallery.findOne({ projectId: page.id });
  if (projectGallery) {
    detailData.galleryImages = projectGallery.images;
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
    
    const plantaGalleries = await PlantaGallery.find();
    const projectGalleries = await ProjectGallery.find();
    const galleries = [...plantaGalleries, ...projectGalleries];
    
    res.render('admin-dashboard-new', { 
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

// ===== ROTAS PARA EDITAR PÁGINAS INSTITUCIONAIS =====

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
    
    // Validação básica
    if (!pageData.title || pageData.title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Título da página é obrigatório' });
    }

    // Parse JSON fields com tratamento de erro
    try {
      // Certifique-se de que pageData.details não contenha arrays de imagens aqui
      if (typeof pageData.details === 'string') {
        pageData.details = JSON.parse(pageData.details);
      }
      if (typeof pageData.hero === 'string') {
        pageData.hero = JSON.parse(pageData.hero);
      }
      if (typeof pageData.content === 'string') {
        pageData.content = JSON.parse(pageData.content);
      }
    } catch (parseError) {
      console.error('[ERROR] Erro ao fazer parse de JSON:', parseError);
      return res.status(400).json({ success: false, message: 'Formato de dados inválido: ' + parseError.message });
    }

    const updatedPage = await Page.findOneAndUpdate({ id: req.params.id }, pageData, { new: true });
    
    if (!updatedPage) {
      return res.status(404).json({ success: false, message: 'Página não encontrada' });
    }

    console.log(`[UPDATE] Página atualizada: ${req.params.id}`);
    res.json({ success: true, message: 'Página atualizada com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao salvar página:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar página: ' + error.message });
  }
});

// ===== ROTAS PARA EDITAR PROJETOS (DETALHES BÁSICOS) =====

app.get('/admin/edit-project/:id', isAuthenticated, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id });
    if (!project) {
      return res.status(404).send('Projeto não encontrado');
    }
    // Renderizar a nova view refatorada
    res.render('admin-edit-project', { project, username: req.session.admin.username });
  } catch (error) {
    console.error('Erro ao carregar projeto:', error);
    res.status(500).send('Erro ao carregar projeto');
  }
});

// Rota alternativa para compatibilidade com links antigos
app.get('/admin/edit-project-new/:id', isAuthenticated, async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id });
    if (!project) {
      return res.status(404).send('Projeto não encontrado');
    }
    // Renderizar a nova view refatorada
    res.render('admin-edit-project', { project, username: req.session.admin.username });
  } catch (error) {
    console.error('Erro ao carregar projeto:', error);
    res.status(500).send('Erro ao carregar projeto');
  }
});

app.post('/admin/save-project/:id', isAuthenticated, uploadForProject('imageFile', 'project_main'), handleMulterError, async (req, res) => {
  try {
    const projectData = { ...req.body };
    
    // Validação
    if (!projectData.title || projectData.title.trim().length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Título do projeto é obrigatório' });
    }
    if (!projectData.category || projectData.category.trim().length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Categoria do projeto é obrigatória' });
    }

    // Se um arquivo foi enviado, ele sobrescreve o campo de imagem
    if (req.file) {
      const webPath = toWebPath(req.file.path);
      projectData.image = webPath;
      console.log(`[UPLOAD] Imagem de projeto: ${req.file.originalname} → ${projectData.image}`);
    }

    const updatedProject = await Project.findOneAndUpdate({ id: req.params.id }, projectData, { new: true });
    
    if (!updatedProject) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
    }

    // Sincronizar imagem com o Hero da página para garantir que a alteração apareça
    if (projectData.image) {
      await Page.findOneAndUpdate({ id: req.params.id }, { "hero.image": projectData.image });
      console.log(`[SYNC] Imagem sincronizada na página: ${req.params.id}`);
    }

    console.log(`[UPDATE] Projeto atualizado: ${req.params.id}`);
    res.json({ success: true, message: 'Projeto atualizado com sucesso!' });
  } catch (error) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('[ERROR] Erro ao salvar projeto:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar projeto: ' + error.message });
  }
});

// ===== ROTAS PARA GERENCIAR IMAGENS DE PLANTA/IMPLANTAÇÃO =====

app.get('/admin/edit-planta/:projectId', isAuthenticated, async (req, res) => {
  // DEPRECATED: Redireciona para interface unificada
  return res.redirect(`/admin/edit-project/${req.params.projectId}#planta`);
});

app.post('/admin/upload-planta/:projectId', isAuthenticated, uploadForProject('image', 'planta'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      console.warn(`[UPLOAD-PLANTA] ✗ Nenhum arquivo enviado para projeto: ${req.params.projectId}`);
      return res.status(400).json({ success: false, message: 'Nenhum arquivo foi enviado' });
    }

    console.log(`[UPLOAD-PLANTA] ✓ Recebido: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`[UPLOAD-PLANTA] Caminho no disco: ${req.file.path}`);
    console.log(`[UPLOAD-PLANTA] Existe no disco: ${fs.existsSync(req.file.path)}`);

    const finalFilePath = req.file.path;
    const { alt, title } = req.body;
    const imagePath = toWebPath(finalFilePath);

    console.log(`[UPLOAD-PLANTA] Path web: ${imagePath}`);

    if (!alt || alt.trim().length === 0) {
      console.warn(`[UPLOAD-PLANTA] ✗ Alt text vazio para ${req.file.originalname}`);
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log(`[UPLOAD-PLANTA] Arquivo deletado: ${req.file.path}`);
      }
      return res.status(400).json({ success: false, message: 'Descrição (alt) é obrigatória' });
    }

    let plantaGallery = await PlantaGallery.findOne({ projectId: req.params.projectId });
    if (!plantaGallery) {
      console.log(`[UPLOAD-PLANTA] Criando nova galeria para projeto: ${req.params.projectId}`);
      plantaGallery = new PlantaGallery({ projectId: req.params.projectId, images: [] });
    }

    plantaGallery.images.push({
      src: imagePath,
      alt: alt.trim(),
      title: title ? title.trim() : '',
      uploadedAt: new Date()
    });

    await plantaGallery.save();
    console.log(`[UPLOAD-PLANTA] ✓ Salvo em BD: ${req.params.projectId}`);
    console.log(`[UPLOAD-PLANTA] Total de imagens: ${plantaGallery.images.length}`);

    res.json({ success: true, message: 'Imagem de planta enviada com sucesso!', image: plantaGallery.images[plantaGallery.images.length - 1] });
  } catch (error) {
    console.error('[UPLOAD-PLANTA] ✗ Erro:', error.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log(`[UPLOAD-PLANTA] Arquivo deletado por erro: ${req.file.path}`);
    }
    res.status(500).json({ success: false, message: 'Erro ao enviar imagem de planta: ' + error.message });
  }
});

app.post('/admin/update-planta-details/:projectId', isAuthenticated, async (req, res) => {
  try {
    const { plantaTitle, plantaSubtitle, plantaDescription, plantaHighlights } = req.body;

    const page = await Page.findOne({ id: req.params.projectId });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
    }

    if (!page.details) page.details = {};
    page.details.plantaTitle = plantaTitle || '';
    page.details.plantaSubtitle = plantaSubtitle || '';
    page.details.plantaDescription = plantaDescription || '';
    page.details.plantaHighlights = Array.isArray(plantaHighlights) ? plantaHighlights : (plantaHighlights ? [plantaHighlights] : []);

    await page.save();
    console.log(`[UPDATE] Detalhes da planta atualizados para o projeto: ${req.params.projectId}`);
    res.json({ success: true, message: 'Detalhes da planta atualizados com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar detalhes da planta:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar detalhes da planta' });
  }
});

app.post('/admin/delete-planta-image/:projectId/:filename', isAuthenticated, async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Validação e sanitização
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ success: false, message: 'Nome de arquivo inválido' });
    }

    const projectFolder = sanitizeFolderName(req.params.projectId);
    const filePath = path.join(plantaBase, projectFolder, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[DELETE] Arquivo de planta removido: ${filePath}`);
    } else {
      console.warn(`[DELETE] Arquivo de planta não encontrado no disco: ${filePath}`);
    }

    // Remover do banco de dados
    const plantaGallery = await PlantaGallery.findOne({ projectId: req.params.projectId });
    if (plantaGallery) {
      const initialCount = plantaGallery.images.length;
      plantaGallery.images = plantaGallery.images.filter(img => !img.src.includes(filename));
      if (plantaGallery.images.length < initialCount) {
        await plantaGallery.save();
        console.log(`[UPDATE] Imagem de planta removida da galeria do projeto: ${req.params.projectId}`);
      }
    }

    res.json({ success: true, message: 'Imagem de planta removida com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao remover imagem de planta:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover imagem de planta: ' + error.message });
  }
});

// ===== ROTAS PARA GERENCIAR GALERIA GERAL DO PROJETO =====

app.get('/admin/edit-gallery/:projectId', isAuthenticated, async (req, res) => {
  // DEPRECATED: Redireciona para interface unificada
  return res.redirect(`/admin/edit-project/${req.params.projectId}#gallery`);
});

// ===== ENDPOINTS PARA OBTER GALERIAS EM JSON =====

app.get('/admin/get-planta-gallery/:projectId', isAuthenticated, async (req, res) => {
  try {
    const plantaGallery = await PlantaGallery.findOne({ projectId: req.params.projectId });
    res.json(plantaGallery || { projectId: req.params.projectId, images: [] });
  } catch (error) {
    console.error('Erro ao obter galeria de planta:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter galeria' });
  }
});

app.get('/admin/get-gallery/:projectId', isAuthenticated, async (req, res) => {
  try {
    const projectGallery = await ProjectGallery.findOne({ projectId: req.params.projectId });
    res.json(projectGallery || { projectId: req.params.projectId, images: [] });
  } catch (error) {
    console.error('Erro ao obter galeria geral:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter galeria' });
  }
});

app.post('/admin/upload-gallery/:projectId', isAuthenticated, uploadForProject('image', 'gallery'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      console.warn(`[UPLOAD-GALLERY] ✗ Nenhum arquivo enviado para projeto: ${req.params.projectId}`);
      return res.status(400).json({ success: false, message: 'Nenhum arquivo foi enviado' });
    }

    console.log(`[UPLOAD-GALLERY] ✓ Recebido: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`[UPLOAD-GALLERY] Caminho no disco: ${req.file.path}`);
    console.log(`[UPLOAD-GALLERY] Existe no disco: ${fs.existsSync(req.file.path)}`);

    const finalFilePath = req.file.path;
    const { alt, title } = req.body;
    const imagePath = toWebPath(finalFilePath);

    console.log(`[UPLOAD-GALLERY] Path web: ${imagePath}`);

    if (!alt || alt.trim().length === 0) {
      console.warn(`[UPLOAD-GALLERY] ✗ Alt text vazio para ${req.file.originalname}`);
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log(`[UPLOAD-GALLERY] Arquivo deletado: ${req.file.path}`);
      }
      return res.status(400).json({ success: false, message: 'Descrição (alt) é obrigatória' });
    }

    let projectGallery = await ProjectGallery.findOne({ projectId: req.params.projectId });
    if (!projectGallery) {
      console.log(`[UPLOAD-GALLERY] Criando nova galeria para projeto: ${req.params.projectId}`);
      projectGallery = new ProjectGallery({ projectId: req.params.projectId, images: [] });
    }

    projectGallery.images.push({
      src: imagePath,
      alt: alt.trim(),
      title: title ? title.trim() : '',
      uploadedAt: new Date()
    });

    await projectGallery.save();
    console.log(`[UPLOAD-GALLERY] ✓ Salvo em BD: ${req.params.projectId}`);
    console.log(`[UPLOAD-GALLERY] Total de imagens: ${projectGallery.images.length}`);

    res.json({ success: true, message: 'Imagem de galeria enviada com sucesso!', image: projectGallery.images[projectGallery.images.length - 1] });
  } catch (error) {
    console.error('[UPLOAD-GALLERY] ✗ Erro:', error.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log(`[UPLOAD-GALLERY] Arquivo deletado por erro: ${req.file.path}`);
    }
    res.status(500).json({ success: false, message: 'Erro ao enviar imagem de galeria: ' + error.message });
  }
});

// Garantir que a pasta de galeria (incluindo /detalhe) exista para um projeto
app.post('/admin/ensure-gallery-folder/:projectId', isAuthenticated, (req, res) => {
  try {
    const projectId = req.params.projectId;
    const folder = sanitizeFolderName(projectId);
    const dest = path.join(projectGalleryBase, folder, 'detalhe');
    fs.mkdirSync(dest, { recursive: true });
    console.log(`[FOLDER] Garantido gallery detalhe para: ${dest}`);
    return res.json({ success: true, path: toWebPath(dest) });
  } catch (err) {
    console.error('[ERROR] Falha ao garantir pasta de galeria:', err);
    return res.status(500).json({ success: false, message: 'Erro ao garantir pasta de galeria' });
  }
});

app.post('/admin/delete-gallery-image/:projectId/:filename', isAuthenticated, async (req, res) => {
  try {
    const filename = req.params.filename;

    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ success: false, message: 'Nome de arquivo inválido' });
    }

    const projectFolder = sanitizeFolderName(req.params.projectId);
    const filePath = path.join(projectGalleryBase, projectFolder, 'detalhe', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[DELETE] Arquivo de galeria removido: ${filePath}`);
    } else {
      console.warn(`[DELETE] Arquivo de galeria não encontrado no disco: ${filePath}`);
    }

    const projectGallery = await ProjectGallery.findOne({ projectId: req.params.projectId });
    if (projectGallery) {
      const initialCount = projectGallery.images.length;
      projectGallery.images = projectGallery.images.filter(img => !img.src.includes(filename));
      if (projectGallery.images.length < initialCount) {
        await projectGallery.save();
        console.log(`[UPDATE] Imagem de galeria removida da coleção do projeto: ${req.params.projectId}`);
      }
    }

    res.json({ success: true, message: 'Imagem de galeria removida com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao remover imagem de galeria:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover imagem de galeria: ' + error.message });
  }
});

// ===== ROTA ANTIGA (MANTIDA PARA CONFIGURAÇÕES GLOBAIS E DESCRIÇÕES DE PÁGINAS) =====

app.post('/admin/save', isAuthenticated, async (req, res) => {
  const { nav, footerCompany, footerDescription, footerLinks, contactItems, pageDescriptions } = req.body;

  const update = {
    nav: Array.isArray(nav) ? nav : (nav ? [nav] : []),
    footer: {
      company: footerCompany,
      description: footerDescription,
      links: Array.isArray(footerLinks) 
        ? footerLinks.map((item, index) => ({ title: item.title || `Link ${index + 1}`, url: item.url || '/' }))
        : (footerLinks && footerLinks.title ? [{ title: footerLinks.title, url: footerLinks.url }] : []),
      contact: Array.isArray(contactItems) ? contactItems : (contactItems ? [contactItems] : [])
    }
  };

  await Setting.findOneAndUpdate({}, update, { upsert: true });

  // Atualizar as descrições das páginas no MongoDB
  if (pageDescriptions) {
    for (const [id, description] of Object.entries(pageDescriptions)) {
      await Page.updateOne({ id }, { $set: { description } });
    }
  }

  res.redirect('/admin/dashboard'); // Redireciona para o dashboard após salvar configurações globais
});

// ===== ROTAS PARA GERENCIAR PROJETOS (CRUD) =====

app.post('/admin/create-project', isAuthenticated, async (req, res) => {
  try {
    const { id, title, description, badge, href, image, category } = req.body;

    // Validação de campos obrigatórios
    if (!id || !id.trim()) {
      return res.json({ success: false, message: 'ID do projeto é obrigatório' });
    }
    if (!title || !title.trim()) {
      return res.json({ success: false, message: 'Título do projeto é obrigatório' });
    }
    if (!category || !category.trim()) {
      return res.json({ success: false, message: 'Categoria do projeto é obrigatória' });
    }

    // Validar formato do ID (lowercase, números, hífens)
    const idRegex = /^[a-z0-9-]+$/;
    if (!idRegex.test(id.trim())) {
      return res.json({ success: false, message: 'ID deve conter apenas letras minúsculas, números e hífens' });
    }

    // Verificar se já existe projeto com esse ID
    const existingProject = await Project.findOne({ id: id.trim() });
    if (existingProject) {
      return res.json({ success: false, message: 'Um projeto com este ID já existe' });
    }

    const newProject = new Project({
      id: id.trim(),
      title: title.trim(),
      description: description ? description.trim() : '',
      badge: badge ? badge.trim() : '',
      href: href ? href.trim() : `/obras/${id.trim()}`,
      image: image ? image.trim() : '',
      category: category.trim(),
      createdAt: new Date()
    });

    await newProject.save();
    console.log(`[CREATE] Novo projeto criado: ${id}`);

    // Criar página correspondente para detalhes do projeto
    const newPage = new Page({
      id: id.trim(),
      title: title.trim(),
      description: description ? description.trim() : '',
      hero: {
        title: title.trim(),
        subtitle: '',
        image: image ? image.trim() : ''
      },
      details: { // Detalhes textuais do projeto
        detailTag: badge ? badge.trim() : '',
        summaryItems: [],
        plantaTitle: 'Distribuição de Espaços',
        plantaDescription: '',
        plantaHighlights: []
      },
      createdAt: new Date()
    });

    await newPage.save();
    console.log(`[CREATE] Página de detalhes correspondente criada: ${id}`);

    // Criar entradas vazias nas galerias de planta e projeto
    await PlantaGallery.create({ projectId: id.trim(), images: [] });
    await ProjectGallery.create({ projectId: id.trim(), images: [] });
    console.log(`[CREATE] Entradas de PlantaGallery e ProjectGallery criadas para: ${id}`);

    // Criar pastas dedicadas para a obra em /public/images/gallery/:projectId e /public/images/planta/:projectId
    try {
      const folderName = sanitizeFolderName(id.trim());
        const projectGalleryPath = path.join(projectGalleryBase, folderName);
      const projectGalleryDetailPath = path.join(projectGalleryBase, folderName, 'detalhe');
      const plantaPath = path.join(plantaBase, folderName);

      if (!fs.existsSync(projectGalleryPath)) {
        fs.mkdirSync(projectGalleryPath, { recursive: true });
        console.log(`[CREATE] Pasta da galeria geral criada: ${projectGalleryPath}`);
      }
      if (!fs.existsSync(projectGalleryDetailPath)) {
        fs.mkdirSync(projectGalleryDetailPath, { recursive: true });
        console.log(`[CREATE] Pasta da galeria detalhe criada: ${projectGalleryDetailPath}`);
      }
      if (!fs.existsSync(plantaPath)) {
        fs.mkdirSync(plantaPath, { recursive: true });
        console.log(`[CREATE] Pasta da galeria de planta criada: ${plantaPath}`);
      }
    } catch (e) {
      console.error('[ERROR] Não foi possível criar pastas de galeria/planta:', e);
    }

    res.json({ success: true, message: 'Projeto criado com sucesso!', projectId: id });
  } catch (error) {
    console.error('[ERROR] Erro ao criar projeto:', error);
    res.json({ success: false, message: 'Erro ao criar projeto: ' + error.message });
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

    // Deletar galerias de planta e projeto
    await PlantaGallery.deleteOne({ projectId: projectId });
    await ProjectGallery.deleteOne({ projectId: projectId });

    // Remover pastas de imagens do disco
    const projectFolder = sanitizeFolderName(projectId);
    const projectGalleryPath = path.join(projectGalleryBase, projectFolder);
    const plantaPath = path.join(plantaBase, projectFolder);

    if (fs.existsSync(projectGalleryPath)) {
      fs.rmSync(projectGalleryPath, { recursive: true, force: true });
      console.log(`[DELETE] Pasta da galeria geral removida: ${projectGalleryPath}`);
    }
    if (fs.existsSync(plantaPath)) {
      fs.rmSync(plantaPath, { recursive: true, force: true });
      console.log(`[DELETE] Pasta da galeria de planta removida: ${plantaPath}`);
    }

    console.log(`[DELETE] Projeto deletado: ${projectId}`);
    res.json({ success: true, message: 'Projeto deletado com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao deletar projeto:', error);
    res.json({ success: false, message: 'Erro ao deletar projeto: ' + error.message });
  }
});

// ===== TRATAMENTO DE ROTAS NÃO ENCONTRADAS (404) =====
app.use((req, res) => {
  console.log(`[404] Página não encontrada: ${req.path}`);
  res.status(404).render('404'); // Renderiza a página 404.ejs
});

// ===== MIDDLEWARE GLOBAL DE TRATAMENTO DE ERROS =====
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR] ${err.message}`);
  console.error(err.stack);

  // Erro de validação do Mongoose
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação: ' + Object.values(err.errors).map(e => e.message).join(', ')
    });
  }

  // Erro de casting do Mongoose
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID inválido'
    });
  }

  // Erro de chave duplicada
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `Este ${field} já existe no sistema`
    });
  }

  // Erros de arquivo (multer)
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: `Erro de upload: ${err.message}`
    });
  }

  // Erro genérico
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message
  });
});

// --- INICIALIZAÇÃO ADAPTADA ---
// Só inicia o servidor com escuta de porta caso NÃO esteja na Vercel (produção)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Admin em http://localhost:${PORT}/admin/login`);
    console.log(`${'='.repeat(60)}\n`);
  });
}

// Exporta o aplicativo Express para que a Vercel gerencie o roteamento Serverless
module.exports = app;
