# ⚡ Quick Reference - Guia Rápido

## 🔑 Credenciais Padrão

| Campo | Valor |
|-------|-------|
| **URL** | `http://localhost:3000/admin/login` |
| **Usuário** | `admin` |
| **Senha** | `admin123` |

⚠️ **Altere a senha após primeiro login!**

---

## 📍 Navegação Rápida

```
Admin Login
    ↓
Dashboard
    ├─ Editar Páginas
    ├─ Editar Projetos
    │   ├─ Editar (informações básicas)
    │   └─ Planta (imagens)
    └─ Configurações
```

---

## 🎯 Tarefas Mais Comuns

### 1️⃣ Editar Texto de uma Página

1. Dashboard → **Editar Páginas**
2. Clique em **"Editar"** na página desejada
3. Modifique os campos de texto
4. Clique em **"Salvar Alterações"**

⏱️ **Tempo**: 2-3 minutos

---

### 2️⃣ Fazer Upload de Imagem

1. Dashboard → **Editar Projetos**
2. Clique em **"Planta"** no projeto
3. **Arraste imagem** para a área cinza
4. Preencha **"Texto Alt"**
5. Clique em **"Enviar Imagens"**

⏱️ **Tempo**: 1-2 minutos

---

### 3️⃣ Criar Novo Projeto

1. Dashboard → **Editar Projetos**
2. Clique em **"+ Novo Projeto"**
3. Preencha os campos:
   - ID (ex: `meu-projeto`)
   - Título
   - Descrição
4. Clique em **"Criar Projeto"**

⏱️ **Tempo**: 3-5 minutos

---

### 4️⃣ Deletar Projeto

1. Dashboard → **Editar Projetos**
2. Procure o projeto
3. Clique em **"Deletar"** (botão vermelho)
4. **Confirme** a exclusão

⚠️ **Nota**: Apenas projetos criados podem ser deletados

⏱️ **Tempo**: 1 minuto

---

### 5️⃣ Adicionar Destaques (Highlights)

1. Dashboard → **Editar Projetos** → **Planta**
2. Scroll para **"Destaques da Planta"**
3. Digite um destaque
4. Pressione **Enter**
5. Repita para mais destaques
6. Clique em **"Salvar Configurações"**

⏱️ **Tempo**: 2-3 minutos

---

### 6️⃣ Mudar Senha do Admin

