# Gerenciamento Dinâmico de Projetos - AP Construções

## 🎯 Novo Sistema de Projetos

Agora você pode criar, editar e deletar projetos diretamente do painel administrativo, sem precisar modificar o código!

## 📋 Como Criar um Novo Projeto

### Passo 1: Acessar o Dashboard
1. Faça login em `/admin/login` com suas credenciais
2. Clique no botão **"+ Novo Projeto"** na seção "Editar Projetos"

### Passo 2: Preencher os Dados

A modal de criação tem os seguintes campos:

| Campo | Obrigatório | Exemplo | Descrição |
|-------|-----------|---------|-----------|
| **ID do Projeto** | Sim | `meu-projeto` | Identificador único (letras minúsculas, números e hífen) |
| **Título** | Sim | `Projeto ABC` | Nome que aparece na página e no admin |
| **Descrição** | Sim | `Descrição breve...` | Texto descritivo (aparece na galeria de projetos) |
| **Badge/Etiqueta** | Não | `Lançamento` | Etiqueta especial (ex: "Lançamento", "Em construção") |
| **URL da Imagem** | Não | `https://...` | Imagem de capa do projeto |
| **URL do Projeto** | Não | `/obras/meu-projeto` | Link da página (padrão: `/obras/{id}`) |

### Passo 3: Confirmar
Clique em **"Criar Projeto"** e a página será recarregada automaticamente.

## ✏️ Editando Projetos

Após criar um projeto, você verá um card na lista com 3 opções:

### Botões Disponíveis

- **Editar** <i class="fas fa-edit"></i>: Modifica informações básicas (título, descrição, badge, imagem)
- **Planta** <i class="fas fa-image"></i>: Gerencia fotos e detalhes técnicos do projeto
- **Deletar** <i class="fas fa-trash"></i>: Remove o projeto (apenas para projetos criados, não os padrão)

## 🗑️ Deletando Projetos

### Projetos Padrão (Protegidos)
Não é possível deletar os 3 projetos originais:
- Monumental
- Cosmopolitan
- Barão Mauá

### Projetos Personalizados
1. Clique no botão **"Deletar"** no card do projeto
2. Confirme a exclusão
3. Todas as informações associadas (imagens, detalhes, galeria) serão removidas

## 🔧 Fluxo Completo de Criação

### Exemplo Prático:

**1. Criar o Projeto**
```
ID: torre-moderna
Título: Torre Moderna
Descrição: Edifício residencial moderno com 30 andares
Badge: Lançamento Exclusivo
Imagem: https://exemplo.com/torre.jpg
URL: /obras/torre-moderna
```

**2. Editar Detalhes**
Após criação, clique em **"Editar"** para:
- Alterar título, descrição, badge
- Atualizar imagem
- Modificar URL

**3. Adicionar Plantas e Imagens**
Clique em **"Planta"** para:
- Upload de imagens de plantas
- Configurar título e subtítulo da planta
- Adicionar destaques (highlights)
- Editar descrição técnica

**4. Configurar Informações Técnicas**
Na página de edição de planta, você pode:
- Adicionar itens técnicos (endereço, área, unidades, vagas)
- Fazer upload de fotos de ambientes
- Adicionar destaques de recursos

## 📊 Estrutura de Dados Criada

Ao criar um novo projeto, o sistema cria automaticamente:

1. **Projeto (Project)**
   - ID, Título, Descrição, Badge, Imagem, URL

2. **Página (Page)**
   - Página de detalhes com hero section
   - Estrutura para plantas e detalhes técnicos
   - Campos prontos para edição

3. **Galeria (Gallery)**
   - Espaço vazio para receber imagens
   - Associado ao ID do projeto

## ✅ Validações

- **ID**: Deve conter apenas letras minúsculas, números e hífen
- **Título e Descrição**: Obrigatórios
- **ID Duplicado**: Não permite criar projetos com ID já existente
- **Deletar Padrão**: Impede deletar projetos originais

## 🎨 Personalizações Recomendadas

Após criar um projeto, recomendamos:

1. ✅ Editar informações básicas
2. ✅ Fazer upload de imagem de capa
3. ✅ Adicionar plantas e imagens
4. ✅ Preencher detalhes técnicos (endereço, área, etc)
5. ✅ Adicionar destaques (highlights)

## 📱 Publicando seu Projeto

Os projetos criados aparecem:
- Na página de **Obras** (`/obras`)
- No card em miniatura na home
- Na galeria de projetos

Para visualizar o projeto:
1. Acesse `http://localhost:3000/obras/{seu-id}`
2. Ex: `http://localhost:3000/obras/torre-moderna`

## ⚠️ Dicas Importantes

### IDs Válidos
✅ `meu-projeto`
✅ `projeto-123`
✅ `torre-moderna-2024`

❌ `Meu Projeto` (espaços e maiúsculas)
❌ `meu_projeto` (underscore)
❌ `meu projeto` (espaço)

### URLs Recomendadas
- Use `/obras/{id}` para manter consistência
- Sistema cria automaticamente se deixar em branco

### Imagens
- Formate JPG, PNG ou WebP
- Resolução recomendada: 1920x1080px
- Tamanho máximo para upload: 10MB

## 🔄 Fluxo de Trabalho

```
Novo Projeto
     ↓
 Editar Info
     ↓
 Upload Imagem Capa
     ↓
 Editar Detalhes
     ↓
 Upload Plantas
     ↓
 Configurar Highlights
     ↓
 Publicado!
```

## 📞 Suporte

Se encontrar algum erro ou tiver dúvidas:
1. Verifique se o ID está em formato válido
2. Confirme que a imagem URL é válida
3. Reinicie o servidor se necessário
4. Consulte os logs do navegador (F12)

