# Upload e Edição de Imagens - AP Construções

## 📸 Sistema de Imagens

O sistema permite gerenciar imagens em dois locais principais:
1. **Imagem de Capa do Projeto** - Foto exibida na galeria de projetos
2. **Imagens de Planta** - Fotos de plantas, ambientes e detalhes técnicos

---

## 🖼️ Imagem de Capa do Projeto

### Localização
- **Dashboard** → **Editar Projetos** → Clique em **"Editar"** no projeto

### Editando a Imagem

1. **Encontre o campo "URL da Imagem"**
2. **Cole o link da imagem** (URL completa)
   - Exemplo: `https://exemplo.com/meu-projeto.jpg`
3. **Visualize o preview** abaixo do campo
4. **Clique em "Salvar Alterações"**

### Formatos Aceitos
- JPG / JPEG ✅
- PNG ✅
- WebP ✅

### Tamanho Recomendado
- **Resolução**: 1920x1080px ou maior
- **Peso**: 500KB a 5MB
- **Proporção**: 16:9 (recomendado)

### Hospedando Imagens

Você tem várias opções para hospedar suas imagens:

#### Opção 1: Imgur (Gratuito)
1. Acesse [imgur.com](https://imgur.com)
2. Faça upload da imagem
3. Clique direito → Copiar link de imagem
4. Cole em "URL da Imagem" no admin

#### Opção 2: Cloudinary (Recomendado)
1. Crie conta em [cloudinary.com](https://cloudinary.com)
2. Faça upload na dashboard
3. Copie o link da imagem
4. Cole no admin

#### Opção 3: GitHub (Para projetos)
1. Crie repositório público
2. Faça upload de imagens na pasta `/images`
3. Use link raw do GitHub
4. Exemplo: `https://raw.githubusercontent.com/seu-usuario/repo/main/images/foto.jpg`

#### Opção 4: Servidor Local (Se tiver acesso)
1. Armazene imagens em `/public/uploads`
2. Use caminho relativo: `/uploads/minha-imagem.jpg`

---

## 🏗️ Imagens de Planta

### Localização
- **Dashboard** → **Editar Projetos** → Clique em **"Planta"** no projeto

### Upload de Novas Imagens

#### Método 1: Clicar na Área de Upload
1. Clique na **área pontilhada cinza** ("Upload de Imagens da Planta")
2. Selecione uma ou mais imagens do seu computador
3. Preencha **"Texto Alt"** (descrição da imagem)
4. Clique em **"Enviar Imagens"**

#### Método 2: Drag & Drop (Recomendado)
1. Abra a pasta com suas imagens
2. **Arraste as imagens** para a área de upload
3. Solte sobre a área cinza
4. Preencha **"Texto Alt"**
5. Clique em **"Enviar Imagens"**

#### Método 3: Upload Múltiplo
1. Selecione várias imagens (Ctrl+click)
2. Arraste todas de uma vez
3. Sistema enviará automaticamente todas
4. Carregará a página ao terminar

### Campos ao Fazer Upload

| Campo | Obrigatório | Exemplo | Descrição |
|-------|-----------|---------|-----------|
| **Arquivo** | Sim | minha-planta.jpg | Imagem do computador |
| **Texto Alt** | Sim | Planta Unidade Tipo A | Descrição para acessibilidade |
| **Título** | Não | Unidade Tipo A | Aparece ao passar mouse |

### Tamanho Aceito
- **Máximo**: 10MB por imagem
- **Recomendado**: 500KB a 3MB
- **Resolução**: 800x600px até 1200x900px
- **Proporção**: Qualquer uma funciona

---

## 📝 Editar Imagens Já Existentes

### Renomear ou Substituir Texto Alt

1. **Vá para** "Editar Planta" do projeto
2. Procure a **seção "Galeria da Planta"**
3. **Passe o mouse** sobre a imagem
4. Clique no **ícone de lixeira** para deletar
5. **Faça upload novamente** com o novo texto alt

⚠️ **Nota**: Não é possível editar o texto alt de uma imagem já enviada. Para alterar, delete e reenvie.

### Reordenar Imagens

Atualmente o sistema não permite reordenar arrastar. Para mudar a ordem:

1. Anote a ordem desejada
2. Delete todas as imagens
3. Reenvie na ordem correta

### Deletar Imagem

1. **Vá para** "Editar Planta"
2. Procure a imagem na **"Galeria da Planta"**
3. **Passe o mouse** sobre a imagem
4. Clique no **botão de lixeira** que aparece
5. **Confirme** a exclusão

---

## 🎨 Editar Detalhes da Planta

Além das imagens, você pode editar:

### Título da Planta
- Campo: **"Título da Planta"**
- Exemplo: "Distribuição de Espaços"

### Subtítulo da Planta
- Campo: **"Subtítulo da Planta"**
- Exemplo: "Planejado cirurgicamente para maximizar conforto"

### Descrição da Planta
- Campo: **"Descrição da Planta"**
- Texto longo descrevendo os detalhes
- Máximo: 500 caracteres

### Destaques (Highlights)

Esses são os pontos principais da planta. Para adicionar:

1. Digite o texto no campo **"Destaques da Planta"**
2. Pressione **Enter**
3. Aparecerá como uma tag azul
4. Clique no **"×"** para remover

#### Exemplos de Destaques
- "48m² Privativos"
- "Suíte Modulável"
- "Janelas Piso-Teto"
- "Varanda Panorâmica"

---

## 🔄 Fluxo Completo de Edição

```
Editar Projeto
     ↓
Mudar Imagem de Capa
     ↓
Clicar em "Planta"
     ↓
Upload Novas Imagens
     ↓
Editar Título/Subtítulo
     ↓
Atualizar Descrição
     ↓
Adicionar Destaques
     ↓
Salvar Configurações
     ↓
Verificar no Site
```

---

## 🖥️ Hospedagem de Imagens - Guia Rápido

### Imgur (Mais Fácil)
```
1. imgur.com → Upload
2. Copiar → Copiar link
3. Colar no admin
```

### Cloudinary (Mais Profissional)
```
1. cloudinary.com → Sign up
2. Dashboard → Upload
3. Copiar URL
4. Colar no admin
```

### Seu Próprio Servidor (Se tiver)
```
1. Coloque imagem em /public/uploads/
2. Use: /uploads/imagem.jpg
3. Pronto!
```

---

## ✅ Checklist ao Adicionar Imagens

- [ ] Imagem tem formato aceito (JPG, PNG, WebP)
- [ ] Tamanho está entre 500KB e 3MB
- [ ] Resolução mínima 800x600px
- [ ] Texto Alt está bem descritivo
- [ ] Imagem está clara e de boa qualidade
- [ ] Preview aparece corretamente
- [ ] Página foi recarregada após upload

---

## 🚨 Erros Comuns

### "Arquivo muito grande"
**Solução**: Comprima a imagem
- Use [tinypng.com](https://tinypng.com) para reduzir tamanho
- Máximo 10MB

### "Formato não suportado"
**Solução**: Converta para JPG, PNG ou WebP
- Use [convertio.co](https://convertio.co)

### "Imagem não aparece na galeria"
**Solução**: 
- Recarregue a página (F5)
- Verifique se o upload completou
- Tente novamente com arquivo diferente

### "URL da imagem não funciona"
**Solução**:
- Copie o link novamente
- Teste o link em nova aba do navegador
- Certifique-se que é URL completa (https://...)

---

## 📸 Exemplos de URLs Válidas

✅ Válido:
```
https://imgur.com/abcdef.jpg
https://res.cloudinary.com/user/image/upload/v123/foto.jpg
https://exemplo.com/imagens/projeto.png
/uploads/planta-tipo-a.jpg
```

❌ Inválido:
```
C:\Users\pasta\imagem.jpg (caminho local)
imagem.jpg (sem domínio)
```

---

## 🔐 Dicas de Segurança

- Use HTTPS em URLs de imagens
- Não compartilhe links de upload diretos
- Faça backup de imagens importantes
- Mantenha nomes descritivos

---

## 💡 Dicas Profissionais

1. **Manter Consistência**: Use imagens com proporções similares
2. **Texto Alt**: Sempre descreva bem para SEO e acessibilidade
3. **Organização**: Use nomes claros (planta-tipo-a, ambiente-sala)
4. **Backup**: Guarde cópias das imagens originais
5. **Qualidade**: Priorize imagens de alta resolução

