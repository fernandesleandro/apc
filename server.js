require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const sharp = require('sharp');

const app = express();
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ap_construcoes';
const isVercel = Boolean(process.env.VERCEL);

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

const VERCEL_MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function persistUploadedImage(file) {
  if (!file) return null;

  if (isVercel && file.buffer) {
    const optimized = await sharp(file.buffer)
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    if (optimized.length > VERCEL_MAX_IMAGE_BYTES) {
      throw new Error('Imagem muito grande após compressão. Use uma foto menor (até 4 MB).');
    }
    return `data:image/webp;base64,${optimized.toString('base64')}`;
  }

  if (file.path) {
    const parsed = path.parse(file.path);
    const webpPath = path.join(parsed.dir, `${parsed.name}.webp`);
    await sharp(file.path)
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(webpPath);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return toWebPath(webpPath);
  }

  return null;
}

function normalizeCategoryValue(category) {
  if (!category) return '';
  const key = String(category).trim().toLowerCase();
  const map = {
    residencial: 'residencial',
    comercial: 'comercial',
    corporativo: 'corporativo',
    misto: 'misto',
    institucional: 'institucional',
    outro: 'outro'
  };
  return map[key] || key;
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
      dest = path.join(projectGalleryBase, folder);
    } else if (type === 'project_main') {
      dest = path.join(projectGalleryBase, folder);
    } else {
      dest = UPLOAD_DIR_FALLBACK;
    }

    if (!isVercel) {
      try {
        fs.mkdirSync(dest, { recursive: true });
      } catch (e) {
        console.error('[ERROR] Falha ao criar pasta do projeto:', dest, e);
      }
    }

    const dynamicStorage = isVercel
      ? multer.memoryStorage()
      : multer.diskStorage({
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

    const fileFilter = (r, f, cb) => {
      if (!ALLOWED_MIMES.includes(f.mimetype)) {
        return cb(new Error(`Tipo de arquivo não permitido: ${f.mimetype}. Use JPG, PNG, WebP ou GIF.`), false);
      }
      cb(null, true);
    };

    const maxSize = isVercel ? VERCEL_MAX_IMAGE_BYTES : MAX_FILE_SIZE;
    const uploader = multer({ storage: dynamicStorage, fileFilter, limits: { fileSize: maxSize } }).single(fieldName);

    uploader(req, res, (err) => {
      if (err) {
        console.error(`[MULTER ERROR] ${err.message}`);
        return next(err);
      }
      if (req.file) {
        const target = req.file.path || `memory:${req.file.originalname} (${req.file.size} bytes)`;
        console.log(`[DYNAMIC UPLOAD] field=${fieldName} saved to ${target}`);
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
  constructionYear: Number,
  constructionMonth: Number,
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

const ContactMessage = mongoose.model('ContactMessage', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  address: String,
  message: { type: String, required: true },
  projectInterest: String,
  ip: String,
  createdAt: { type: Date, default: Date.now }
}));

const ManualChapter = mongoose.model('ManualChapter', new mongoose.Schema({
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
}));

ManualChapter.schema.index({ sectionSlug: 1, docType: 1, slug: 1 }, { unique: true });

const ManualDocument = mongoose.model('ManualDocument', new mongoose.Schema({
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
}));

ManualDocument.schema.index({ sectionSlug: 1, docType: 1 }, { unique: true });

const {
  chapterSlugFromHref,
  fetchChapterContent,
  buildManualPath,
  buildChapterPath,
  formatManualHtml
} = require('./lib/manual-content');
const { crawlDocumentChildren } = require('./lib/manual-crawl');

const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || 'https://www.apconstrucoes.com.br').replace(/\/$/, '');
const WHATSAPP_PHONE = (process.env.WHATSAPP_PHONE || '556121958300').replace(/\D/g, '');
const contactRateLimit = new Map();

const DEFAULT_FOOTER_SOCIAL = [
  { platform: 'facebook', icon: 'fab fa-facebook-f', label: 'Facebook', url: '' },
  { platform: 'instagram', icon: 'fab fa-instagram', label: 'Instagram', url: '' },
  { platform: 'linkedin', icon: 'fab fa-linkedin-in', label: 'LinkedIn', url: '' }
];

const DEFAULT_FOOTER_HR = {
  email: '',
  phone: '',
  note: ''
};

const DEFAULT_FOOTER_CONTACT = [
  { icon: 'fas fa-phone-alt', label: 'Telefone Central', value: '(61) 2195-8300' },
  { icon: 'fas fa-envelope', label: 'E-mail', value: 'contato@apconstrucoes.com.br' },
  { icon: 'fas fa-map-marker-alt', label: 'Endereço Corporativo', value: 'SCS Qd. 02 Bl. D Ed. Oscar Niemeyer, 13° andar, Sala 1301 - Brasília/DF' }
];

function isWhatsappContactItem(item) {
  return String(item?.icon || '').includes('whatsapp');
}

function filterContactItems(contact) {
  const list = Array.isArray(contact) ? contact.filter((item) => !isWhatsappContactItem(item)) : [];
  return list.length ? list : DEFAULT_FOOTER_CONTACT;
}

const defaultSettings = {
  nav: [
    { title: 'Sobre Nós', url: '/sobre' },
    { title: 'Lançamento', url: '/lancamentos' },
    { title: 'Empreendimentos', url: '/obras' },
    {
      title: 'Atendimento',
      url: '/contato',
      children: [
        { title: 'Acesso ao Cliente', url: '/acesso-cliente', icon: 'fa-user-shield' },
        { title: 'Trabalhe Conosco', url: '/trabalhe-conosco', icon: 'fa-briefcase' },
        { title: 'Fale Conosco', url: '/contato', icon: 'fa-headset' }
      ]
    }
  ],
  footer: {
    company: 'AP Construções',
    description: 'Construção civil com qualidade, confiança e excelência.',
    links: [],
    contact: [],
    social: DEFAULT_FOOTER_SOCIAL,
    hr: DEFAULT_FOOTER_HR
  }
};
const fallbackImage = '/images/banners/banner-empreendimento.webp';
const OBRAS_LISTING_BANNER = '/images/gallery/monumental/monumental-ap-high.jpg-1781211333896-122053680.webp';

function isDataImageUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function projectCoverMediaPath(projectId) {
  return `/media/cover/${projectId}`;
}

function pageHeroMediaPath(pageId) {
  return `/media/page-hero/${pageId}`;
}

function resolvePageHeroForDisplay(pageId, raw) {
  if (!raw || typeof raw !== 'string') return '';
  if (isDataImageUrl(raw)) return pageHeroMediaPath(pageId);
  return normalizePublicPath(raw);
}

function reorderImageArray(images, order) {
  if (!Array.isArray(images) || !Array.isArray(order)) return images;
  return order.map((i) => images[Number(i)]).filter(Boolean);
}

function galleryMediaPath(projectId, index, kind = 'gallery') {
  return `/media/${kind}/${projectId}/${index}`;
}

function mapGalleryImagesForDisplay(projectId, images, kind = 'gallery') {
  return (images || [])
    .map((image, index) => {
      if (!image || !image.src) return null;
      return {
        ...image,
        src: galleryMediaPath(projectId, index, kind)
      };
    })
    .filter(Boolean);
}

function mapGalleryImagesForApi(projectId, images, kind = 'gallery') {
  return (images || [])
    .map((image, index) => {
      if (!image || !image.src) return null;
      return {
        alt: image.alt || '',
        title: image.title || '',
        uploadedAt: image.uploadedAt,
        index,
        src: galleryMediaPath(projectId, index, kind)
      };
    })
    .filter(Boolean);
}

async function serveGalleryImageFromDb(projectId, index, kind, res) {
  const Model = kind === 'planta' ? PlantaGallery : ProjectGallery;
  const gallery = await Model.findOne({ projectId }).lean();
  const image = gallery?.images?.[index];
  if (!image?.src) {
    return res.status(404).end();
  }

  const src = image.src;
  if (isDataImageUrl(src)) {
    const match = src.match(/^data:(image\/[\w+.+-]+);base64,(.+)$/s);
    if (!match) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=86400');
    res.type(match[1]);
    return res.send(Buffer.from(match[2], 'base64'));
  }

  const webPath = normalizePublicPath(src);
  if (webPath) {
    const filePath = path.join(__dirname, 'public', webPath.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      res.set('Cache-Control', 'public, max-age=86400');
      return res.sendFile(filePath);
    }
    return res.redirect(webPath);
  }

  return res.status(404).end();
}

function resolveProjectImageForDisplay(project) {
  const raw = project?.image;
  if (!raw || typeof raw !== 'string') return '';
  if (isDataImageUrl(raw)) return projectCoverMediaPath(project.id);
  return normalizePublicPath(raw);
}

function preserveStoredImageValue(image) {
  if (!image || typeof image !== 'string') return '';
  if (isDataImageUrl(image)) return image;
  return normalizePublicPath(image) || fallbackImage;
}

function normalizePublicPath(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/\\/g, '/');
  if (trimmed.startsWith('data:')) return '';
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;
  const withoutPublic = trimmed.replace(/^\/?public\//, '');
  return withoutPublic.startsWith('/') ? withoutPublic : `/${withoutPublic}`;
}

function buildPageUrl(req) {
  const pathOnly = (req.originalUrl || '/').split('?')[0] || '/';
  return `${SITE_URL}${pathOnly}`;
}

function normalizeImageRecord(image) {
  if (!image || typeof image !== 'object') return image;
  return { ...image, src: normalizePublicPath(image.src) };
}

const DELIVERY_MONTH_SHORT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatProjectDeliveryLabel(project) {
  const year = Number(project?.constructionYear);
  if (!year) return '';
  const month = Number(project?.constructionMonth);
  const period = month >= 1 && month <= 12
    ? `${DELIVERY_MONTH_SHORT[month]}/${year}`
    : String(year);
  const badge = String(project?.badge || '').trim().toLowerCase();
  if (/entregue/.test(badge)) return `Entregue em ${period}`;
  if (/lançamento|lancamento|em construção|em construcao|construção|construcao/.test(badge)) {
    return `Previsão de entrega: ${period}`;
  }
  return `Entrega: ${period}`;
}

function shouldShowProjectBadge(project) {
  const badge = String(project?.badge || '').trim();
  if (!badge) return false;
  // Com data de entrega, "Entregue" na foto repete a linha abaixo do título
  if (project.deliveryLabel && /entregue/i.test(badge)) return false;
  return true;
}

function normalizeProjectRecord(project) {
  if (!project) return project;
  const object = typeof project.toObject === 'function' ? project.toObject() : project;
  const normalized = {
    ...object,
    href: object.href || `/obras/${object.id}`,
    image: resolveProjectImageForDisplay(object) || fallbackImage,
    categoryLabel: formatCategoryLabel(object.category)
  };
  normalized.deliveryLabel = formatProjectDeliveryLabel(normalized);
  normalized.showBadge = shouldShowProjectBadge(normalized);
  return normalized;
}

function formatCategoryLabel(category) {
  if (!category) return '';
  const map = {
    residencial: 'Residencial',
    comercial: 'Comercial',
    corporativo: 'Corporativo',
    misto: 'Misto',
    institucional: 'Institucional',
    outro: 'Outro'
  };
  const key = String(category).trim().toLowerCase();
  return map[key] || String(category).trim();
}

function parseConstructionYearMonth(body) {
  let constructionYear = null;
  let constructionMonth = null;
  if (body?.constructionYear !== undefined && String(body.constructionYear).trim() !== '') {
    const year = parseInt(String(body.constructionYear).trim(), 10);
    if (!Number.isNaN(year) && year >= 1900 && year <= 2100) constructionYear = year;
  }
  if (body?.constructionMonth !== undefined && String(body.constructionMonth).trim() !== '') {
    const month = parseInt(String(body.constructionMonth).trim(), 10);
    if (!Number.isNaN(month) && month >= 1 && month <= 12) constructionMonth = month;
  }
  return { constructionYear, constructionMonth };
}

function compareProjectsByConstruction(a, b) {
  const yearA = Number(a?.constructionYear) || 0;
  const yearB = Number(b?.constructionYear) || 0;
  if (yearB !== yearA) return yearB - yearA;
  const monthA = Number(a?.constructionMonth) || 0;
  const monthB = Number(b?.constructionMonth) || 0;
  if (monthB !== monthA) return monthB - monthA;
  return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
}

function sortProjectsByConstruction(projects) {
  return [...projects].sort(compareProjectsByConstruction);
}

function buildProjectFilterOptions(rawProjects) {
  const categoryOptions = [...new Set(rawProjects.map((p) => p.category).filter(Boolean))]
    .map((value) => ({ value, label: formatCategoryLabel(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const statusOptions = [...new Set(rawProjects.map((p) => (p.badge || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return { categoryOptions, statusOptions };
}

function getDefaultServicesSection() {
  return {
    tag: 'Soluções Completas',
    title: 'Nossa Atuação',
    items: [
      {
        icon: 'fa-building',
        title: 'Construções de Alto Padrão',
        description: 'Execução impecável com materiais de primeira linha e rigor técnico absoluto em todas as etapas.'
      },
      {
        icon: 'fa-tools',
        title: 'Reformas Corporativas',
        description: 'Modernização de escritórios e layouts comerciais com foco em funcionalidade e sofisticação.'
      },
      {
        icon: 'fa-pencil-ruler',
        title: 'Projetos de Engenharia',
        description: 'Desenho arquitetônico e estrutural integrado para otimizar espaço, custos e prazos.'
      }
    ]
  };
}

function normalizeServicesSection(content) {
  const defaults = getDefaultServicesSection();
  if (!content || typeof content !== 'object') return defaults;
  const items = Array.isArray(content.items)
    ? content.items
      .filter((item) => item && (item.title || item.description))
      .map((item) => ({
        icon: String(item.icon || 'fa-building').trim(),
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim()
      }))
    : defaults.items;
  return {
    tag: String(content.tag || defaults.tag).trim(),
    title: String(content.title || defaults.title).trim(),
    items: items.length ? items : defaults.items
  };
}

function absoluteAssetUrl(req, assetPath) {
  if (!assetPath) return null;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  const host = `${req.protocol}://${req.get('host')}`;
  return `${host}${normalizePublicPath(assetPath)}`;
}

function buildWhatsappUrl(text) {
  const encoded = encodeURIComponent(text || 'Olá! Gostaria de mais informações sobre os empreendimentos da AP Construções.');
  return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encoded}`;
}

function normalizeFooter(footer) {
  const fromDb = readNavFooterFromDatabaseJson()?.footer;
  const base = footer && typeof footer === 'object' ? footer : (fromDb || defaultSettings.footer);
  const social = DEFAULT_FOOTER_SOCIAL.map((item) => {
    const existing = (base.social || fromDb?.social || [])
      .filter((entry) => entry.platform !== 'whatsapp')
      .find((entry) => entry.platform === item.platform);
    return existing ? { ...item, ...existing, icon: item.icon, platform: item.platform } : { ...item };
  });
  return {
    ...base,
    company: base.company || fromDb?.company || defaultSettings.footer.company,
    description: base.description || fromDb?.description || defaultSettings.footer.description,
    links: (base.links?.length ? base.links : (fromDb?.links || defaultSettings.footer.links || []))
      .filter((link) => !isHomeNavItem(link))
      .map((link) => normalizeNavItem(link)),
    contact: filterContactItems(base.contact?.length ? base.contact : (fromDb?.contact || DEFAULT_FOOTER_CONTACT)),
    social,
    hr: { ...DEFAULT_FOOTER_HR, ...(fromDb?.hr || {}), ...(base.hr || {}) }
  };
}

function isDeliveredProject(project, detailData) {
  const badge = (project?.badge || '').trim();
  const tag = (detailData?.detailTag || '').trim();
  return badge === 'Entregue' || /entregue/i.test(tag);
}

function normalizeDetailData(detailData, page, project) {
  const d = detailData || {};
  const details = page?.details || {};
  return {
    ...d,
    detailHeadline: d.detailHeadline || details.detailHeadline || '',
    detailBullets: Array.isArray(d.detailBullets) ? d.detailBullets : (Array.isArray(details.detailBullets) ? details.detailBullets : []),
    plantaSectionTag: d.plantaSectionTag || details.plantaSectionTag || 'Distribuição de Espaços',
    plantaTitle: d.plantaTitle || details.plantaTitle || 'Distribuição de Espaços',
    commonAreasSectionTag: d.commonAreasSectionTag || details.commonAreasSectionTag || 'Conforto & Lazer',
    commonAreasTitle: d.commonAreasTitle || details.commonAreasTitle || 'Áreas Comuns do Empreendimento',
    commonAreasIntro: d.commonAreasIntro || details.commonAreasIntro || '',
    location: {
      title: d.location?.title || details.location?.title || 'Localização',
      subtitle: d.location?.subtitle || details.location?.subtitle || 'Estilo de Vida e Comodidade',
      description: d.location?.description || details.location?.description || '',
      mapQuery: d.location?.mapQuery || details.location?.mapQuery || '',
      features: d.location?.features || details.location?.features || []
    }
  };
}

function buildProjectSections(detailData) {
  const sections = [];
  if (detailData.summaryItems?.length) sections.push({ id: 'ficha', label: 'Ficha Técnica' });
  sections.push({ id: 'detalhes', label: 'Detalhes' });
  if ((detailData.plantaGallery?.length) || detailData.plantaImage) sections.push({ id: 'plantas', label: 'Plantas' });
  if (detailData.commonAreas?.length) sections.push({ id: 'areas', label: 'Áreas Comuns' });
  if (detailData.location && (detailData.location.description || detailData.location.features?.length)) {
    sections.push({ id: 'localizacao', label: 'Localização' });
  }
  return sections;
}

function getFooterContactValue(footer, labelPattern) {
  const items = filterContactItems(footer?.contact);
  const item = items.find((i) => labelPattern.test(String(i?.label || '')));
  return item?.value ? String(item.value).trim() : '';
}

function formatPhoneForSchema(displayPhone) {
  const digits = String(displayPhone || WHATSAPP_PHONE).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
}

function buildLocalBusinessSchemaJson(page, footer) {
  const phone = getFooterContactValue(footer, /telefone|phone/i) || DEFAULT_FOOTER_CONTACT[0].value;
  const email = getFooterContactValue(footer, /e-?mail/i) || DEFAULT_FOOTER_CONTACT[1].value;
  const addressRaw = getFooterContactValue(footer, /endereço|localização/i) || DEFAULT_FOOTER_CONTACT[2].value;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: footer?.company || defaultSettings.footer.company,
    description: page?.description || defaultSettings.footer.description,
    url: `${SITE_URL}/sobre`,
    telephone: formatPhoneForSchema(phone),
    email
  };
  if (addressRaw) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: addressRaw.split(' - ')[0].trim(),
      addressLocality: 'Brasília',
      addressRegion: 'DF',
      addressCountry: 'BR'
    };
  }
  return JSON.stringify(schema);
}

function buildProjectSchemaJson(page, project, detailData, requestUrl) {
  const addressItem = (detailData.summaryItems || []).find(i =>
    i && ['Endereço', 'Localização'].includes(i.label)
  );
  const category = (project?.category || '').toLowerCase();
  const schemaType = category === 'comercial' || category === 'corporativo' || category === 'institucional'
    ? 'OfficeBuilding'
    : 'Residence';
  const schema = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: page?.hero?.title || project?.title,
    description: page?.description,
    url: requestUrl,
    image: detailData.heroImage || project?.image
  };
  if (addressItem?.value) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: addressItem.value,
      addressLocality: 'Brasília',
      addressRegion: 'DF',
      addressCountry: 'BR'
    };
  }
  return JSON.stringify(schema);
}

const PROJECT_LISTING_CACHE_MS = 60 * 1000;
const PROJECT_LISTING_FIELDS = {
  id: 1, title: 1, description: 1, image: 1, href: 1, badge: 1, category: 1,
  constructionYear: 1, constructionMonth: 1, createdAt: 1
};
const projectsListingCache = { at: 0, rawProjects: null, filterOptions: null };

function invalidateProjectsListingCache() {
  projectsListingCache.at = 0;
  projectsListingCache.rawProjects = null;
  projectsListingCache.filterOptions = null;
}

function attachLocationChips(projects, pages) {
  const pageById = Object.fromEntries(pages.map((p) => [p.id, p]));
  return projects.map((project) => {
    const summary = pageById[project.id]?.details?.summaryItems || [];
    const address = summary.find((i) => i && ['Endereço', 'Localização'].includes(i.label));
    const metragem = summary.find((i) => i && /metr|m²|m2|área/i.test(i.label || ''));
    const locationChip = address?.value
      ? String(address.value).split('-')[0].split(',')[0].trim().slice(0, 48)
      : (metragem?.value ? String(metragem.value).slice(0, 48) : '');
    return { ...project, locationChip };
  });
}

async function loadProjectsListingBase() {
  if (projectsListingCache.rawProjects && Date.now() - projectsListingCache.at < PROJECT_LISTING_CACHE_MS) {
    return {
      rawProjects: projectsListingCache.rawProjects,
      filterOptions: projectsListingCache.filterOptions
    };
  }

  const rawProjects = sortProjectsByConstruction(
    (await Project.find({}, PROJECT_LISTING_FIELDS).lean()).map(normalizeProjectRecord)
  );
  const pages = rawProjects.length
    ? await Page.find(
      { id: { $in: rawProjects.map((p) => p.id) } },
      { id: 1, 'details.summaryItems': 1 }
    ).lean()
    : [];
  const enriched = attachLocationChips(rawProjects, pages);
  const filterOptions = buildProjectFilterOptions(rawProjects);
  projectsListingCache.at = Date.now();
  projectsListingCache.rawProjects = enriched;
  projectsListingCache.filterOptions = filterOptions;
  return { rawProjects: enriched, filterOptions };
}

function checkContactRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 8;
  const entry = contactRateLimit.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    contactRateLimit.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  contactRateLimit.set(ip, entry);
  return true;
}

async function sendContactEmail(payload) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    const to = process.env.CONTACT_EMAIL || process.env.SMTP_USER;
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      replyTo: payload.email,
      subject: `[AP Construções] Contato — ${payload.name}`,
      text: `Nome: ${payload.name}\nE-mail: ${payload.email}\nTelefone: ${payload.phone || '-'}\nEndereço: ${payload.address || '-'}\nInteresse: ${payload.projectInterest || '-'}\n\n${payload.message}`
    });
    return true;
  } catch (err) {
    console.error('[CONTACT] Falha ao enviar e-mail:', err.message);
    return false;
  }
}

function parseJsonField(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function upsertSummaryItems(existingItems, updates) {
  const items = Array.isArray(existingItems) ? existingItems.map(item => ({ ...item })) : [];
  for (const update of updates) {
    if (!update || !update.label) continue;
    const index = items.findIndex(item => item.label === update.label);
    if (index >= 0) {
      items[index].value = update.value ?? '';
    } else {
      items.push({ label: update.label, value: update.value ?? '' });
    }
  }
  return items;
}

function mergeSummaryItems(existingItems, incomingItems) {
  if (!Array.isArray(incomingItems) || incomingItems.length === 0) {
    return Array.isArray(existingItems) ? existingItems.map(item => ({ ...item })) : [];
  }
  const map = new Map();
  for (const item of (existingItems || [])) {
    if (item && item.label) map.set(item.label, { ...item });
  }
  for (const item of incomingItems) {
    if (item && item.label) map.set(item.label, { ...item });
  }
  return Array.from(map.values());
}

function mergeDetails(existing, incoming) {
  const base = JSON.parse(JSON.stringify(existing || {}));
  if (!incoming || typeof incoming !== 'object') return base;

  for (const key of Object.keys(incoming)) {
    if (key === 'plantaGallery') continue;

    if (key === 'location' && incoming.location && typeof incoming.location === 'object') {
      base.location = base.location || {};
      if (incoming.location.title !== undefined) base.location.title = incoming.location.title;
      if (incoming.location.subtitle !== undefined) base.location.subtitle = incoming.location.subtitle;
      if (incoming.location.description !== undefined) base.location.description = incoming.location.description;
      if (incoming.location.mapQuery !== undefined) base.location.mapQuery = incoming.location.mapQuery;
      if (Array.isArray(incoming.location.features)) {
        base.location.features = incoming.location.features.map(f => ({ ...f }));
      }
      continue;
    }

    if (key === 'summaryItems' && Array.isArray(incoming.summaryItems)) {
      base.summaryItems = mergeSummaryItems(base.summaryItems, incoming.summaryItems);
      continue;
    }

    if (Array.isArray(incoming[key])) {
      base[key] = incoming[key].map(item => (typeof item === 'object' && item !== null ? { ...item } : item));
      continue;
    }

    if (incoming[key] !== undefined) {
      base[key] = incoming[key];
    }
  }

  return base;
}

async function updatePageDetails(projectId, updater) {
  const page = await Page.findOne({ id: projectId });
  if (!page) return null;
  if (!page.details || typeof page.details !== 'object') page.details = {};
  updater(page.details);
  page.markModified('details');
  await page.save();
  invalidateProjectsListingCache();
  return page;
}

function normalizeSiteLabel(title) {
  if (!title || typeof title !== 'string') return title;
  if (title.trim() === 'Obras') return 'Empreendimentos';
  return title;
}

function normalizeNavItem(item) {
  if (!item || typeof item !== 'object') return item;
  const title = String(item.title || '').trim();
  const url = String(item.url || '').trim();
  const titleKey = title.toLowerCase();
  if (titleKey === 'serviços' || titleKey === 'servicos' || url.includes('#servicos')) {
    return { ...item, title: 'Lançamento', url: '/lancamentos' };
  }
  return { ...item, title: normalizeSiteLabel(title), url };
}

const ATENDIMENTO_CHILD_URLS = ['/acesso-cliente', '/trabalhe-conosco', '/contato'];
const ATENDIMENTO_DROPDOWN = {
  title: 'Atendimento',
  url: '/contato',
  children: [
    { title: 'Acesso ao Cliente', url: '/acesso-cliente', icon: 'fa-user-shield' },
    { title: 'Trabalhe Conosco', url: '/trabalhe-conosco', icon: 'fa-briefcase' },
    { title: 'Fale Conosco', url: '/contato', icon: 'fa-headset' }
  ]
};

function isAtendimentoChildUrl(url) {
  return ATENDIMENTO_CHILD_URLS.includes(String(url || '').trim());
}

function isAtendimentoDropdown(item) {
  return Array.isArray(item?.children)
    && item.children.some((child) => isAtendimentoChildUrl(child.url));
}

function buildAtendimentoDropdown(nav) {
  const list = Array.isArray(nav) ? [...nav] : [];
  const flatChildren = list
    .filter((item) => isAtendimentoChildUrl(item.url))
    .map((item) => ({ title: normalizeSiteLabel(item.title), url: String(item.url).trim() }));

  const existingDropdown = list.find((item) => isAtendimentoDropdown(item));
  const filtered = list.filter((item) => {
    if (isAtendimentoChildUrl(item.url)) return false;
    if (isAtendimentoDropdown(item)) return false;
    return true;
  });

  const children = ATENDIMENTO_DROPDOWN.children.map((child) => {
    const fromFlat = flatChildren.find((item) => item.url === child.url);
    const fromDropdown = existingDropdown?.children?.find((item) => String(item.url).trim() === child.url);
    const title = child.url === '/contato'
      ? 'Fale Conosco'
      : normalizeSiteLabel(fromFlat?.title || fromDropdown?.title || child.title);
    return { ...child, title, icon: child.icon };
  });

  const obrasIndex = filtered.findIndex((item) => String(item.url || '').trim() === '/obras');
  const insertAt = obrasIndex >= 0 ? obrasIndex + 1 : filtered.length;
  filtered.splice(insertAt, 0, {
    title: existingDropdown?.title ? normalizeSiteLabel(existingDropdown.title) : ATENDIMENTO_DROPDOWN.title,
    url: ATENDIMENTO_DROPDOWN.url,
    children
  });

  return filtered;
}

function mergeRequiredNavItems(nav) {
  return buildAtendimentoDropdown(Array.isArray(nav) ? nav : []);
}

function isHomeNavItem(item) {
  if (!item || typeof item !== 'object') return false;
  const title = String(item.title || '').trim().toLowerCase();
  const url = String(item.url || '').trim();
  return url === '/' || url === '/index' || title === 'início' || title === 'inicio' || title === 'home';
}

function normalizeSiteSettings(settings) {
  const nav = buildAtendimentoDropdown(
    (settings.nav || [])
      .filter((item) => !isHomeNavItem(item))
      .map((item) => normalizeNavItem(item))
  );
  const footer = normalizeFooter(settings.footer);
  return { nav, footer };
}

const SETTINGS_CACHE_MS = 60 * 1000;
const settingsCache = { data: null, at: 0 };

async function getSettings() {
  if (settingsCache.data && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) {
    return settingsCache.data;
  }
  const settings = await Setting.findOne().lean();
  const resolved = {
    nav: (settings && Array.isArray(settings.nav) && settings.nav.length) ? settings.nav : defaultSettings.nav,
    footer: (settings && settings.footer) ? settings.footer : defaultSettings.footer
  };
  settingsCache.data = normalizeSiteSettings(resolved);
  settingsCache.at = Date.now();
  return settingsCache.data;
}

// Cache: desabilitado só em desenvolvimento local
app.use((req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  } else if (req.method === 'GET' && !req.path.startsWith('/admin')) {
    res.set('Cache-Control', 'public, max-age=300');
  }
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

// ===== SESSION CONFIGURATION (persistida no MongoDB — evita logout ao reiniciar servidor) =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongoUrl: MONGO_URI,
    collectionName: 'admin_sessions',
    ttl: 24 * 60 * 60
  }),
  name: 'apc.sid',
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    path: '/'
  }
}));

// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  }
  
  // Verifica se é uma requisição AJAX/API
  const isAjaxRequest =
    req.xhr ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    req.headers['content-type']?.includes('application/json');

  if (isAjaxRequest) {
    return res.status(401).json({
      success: false,
      message: 'Sessão expirada. Faça login novamente.',
      redirect: '/admin/login'
    });
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
      const maxMb = isVercel ? 4 : 50;
      return res.status(400).json({ success: false, message: `Arquivo muito grande. Máximo: ${maxMb}MB` });
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

  await ensureServicosPage();
  await ensureInstitutionalPages(['acesso-cliente', 'trabalhe-conosco', 'manual-proprietario', 'convencao-condominio']);
  await ensureClientAccessPageContent();
  await ensureRemovePericiaOlympiquePage();
  await ensureManualProprietarioPageContent();
  await ensureSettingsNavFromDatabase();
  await ensureFooterSettings();
  await syncProjectConstructionDates();
}

async function syncProjectConstructionDates() {
  const dbFile = path.join(__dirname, 'data', 'database.json');
  if (!fs.existsSync(dbFile)) return;
  try {
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    if (!Array.isArray(data.projects)) return;
    let updated = 0;
    for (const seed of data.projects) {
      if (!seed.id || seed.constructionYear == null) continue;
      const result = await Project.updateOne(
        {
          id: seed.id,
          $or: [{ constructionYear: { $exists: false } }, { constructionYear: null }]
        },
        {
          $set: {
            constructionYear: seed.constructionYear,
            constructionMonth: seed.constructionMonth ?? null
          }
        }
      );
      if (result.modifiedCount) updated += 1;
    }
    if (updated) {
      invalidateProjectsListingCache();
      console.log(`[SEED] Datas de construção sincronizadas em ${updated} empreendimento(s)`);
    }
  } catch (error) {
    console.error('[SEED] Erro ao sincronizar datas de construção:', error.message);
  }
}

function readNavFooterFromDatabaseJson() {
  const dbFile = path.join(__dirname, 'data', 'database.json');
  if (!fs.existsSync(dbFile)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return { nav: data.nav || [], footer: data.footer || null };
  } catch (error) {
    console.error('[SEED] Erro ao ler nav do database.json:', error);
    return null;
  }
}

async function ensureSettingsNavFromDatabase() {
  const fromDb = readNavFooterFromDatabaseJson();
  if (!fromDb?.nav?.length) return;

  const settings = await Setting.findOne();
  const currentNav = settings?.nav || [];
  const sourceNav = currentNav.length ? currentNav : fromDb.nav;
  const normalizedNav = normalizeSiteSettings({ nav: sourceNav, footer: settings?.footer }).nav;
  const hasFlatAtendimento = sourceNav.some((item) => isAtendimentoChildUrl(item.url));
  const dropdown = sourceNav.find((item) => isAtendimentoDropdown(item));
  const staleDropdown = dropdown?.children?.some((item) => {
    const expected = ATENDIMENTO_DROPDOWN.children.find((child) => child.url === String(item.url).trim());
    if (!expected) return true;
    if (expected.url === '/contato' && item.title !== 'Fale Conosco') return true;
    return item.icon !== expected.icon;
  });
  if (!hasFlatAtendimento && dropdown && !staleDropdown) return;

  const update = { nav: normalizedNav };
  if (settings?.footer) {
    update.footer = settings.footer;
  } else if (fromDb.footer) {
    update.footer = fromDb.footer;
  }

  await Setting.findOneAndUpdate({}, update, { upsert: true });
  console.log('[SEED] Menu atualizado com dropdown Atendimento.');
}

async function ensureFooterSettings() {
  const fromDb = readNavFooterFromDatabaseJson();
  if (!fromDb?.footer) return;

  const settings = await Setting.findOne();
  const currentFooter = settings?.footer || {};
  const normalizedFooter = normalizeFooter(currentFooter.company ? currentFooter : fromDb.footer);
  const needsSocial = !Array.isArray(currentFooter.social)
    || currentFooter.social.length < DEFAULT_FOOTER_SOCIAL.length
    || (currentFooter.social || []).some((item) => item.platform === 'whatsapp');
  const needsHr = !currentFooter.hr || typeof currentFooter.hr !== 'object';
  const hasLegacyWhatsappContact = (currentFooter.contact || []).some(isWhatsappContactItem);
  const needsContact = !Array.isArray(currentFooter.contact) || !currentFooter.contact.length;
  if (!needsSocial && !needsHr && !needsContact && !hasLegacyWhatsappContact) return;

  await Setting.findOneAndUpdate({}, { footer: normalizedFooter }, { upsert: true });
  console.log('[SEED] Rodapé atualizado com redes sociais, contato e RH.');
}

function readPageFromDatabaseJson(pageId) {
  const dbFile = path.join(__dirname, 'data', 'database.json');
  if (!fs.existsSync(dbFile)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    return (data.pages || []).find((p) => p.id === pageId) || null;
  } catch (error) {
    console.error(`[SEED] Erro ao ler página ${pageId}:`, error);
    return null;
  }
}

let manualProprietarioContentCache = null;
let manualProprietarioContentMtime = 0;
let manualContentDbCache = null;

function invalidateManualContentCache() {
  manualContentDbCache = null;
  manualProprietarioContentCache = null;
  manualProprietarioContentMtime = 0;
}

async function refreshManualContentFromDb() {
  const page = await Page.findOne({ id: 'manual-proprietario' }).lean();
  if (page?.content?.sections?.length) {
    manualContentDbCache = enrichManualProprietarioContent(page.content);
    return manualContentDbCache;
  }
  manualContentDbCache = null;
  return null;
}

function getManualProprietarioContent() {
  if (manualContentDbCache) return manualContentDbCache;

  const dbFile = path.join(__dirname, 'data', 'database.json');
  if (!fs.existsSync(dbFile)) return null;
  const { mtimeMs } = fs.statSync(dbFile);
  if (manualProprietarioContentCache && mtimeMs === manualProprietarioContentMtime) {
    return manualProprietarioContentCache;
  }
  const page = readPageFromDatabaseJson('manual-proprietario');
  manualProprietarioContentCache = enrichManualProprietarioContent(page?.content);
  manualProprietarioContentMtime = mtimeMs;
  return manualProprietarioContentCache;
}

async function ensureInstitutionalPages(pageIds) {
  for (const pageId of pageIds) {
    const existing = await Page.findOne({ id: pageId });
    if (existing) continue;
    const payload = readPageFromDatabaseJson(pageId);
    if (!payload) continue;
    await Page.create(payload);
    console.log(`[SEED] Página institucional criada: ${pageId}`);
  }
}

async function ensureClientAccessPageContent() {
  const defaults = readPageFromDatabaseJson('acesso-cliente');
  if (!defaults?.content?.services?.length) return;
  const existing = await Page.findOne({ id: 'acesso-cliente' });
  if (!existing) return;

  const currentServices = Array.isArray(existing.content?.services) ? existing.content.services : [];
  const defaultsById = Object.fromEntries(defaults.content.services.map((service) => [service.id, service]));
  const hasLegacyLinks = currentServices.some((service) => {
    const href = String(service.href || '');
    if (href.startsWith('/contato?')) return true;
    if (service.id === 'manual' && !href.includes('/acesso-cliente/manual-proprietario')) return true;
    if (service.id === 'convencao' && !href.includes('/acesso-cliente/convencao-condominio')) return true;
    if (['boletos', 'acompanhe-obra', 'manutencao'].includes(service.id) && !service.disabled) return true;
    const expected = defaultsById[service.id];
    return expected && expected.disabled && !service.disabled;
  });
  const hasRemovedPericia = currentServices.some((service) => service.id === 'pericia-olympique');
  const missingIds = defaults.content.services.some(
    (service) => !currentServices.some((item) => item.id === service.id)
  );

  if (!hasLegacyLinks && !missingIds && !hasRemovedPericia && currentServices.some((service) => service.id)) return;

  existing.content = {
    ...(existing.content || {}),
    intro: defaults.content.intro,
    services: defaults.content.services
  };
  if (existing.content.portalNote) delete existing.content.portalNote;
  existing.markModified('content');
  await existing.save();
  console.log('[SEED] Conteúdo do Acesso ao Cliente atualizado com links do portal.');
}

async function ensureRemovePericiaOlympiquePage() {
  const removed = await Page.deleteOne({ id: 'pericia-olympique' });
  if (removed.deletedCount) {
    console.log('[SEED] Página Perícia Olympique removida.');
  }
}

async function ensureManualProprietarioPageContent() {
  const defaults = readPageFromDatabaseJson('manual-proprietario');
  if (!defaults?.content?.sections?.length) return;
  const existing = await Page.findOne({ id: 'manual-proprietario' });
  if (!existing) return;

  const enrichedDefaults = enrichManualProprietarioContent(defaults.content);
  const currentFirst = existing.content?.sections?.[0]?.title;
  const expectedFirst = enrichedDefaults.sections[0]?.title;
  const introOutdated = existing.content?.intro !== enrichedDefaults.intro;
  const childrenOutdated = getManualChildrenCount(existing.content?.sections)
    < getManualChildrenCount(enrichedDefaults.sections);

  if (currentFirst === expectedFirst && !introOutdated && !childrenOutdated) return;

  existing.content = {
    ...(existing.content || {}),
    intro: enrichedDefaults.intro,
    sections: enrichedDefaults.sections
  };
  existing.markModified('content');
  await existing.save();
  console.log('[SEED] Manual do Proprietário atualizado (ordem, capítulos e intro).');
}

async function ensureServicosPage() {
  const existing = await Page.findOne({ id: 'servicos' });
  if (existing) return;

  const servicosPage = readPageFromDatabaseJson('servicos');

  const payload = servicosPage || {
    id: 'servicos',
    title: 'Serviços | AP Construções',
    description: 'Conheça as soluções da AP Construções em Brasília.',
    content: getDefaultServicesSection()
  };

  await Page.create(payload);
  console.log('[SEED] Página de serviços criada para edição no admin.');
}

// --- AJUSTE CONEXÃO SERVERLESS (VERCEL) ---
let isConnected = false;
async function connectToDatabase() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
    console.log('Conectado ao MongoDB com sucesso!');
    ensureDatabase().catch((err) => console.error('[SEED] Erro no ensureDatabase:', err.message));
    refreshManualContentFromDb().catch((err) => console.error('[MANUAL] Erro ao carregar manual do BD:', err.message));
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
  try {
    const [settings, page, servicesPage, listing] = await Promise.all([
      getSettings(),
      Page.findOne({ id: 'home' }).lean(),
      Page.findOne({ id: 'servicos' }).lean(),
      loadProjectsListingBase()
    ]);
    const servicesSection = normalizeServicesSection(servicesPage?.content);
    const projects = listing.rawProjects.map((project) => ({
      ...project,
      whatsappUrl: buildWhatsappUrl(`Olá! Tenho interesse no empreendimento ${project.title}.`, settings.footer)
    }));
    const { categoryOptions, statusOptions } = listing.filterOptions;
    const requestUrl = `${buildPageUrl(req)}`;
    res.render('home', {
      page: page || { title: 'AP Construções', hero: { title: 'AP Construções', subtitle: 'Construção civil com qualidade, confiança e excelência.' } },
      nav: settings.nav,
      footer: settings.footer,
      servicesSection,
      projects,
      categoryOptions,
      statusOptions,
      active: req.path,
      requestUrl,
      ogImage: absoluteAssetUrl(req, '/logo.png'),
      whatsappUrl: buildWhatsappUrl(undefined, settings.footer)
    });
  } catch (error) {
    console.error('[ERROR] Erro ao carregar home:', error);
    res.status(500).send('Erro ao carregar página inicial');
  }
});

app.get('/sobre', async (req, res) => {
  try {
    const settings = await getSettings();
    const page = await Page.findOne({ id: 'sobre' }).lean();
    const requestUrl = `${buildPageUrl(req)}`;
    const schemaJson = buildLocalBusinessSchemaJson(page, settings.footer);
    res.render('sobre', {
      page: page || { title: 'Sobre', description: '' },
      nav: settings.nav,
      footer: settings.footer,
      detailData: {},
      active: req.path,
      requestUrl,
      schemaJson
    });
  } catch (error) {
    console.error('[ERROR] Erro ao carregar sobre:', error);
    res.status(500).send('Erro ao carregar página');
  }
});

app.get('/contato', async (req, res) => {
  try {
    const settings = await getSettings();
    const page = await Page.findOne({ id: 'contato' }).lean();
    const interest = typeof req.query.obra === 'string' ? req.query.obra : '';
    const assuntoLabels = {
      '2via-boleto': '2ª via de boleto / extrato',
      'manual-proprietario': 'Manual do proprietário',
      'manutencao': 'Manutenção — unidade entregue',
      'convencao-condominio': 'Convenção de condomínio',
      'acompanhamento-obra': 'Acompanhamento de obra'
    };
    const assuntoKey = typeof req.query.assunto === 'string' ? req.query.assunto : '';
    const assuntoLabel = assuntoLabels[assuntoKey] || '';
    const projectInterest = interest || assuntoLabel;
    res.render('contato', {
      page: page || { title: 'Contato', description: '' },
      nav: settings.nav,
      footer: settings.footer,
      active: req.path,
      requestUrl: `${buildPageUrl(req)}`,
      ogImage: absoluteAssetUrl(req, '/logo.png'),
      projectInterest,
      assuntoLabel,
      whatsappUrl: buildWhatsappUrl(projectInterest ? `Olá! Tenho interesse: ${projectInterest}.` : undefined, settings.footer)
    });
  } catch (error) {
    console.error('[ERROR] Erro ao carregar contato:', error);
    res.status(500).send('Erro ao carregar página');
  }
});

app.get('/acesso-cliente', async (req, res) => {
  try {
    const settings = await getSettings();
    let page = await Page.findOne({ id: 'acesso-cliente' }).lean();
    if (!page) {
      page = readPageFromDatabaseJson('acesso-cliente');
    }
    if (!page) {
      return res.status(404).send('Página não encontrada');
    }
    res.render('acesso-cliente', {
      page: resolveClientAccessPage(page),
      nav: settings.nav,
      footer: settings.footer,
      active: '/acesso-cliente',
      requestUrl: `${buildPageUrl(req)}`,
      ogImage: absoluteAssetUrl(req, '/logo.png'),
      whatsappUrl: buildWhatsappUrl(undefined, settings.footer)
    });
  } catch (error) {
    console.error('[ERROR] Erro ao carregar acesso ao cliente:', error);
    res.status(500).send('Erro ao carregar página');
  }
});

app.get('/acesso-cliente/manual-proprietario', async (req, res) => {
  try {
    await renderClientDocumentsPage(req, res, 'manual-proprietario');
  } catch (error) {
    console.error('[ERROR] Erro ao carregar manual do proprietário:', error);
    res.status(500).send('Erro ao carregar página');
  }
});

app.get('/acesso-cliente/manual-proprietario/:sectionSlug/:docType/capitulo/:chapterSlug', async (req, res) => {
  try {
    await renderManualChapterApi(req, res, req.params);
  } catch (error) {
    console.error('[ERROR] Erro ao carregar capítulo do manual:', error);
    res.status(500).json({ error: 'Erro ao carregar capítulo' });
  }
});

app.get('/acesso-cliente/manual-proprietario/:sectionSlug/:docType', async (req, res) => {
  try {
    await renderManualDocumentPage(req, res, req.params);
  } catch (error) {
    console.error('[ERROR] Erro ao carregar manual completo:', error);
    res.status(500).send('Erro ao carregar manual');
  }
});

app.get('/acesso-cliente/manual-proprietario/:sectionSlug/:docType/:chapterSlug', (req, res) => {
  res.redirect(301, `/acesso-cliente/manual-proprietario/${req.params.sectionSlug}/${req.params.docType}#${req.params.chapterSlug}`);
});

app.get('/acesso-cliente/convencao-condominio', async (req, res) => {
  try {
    await renderClientDocumentsPage(req, res, 'convencao-condominio');
  } catch (error) {
    console.error('[ERROR] Erro ao carregar convenção de condomínio:', error);
    res.status(500).send('Erro ao carregar página');
  }
});

app.get('/trabalhe-conosco', async (req, res) => {
  try {
    const settings = await getSettings();
    let page = await Page.findOne({ id: 'trabalhe-conosco' }).lean();
    if (!page) {
      page = readPageFromDatabaseJson('trabalhe-conosco');
    }
    if (!page) {
      return res.status(404).send('Página não encontrada');
    }
    res.render('trabalhe-conosco', {
      page,
      nav: settings.nav,
      footer: settings.footer,
      active: '/trabalhe-conosco',
      requestUrl: `${buildPageUrl(req)}`,
      ogImage: absoluteAssetUrl(req, '/logo.png'),
      whatsappUrl: buildWhatsappUrl(undefined, settings.footer)
    });
  } catch (error) {
    console.error('[ERROR] Erro ao carregar trabalhe conosco:', error);
    res.status(500).send('Erro ao carregar página');
  }
});

const LAUNCH_STATUS = 'Lançamento';
const DEFAULT_CLIENT_MANUAL_URL = '/acesso-cliente/manual-proprietario';

function resolveClientAccessPage(page) {
  if (!page?.content?.services?.length) return page;

  const overrides = {
    manual: {
      href: DEFAULT_CLIENT_MANUAL_URL,
      external: false,
      cta: 'Ver manuais'
    },
    convencao: {
      href: '/acesso-cliente/convencao-condominio',
      external: false,
      cta: 'Ver documentos'
    }
  };

  const services = page.content.services.map((service) => {
    const patch = overrides[service.id];
    const merged = patch ? { ...service, ...patch } : { ...service };
    const defaults = readPageFromDatabaseJson('acesso-cliente');
    const defaultService = defaults?.content?.services?.find((item) => item.id === service.id);
    if (defaultService?.disabled) {
      merged.disabled = true;
      merged.disabledLabel = defaultService.disabledLabel || 'Indisponível';
    }
    return merged;
  });

  const content = { ...page.content, services };
  if (content.portalNote) delete content.portalNote;

  return { ...page, content };
}

const MANUAL_DOC_TYPE_ORDER = { proprietario: 1, 'areas-comuns': 2, desenhos: 3, 'habite-se': 4, documento: 5 };

function inferManualDocType(title, href) {
  const text = String(title || '').toLowerCase();
  if (/habite|habitise/.test(text) || /\.pdf($|\?)/i.test(href || '')) return 'habite-se';
  if (/desenhos/.test(text)) return 'desenhos';
  if (/propriet/.test(text)) return 'proprietario';
  if (/áreas comuns|areas comuns/.test(text)) return 'areas-comuns';
  return 'documento';
}

function slugifyManualSection(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'empreendimento';
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const entities = {
        aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä',
        eacute: 'é', ecirc: 'ê', iacute: 'í', oacute: 'ó', ocirc: 'ô',
        otilde: 'õ', ouml: 'ö', uacute: 'ú', uuml: 'ü', ccedil: 'ç',
        Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
        Ccedil: 'Ç', nbsp: ' '
      };
      return entities[name] || match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeManualHtml(html) {
  return String(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const entities = {
        aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä',
        eacute: 'é', ecirc: 'ê', iacute: 'í', oacute: 'ó', ocirc: 'ô',
        otilde: 'õ', ouml: 'ö', uacute: 'ú', uuml: 'ü', ccedil: 'ç',
        Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
        Ccedil: 'Ç', nbsp: ' ', ordm: 'º', ordf: 'ª',
        ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'"
      };
      return entities[name] || match;
    });
}

function normalizeManualChapter(chapter, sectionSlug, docType) {
  const title = decodeHtmlEntities(chapter.title);
  const slug = chapter.slug || chapterSlugFromHref(chapter.href, title);
  return {
    title,
    href: chapter.href,
    slug,
    internalPath: buildChapterPath(sectionSlug, docType, slug)
  };
}

function getManualChildrenCount(sections) {
  return (sections || []).reduce(
    (total, section) => total + (section.documents || []).reduce(
      (count, doc) => count + (doc.children || []).length,
      0
    ),
    0
  );
}

function enrichManualProprietarioContent(content) {
  if (!content?.sections?.length) return content;
  const sections = content.sections.map((section) => {
    const sectionSlug = section.slug || slugifyManualSection(section.title);
    const documents = (section.documents || []).map((doc) => {
      const docType = doc.type || inferManualDocType(doc.title, doc.href);
      const children = (doc.children || []).map((child) => normalizeManualChapter(child, sectionSlug, docType));
      return {
        ...doc,
        title: decodeHtmlEntities(doc.title),
        type: docType,
        internalPath: buildManualPath(sectionSlug, docType),
        chapterCount: children.length,
        children
      };
    });
    documents.sort(
      (a, b) => (MANUAL_DOC_TYPE_ORDER[a.type] || 9) - (MANUAL_DOC_TYPE_ORDER[b.type] || 9)
    );
    return {
      ...section,
      slug: section.slug || slugifyManualSection(section.title),
      documents
    };
  });
  return {
    ...content,
    intro: content.intro || 'Encontre o empreendimento e abra o manual completo em uma única página, com todos os tópicos.',
    sections
  };
}

function buildManualHubSections(content) {
  const enriched = content?.sections?.length ? content : getManualProprietarioContent();
  if (!enriched?.sections?.length) return [];

  return enriched.sections.map((section) => {
    const keywords = [String(section.title || '').toLowerCase()];
    const documents = (section.documents || []).map((doc) => {
      const chapterCount = doc.chapterCount || (doc.children || []).length;
      keywords.push(String(doc.title || '').toLowerCase());
      return {
        title: doc.title,
        href: doc.href,
        type: doc.type,
        internalPath: doc.internalPath,
        chapterCount
      };
    });
    const chapterCount = documents.reduce((total, doc) => total + doc.chapterCount, 0);
    return {
      slug: section.slug,
      title: section.title,
      searchKeywords: keywords.join(' '),
      manualCount: documents.length,
      chapterCount,
      documents
    };
  });
}

function findManualChapterMeta(sectionSlug, docType, chapterSlug) {
  const content = getManualProprietarioContent();
  if (!content?.sections?.length) return null;

  for (const section of content.sections) {
    if (section.slug !== sectionSlug) continue;
    for (const doc of section.documents || []) {
      if (doc.type !== docType) continue;
      for (const child of doc.children || []) {
        if (child.slug === chapterSlug) {
          return {
            sectionSlug: section.slug,
            sectionTitle: section.title,
            docType: doc.type,
            docTitle: doc.title,
            slug: child.slug,
            title: child.title,
            sourceHref: child.href
          };
        }
      }
    }
  }
  return null;
}

function presentManualChapterHtml(html) {
  const raw = String(html || '');
  if (raw.includes('manual-pdf-list')) {
    return decodeManualHtml(raw);
  }
  return formatManualHtml(decodeManualHtml(raw));
}

function needsPdfDirectoryRefetch(chapter, sourceHref) {
  if (!/\/(desenhos|imagens)\//i.test(String(sourceHref || ''))) return false;
  if (!chapter?.html) return true;
  if (chapter.html.includes('manual-pdf-list')) return false;
  return /\/$/.test(sourceHref) || /\.pdf($|\?)/i.test(sourceHref) === false;
}

async function getOrFetchManualChapter(meta, { force = false } = {}) {
  let chapter = await ManualChapter.findOne({
    sectionSlug: meta.sectionSlug,
    docType: meta.docType,
    slug: meta.slug
  }).lean();

  const shouldRefetch = force || needsPdfDirectoryRefetch(chapter, meta.sourceHref);

  if (chapter?.html && !shouldRefetch) {
    return { ...chapter, html: presentManualChapterHtml(chapter.html) };
  }

  try {
    const content = await fetchChapterContent(meta.sourceHref);
    const payload = {
      sectionSlug: meta.sectionSlug,
      sectionTitle: meta.sectionTitle,
      docType: meta.docType,
      docTitle: meta.docTitle,
      slug: meta.slug,
      title: meta.title,
      sourceHref: meta.sourceHref,
      html: content.html,
      plainText: content.plainText,
      syncedAt: new Date()
    };
    chapter = await ManualChapter.findOneAndUpdate(
      { sourceHref: meta.sourceHref },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { ...chapter, html: presentManualChapterHtml(chapter.html) };
  } catch (error) {
    console.error('[MANUAL] Falha ao buscar capítulo:', meta.sourceHref, error.message);
    return null;
  }
}

function isManualSectionHeader(title) {
  return /^[IVXLC]+(\s*[\.\-\)]|\s+-)\s/i.test(String(title || '').trim());
}

function isManualNavTopic(title) {
  return /^(inicio|index|voltar|manual do propri|manual das áreas|manual de áreas|manual das areas)$/i.test(
    String(title || '').trim().replace(/\s+/g, ' ')
  );
}

function buildManualTreeNodes(chapters) {
  const nodes = [];
  let currentSection = null;

  for (const chapter of chapters) {
    if (isManualNavTopic(chapter.title)) continue;

    if (isManualSectionHeader(chapter.title)) {
      currentSection = {
        type: 'section',
        slug: chapter.slug,
        title: chapter.title,
        children: [{ type: 'topic', slug: chapter.slug, title: chapter.title }]
      };
      nodes.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.children.push({ type: 'topic', slug: chapter.slug, title: chapter.title });
    } else {
      nodes.push({ type: 'topic', slug: chapter.slug, title: chapter.title });
    }
  }

  return nodes;
}

function findManualDocumentMeta(sectionSlug, docType) {
  const content = getManualProprietarioContent();
  if (!content?.sections?.length) return null;

  for (const section of content.sections) {
    if (section.slug !== sectionSlug) continue;
    for (const doc of section.documents || []) {
      if (doc.type !== docType) continue;
      if (/\.pdf($|\?)/i.test(doc.href || '')) return null;
      return {
        sectionSlug: section.slug,
        sectionTitle: section.title,
        docType: doc.type,
        docTitle: doc.title,
        children: doc.children || []
      };
    }
  }
  return null;
}

async function findManualDocInPage(sectionSlug, docType) {
  const page = await Page.findOne({ id: 'manual-proprietario' });
  if (!page?.content?.sections?.length) {
    return { page: null, section: null, doc: null, sectionIndex: -1, docIndex: -1 };
  }
  for (let si = 0; si < page.content.sections.length; si++) {
    const section = page.content.sections[si];
    const slug = section.slug || slugifyManualSection(section.title);
    if (slug !== sectionSlug) continue;
    for (let di = 0; di < (section.documents || []).length; di++) {
      const doc = section.documents[di];
      const type = doc.type || inferManualDocType(doc.title, doc.href);
      if (type === docType) {
        return { page, section, doc, sectionIndex: si, docIndex: di };
      }
    }
  }
  return { page, section: null, doc: null, sectionIndex: -1, docIndex: -1 };
}

async function saveManualDocumentChildren(sectionSlug, docType, children) {
  const found = await findManualDocInPage(sectionSlug, docType);
  if (!found.doc || !found.page) {
    throw new Error('Documento não encontrado na página do manual');
  }
  const docRef = found.page.content.sections[found.sectionIndex].documents[found.docIndex];
  docRef.children = children;
  if (!docRef.type) docRef.type = docType;
  found.page.markModified('content');
  await found.page.save();
  invalidateManualContentCache();
  await refreshManualContentFromDb();
}

function findManualChildByHref(meta, href) {
  const normalized = String(href || '').split('#')[0].trim().toLowerCase();
  return (meta?.children || []).find((child) =>
    String(child.href || '').split('#')[0].trim().toLowerCase() === normalized
  );
}

async function buildManualDocumentRecord(meta) {
  const allStored = await ManualChapter.find({
    sectionSlug: meta.sectionSlug,
    docType: meta.docType,
    html: { $ne: '' }
  }).lean();
  const byHref = new Map(allStored.map((chapter) => [chapter.sourceHref.toLowerCase(), chapter]));
  const chapters = [];

  for (const child of meta.children) {
    const chapterMeta = {
      sectionSlug: meta.sectionSlug,
      sectionTitle: meta.sectionTitle,
      docType: meta.docType,
      docTitle: meta.docTitle,
      slug: child.slug || chapterSlugFromHref(child.href, child.title),
      title: child.title,
      sourceHref: child.href
    };
    const stored = byHref.get(String(child.href).toLowerCase());
    const force = needsPdfDirectoryRefetch(stored, child.href);
    const fetched = await getOrFetchManualChapter(chapterMeta, { force });
    if (!fetched?.html) continue;
    chapters.push({
      slug: child.slug,
      title: child.title,
      html: fetched.html
    });
  }

  const filteredChapters = chapters.filter((ch) => !isManualNavTopic(ch.title));
  const toc = filteredChapters.map((chapter) => ({ slug: chapter.slug, title: chapter.title }));
  const payload = {
    sectionSlug: meta.sectionSlug,
    docType: meta.docType,
    sectionTitle: meta.sectionTitle,
    docTitle: meta.docTitle,
    chapters: filteredChapters,
    toc,
    chapterCount: filteredChapters.length,
    layout: 'tree-v2',
    syncedAt: new Date()
  };

  return ManualDocument.findOneAndUpdate(
    { sectionSlug: meta.sectionSlug, docType: meta.docType },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

async function renderManualChapterApi(req, res, { sectionSlug, docType, chapterSlug }) {
  const meta = findManualChapterMeta(sectionSlug, docType, chapterSlug);
  if (!meta) {
    return res.status(404).json({ error: 'Capítulo não encontrado' });
  }

  const chapter = await getOrFetchManualChapter(meta);
  if (!chapter?.html) {
    return res.status(502).json({ error: 'Não foi possível carregar este capítulo' });
  }

  if (process.env.NODE_ENV === 'production') {
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  }

  res.json({
    slug: chapter.slug,
    title: chapter.title,
    html: chapter.html
  });
}

async function renderManualDocumentPage(req, res, { sectionSlug, docType }) {
  const meta = findManualDocumentMeta(sectionSlug, docType);
  if (!meta) {
    return res.status(404).send('Manual não encontrado');
  }

  const expectedChapterCount = meta.children.filter((child) => !isManualNavTopic(child.title)).length;

  let manual = await ManualDocument.findOne(
    { sectionSlug, docType },
    { sectionSlug: 1, sectionTitle: 1, docTitle: 1, chapterCount: 1, layout: 1, toc: 1 }
  ).lean();

  const needsRebuild = !manual?.toc?.length
    || (manual.chapterCount || 0) < expectedChapterCount
    || manual.layout !== 'tree-v2';

  if (needsRebuild) {
    manual = await buildManualDocumentRecord(meta);
  }

  const toc = (manual.toc || []).filter((entry) => !isManualNavTopic(entry.title));
  if (!toc.length) {
    return res.status(502).send('Não foi possível carregar este manual. Tente novamente mais tarde.');
  }

  const tree = buildManualTreeNodes(toc);
  const settings = await getSettings();
  const chapterApiBase = `/acesso-cliente/manual-proprietario/${sectionSlug}/${docType}/capitulo`;
  const initialSlug = toc[0].slug;

  res.render('manual-document', {
    manual: {
      sectionSlug: manual.sectionSlug,
      sectionTitle: manual.sectionTitle,
      docTitle: manual.docTitle,
      chapterCount: manual.chapterCount || toc.length
    },
    toc,
    tree,
    initialSlug,
    chapterApiBase,
    nav: settings.nav,
    footer: settings.footer,
    active: '/acesso-cliente',
    requestUrl: `${buildPageUrl(req)}`,
    whatsappUrl: buildWhatsappUrl(undefined, settings.footer)
  });
}

async function renderClientDocumentsPage(req, res, pageId) {
  const isManualHub = pageId === 'manual-proprietario';
  const pageProjection = isManualHub
    ? { id: 1, title: 1, description: 1, hero: 1, 'content.intro': 1, 'content.backHref': 1, 'content.backLabel': 1 }
    : null;

  const [settings, pageDoc] = await Promise.all([
    getSettings(),
    Page.findOne({ id: pageId }, pageProjection).lean()
  ]);

  let page = pageDoc || readPageFromDatabaseJson(pageId);
  if (!page) {
    return res.status(404).send('Página não encontrada');
  }

  if (isManualHub) {
    const hubSource = getManualProprietarioContent()
      || (page.content?.sections ? enrichManualProprietarioContent(page.content) : null);
    page = {
      ...page,
      content: {
        intro: hubSource?.intro || page.content?.intro,
        backHref: page.content?.backHref,
        backLabel: page.content?.backLabel,
        sections: buildManualHubSections(hubSource)
      }
    };
  }

  res.render('client-documents', {
    page,
    nav: settings.nav,
    footer: settings.footer,
    active: '/acesso-cliente',
    requestUrl: `${buildPageUrl(req)}`,
    ogImage: absoluteAssetUrl(req, '/logo.png'),
    whatsappUrl: buildWhatsappUrl(undefined, settings.footer),
    isManualHub
  });
}

function filterProjectsByStatus(projects, status) {
  if (!status) return projects;
  return projects.filter((project) => (project.badge || '').trim() === status);
}

async function renderProjectsListing(req, res, options = {}) {
  const presetStatus = options.presetStatus || '';
  const [settings, listing] = await Promise.all([
    getSettings(),
    loadProjectsListingBase()
  ]);

  const allProjects = listing.rawProjects.map((project) => ({
    ...project,
    whatsappUrl: buildWhatsappUrl(`Olá! Tenho interesse no empreendimento ${project.title}.`, settings.footer)
  }));
  const projects = filterProjectsByStatus(allProjects, presetStatus);
  const { categoryOptions, statusOptions } = listing.filterOptions;
  const isLaunchListing = presetStatus === LAUNCH_STATUS;
  const bannerImage = isLaunchListing
    ? (projects[0]?.image || OBRAS_LISTING_BANNER)
    : OBRAS_LISTING_BANNER;

  res.render('obras', {
    nav: settings.nav,
    footer: settings.footer,
    projects,
    categoryOptions,
    statusOptions,
    presetStatus,
    hideStatusFilter: isLaunchListing,
    bannerImage,
    listingTitle: isLaunchListing ? 'Lançamentos' : 'Empreendimentos',
    listingSubtitle: isLaunchListing
      ? 'Conheça os empreendimentos em lançamento da AP Construções'
      : 'Conheça os principais empreendimentos realizados pela AP Construções',
    sectionTitle: isLaunchListing ? 'Empreendimentos em Lançamento' : 'Empreendimentos',
    sectionIntro: isLaunchListing
      ? 'Oportunidades exclusivas para investir ou morar com o padrão AP Construções.'
      : 'Conheça lançamentos inspirados nas melhores tendências globais de design urbano.',
    active: isLaunchListing ? '/lancamentos' : '/obras',
    requestUrl: `${buildPageUrl(req)}`,
    ogImage: absoluteAssetUrl(req, isLaunchListing
      ? (projects[0]?.image || OBRAS_LISTING_BANNER)
      : OBRAS_LISTING_BANNER),
    whatsappUrl: buildWhatsappUrl(undefined, settings.footer)
  });
}

app.get('/obras', async (req, res) => {
  try {
    await renderProjectsListing(req, res);
  } catch (error) {
    console.error('[ERROR] Erro ao carregar obras:', error);
    res.status(500).send('Erro ao carregar obras');
  }
});

app.get('/lancamentos', async (req, res) => {
  try {
    await renderProjectsListing(req, res, { presetStatus: LAUNCH_STATUS });
  } catch (error) {
    console.error('[ERROR] Erro ao carregar lançamentos:', error);
    res.status(500).send('Erro ao carregar lançamentos');
  }
});

async function loadProjectDetailContext(slug, req) {
  const settings = await getSettings();
  const project = normalizeProjectRecord(await Project.findOne({ id: slug }).lean());
  let page = await Page.findOne({ id: slug }).lean();

  if (!page && project) {
    page = await Page.findOne({ id: 'default-project-template' }).lean()
      || await Page.findOne({ id: 'monumental' }).lean();
  }
  if (!page) return null;

  const detailData = normalizeDetailData(
    JSON.parse(JSON.stringify(page.details || {})),
    page,
    project
  );
  detailData.heroImage = (project && project.image) || (page.hero && page.hero.image);

  const plantaGallery = await PlantaGallery.findOne({ projectId: slug }).lean();
  if (plantaGallery) {
    detailData.plantaGallery = mapGalleryImagesForDisplay(slug, plantaGallery.images, 'planta');
  }
  const projectGallery = await ProjectGallery.findOne({ projectId: slug }).lean();
  const galleryFromDb = mapGalleryImagesForDisplay(slug, projectGallery?.images, 'gallery');
  const mainImageSrc = normalizePublicPath(detailData.heroImage);
  const mainImageAlt = page.hero?.title || project?.title || slug;

  if (galleryFromDb.length) {
    detailData.galleryImages = galleryFromDb;
  } else if (mainImageSrc) {
    detailData.galleryImages = [{ src: mainImageSrc, alt: mainImageAlt }];
  }

  if (!detailData.location.mapQuery) {
    const addr = (detailData.summaryItems || []).find(i => i && ['Endereço', 'Localização'].includes(i.label));
    if (addr?.value) detailData.location.mapQuery = addr.value;
  }

  const requestUrl = `${buildPageUrl(req)}`;
  const ogImage = absoluteAssetUrl(req, detailData.heroImage || project?.image);
  const whatsappUrl = buildWhatsappUrl(`Olá! Tenho interesse no empreendimento ${page.hero?.title || project?.title || slug}.`, settings.footer);
  const sectionsNav = buildProjectSections(detailData);
  const schemaJson = buildProjectSchemaJson(page, project, detailData, requestUrl);
  const showSalesCta = !isDeliveredProject(project, detailData);

  return { project, page, detailData, requestUrl, ogImage, whatsappUrl, sectionsNav, schemaJson, showSalesCta };
}

// Generic route to serve project details under /obras/:slug
app.get('/obras/:slug', async (req, res) => {
  try {
    const settings = await getSettings();
    const ctx = await loadProjectDetailContext(req.params.slug, req);
    if (!ctx) return res.status(404).send('Página não encontrada');

    res.render('project', {
      page: ctx.page,
      project: ctx.project,
      nav: settings.nav,
      footer: settings.footer,
      detailData: ctx.detailData,
      sectionsNav: ctx.sectionsNav,
      active: req.path,
      requestUrl: ctx.requestUrl,
      ogImage: ctx.ogImage,
      whatsappUrl: ctx.whatsappUrl,
      schemaJson: ctx.schemaJson,
      showSalesCta: ctx.showSalesCta !== false
    });
  } catch (error) {
    console.error('[ERROR] Erro ao carregar projeto:', error);
    res.status(500).send('Erro ao carregar projeto');
  }
});

app.post('/api/contato', async (req, res) => {
  try {
    const { name, email, phone, address, message, projectInterest, website } = req.body || {};
    if (website) {
      return res.json({ success: true, message: 'Mensagem recebida com sucesso!' });
    }
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (!checkContactRateLimit(ip)) {
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim();
    const cleanMessage = String(message || '').trim();
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, message: 'Informe seu nome completo.' });
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Informe um e-mail válido.' });
    }
    if (!cleanMessage || cleanMessage.length < 10) {
      return res.status(400).json({ success: false, message: 'Descreva sua necessidade com pelo menos 10 caracteres.' });
    }

    const payload = {
      name: cleanName,
      email: cleanEmail,
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      message: cleanMessage,
      projectInterest: String(projectInterest || '').trim(),
      ip
    };

    await ContactMessage.create(payload);
    const emailed = await sendContactEmail(payload);

    res.json({
      success: true,
      message: emailed
        ? 'Mensagem enviada! Nossa equipe responderá em breve.'
        : 'Mensagem registrada! Nossa equipe responderá em breve.'
    });
  } catch (error) {
    console.error('[CONTACT] Erro:', error);
    res.status(500).json({ success: false, message: 'Não foi possível enviar sua mensagem. Tente WhatsApp ou telefone.' });
  }
});

app.get('/media/cover/:projectId', async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.projectId }, { image: 1 }).lean();
    const image = project?.image;
    if (!image) {
      return res.redirect(fallbackImage);
    }
    if (isDataImageUrl(image)) {
      const match = image.match(/^data:(image\/[\w+.+-]+);base64,(.+)$/s);
      if (!match) return res.status(404).end();
      res.set('Cache-Control', 'public, max-age=86400');
      res.type(match[1]);
      return res.send(Buffer.from(match[2], 'base64'));
    }
    return res.redirect(image);
  } catch (error) {
    console.error('[MEDIA] Erro ao servir capa:', error);
    res.status(500).end();
  }
});

app.get('/media/gallery/:projectId/:index', async (req, res) => {
  const index = parseInt(req.params.index, 10);
  if (Number.isNaN(index) || index < 0) return res.status(400).end();
  try {
    await serveGalleryImageFromDb(req.params.projectId, index, 'gallery', res);
  } catch (error) {
    console.error('[MEDIA] Erro ao servir galeria:', error);
    res.status(500).end();
  }
});

app.get('/media/planta/:projectId/:index', async (req, res) => {
  const index = parseInt(req.params.index, 10);
  if (Number.isNaN(index) || index < 0) return res.status(400).end();
  try {
    await serveGalleryImageFromDb(req.params.projectId, index, 'planta', res);
  } catch (error) {
    console.error('[MEDIA] Erro ao servir planta:', error);
    res.status(500).end();
  }
});

app.get('/media/page-hero/:pageId', async (req, res) => {
  try {
    const page = await Page.findOne({ id: req.params.pageId }, { hero: 1 }).lean();
    const image = page?.hero?.image;
    if (!image) return res.status(404).end();
    if (isDataImageUrl(image)) {
      const match = image.match(/^data:(image\/[\w+.+-]+);base64,(.+)$/s);
      if (!match) return res.status(404).end();
      res.set('Cache-Control', 'public, max-age=86400');
      res.type(match[1]);
      return res.send(Buffer.from(match[2], 'base64'));
    }
    return res.redirect(image);
  } catch (error) {
    console.error('[MEDIA] Erro ao servir hero da página:', error);
    res.status(500).end();
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const projects = await Project.find().lean();
    const staticPaths = ['/', '/sobre', '/lancamentos', '/obras', '/acesso-cliente', '/acesso-cliente/manual-proprietario', '/acesso-cliente/convencao-condominio', '/trabalhe-conosco', '/contato'];
    const urls = staticPaths.map(p => ({
      loc: `${SITE_URL}${p}`,
      changefreq: p === '/' ? 'weekly' : 'monthly',
      priority: p === '/' ? '1.0' : '0.8'
    }));
    for (const p of projects) {
      urls.push({
        loc: `${SITE_URL}/obras/${p.id}`,
        changefreq: 'monthly',
        priority: '0.7'
      });
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  } catch (error) {
    console.error('[SITEMAP] Erro:', error);
    res.status(500).type('text/plain').send('Erro ao gerar sitemap');
  }
});

// Legacy routes; use /obras/:slug instead
app.get('/monumental', (req, res) => res.redirect('/obras/monumental'));
app.get('/cosmopolitan', (req, res) => res.redirect('/obras/cosmopolitan'));

app.get('/admin', isAuthenticated, async (req, res) => {
  res.redirect('/admin/dashboard');
});

app.get('/admin/dashboard', isAuthenticated, async (req, res) => {
  try {
    const settings = await getSettings();
    const pages = await Page.find();
    const projects = sortProjectsByConstruction(
      (await Project.find().lean()).map(normalizeProjectRecord)
    );
    
    const plantaGalleries = await PlantaGallery.find();
    const projectGalleries = await ProjectGallery.find();
    const galleries = [...plantaGalleries, ...projectGalleries];
    
    res.render('admin-dashboard-new', { 
      nav: settings.nav, 
      footer: settings.footer, 
      pages,
      projects,
      galleries,
      username: req.session.admin.username,
      activeTab: req.query.tab || 'pages',
      settingsSaved: req.query.saved === '1'
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
    const pageObj = page.toObject ? page.toObject() : page;
    if (pageObj.hero?.image) {
      pageObj.hero = {
        ...pageObj.hero,
        image: resolvePageHeroForDisplay(pageObj.id, pageObj.hero.image)
      };
    }
    res.render('admin-edit-page', { page: pageObj, username: req.session.admin.username });
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

    // Mesclar details para não sobrescrever campos ausentes no formulário legado
    const existingPage = await Page.findOne({ id: req.params.id });
    if (!existingPage) {
      return res.status(404).json({ success: false, message: 'Página não encontrada' });
    }

    if (pageData.details && typeof pageData.details === 'object') {
      pageData.details = mergeDetails(existingPage.details || {}, pageData.details);
    }

    if (req.params.id === 'servicos' && pageData.content && typeof pageData.content === 'object') {
      pageData.content = normalizeServicesSection(pageData.content);
    }

    if (pageData.hero && typeof pageData.hero === 'object') {
      const incomingHeroImage = pageData.hero.image;
      if (!incomingHeroImage || incomingHeroImage === pageHeroMediaPath(req.params.id)) {
        pageData.hero.image = existingPage.hero?.image || '';
      } else if (!isDataImageUrl(incomingHeroImage)) {
        pageData.hero.image = normalizePublicPath(incomingHeroImage) || existingPage.hero?.image || '';
      }
    }

    if (pageData.content && typeof pageData.content === 'object' && ['acesso-cliente', 'manual-proprietario', 'convencao-condominio'].includes(req.params.id)) {
      const existingContent = existingPage.content ? JSON.parse(JSON.stringify(existingPage.content)) : {};
      if (req.params.id === 'manual-proprietario' || req.params.id === 'convencao-condominio') {
        const incomingSections = pageData.content.sections || [];
        pageData.content.sections = incomingSections.map((section, index) => {
          const prev = existingContent.sections?.[index] || {};
          return { ...prev, ...section };
        });
      }
      pageData.content = { ...existingContent, ...pageData.content };
    }

    const updatePayload = {
      title: pageData.title,
      description: pageData.description,
      hero: pageData.hero !== undefined ? pageData.hero : existingPage.hero,
      content: pageData.content !== undefined ? pageData.content : existingPage.content,
      details: pageData.details !== undefined ? pageData.details : existingPage.details
    };

    existingPage.set(updatePayload);
    if (updatePayload.details) existingPage.markModified('details');
    if (updatePayload.hero) existingPage.markModified('hero');
    if (updatePayload.content) existingPage.markModified('content');
    const updatedPage = await existingPage.save();

    if (req.params.id === 'manual-proprietario') {
      invalidateManualContentCache();
      await refreshManualContentFromDb();
    }

    console.log(`[UPDATE] Página atualizada: ${req.params.id}`);
    res.json({ success: true, message: 'Página atualizada com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao salvar página:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar página: ' + error.message });
  }
});

// ===== ADMIN: MANUAL DO PROPRIETÁRIO — CAPÍTULOS =====

app.post('/admin/crawl-manual-document/:sectionSlug/:docType', isAuthenticated, async (req, res) => {
  try {
    const { sectionSlug, docType } = req.params;
    const found = await findManualDocInPage(sectionSlug, docType);
    if (!found.doc?.href) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado ou sem URL' });
    }
    const children = await crawlDocumentChildren(found.doc);
    await saveManualDocumentChildren(sectionSlug, docType, children);
    const meta = findManualDocumentMeta(sectionSlug, docType);
    if (meta) await buildManualDocumentRecord(meta);
    res.json({
      success: true,
      message: `${children.length} capítulo(s) descobertos a partir do link do documento`,
      children
    });
  } catch (error) {
    console.error('[ADMIN] crawl-manual-document:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/admin/sync-manual-document/:sectionSlug/:docType', isAuthenticated, async (req, res) => {
  try {
    const { sectionSlug, docType } = req.params;
    const meta = findManualDocumentMeta(sectionSlug, docType);
    if (!meta) {
      return res.status(404).json({ success: false, message: 'Manual não encontrado' });
    }
    const force = Boolean(req.body?.force);
    let synced = 0;
    let failed = 0;
    for (const child of meta.children) {
      const chapterMeta = {
        sectionSlug: meta.sectionSlug,
        sectionTitle: meta.sectionTitle,
        docType: meta.docType,
        docTitle: meta.docTitle,
        slug: child.slug || chapterSlugFromHref(child.href, child.title),
        title: child.title,
        sourceHref: child.href
      };
      const result = await getOrFetchManualChapter(chapterMeta, { force });
      if (result?.html) synced += 1;
      else failed += 1;
    }
    const manual = await buildManualDocumentRecord(meta);
    res.json({
      success: true,
      message: `${synced} capítulo(s) com conteúdo sincronizado`,
      synced,
      failed,
      chapterCount: manual?.chapterCount || 0
    });
  } catch (error) {
    console.error('[ADMIN] sync-manual-document:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/admin/sync-manual-chapter/:sectionSlug/:docType', isAuthenticated, async (req, res) => {
  try {
    const { sectionSlug, docType } = req.params;
    const { href, title } = req.body;
    if (!href || !title) {
      return res.status(400).json({ success: false, message: 'Título e URL do capítulo são obrigatórios' });
    }
    const docMeta = findManualDocumentMeta(sectionSlug, docType);
    if (!docMeta) {
      return res.status(404).json({ success: false, message: 'Manual não encontrado' });
    }
    const slug = chapterSlugFromHref(href, title);
    const chapterMeta = {
      sectionSlug: docMeta.sectionSlug,
      sectionTitle: docMeta.sectionTitle,
      docType: docMeta.docType,
      docTitle: docMeta.docTitle,
      slug,
      title: String(title).trim(),
      sourceHref: String(href).trim()
    };
    const result = await getOrFetchManualChapter(chapterMeta, { force: true });
    if (!result?.html) {
      return res.status(502).json({ success: false, message: 'Não foi possível baixar o conteúdo deste capítulo' });
    }
    await buildManualDocumentRecord(docMeta);
    res.json({ success: true, message: 'Capítulo sincronizado!', slug, title: chapterMeta.title });
  } catch (error) {
    console.error('[ADMIN] sync-manual-chapter:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== ROTAS PARA EDITAR PROJETOS (DETALHES BÁSICOS) =====

app.get('/admin/edit-project/:id', isAuthenticated, async (req, res) => {
  try {
    const project = normalizeProjectRecord(await Project.findOne({ id: req.params.id }).lean());
    if (!project) {
      return res.status(404).send('Projeto não encontrado');
    }
    // Buscar página correspondente para obter detalhes técnicos e localização
    const page = await Page.findOne({ id: req.params.id });
    // Renderizar a nova view refatorada com tabs
    res.render('admin-edit-project-new', { project, page, username: req.session.admin.username });
  } catch (error) {
    console.error('Erro ao carregar projeto:', error);
    res.status(500).send('Erro ao carregar projeto');
  }
});

// Rota legada — redireciona para a rota canônica
app.get('/admin/edit-project-new/:id', isAuthenticated, (req, res) => {
  res.redirect(301, `/admin/edit-project/${req.params.id}`);
});

app.post('/admin/upload-main-image/:id', isAuthenticated, uploadForProject('imageFile', 'project_main'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }

    let imagePath;
    try {
      imagePath = await persistUploadedImage(req.file);
    } catch (uploadError) {
      return res.status(400).json({ success: false, message: uploadError.message });
    }

    const updatedProject = await Project.findOneAndUpdate(
      { id: req.params.id },
      { image: imagePath },
      { new: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
    }
    invalidateProjectsListingCache();

    await Page.findOneAndUpdate({ id: req.params.id }, { 'hero.image': imagePath });
    console.log(`[UPLOAD] Imagem principal atualizada: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Imagem principal atualizada!',
      image: isDataImageUrl(imagePath) ? projectCoverMediaPath(req.params.id) : imagePath
    });
  } catch (error) {
    console.error('[ERROR] Erro ao enviar imagem principal:', error);
    res.status(500).json({ success: false, message: 'Erro ao enviar imagem: ' + error.message });
  }
});

app.post('/admin/save-project/:id', isAuthenticated, uploadForProject('imageFile', 'project_main'), handleMulterError, async (req, res) => {
  try {
    const existing = await Project.findOne({ id: req.params.id });
    if (!existing) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
    }

    const body = req.body || {};
    const title = String(body.title || existing.title || '').trim();
    const category = normalizeCategoryValue(body.category || existing.category);

    if (!title) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Título do projeto é obrigatório' });
    }
    if (!category) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Categoria do projeto é obrigatória' });
    }

    const construction = parseConstructionYearMonth(body);
    const update = {
      title,
      description: body.description !== undefined ? String(body.description) : existing.description,
      category,
      badge: body.badge !== undefined ? String(body.badge).trim() : existing.badge,
      href: body.href !== undefined ? String(body.href).trim() : existing.href,
      constructionYear: body.constructionYear !== undefined ? construction.constructionYear : existing.constructionYear,
      constructionMonth: body.constructionMonth !== undefined ? construction.constructionMonth : existing.constructionMonth
    };

    if (req.file) {
      try {
        update.image = await persistUploadedImage(req.file);
        console.log(`[UPLOAD] Imagem de projeto: ${req.file.originalname}`);
      } catch (uploadError) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: uploadError.message });
      }
    } else if (existing.image) {
      update.image = preserveStoredImageValue(existing.image);
    }

    const updatedProject = await Project.findOneAndUpdate({ id: req.params.id }, update, { new: true });

    const pageUpdate = {};
    if (update.image) {
      pageUpdate['hero.image'] = update.image;
    }

    const detailTagValue = (body.detailTag !== undefined ? body.detailTag : update.badge) || '';
    await updatePageDetails(req.params.id, (details) => {
      details.detailTag = detailTagValue.trim();
    });

    if (body.detailTag !== undefined) {
      await Project.findOneAndUpdate({ id: req.params.id }, { badge: body.detailTag.trim() });
    }

    if (Object.keys(pageUpdate).length > 0) {
      await Page.findOneAndUpdate({ id: req.params.id }, pageUpdate);
      console.log(`[SYNC] Imagem sincronizada na página: ${req.params.id}`);
    }

    console.log(`[UPDATE] Projeto atualizado: ${req.params.id}`);
    invalidateProjectsListingCache();
    res.json({ success: true, message: 'Projeto atualizado com sucesso!', image: updatedProject.image });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
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

    const { alt, title } = req.body;
    let imagePath;
    try {
      imagePath = await persistUploadedImage(req.file);
    } catch (uploadError) {
      return res.status(400).json({ success: false, message: uploadError.message });
    }

    console.log(`[UPLOAD-PLANTA] Path web: ${imagePath.substring(0, 80)}...`);

    if (!alt || alt.trim().length === 0) {
      console.warn(`[UPLOAD-PLANTA] ✗ Alt text vazio para ${req.file.originalname}`);
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log(`[UPLOAD-PLANTA] Arquivo deletado: ${req.file.path}`);
        }
      } catch (delErr) {
        // Ignora erro de deletar (pode ser EROFS na Vercel)
        console.warn(`[UPLOAD-PLANTA] Não foi possível deletar arquivo: ${delErr.message}`);
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

    plantaGallery.markModified('images');
    await plantaGallery.save();
    console.log(`[UPLOAD-PLANTA] ✓ Salvo em BD: ${req.params.projectId}`);
    console.log(`[UPLOAD-PLANTA] Total de imagens: ${plantaGallery.images.length}`);

    const savedIndex = plantaGallery.images.length - 1;
    const savedImage = plantaGallery.images[savedIndex];
    res.json({
      success: true,
      message: 'Imagem de planta enviada com sucesso!',
      image: {
        alt: savedImage.alt,
        title: savedImage.title || '',
        uploadedAt: savedImage.uploadedAt,
        index: savedIndex,
        src: galleryMediaPath(req.params.projectId, savedIndex, 'planta')
      }
    });
  } catch (error) {
    console.error('[UPLOAD-PLANTA] ✗ Erro:', error.message);
    
    // Verifica erro de sistema de arquivos read-only (Vercel)
    if (error.code === 'EROFS' || error.message.includes('read-only')) {
      console.error('[UPLOAD-PLANTA] ✗ Sistema de arquivos read-only (Vercel). Upload não suportado em ambiente serverless.');
      return res.status(500).json({ 
        success: false, 
        message: 'Upload de arquivos não é suportado no ambiente de produção atual. Use um serviço de armazenamento externo ou servidor com sistema de arquivos gravável.' 
      });
    }
    
    try {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log(`[UPLOAD-PLANTA] Arquivo deletado por erro: ${req.file.path}`);
      }
    } catch (delErr) {
      // Ignora erro de deletar
    }
    res.status(500).json({ success: false, message: 'Erro ao enviar imagem de planta: ' + error.message });
  }
});

app.post('/admin/update-project-page-content/:projectId', isAuthenticated, async (req, res) => {
  try {
    const {
      heroSubtitle,
      pageDescription,
      detailHeadline,
      detailBullets,
      plantaSectionTag
    } = req.body;
    const projectId = req.params.projectId;
    const page = await Page.findOne({ id: projectId });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Página do projeto não encontrada' });
    }

    let needsPageSave = false;
    if (heroSubtitle !== undefined) {
      page.hero = page.hero || {};
      page.hero.subtitle = heroSubtitle || '';
      page.markModified('hero');
      needsPageSave = true;
    }
    if (pageDescription !== undefined) {
      page.description = pageDescription || '';
      needsPageSave = true;
    }

    await updatePageDetails(projectId, (details) => {
      if (detailHeadline !== undefined) details.detailHeadline = detailHeadline || '';
      if (plantaSectionTag !== undefined) details.plantaSectionTag = plantaSectionTag || 'Distribuição de Espaços';
      if (detailBullets !== undefined) {
        details.detailBullets = Array.isArray(detailBullets)
          ? detailBullets
          : (detailBullets ? String(detailBullets).split('\n').map(s => s.trim()).filter(Boolean) : []);
      }
    });

    if (needsPageSave) await page.save();

    res.json({ success: true, message: 'Conteúdo da página salvo com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao salvar conteúdo da página:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar conteúdo: ' + error.message });
  }
});

app.post('/admin/update-planta-details/:projectId', isAuthenticated, async (req, res) => {
  try {
    const { plantaSectionTag, plantaTitle, plantaSubtitle, plantaDescription, plantaHighlights } = req.body;

    const page = await updatePageDetails(req.params.projectId, (details) => {
      if (plantaSectionTag !== undefined) details.plantaSectionTag = plantaSectionTag || 'Distribuição de Espaços';
      if (plantaTitle !== undefined) details.plantaTitle = plantaTitle || '';
      if (plantaSubtitle !== undefined) details.plantaSubtitle = plantaSubtitle || '';
      if (plantaDescription !== undefined) details.plantaDescription = plantaDescription || '';
      if (plantaHighlights !== undefined) {
        details.plantaHighlights = Array.isArray(plantaHighlights)
          ? plantaHighlights
          : (plantaHighlights ? [plantaHighlights] : []);
      }
    });

    if (!page) {
      return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
    }

    console.log(`[UPDATE] Detalhes da planta atualizados para o projeto: ${req.params.projectId}`);
    res.json({ success: true, message: 'Detalhes da planta atualizados com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar detalhes da planta:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar detalhes da planta' });
  }
});

app.post('/admin/delete-planta-image/:projectId/:index', isAuthenticated, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ success: false, message: 'Índice de imagem inválido' });
    }

    const plantaGallery = await PlantaGallery.findOne({ projectId: req.params.projectId });
    if (!plantaGallery || !plantaGallery.images[index]) {
      return res.status(404).json({ success: false, message: 'Imagem não encontrada' });
    }

    const src = plantaGallery.images[index].src;
    if (!isDataImageUrl(src)) {
      const webPath = normalizePublicPath(src);
      if (webPath) {
        const filePath = path.join(__dirname, 'public', webPath.replace(/^\//, ''));
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[DELETE] Arquivo de planta removido: ${filePath}`);
          }
        } catch (delErr) {
          console.warn(`[DELETE] Erro ao deletar arquivo de planta: ${delErr.message}`);
        }
      }
    }

    plantaGallery.images.splice(index, 1);
    plantaGallery.markModified('images');
    await plantaGallery.save();
    console.log(`[UPDATE] Imagem de planta removida da galeria do projeto: ${req.params.projectId}`);

    res.json({ success: true, message: 'Imagem de planta removida com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao remover imagem de planta:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover imagem de planta: ' + error.message });
  }
});

// ===== ROTAS PARA INFORMAÇÕES TÉCNICAS E LOCALIZAÇÃO =====

app.post('/admin/update-technical-info/:projectId', isAuthenticated, async (req, res) => {
  try {
    const { summaryItems } = req.body;
    const projectId = req.params.projectId;

    if (!Array.isArray(summaryItems)) {
      return res.status(400).json({ success: false, message: 'Formato inválido para summaryItems. Deve ser um array.' });
    }

    const normalizedSummaryItems = summaryItems
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        label: String(item.label || '').trim(),
        value: String(item.value || '').trim()
      }))
      .filter(item => item.label.length > 0);

    const page = await updatePageDetails(projectId, (details) => {
      const existingAddress = (details.summaryItems || []).find(item => item && item.label === 'Endereço');
      const hasAddressInPayload = normalizedSummaryItems.some(item => item.label === 'Endereço');

      details.summaryItems = hasAddressInPayload
        ? normalizedSummaryItems
        : (existingAddress ? [existingAddress, ...normalizedSummaryItems] : normalizedSummaryItems);
    });

    if (!page) {
      return res.status(404).json({ success: false, message: 'Página do projeto não encontrada' });
    }

    console.log(`[UPDATE] Informações técnicas atualizadas para: ${projectId}`);
    res.json({ success: true, message: 'Informações técnicas salvas com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao salvar informações técnicas:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar informações técnicas: ' + error.message });
  }
});

app.post('/admin/update-location-info/:projectId', isAuthenticated, async (req, res) => {
  try {
    const { address, locationTitle, locationSubtitle, locationDescription, locationMapQuery, locationFeatures } = req.body;
    const projectId = req.params.projectId;

    const parsedFeatures = parseJsonField(locationFeatures, null);
    if (locationFeatures && parsedFeatures === null) {
      return res.status(400).json({ success: false, message: 'Formato inválido para locationFeatures. Deve ser um array JSON.' });
    }

    const page = await updatePageDetails(projectId, (details) => {
      details.summaryItems = upsertSummaryItems(details.summaryItems, [
        { label: 'Endereço', value: address || '' }
      ]);

      const currentLocation = details.location && typeof details.location === 'object' ? details.location : {};
      details.location = {
        title: locationTitle !== undefined ? (locationTitle || 'Localização') : (currentLocation.title || 'Localização'),
        subtitle: locationSubtitle !== undefined ? (locationSubtitle || '') : (currentLocation.subtitle || ''),
        description: locationDescription !== undefined ? (locationDescription || '') : (currentLocation.description || ''),
        mapQuery: locationMapQuery !== undefined ? (locationMapQuery || '') : (currentLocation.mapQuery || ''),
        features: Array.isArray(parsedFeatures)
          ? parsedFeatures
          : (Array.isArray(currentLocation.features) ? currentLocation.features : [])
      };
    });

    if (!page) {
      return res.status(404).json({ success: false, message: 'Página do projeto não encontrada' });
    }

    console.log(`[UPDATE] Informações de localização atualizadas para: ${projectId}`);
    res.json({ success: true, message: 'Informações de localização salvas com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao salvar informações de localização:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar informações de localização: ' + error.message });
  }
});

app.post('/admin/update-common-areas/:projectId', isAuthenticated, async (req, res) => {
  try {
    const { commonAreasSectionTag, commonAreasTitle, commonAreasIntro, commonAreas } = req.body;
    const projectId = req.params.projectId;

    const parsedCommonAreas = parseJsonField(commonAreas, null);
    if (commonAreas !== undefined && commonAreas !== null && commonAreas !== '' && parsedCommonAreas === null) {
      return res.status(400).json({ success: false, message: 'Formato inválido para commonAreas. Deve ser um array JSON.' });
    }

    const page = await updatePageDetails(projectId, (details) => {
      if (commonAreasSectionTag !== undefined) details.commonAreasSectionTag = commonAreasSectionTag || 'Conforto & Lazer';
      if (commonAreasTitle !== undefined) details.commonAreasTitle = commonAreasTitle || '';
      if (commonAreasIntro !== undefined) details.commonAreasIntro = commonAreasIntro || '';
      if (Array.isArray(parsedCommonAreas)) {
        details.commonAreas = parsedCommonAreas.map(area => ({
          label: area.label || '',
          icon: area.icon || 'fas fa-check',
          group: area.group || ''
        }));
      }
    });

    if (!page) {
      return res.status(404).json({ success: false, message: 'Página do projeto não encontrada' });
    }

    console.log(`[UPDATE] Áreas comuns atualizadas para: ${projectId}`);
    res.json({ success: true, message: 'Áreas comuns salvas com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao salvar áreas comuns:', error);
    res.status(500).json({ success: false, message: 'Erro ao salvar áreas comuns: ' + error.message });
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
    const plantaGallery = await PlantaGallery.findOne({ projectId: req.params.projectId }).lean();
    const images = mapGalleryImagesForApi(req.params.projectId, plantaGallery?.images, 'planta');
    res.json({ projectId: req.params.projectId, images });
  } catch (error) {
    console.error('Erro ao obter galeria de planta:', error);
    res.status(500).json({ success: false, message: 'Erro ao obter galeria' });
  }
});

app.get('/admin/get-gallery/:projectId', isAuthenticated, async (req, res) => {
  try {
    const projectGallery = await ProjectGallery.findOne({ projectId: req.params.projectId }).lean();
    const images = mapGalleryImagesForApi(req.params.projectId, projectGallery?.images, 'gallery');
    res.json({ projectId: req.params.projectId, images });
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

    const { alt, title } = req.body;
    let imagePath;
    try {
      imagePath = await persistUploadedImage(req.file);
    } catch (uploadError) {
      return res.status(400).json({ success: false, message: uploadError.message });
    }

    console.log(`[UPLOAD-GALLERY] Path web: ${imagePath.substring(0, 80)}...`);

    if (!alt || alt.trim().length === 0) {
      console.warn(`[UPLOAD-GALLERY] ✗ Alt text vazio para ${req.file.originalname}`);
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log(`[UPLOAD-GALLERY] Arquivo deletado: ${req.file.path}`);
        }
      } catch (delErr) {
        // Ignora erro de deletar (pode ser EROFS na Vercel)
        console.warn(`[UPLOAD-GALLERY] Não foi possível deletar arquivo: ${delErr.message}`);
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

    projectGallery.markModified('images');
    await projectGallery.save();
    console.log(`[UPLOAD-GALLERY] ✓ Salvo em BD: ${req.params.projectId}`);
    console.log(`[UPLOAD-GALLERY] Total de imagens: ${projectGallery.images.length}`);

    const savedIndex = projectGallery.images.length - 1;
    const savedImage = projectGallery.images[savedIndex];
    res.json({
      success: true,
      message: 'Imagem de galeria enviada com sucesso!',
      image: {
        alt: savedImage.alt,
        title: savedImage.title || '',
        uploadedAt: savedImage.uploadedAt,
        index: savedIndex,
        src: galleryMediaPath(req.params.projectId, savedIndex, 'gallery')
      }
    });
  } catch (error) {
    console.error('[UPLOAD-GALLERY] ✗ Erro:', error.message);
    
    // Verifica erro de sistema de arquivos read-only (Vercel)
    if (error.code === 'EROFS' || error.message.includes('read-only')) {
      console.error('[UPLOAD-GALLERY] ✗ Sistema de arquivos read-only (Vercel). Upload não suportado em ambiente serverless.');
      return res.status(500).json({ 
        success: false, 
        message: 'Upload de arquivos não é suportado no ambiente de produção atual. Use um serviço de armazenamento externo ou servidor com sistema de arquivos gravável.' 
      });
    }
    
    try {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log(`[UPLOAD-GALLERY] Arquivo deletado por erro: ${req.file.path}`);
      }
    } catch (delErr) {
      // Ignora erro de deletar
    }
    res.status(500).json({ success: false, message: 'Erro ao enviar imagem de galeria: ' + error.message });
  }
});

// Garantir que as pastas de imagens existam para um projeto
app.post('/admin/ensure-project-folders/:projectId', isAuthenticated, (req, res) => {
  try {
    const projectId = req.params.projectId;
    const folder = sanitizeFolderName(projectId);
    
    // Criar pasta de galeria
    const galleryDest = path.join(projectGalleryBase, folder);
    fs.mkdirSync(galleryDest, { recursive: true });
    console.log(`[FOLDER] Garantido gallery para: ${galleryDest}`);
    
    // Criar pasta de planta
    const plantaDest = path.join(plantaBase, folder);
    fs.mkdirSync(plantaDest, { recursive: true });
    console.log(`[FOLDER] Garantido planta para: ${plantaDest}`);
    
    return res.json({ 
      success: true, 
      galleryPath: toWebPath(galleryDest),
      plantaPath: toWebPath(plantaDest)
    });
  } catch (err) {
    console.error('[ERROR] Falha ao garantir pastas do projeto:', err);
    return res.status(500).json({ success: false, message: 'Erro ao garantir pastas do projeto' });
  }
});

app.post('/admin/delete-gallery-image/:projectId/:index', isAuthenticated, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ success: false, message: 'Índice de imagem inválido' });
    }

    const projectGallery = await ProjectGallery.findOne({ projectId: req.params.projectId });
    if (!projectGallery || !projectGallery.images[index]) {
      return res.status(404).json({ success: false, message: 'Imagem não encontrada' });
    }

    const src = projectGallery.images[index].src;
    if (!isDataImageUrl(src)) {
      const webPath = normalizePublicPath(src);
      if (webPath) {
        const filePath = path.join(__dirname, 'public', webPath.replace(/^\//, ''));
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[DELETE] Arquivo de galeria removido: ${filePath}`);
          }
        } catch (delErr) {
          console.warn(`[DELETE] Erro ao deletar arquivo de galeria: ${delErr.message}`);
        }
      }
    }

    projectGallery.images.splice(index, 1);
    projectGallery.markModified('images');
    await projectGallery.save();
    console.log(`[UPDATE] Imagem de galeria removida da coleção do projeto: ${req.params.projectId}`);

    res.json({ success: true, message: 'Imagem de galeria removida com sucesso!' });
  } catch (error) {
    console.error('[ERROR] Erro ao remover imagem de galeria:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover imagem de galeria: ' + error.message });
  }
});

app.post('/admin/update-gallery-meta/:projectId/:index', isAuthenticated, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const kind = req.body.kind === 'planta' ? 'planta' : 'gallery';
    const { alt, title } = req.body;
    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ success: false, message: 'Índice inválido' });
    }
    if (!alt || !String(alt).trim()) {
      return res.status(400).json({ success: false, message: 'Descrição (alt) é obrigatória' });
    }
    const Model = kind === 'planta' ? PlantaGallery : ProjectGallery;
    const gallery = await Model.findOne({ projectId: req.params.projectId });
    if (!gallery || !gallery.images[index]) {
      return res.status(404).json({ success: false, message: 'Imagem não encontrada' });
    }
    gallery.images[index].alt = String(alt).trim();
    gallery.images[index].title = title ? String(title).trim() : '';
    gallery.markModified('images');
    await gallery.save();
    res.json({
      success: true,
      message: 'Imagem atualizada!',
      image: {
        alt: gallery.images[index].alt,
        title: gallery.images[index].title || '',
        index,
        src: galleryMediaPath(req.params.projectId, index, kind)
      }
    });
  } catch (error) {
    console.error('[ERROR] Erro ao atualizar meta da galeria:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/admin/reorder-gallery/:projectId', isAuthenticated, async (req, res) => {
  try {
    const order = req.body.order;
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, message: 'Ordem inválida' });
    }
    const gallery = await ProjectGallery.findOne({ projectId: req.params.projectId });
    if (!gallery) {
      return res.status(404).json({ success: false, message: 'Galeria não encontrada' });
    }
    gallery.images = reorderImageArray(gallery.images, order);
    gallery.markModified('images');
    await gallery.save();
    res.json({ success: true, message: 'Ordem da galeria atualizada!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/admin/reorder-planta/:projectId', isAuthenticated, async (req, res) => {
  try {
    const order = req.body.order;
    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, message: 'Ordem inválida' });
    }
    const gallery = await PlantaGallery.findOne({ projectId: req.params.projectId });
    if (!gallery) {
      return res.status(404).json({ success: false, message: 'Galeria não encontrada' });
    }
    gallery.images = reorderImageArray(gallery.images, order);
    gallery.markModified('images');
    await gallery.save();
    res.json({ success: true, message: 'Ordem das plantas atualizada!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/admin/project-completion/:projectId', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findOne({ id: projectId }).lean();
    const page = await Page.findOne({ id: projectId }).lean();
    const projectGallery = await ProjectGallery.findOne({ projectId }).lean();
    const plantaGallery = await PlantaGallery.findOne({ projectId }).lean();
    const technicalItems = (page?.details?.summaryItems || []).filter((i) => i && i.label && i.label !== 'Endereço');

    const checks = {
      basic: Boolean(project?.title && project?.description && project?.image),
      planta: Boolean(plantaGallery?.images?.length),
      technical: technicalItems.length > 0,
      location: Boolean(page?.details?.location?.mapQuery || page?.details?.location?.description),
      commonAreas: Boolean(page?.details?.commonAreas?.length),
      gallery: Boolean(projectGallery?.images?.length)
    };
    const done = Object.values(checks).filter(Boolean).length;
    res.json({ success: true, checks, done, total: Object.keys(checks).length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/admin/upload-page-hero/:pageId', isAuthenticated, uploadForProject('imageFile', 'gallery'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }
    let imagePath;
    try {
      imagePath = await persistUploadedImage(req.file);
    } catch (uploadError) {
      return res.status(400).json({ success: false, message: uploadError.message });
    }
    const page = await Page.findOne({ id: req.params.pageId });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Página não encontrada' });
    }
    page.hero = page.hero || {};
    page.hero.image = imagePath;
    page.markModified('hero');
    await page.save();
    const displayUrl = isDataImageUrl(imagePath)
      ? pageHeroMediaPath(req.params.pageId)
      : normalizePublicPath(imagePath);
    res.json({ success: true, message: 'Banner atualizado!', image: displayUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/admin/duplicate-project/:id', isAuthenticated, async (req, res) => {
  try {
    const sourceId = req.params.id;
    let newId = String(req.body.newId || '').trim().toLowerCase();
    if (!newId) {
      newId = `${sourceId}-copia-${Date.now()}`;
    }
    if (!/^[a-z0-9-]+$/.test(newId)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }
    if (await Project.findOne({ id: newId })) {
      return res.status(400).json({ success: false, message: 'Já existe um projeto com este ID' });
    }

    const sourceProject = await Project.findOne({ id: sourceId }).lean();
    const sourcePage = await Page.findOne({ id: sourceId }).lean();
    if (!sourceProject) {
      return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
    }

    const newTitle = String(req.body.title || `${sourceProject.title} (cópia)`).trim();
    await Project.create({
      id: newId,
      title: newTitle,
      description: sourceProject.description || '',
      badge: sourceProject.badge || '',
      href: `/obras/${newId}`,
      image: sourceProject.image || '',
      category: sourceProject.category || '',
      constructionYear: sourceProject.constructionYear,
      constructionMonth: sourceProject.constructionMonth,
      createdAt: new Date()
    });

    if (sourcePage) {
      const pageCopy = JSON.parse(JSON.stringify(sourcePage));
      delete pageCopy._id;
      pageCopy.id = newId;
      pageCopy.title = newTitle;
      if (pageCopy.hero) pageCopy.hero.title = newTitle;
      await Page.create(pageCopy);
    } else {
      await Page.create({
        id: newId,
        title: newTitle,
        description: sourceProject.description || '',
        hero: { title: newTitle, subtitle: '', image: sourceProject.image || '' },
        details: {}
      });
    }

    const srcGallery = await ProjectGallery.findOne({ projectId: sourceId }).lean();
    const srcPlanta = await PlantaGallery.findOne({ projectId: sourceId }).lean();
    await ProjectGallery.create({ projectId: newId, images: srcGallery?.images ? JSON.parse(JSON.stringify(srcGallery.images)) : [] });
    await PlantaGallery.create({ projectId: newId, images: srcPlanta?.images ? JSON.parse(JSON.stringify(srcPlanta.images)) : [] });

    invalidateProjectsListingCache();
    res.json({ success: true, message: 'Empreendimento duplicado!', projectId: newId });
  } catch (error) {
    console.error('[ERROR] Erro ao duplicar projeto:', error);
    res.status(500).json({ success: false, message: error.message });
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

app.post('/admin/save-site-settings', isAuthenticated, async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const currentFooter = normalizeFooter(settings?.footer);
    const body = req.body || {};

    const contact = [];
    const contactItems = body.contactItems;
    const contactList = Array.isArray(contactItems) ? contactItems : (contactItems ? [contactItems] : []);
    contactList.forEach((item, index) => {
      if (!item || isWhatsappContactItem(item) || !String(item.value || '').trim()) return;
      const slot = DEFAULT_FOOTER_CONTACT[index] || {};
      contact.push({
        icon: item.icon || slot.icon || currentFooter.contact[index]?.icon || 'fas fa-info-circle',
        label: String(item.label || '').trim() || slot.label || '',
        value: String(item.value || '').trim()
      });
    });

    const socialItems = body.socialItems;
    const socialList = Array.isArray(socialItems) ? socialItems : (socialItems ? [socialItems] : []);
    const social = DEFAULT_FOOTER_SOCIAL.map((item) => {
      const posted = socialList.find((entry) => entry.platform === item.platform) || {};
      return {
        ...item,
        url: String(posted.url || '').trim()
      };
    });

    const footer = {
      ...currentFooter,
      contact: contact.length ? contact : currentFooter.contact,
      social,
      hr: {
        email: String(body.hrEmail || '').trim(),
        phone: String(body.hrPhone || '').trim(),
        note: String(body.hrNote || '').trim()
      }
    };

    await Setting.findOneAndUpdate({}, { footer }, { upsert: true });
    res.redirect('/admin/dashboard?tab=settings&saved=1');
  } catch (error) {
    console.error('[ERROR] Erro ao salvar configurações do site:', error);
    res.redirect('/admin/dashboard?tab=settings&error=1');
  }
});

// ===== ROTAS PARA GERENCIAR PROJETOS (CRUD) =====

app.post('/admin/create-project', isAuthenticated, async (req, res) => {
  try {
    const { id, title, description, badge, href, image, category } = req.body;
    const construction = parseConstructionYearMonth(req.body);

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

    const normalizedImage = image ? normalizePublicPath(image) : '';
    if (image && !normalizedImage) {
      return res.json({ success: false, message: 'Imagem inválida. Envie um arquivo de imagem, não dados embutidos no formulário.' });
    }

    const newProject = new Project({
      id: id.trim(),
      title: title.trim(),
      description: description ? description.trim() : '',
      badge: badge ? badge.trim() : '',
      href: href ? href.trim() : `/obras/${id.trim()}`,
      image: normalizedImage,
      category: category.trim(),
      constructionYear: construction.constructionYear,
      constructionMonth: construction.constructionMonth,
      createdAt: new Date()
    });

    await newProject.save();
    invalidateProjectsListingCache();
    console.log(`[CREATE] Novo projeto criado: ${id}`);

    // Criar página correspondente para detalhes do projeto
    const newPage = new Page({
      id: id.trim(),
      title: title.trim(),
      description: description ? description.trim() : '',
      hero: {
        title: title.trim(),
        subtitle: '',
        image: normalizedImage
      },
      details: { // Detalhes textuais do projeto
        detailTag: badge ? badge.trim() : '',
        summaryItems: [],
        plantaTitle: 'Distribuição de Espaços',
        plantaSubtitle: '',
        plantaDescription: '',
        plantaHighlights: [],
        commonAreas: [],
        location: {
          title: 'Localização',
          description: '',
          features: []
        }
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
      const plantaPath = path.join(plantaBase, folderName);

      if (!fs.existsSync(projectGalleryPath)) {
        fs.mkdirSync(projectGalleryPath, { recursive: true });
        console.log(`[CREATE] Pasta da galeria geral criada: ${projectGalleryPath}`);
      }
      if (!fs.existsSync(plantaPath)) {
        fs.mkdirSync(plantaPath, { recursive: true });
        console.log(`[CREATE] Pasta da galeria de planta criada: ${plantaPath}`);
      }
    } catch (e) {
      console.error('[ERROR] Não foi possível criar pastas de galeria/planta:', e);
    }

    res.json({ success: true, message: 'Projeto criado com sucesso!', projectId: id.trim() });
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
    invalidateProjectsListingCache();
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
