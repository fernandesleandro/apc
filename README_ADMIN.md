# 📚 Documentação - AP Construções Admin

Bem-vindo! Aqui você encontrará todos os guias para gerenciar o painel administrativo da AP Construções.

---

## 🗂️ Guias Disponíveis

### 1. 🔐 [SEGURANCA.md](SEGURANCA.md) - Segurança e Autenticação
**Para**: Entender senhas, hashes bcrypt e SESSION_SECRET

Covers:
- ✅ Como as senhas são armazenadas (hash bcrypt)
- ✅ O que é SESSION_SECRET e por que é importante
- ✅ Como gerar uma chave secreta segura
- ✅ Onde guardar as credenciais
- ✅ Como alterar a senha do admin
- ✅ Configuração do arquivo .env
- ✅ Checklist de segurança

**Leia este guia se você quer saber**:
- Como funciona a autenticação
- Por que a senha não aparece no banco
- Onde pegar SESSION_SECRET
- Como garantir segurança em produção

---

### 2. 🖼️ [UPLOAD_IMAGENS.md](UPLOAD_IMAGENS.md) - Upload e Gerenciamento de Imagens
**Para**: Fazer upload, editar e gerenciar imagens de projetos

Covers:
- ✅ Como fazer upload de novas imagens
- ✅ Como editar imagens já existentes
- ✅ Formatos e tamanhos aceitos
- ✅ Hospedagem de imagens (Imgur, Cloudinary, etc)
- ✅ Texto Alt e acessibilidade
- ✅ Dicas profissionais
- ✅ Troubleshooting

**Leia este guia se você quer**:
- Fazer upload de plantas e fotos
- Saber qual tamanho de imagem usar
- Hospedar imagens online
- Editar detalhes das plantas
- Adicionar destaques (highlights)

---

### 3. 👨‍💼 [ADMIN_GUIDE.md](ADMIN_GUIDE.md) - Guia Geral do Admin
**Para**: Overview completo das funcionalidades administrativas

Covers:
- ✅ Como acessar o admin
- ✅ Editar páginas (título, descrição, hero section)
- ✅ Editar projetos
- ✅ Gerenciar imagens (referência rápida)
- ✅ Estrutura JSON dos dados
- ✅ Formatos recomendados
- ✅ Troubleshooting

**Leia este guia se você quer**:
- Visão geral de todas as funcionalidades
- Entender a estrutura dos dados
- Editar páginas do site
- Saber os formatos recomendados

---

### 4. 🏢 [PROJETOS_DINAMICOS.md](PROJETOS_DINAMICOS.md) - Gerenciamento Dinâmico de Projetos
**Para**: Criar, editar e deletar projetos sem código

Covers:
- ✅ Como criar novos projetos
- ✅ Campos obrigatórios e opcionais
- ✅ Como editar projetos existentes
- ✅ Como deletar projetos
- ✅ Fluxo completo de criação
- ✅ Validações do sistema
- ✅ Estrutura de dados criada

**Leia este guia se você quer**:
- Criar novos projetos
- Entender o formulário de criação
- Saber o que é criado automaticamente
- Deletar projetos personalizados

---

## 🚀 Quick Start (Início Rápido)

### Seu Primeiro Dia

1. **Acesse o Admin**
   - URL: `http://localhost:3000/admin/login`
   - Usuário: `admin`
   - Senha: `admin123`

2. **Explore o Dashboard**
   - Veja as páginas, projetos e galerias

3. **Edite um Projeto Existente**
   - Clique em "Editar" em um projeto
   - Mude o título, descrição ou imagem
   - Clique em "Salvar Alterações"

4. **Faça Upload de uma Imagem**
   - Clique em "Planta"
   - Arraste uma imagem
   - Preencha o texto alt
   - Clique em "Enviar Imagens"

5. **Crie um Novo Projeto**
   - Clique em "+ Novo Projeto"
   - Preencha os campos
   - Clique em "Criar Projeto"

---

## 📋 Checklist por Tarefa

