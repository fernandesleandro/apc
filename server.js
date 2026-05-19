const express = require('express');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const dbFile = path.join(__dirname, 'data', 'db.json');
const descriptionsDir = path.join(__dirname, 'data', 'descriptions');

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, {});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const defaultData = {
  nav: [
    { title: 'Início', url: '/' },
    { title: 'Sobre Nós', url: '/sobre' },
    { title: 'Serviços', url: '/#servicos' },
    { title: 'Obras', url: '/obras' },
    { title: 'Contato', url: '/contato' }
  ],
  footer: {
    company: 'AP Construções',
    description: 'Referência em engenharia civil de alta performance e incorporações exclusivas. Desenvolvemos ecossistemas inteligentes alinhados com o futuro do morar e do investir.',
    links: [
      { title: 'Início', url: '/' },
      { title: 'Sobre Nós', url: '/sobre' },
      { title: 'Serviços', url: '/#servicos' },
      { title: 'Obras', url: '/obras' },
      { title: 'Contato', url: '/contato' }
    ],
    contact: [
      { label: 'Telefone Central', value: '(61) 2195-8300' },
      { label: 'WhatsApp Comercial', value: '(61) 2195-8300' },
      { label: 'Endereço Corporativo', value: 'SCS Qd. 02 Bl. D Ed. Oscar Niemeyer, 13° andar, Sala 1301 - Brasília/DF' }
    ]
  },
  pages: [
    { id: 'home', title: 'AP Construções | Excelência Construtiva', description: 'AP Construções entrega projetos residenciais e corporativos de alto padrão em Brasília, com execução técnica, design sofisticado e atendimento personalizado.', hero: { title: 'SOLIDEZ, INOVAÇÃO E EXCELÊNCIA EM CADA OBRA', subtitle: 'Engenharia de precisão e arquitetura de alto padrão sob medida para as suas maiores aspirações corporativas e residenciais.' } },
    { id: 'sobre', title: 'Sobre Nós | AP Construções', description: 'Conheça a AP Construções: engenharia civil, projetos de alto padrão e reformas corporativas com foco em qualidade técnica e inovação em Brasília.', hero: { title: 'Nossa História', subtitle: 'Construindo com ética, transparência e alto padrão em Brasília.' } },
    { id: 'contato', title: 'Contato | AP Construções', description: 'Fale com a AP Construções para projetos residenciais de alto padrão, reformas corporativas e consultoria de engenharia em Brasília.', hero: { title: 'Canais de Atendimento', subtitle: 'Agende uma reunião em nossa sede corporativa.' } },
    { id: 'obra-detalhe', title: 'Residencial Niemeyer Concept | AP Construções', description: 'Residencial Niemeyer Concept é um lançamento em Brasília com studios premium, espaços compartilhados e projetos arquitetônicos modernos para investidores e moradores exigentes.', hero: { title: 'Residencial Niemeyer Concept', subtitle: 'Lançamento exclusivo com studios inteligentes e áreas comuns premium.' } },
    { id: 'corporate-premium-square', title: 'Corporate Premium Square | AP Construções', description: 'Corporate Premium Square: edifício corporativo de alto padrão no Setor Comercial Sul, projetado para empresas que buscam desempenho, localização estratégica e design executivo.', hero: { title: 'Corporate Premium Square', subtitle: 'Edifício corporativo premium no Setor Comercial Sul.' } }
  ],
  projects: [
    { id: 'residencial-niemeyer', title: 'Residencial Niemeyer Concept', description: 'Studios & Suites Premium - Clique para ver Fotos e Planta', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80', href: '/obra-detalhe', badge: 'Lançamento' },
    { id: 'corporate-premium-square', title: 'Corporate Premium Square', description: 'Modernidade empresarial no coração do Setor Comercial Sul.', image: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=800&q=80', href: '/corporate-premium-square' }
  ]
};

const projectExtras = {
  'obra-detalhe': {
    heroImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    detailTag: 'Lançamento Exclusivo',
    summaryItems: [
      { label: 'Metragem', value: '32m² a 65m²' },
      { label: 'Tipologia', value: 'Studios & Suítes' },
      { label: 'Localização', value: 'Asa Sul / SCS' }
    ],
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80', alt: 'Interior Living' },
      { src: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80', alt: 'Residencial Fachada' },
      { src: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', alt: 'Ambiente Moderno' },
      { src: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80', alt: 'Varanda Gourmet Vista' }
    ],
    plantaTitle: 'Distribuição de Espaços',
    plantaSubtitle: 'Veja como cada metro quadrado foi planejado cirurgicamente para maximizar o seu conforto e iluminação natural.',
    plantaImage: '/planta.svg',
    plantaDescription: 'Planta otimizada com aproveitamento inteligente, cozinha linear gourmet e total integração com a varanda.',
    plantaHighlights: [
      '45m² de Área Privativa',
      'Suíte Integrada Modulável',
      'Janelas de Piso ao Teto',
      'Cozinha Linear Gourmet',
      'Varanda com Vista Panorâmica',
      'Infraestrutura para Ar Condicionado'
    ]
  },
  'corporate-premium-square': {
    heroImage: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80',
    detailTag: 'Espaço Corporativo',
    summaryItems: [
      { label: 'Metragem', value: '160m² a 320m²' },
      { label: 'Perfil', value: 'Alto Padrão' },
      { label: 'Localização', value: 'Setor Comercial Sul' }
    ],
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80', alt: 'Corporate Fachada' },
      { src: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', alt: 'Coworking Moderno' },
      { src: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80', alt: 'Lobby Executivo' },
      { src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80', alt: 'Salas Flexíveis' }
    ],
    plantaTitle: 'Distribuição de Espaços',
    plantaSubtitle: 'Plantas corporativas criadas para flexibilidade, eficiência e integração tecnológica.',
    plantaImage: '/planta.svg',
    plantaDescription: 'Layout corporativo com lobby executivo, salas modulares e infraestrutura de alto desempenho.',
    plantaHighlights: [
      'Lobby Executivo Premium',
      'Salas Modulares de Alto Padrão',
      'Fachada com Vidro Esmaltado',
      'Auditório e Sala de Reuniões',
      'Infraestrutura para Data Center',
      'Estacionamento com Controle de Acesso'
    ]
  }
};

async function ensureDatabase() {
  await db.read();
  if (!db.data || !db.data.pages) {
    db.data = defaultData;
    await db.write();
  }
}

function readDescription(pageId) {
  const filePath = path.join(descriptionsDir, `${pageId}.txt`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

function writeDescription(pageId, content) {
  const filePath = path.join(descriptionsDir, `${pageId}.txt`);
  fs.writeFileSync(filePath, content, 'utf8');
}

app.get('/', async (req, res) => {
  await ensureDatabase();
  const page = db.data.pages.find(p => p.id === 'home');
  const content = readDescription('home');
  res.render('home', { page, content, nav: db.data.nav, footer: db.data.footer, projects: db.data.projects || [], active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/sobre', async (req, res) => {
  await ensureDatabase();
  const page = db.data.pages.find(p => p.id === 'sobre');
  const content = readDescription('sobre');
  res.render('page', { page, content, nav: db.data.nav, footer: db.data.footer, projects: db.data.projects || [], active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/contato', async (req, res) => {
  await ensureDatabase();
  const page = db.data.pages.find(p => p.id === 'contato');
  const content = readDescription('contato');
  res.render('contato', { page, content, nav: db.data.nav, footer: db.data.footer, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/obras', async (req, res) => {
  await ensureDatabase();
  res.render('obras', { nav: db.data.nav, footer: db.data.footer, projects: db.data.projects || [], active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/obra-detalhe', async (req, res) => {
  await ensureDatabase();
  const page = db.data.pages.find(p => p.id === 'obra-detalhe');
  const content = readDescription('obra-detalhe');
  const detailData = projectExtras[page.id] || {};
  res.render('project', { page, content, nav: db.data.nav, footer: db.data.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/corporate-premium-square', async (req, res) => {
  await ensureDatabase();
  const page = db.data.pages.find(p => p.id === 'corporate-premium-square');
  const content = readDescription('corporate-premium-square');
  const detailData = projectExtras[page.id] || {};
  res.render('project', { page, content, nav: db.data.nav, footer: db.data.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/admin', async (req, res) => {
  await ensureDatabase();
  const descriptions = {};
  for (const page of db.data.pages) {
    descriptions[page.id] = readDescription(page.id);
  }
  res.render('admin', { nav: db.data.nav, footer: db.data.footer, pages: db.data.pages, descriptions });
});

app.post('/admin/save', async (req, res) => {
  await ensureDatabase();

  const { nav, footerCompany, footerDescription, footerLinks, contactItems } = req.body;

  if (nav) {
    db.data.nav = Array.isArray(nav) ? nav : [nav];
  }

  db.data.footer.company = footerCompany || db.data.footer.company;
  db.data.footer.description = footerDescription || db.data.footer.description;

  if (footerLinks) {
    db.data.footer.links = Array.isArray(footerLinks)
      ? footerLinks.map((item, index) => ({ title: item.title || `Link ${index + 1}`, url: item.url || '/' }))
      : [{ title: footerLinks.title, url: footerLinks.url }];
  }

  if (contactItems) {
    db.data.footer.contact = Array.isArray(contactItems)
      ? contactItems
      : [contactItems];
  }

  for (const page of db.data.pages) {
    const desc = req.body[`desc_${page.id}`];
    if (typeof desc === 'string') {
      writeDescription(page.id, desc);
    }
  }

  await db.write();

  res.redirect('/admin');
});

(async () => {
  await ensureDatabase();
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
})();