1. **Abra MongoDB Compass**
2. Navegue para `ap_construcoes` → `admins`
3. Acesse [bcrypt-generator.com](https://bcrypt-generator.com)
4. Gere novo hash da senha
5. Copie o hash em "password"
6. **Salve**
7. Faça novo login

⏱️ **Tempo**: 5 minutos

---

### 7️⃣ Gerar SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado e coloque em `.env`:
```env
SESSION_SECRET=seu-resultado-aqui
```

⏱️ **Tempo**: 1 minuto

---

## 🖼️ Tamanhos de Imagem Recomendados

| Tipo | Resolução | Tamanho Max |
|------|-----------|------------|
| **Hero** | 1920x1080px | 5MB |
| **Capa Projeto** | 800x600px | 3MB |
| **Planta** | 1200x900px | 3MB |
| **Galeria** | 600x600px | 2MB |

---

## 📁 Estrutura de Pasta Importante

```
apc/
├── public/
│   ├── uploads/          ← Imagens fazem upload aqui
│   └── style.css
├── views/
│   ├── admin-dashboard.ejs
│   ├── admin-edit-page.ejs
│   ├── admin-edit-project.ejs
│   └── admin-edit-planta.ejs
├── data/
│   └── database.json     ← Dados iniciais
├── server.js             ← Servidor Express
├── .env                  ← Credenciais (PRIVADO!)
└── .gitignore            ← Deve incluir: .env
```

---

## 🔐 Segurança em 30 Segundos

1. **Senhas**: Armazenadas como **hash bcrypt** (não texto plano)
2. **SESSION_SECRET**: Chave para proteger sessões (altere em produção)
3. **.env**: Nunca commitar no Git (adicione em .gitignore)
4. **Backup**: Sempre faça backup do MongoDB

---

## 🚨 Atalhos de Teclado

| Atalho | Função |
|--------|--------|
| **F5** | Recarregar página |
| **F12** | Abrir console (debug) |
| **Ctrl+Shift+P** | Paleta de comandos VS Code |

---

## 📊 Campos Editáveis por Tipo

### Página
- [ ] Title
- [ ] Description
- [ ] Hero: Title, Subtitle, Image
- [ ] Conteúdo: Historia, Pilares
- [ ] Details: Tag, SummaryItems, Planta info

### Projeto
- [ ] Title
- [ ] Description
- [ ] Badge
- [ ] Image URL
- [ ] Href (URL)

### Planta
- [ ] Title
- [ ] Subtitle
- [ ] Description
- [ ] Highlights
- [ ] Imagens (via upload)

---

## ⚙️ Arquivo .env Essencial

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/ap_construcoes
SESSION_SECRET=gere-com-node-crypto
```

---

## 🐛 Erros Mais Comuns

| Erro | Solução |
|------|---------|
| **"Usuário ou senha inválidos"** | Verifique credenciais, reinicie servidor |
| **"Erro ao conectar ao MongoDB"** | Certifique-se MongoDB está rodando |
| **"Imagem não aparece"** | Recarregue página, verifique tamanho/formato |
| **"ID já existe"** | Use outro ID para novo projeto |
| **Sessão expirada** | Faça login novamente |

---

## 📞 Comandos Úteis Terminal

```bash
# Iniciar servidor
npm start

# Instalar dependências
npm install

# Verificar se Node está instalado
node --version

# Gerar chave secreta
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🌐 URLs Importantes

| O que | URL |
|------|-----|
| **Admin Login** | `http://localhost:3000/admin/login` |
| **Admin Dashboard** | `http://localhost:3000/admin/dashboard` |
| **Homepage** | `http://localhost:3000/` |
| **Projetos** | `http://localhost:3000/obras` |
| **Projeto Específico** | `http://localhost:3000/obras/{id}` |

---

## 📋 Checklist Antes de Produção

- [ ] Senha admin alterada
- [ ] SESSION_SECRET mudado
- [ ] .env configurado com valores reais
- [ ] MongoDB com autenticação ativada
- [ ] HTTPS habilitado
- [ ] NODE_ENV = "production"
- [ ] Backup do banco realizado
- [ ] Imagens em CDN ou servidor seguro
- [ ] .gitignore protegendo .env
- [ ] Logs configurados

---

## 💡 Dicas & Tricks

✅ **Drag & Drop funciona** para imagens - mais rápido que clicar

✅ **Enter** salva automaticamente destaques

✅ **URL da imagem** pode ser relativa (`/uploads/...`)

✅ **Backup MongoDB** regularmente

✅ **Teste localmente** antes de produção

❌ **Nunca** commit .env no Git

❌ **Nunca** compartilhe SESSION_SECRET

---

## 🔄 Fluxo de Trabalho Típico

```
1. Faz login (2 min)
   ↓
2. Edita alguns textos (5 min)
   ↓
3. Faz upload de imagens (5 min)
   ↓
4. Testa no navegador (3 min)
   ↓
5. Faz logout (1 min)
─────────────────────────
Total: ~15 minutos
```

---

## 📚 Documentação Completa

Para mais detalhes, leia:

- 🔐 [SEGURANCA.md](SEGURANCA.md) - Senhas e SESSION_SECRET
- 🖼️ [UPLOAD_IMAGENS.md](UPLOAD_IMAGENS.md) - Imagens detalhado
- 👨‍💼 [ADMIN_GUIDE.md](ADMIN_GUIDE.md) - Guia completo
- 🏢 [PROJETOS_DINAMICOS.md](PROJETOS_DINAMICOS.md) - Projetos
- 📖 [README_ADMIN.md](README_ADMIN.md) - Índice de documentação

---

## 🎯 Próximas Ações

1. Faça seu **primeiro login**
2. **Mude a senha** do admin
3. **Gere SESSION_SECRET** e coloque em .env
4. **Pratique** editando um projeto
5. **Leia** os guias completos conforme necessário

---

**Boa sorte! 🚀**