### Tenho Que Mudar a Senha
→ [SEGURANCA.md](SEGURANCA.md#mudando-a-senha)

### Preciso Fazer Upload de Imagens
→ [UPLOAD_IMAGENS.md](UPLOAD_IMAGENS.md#upload-de-novas-imagens)

### Quero Criar um Novo Projeto
→ [PROJETOS_DINAMICOS.md](PROJETOS_DINAMICOS.md#como-criar-um-novo-projeto)

### Preciso Editar um Projeto Existente
→ [ADMIN_GUIDE.md](ADMIN_GUIDE.md#editando-projetos)

### Tenho um Erro no Upload de Imagem
→ [UPLOAD_IMAGENS.md](UPLOAD_IMAGENS.md#erros-comuns)

### Quero Entender SESSION_SECRET
→ [SEGURANCA.md](SEGURANCA.md#entendendo-session_secret)

### Preciso Adicionar Destaques (Highlights)
→ [UPLOAD_IMAGENS.md](UPLOAD_IMAGENS.md#destaques-highlights)

### Quero Editar a Descrição de uma Página
→ [ADMIN_GUIDE.md](ADMIN_GUIDE.md#editando-páginas)

---

## 🎓 Aprendizado Progressivo

### Nível 1: Iniciante (1-2 horas)
1. Ler [ADMIN_GUIDE.md](ADMIN_GUIDE.md) - Overview
2. Fazer login e explorar
3. Editar um texto simples

### Nível 2: Intermediário (2-4 horas)
1. Ler [UPLOAD_IMAGENS.md](UPLOAD_IMAGENS.md)
2. Fazer upload de imagens
3. Editar detalhes de plantas
4. Criar um novo projeto

### Nível 3: Avançado (4-8 horas)
1. Ler [SEGURANCA.md](SEGURANCA.md)
2. Alterar senha do admin
3. Gerar SESSION_SECRET
4. Configurar ambiente de produção
5. Gerenciar múltiplos projetos

---

## 🔍 Índice por Funcionalidade

### Autenticação & Segurança
- [Como fazer login](ADMIN_GUIDE.md#acessando-o-admin)
- [Mudar senha](SEGURANCA.md#alterando-a-senha)
- [SESSION_SECRET](SEGURANCA.md#entendendo-session_secret)
- [Arquivo .env](SEGURANCA.md#arquivo-env-completo)

### Gerenciar Páginas
- [Editar informações básicas](ADMIN_GUIDE.md#informações-básicas)
- [Editar hero section](ADMIN_GUIDE.md#hero-section-banner)
- [Editar conteúdo](ADMIN_GUIDE.md#conteúdo)
- [Editar detalhes](ADMIN_GUIDE.md#detalhes-do-projeto)

### Gerenciar Projetos
- [Criar projeto novo](PROJETOS_DINAMICOS.md#como-criar-um-novo-projeto)
- [Editar projeto](PROJETOS_DINAMICOS.md#editando-projetos)
- [Deletar projeto](PROJETOS_DINAMICOS.md#deletando-projetos)
- [Validações](PROJETOS_DINAMICOS.md#validações)

### Imagens
- [Fazer upload de imagens](UPLOAD_IMAGENS.md#upload-de-novas-imagens)
- [Editar imagens](UPLOAD_IMAGENS.md#editar-imagens-já-existentes)
- [Deletar imagens](UPLOAD_IMAGENS.md#deletar-imagem)
- [Hospedagem de imagens](UPLOAD_IMAGENS.md#hospedagem-de-imagens---guia-rápido)
- [Formatos aceitos](UPLOAD_IMAGENS.md#formatos-aceitos)

### Plantas & Destaques
- [Upload de plantas](UPLOAD_IMAGENS.md#upload-de-novas-imagens)
- [Editar título/subtítulo](UPLOAD_IMAGENS.md#título-da-planta)
- [Adicionar destaques](UPLOAD_IMAGENS.md#destaques-highlights)
- [Editar descrição](UPLOAD_IMAGENS.md#descrição-da-planta)

---

## 🆘 Troubleshooting

### Erro ao Fazer Login?
- Verificar credenciais → [ADMIN_GUIDE.md](ADMIN_GUIDE.md#usuário-ou-senha-inválidos)

### Imagem não aparece?
- Verificar formato/tamanho → [UPLOAD_IMAGENS.md](UPLOAD_IMAGENS.md#erros-comuns)

### Sessão expirou?
- Entender SESSION_SECRET → [SEGURANCA.md](SEGURANCA.md#entendendo-session_secret)

### Erro ao criar projeto?
- Validações → [PROJETOS_DINAMICOS.md](PROJETOS_DINAMICOS.md#validações)

---

## 💾 Estrutura de Pastas da Documentação

```
apc/
├── ADMIN_GUIDE.md          ← Guia geral (comece aqui)
├── SEGURANCA.md            ← Segurança e autenticação
├── UPLOAD_IMAGENS.md       ← Upload e gerenciamento de imagens
├── PROJETOS_DINAMICOS.md   ← Criação dinâmica de projetos
├── README.md               ← Este arquivo (você está aqui!)
└── ...
```

---

## 🚀 Próximos Passos

1. **Escolha um guia** acima baseado em sua necessidade
2. **Siga os passos** fornecidos
3. **Teste no seu ambiente** local
4. **Consulte este índice** quando precisar de referência rápida

---

## 📞 Suporte e Contato

Se encontrar problemas não cobertos nesta documentação:

1. **Verifique a seção de Troubleshooting** dos guias
2. **Consulte o console do navegador** (F12 → Console)
3. **Verifique os logs do servidor** (terminal)
4. **Entre em contato com a equipe técnica**

---

## 📝 Versão da Documentação

- **Última atualização**: Maio 2026
- **Versão do projeto**: 1.0.0
- **Framework**: Express.js + EJS
- **Banco de dados**: MongoDB

---

## ✨ Dicas Finais

- 🔖 **Marque este arquivo** nos favoritos para referência rápida
- 📱 **Imprima os guias** que usar com frequência
- 💾 **Guarde as credenciais** em local seguro
- 🔐 **Nunca compartilhe** SESSION_SECRET ou senhas
- ✅ **Sempre faça backup** antes de alterações importantes

---

**Aproveite gerenciando seus projetos!** 🎉

