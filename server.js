const express = require('express');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 3000;
const dbFile = path.join(__dirname, 'data', 'database.json');

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
      { icon: 'fas fa-phone-alt', label: 'Telefone Central', value: '(61) 2195-8300' },
      { icon: 'fas fa-envelope', label: 'E-mail', value: 'contato@apconstrucoes.com.br' },
      { icon: 'fas fa-map-marker-alt', label: 'Endereço Corporativo', value: 'SCS Qd. 02 Bl. D Ed. Oscar Niemeyer, 13° andar, Sala 1301 - Brasília/DF' }
      
    ]
  },
  pages: [
    { 
      id: 'home', 
      title: 'AP Construções | Excelência Construtiva', 
      description: 'AP Construções entrega projetos residenciais e corporativos de alto padrão em Brasília, com execução técnica, design sofisticado e atendimento personalizado.', 
      hero: { title: 'SOLIDEZ, INOVAÇÃO E EXCELÊNCIA EM CADA OBRA', subtitle: 'Engenharia de precisão e arquitetura de alto padrão sob medida para as suas maiores aspirações corporativas e residenciais.' } 
    },
    { 
      id: 'sobre', 
      title: 'Sobre Nós | AP Construções', 
      description: 'Sediada no icônico Edifício Oscar Niemeyer, a AP Construções combina gestão de obra, projeto arquitetônico e planejamento técnico para entregar cronogramas confiáveis.', 
      hero: { title: 'Nossa História', subtitle: 'Excelência técnica e compromisso com a inovação no mercado de Brasília.' },
      content: {
        historia: ["A AP Construções consolida sua atuação no mercado da engenharia e construção civil unindo inovação, conhecimento técnico e experiência acumulada ao longo de décadas."],
        pilares: [{ label: "Missão", icon: "fa-bullseye", text: "Trabalhar de forma ética e competente." }]
      }
    },
    { id: 'contato', title: 'Contato | AP Construções', description: 'Fale com a AP Construções para projetos residenciais de alto padrão, reformas corporativas e consultoria de engenharia em Brasília.', hero: { title: 'Canais de Atendimento', subtitle: 'Agende uma reunião em nossa sede corporativa.' } },
    { id: 'monumental', title: 'Monumental Center | AP Construções', description: 'Monumental Center é um lançamento em Brasília com studios premium, espaços compartilhados e projetos arquitetônicos modernos para investidores e moradores exigentes.', hero: { title: 'Monumental Center', subtitle: 'Lançamento exclusivo com studios inteligentes e áreas comuns premium.' } },
    { id: 'cosmopolitan', title: 'Cosmopolitan | AP Construções', description: 'Cosmopolitan: edifício corporativo de alto padrão no Setor Comercial Sul, projetado para empresas que buscam desempenho, localização estratégica e design executivo.', hero: { title: 'Cosmopolitan', subtitle: 'Edifício corporativo premium no Setor Comercial Sul.' } }
  ],
  projects: [
    { id: 'residencial-niemeyer', title: 'Monumental Center', description: 'Studios & Suites Premium - Clique para ver Fotos e Planta', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80', href: '/monumental', badge: 'Lançamento' },
    { id: 'cosmopolitan', title: 'Cosmopolitan', description: 'Modernidade empresarial no coração do Setor Comercial Sul.', image: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=800&q=80', href: '/cosmopolitan' }
  ]
};

async function ensureDatabase() {
  await db.read();
  if (!db.data || !db.data.pages) {
    db.data = defaultData;
    // ensure galleries container exists for local gallery management
    db.data.galleries = db.data.galleries || {};
    await db.write();
  }
}

app.get('/', async (req, res) => {
  await ensureDatabase();
  const page = db.data.pages.find(p => p.id === 'home');
  res.render('home', { page, nav: db.data.nav, footer: db.data.footer, projects: db.data.projects || [], active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/sobre', async (req, res) => {
  await ensureDatabase();
  const page = db.data.pages.find(p => p.id === 'sobre');
  res.render('sobre', { page, nav: db.data.nav, footer: db.data.footer, projects: db.data.projects || [], detailData: {}, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/contato', async (req, res) => {
  await ensureDatabase();
  const page = db.data.pages.find(p => p.id === 'contato');
  res.render('contato', { page, nav: db.data.nav, footer: db.data.footer, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

app.get('/obras', async (req, res) => {
  await ensureDatabase();
  res.render('obras', { nav: db.data.nav, footer: db.data.footer, projects: db.data.projects || [], active: '/obras', requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

// Generic route to serve project details under /obras/:slug
app.get('/obras/:slug', async (req, res) => {
  await ensureDatabase();
  const slug = req.params.slug;
  // try to find a page matching this slug
  const page = db.data.pages.find(p => p.id === slug);
  if (!page) {
    // fallback: if slug maps to a project id, try mapping
    const proj = (db.data.projects || []).find(pr => pr.id === slug);
    if (proj) {
      // try to map to a page with same id or to a known detail page
      const mappedPage = db.data.pages.find(p => p.id === proj.id) || db.data.pages.find(p => p.id === 'monumental');
      if (mappedPage) {
        // Puxa os dados diretamente do banco de dados (campo 'details')
        const detailData = JSON.parse(JSON.stringify(mappedPage.details || {}));
        
        // Fallback para Hero Image
        detailData.heroImage = detailData.heroImage || (mappedPage.hero && mappedPage.hero.image);

        // Injeta a galeria de fotos principal
        if (db.data.galleries && db.data.galleries[proj.id]) {
          detailData.galleryImages = db.data.galleries[proj.id];
          if (!detailData.heroImage && detailData.galleryImages.length) detailData.heroImage = detailData.galleryImages[0].src;
        }
        return res.render('project', { page: mappedPage, nav: db.data.nav, footer: db.data.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
      }
    }
    return res.status(404).send('Página não encontrada');
  }

  // Puxa os dados diretamente do banco de dados (campo 'details')
  const detailData = JSON.parse(JSON.stringify(page.details || {}));
  
  detailData.heroImage = detailData.heroImage || (page.hero && page.hero.image);

  // determine gallery key: prefer a matching project id when the slug is a page
  let galleryKey = slug;
  if (db.data.projects && Array.isArray(db.data.projects)) {
    const mappedProj = db.data.projects.find(pr => pr.href && (pr.href === `/obras/${slug}` || pr.href === `/${slug}` || pr.href.endsWith(`/${slug}`)));
    if (mappedProj) galleryKey = mappedProj.id;
  }
  if (db.data.galleries && db.data.galleries[galleryKey]) {
    detailData.galleryImages = db.data.galleries[galleryKey];
    if (!detailData.heroImage && detailData.galleryImages.length) {
      detailData.heroImage = detailData.galleryImages[0].src;
    }
  }
  res.render('project', { page, nav: db.data.nav, footer: db.data.footer, detailData, active: req.path, requestUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}` });
});

// Legacy routes; use /obras/:slug instead
app.get('/monumental', (req, res) => res.redirect('/obras/monumental'));
app.get('/cosmopolitan', (req, res) => res.redirect('/obras/cosmopolitan'));

app.get('/admin', async (req, res) => {
  await ensureDatabase();
  res.render('admin', { 
    nav: db.data.nav, 
    footer: db.data.footer, 
    pages: db.data.pages 
  });
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

  await db.write();

  res.redirect('/admin');
});

(async () => {
  await ensureDatabase();
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
})();
