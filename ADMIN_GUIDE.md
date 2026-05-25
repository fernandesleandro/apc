# Guia do Painel Administrativo - AP Construções

## 🔐 Autenticação

### Credenciais Padrão

```
Usuário: admin
Senha: admin123
```

### Acessando o Admin

1. Acesse: `http://localhost:3000/admin/login`
2. Digite as credenciais acima
3. Você será redirecionado para o dashboard

## 📊 Dashboard

O dashboard mostra:
- **Estatísticas**: Número de páginas, projetos e galerias
- **Editar Páginas**: Lista de todas as páginas do site
- **Editar Projetos**: Lista de todos os projetos
- **Configurações**: Menu de navegação e rodapé

## ✏️ Editando Páginas

### Campos Editáveis por Página

#### 1. **Informações Básicas**
- **Título da Página**: Nome que aparece na aba do navegador e nos resultados de busca
- **Descrição**: Meta description para SEO (recomendado: 150-160 caracteres)

#### 2. **Hero Section (Banner)**
- **Título do Hero**: Título grande no topo da página
- **Subtítulo do Hero**: Texto descritivo abaixo do título
- **URL da Imagem do Hero**: Link da imagem de fundo

#### 3. **Conteúdo**
- **História**: Parágrafos de texto descritivo
- **Pilares**: Missão, Visão e Valores com ícones

#### 4. **Detalhes do Projeto**
- **Tag/Badge**: Etiqueta de destaque (ex: "Lançamento")
- **Itens do Resumo**: Informações estruturadas (label + valor)
  - Label: Descrição do item
  - Valor: Conteúdo do item
- **Planta**:
  - Título e Subtítulo
  - Descrição
  - Highlights (destaques principais)

## 🏢 Editando Projetos

### Campos Editáveis

- **Título**: Nome do projeto
- **Descrição**: Descrição breve do projeto
- **Badge/Etiqueta**: Destaque especial (ex: "Lançamento", "Em construção")
- **URL do Projeto**: Link para acessar os detalhes (ex: `/obras/monumental`)
- **URL da Imagem**: Imagem de capa do projeto

## 🖼️ Gerenciando Plantas (Imagens)

### Upload de Imagens

1. Acesse: **Editar Projetos** → Clique no botão **"Planta"**
2. Na seção **Upload de Imagens da Planta**:
   - **Arraste ou clique** para selecionar imagens
   - **Texto Alt**: Descrição alternativa da imagem (importante para acessibilidade)
   - **Título da Imagem**: Opcional (aparece como hover)
3. Clique em **"Enviar Imagens"**

### Gerenciar Galeria

- **Visualizar**: Todas as imagens aparecem na seção "Galeria da Planta"
- **Remover**: Passe o mouse sobre a imagem e clique no ícone de lixeira

### Editar Configurações da Planta

- **Título da Planta**: Título da seção de plantas
- **Subtítulo da Planta**: Descrição da seção
- **Descrição da Planta**: Texto informativo completo
- **Destaques (Highlights)**:
  - Digite um destaque
  - Pressione **Enter** para adicionar
  - Clique no **"×"** para remover

### 📖 Guia Completo de Imagens

Para informações detalhadas sobre upload, hospedagem e edição de imagens, consulte:
📄 [UPLOAD_IMAGENS.md](UPLOAD_IMAGENS.md)

## 🔧 Campos JSON e Estrutura

O banco de dados MongoDB armazena dados em formato JSON. Estrutura básica:

```json
{
  "pages": [
    {
      "id": "monumental",
      "title": "Monumental Center",
      "description": "...",
      "hero": {
        "title": "...",
        "subtitle": "...",
        "image": "..."
      },
      "details": {
        "detailTag": "...",
        "summaryItems": [...],
        "plantaTitle": "...",
        "plantaGallery": [...],
        "plantaHighlights": [...]
      }
    }
  ]
}
```

## 🌐 Campos que Podem Ser Editados

### Titles (Títulos)
- `page.title`
- `page.hero.title`
- `page.hero.subtitle`
- `page.details.plantaTitle`
- `page.details.plantaSubtitle`

### Descriptions (Descrições)
- `page.description`
- `page.details.plantaDescription`

### Labels e Values
- `page.details.summaryItems[].label`
- `page.details.summaryItems[].value`

### Images (Imagens)
- `page.hero.image` - Hero Banner
- `page.details.plantaGallery[].src` - Imagens da galeria
- `page.details.plantaGallery[].alt` - Texto alternativo

### Highlights
- `page.details.plantaHighlights[]` - Array de destaques

## 📱 Formatos Recomendados

### Imagens
- **Formato**: JPG, PNG, WebP
- **Tamanho máximo**: 10MB
- **Resolução recomendada**:
  - Hero: 1920x1080px ou maior
  - Planta: 800x600px até 1200x900px
  - Galeria: 500x500px mínimo

### Textos
- **Títulos**: Até 80 caracteres
- **Descrições**: 150-160 caracteres para SEO
- **Meta Description**: Máximo 160 caracteres

## 🔐 Segurança

### Mudando Senha

A senha é armazenada como **hash bcrypt** no banco de dados, nunca em texto plano.

Para mudar a senha do admin:

1. **Abra MongoDB Compass** ([download aqui](https://mongodb.com/products/compass))
2. **Navegue até**: `ap_construcoes` → `admins`
3. **Gere um novo hash** em [bcrypt-generator.com](https://bcrypt-generator.com)
4. **Atualize o campo "password"** com o novo hash
5. **Faça novo login** com a nova senha

**Nota**: A senha nunca é exibida ou armazenada em texto plano. É sempre armazenada como hash irreversível.

### Variáveis de Ambiente

Edite o arquivo `.env` na raiz do projeto:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/ap_construcoes
SESSION_SECRET=sua-chave-secreta-de-64-caracteres-aqui
```

**SESSION_SECRET**: Chave usada para proteger sessões de usuários logados. Deve ser alterada em produção.

Para gerar uma chave segura:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 📖 Guia Completo de Segurança

Para informações detalhadas sobre segurança, senhas e SESSION_SECRET, consulte:
📄 [SEGURANCA.md](SEGURANCA.md)

## 🚀 Publicando Alterações

1. Todas as alterações são salvas automaticamente no MongoDB
2. As mudanças aparecem no site imediatamente (sem necessidade de reiniciar)
3. Verifique o site para garantir que tudo aparece corretamente

## ❓ Troubleshooting

### "Usuário ou senha inválidos"
- Verifique se as credenciais estão corretas
- Reinicie o servidor

### "Erro ao conectar ao MongoDB"
- Certifique-se que MongoDB está rodando
- Verifique a string MONGODB_URI no .env

### "Imagem não aparece na galeria"
- Verifique se o arquivo foi enviado com sucesso
- Confira o tamanho do arquivo (máximo 10MB)
- Tente com outro formato de imagem

## 📞 Suporte

Para mais informações ou relatórios de bugs, entre em contato com a equipe de desenvolvimento.
