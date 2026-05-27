# Teste Completo de Upload - Checklist Integrado

## 🎯 Objetivo
Validar que uploads de plantas e galeria persistem corretamente ao disco e ao banco de dados após consolidação de código.

---

## 📋 TESTE 1: Upload de Planta

### Pré-requisitos
- ✅ Estar logado no painel admin (`/admin`)
- ✅ Ter um projeto com ao menos um PropertyName (ex: "cosmopolitan")
- ✅ Abrir editor: `/admin/edit-project/{projectId}`
- ✅ Aba "Plantas" visível

### Passos
1. **Navegar até Plantas**
   - Clique na aba "Plantas"
   - Confirme que seção está vazia ou mostra plantas anteriores

2. **Selecionar Imagem**
   - Clique em "Escolher Imagens"
   - Selecione 1 arquivo imagem (PNG/JPG, <5MB recomendado)
   - Confirme preview aparece com:
     - Miniatura da imagem
     - Campo "Descrição (alt)" vazio
     - Campo "Título" vazio
     - Status: "Aguardando..." (cinza)

3. **Preencher Metadados**
   - **Descrição (alt)**: "Planta do projeto cosmopolitan"
   - **Título**: "Planta Principal" (opcional)
   - Confirme que campos estão preenchidos

4. **Upload**
   - Clique em "Upload de Imagens"
   - **Observe**:
     - Botão fica "Enviando..." (disabled)
     - Barra de progresso aparece (0% → 100%)
     - Status muda para "Carregando..." (amarelo)

5. **Validar Sucesso**
   - Status muda para "✓ Upload concluído" (verde)
   - Mensagem toast: "Todas as imagens foram carregadas com sucesso!"
   - Preview desaparece (array limpo)
   - Botão volta a "Upload de Imagens" (enabled)

### Validações Backend (Console Servidor)
```
[UPLOAD-PLANTA] ✓ Recebido: {filename}.jpg (45678 bytes)
[UPLOAD-PLANTA] Caminho no disco: /absolute/path/public/images/planta/cosmopolitan/{filename}.jpg
[UPLOAD-PLANTA] Existe no disco: true
[UPLOAD-PLANTA] Path web: /images/planta/cosmopolitan/{filename}.jpg
[UPLOAD-PLANTA] Criando nova galeria para projeto: cosmopolitan
[UPLOAD-PLANTA] ✓ Salvo em BD: cosmopolitan
[UPLOAD-PLANTA] Total de imagens: 1
```

### Validações Filesystem
- [ ] Arquivo existe em: `/public/images/planta/cosmopolitan/{filename}.jpg`
- [ ] Arquivo legível e íntegro (não vazio)
- [ ] Timestamp do arquivo = agora

### Validações Database
- [ ] Abra MongoDB (ex: MongoDB Compass)
- [ ] Coleção: `plantagalleries`
- [ ] Documento com `projectId: "cosmopolitan"` existe
- [ ] Array `images` contém 1 objeto:
  ```json
  {
    "src": "/images/planta/cosmopolitan/{filename}.jpg",
    "alt": "Planta do projeto cosmopolitan",
    "title": "Planta Principal",
    "uploadedAt": "2025-01-20T10:30:00.000Z"
  }
  ```

---

## 📋 TESTE 2: Upload de Galeria

### Pré-requisitos
- ✅ Ter completado TESTE 1 ou ter projeto válido
- ✅ Estar na aba "Galeria Geral"

### Passos
1. **Navegar até Galeria Geral**
   - Clique na aba "Galeria Geral"
   - Confirme que seção está vazia ou mostra galerias anteriores

2. **Selecionar Múltiplas Imagens**
   - Clique em "Escolher Imagens"
   - Selecione 2-3 arquivos (PNG/JPG, <5MB cada)
   - Confirme 2-3 previews aparecem

3. **Preencher Metadados**
   - Para cada imagem:
     - **Descrição (alt)**: "Detalhe da fachada" (img 1), "Interior" (img 2), etc.
     - **Título**: "Fachada" (img 1), "Sala" (img 2), etc.

4. **Upload**
   - Clique em "Upload de Imagens"
   - **Observe**:
     - Barras de progresso para cada imagem
     - Status muda em tempo real

5. **Validar Sucesso**
   - Todas as imagens mostram "✓ Upload concluído"
   - Toast: "Todas as imagens foram carregadas com sucesso!"
   - Previews desaparecem
   - Seção "Galerias Salvas" atualiza com novas imagens

### Validações Backend (Console Servidor)
```
[UPLOAD-GALLERY] ✓ Recebido: image1.jpg (56789 bytes)
[UPLOAD-GALLERY] Caminho no disco: /absolute/path/public/images/gallery/cosmopolitan/detalhe/image1.jpg
[UPLOAD-GALLERY] Existe no disco: true
[UPLOAD-GALLERY] Path web: /images/gallery/cosmopolitan/detalhe/image1.jpg
[UPLOAD-GALLERY] ✓ Salvo em BD: cosmopolitan
[UPLOAD-GALLERY] Total de imagens: 1

[UPLOAD-GALLERY] ✓ Recebido: image2.jpg (67890 bytes)
[UPLOAD-GALLERY] Caminho no disco: /absolute/path/public/images/gallery/cosmopolitan/detalhe/image2.jpg
[UPLOAD-GALLERY] Existe no disco: true
[UPLOAD-GALLERY] Path web: /images/gallery/cosmopolitan/detalhe/image2.jpg
[UPLOAD-GALLERY] ✓ Salvo em BD: cosmopolitan
[UPLOAD-GALLERY] Total de imagens: 2
```

### Validações Filesystem
- [ ] Arquivo 1 existe: `/public/images/gallery/cosmopolitan/detalhe/image1.jpg`
- [ ] Arquivo 2 existe: `/public/images/gallery/cosmopolitan/detalhe/image2.jpg`
- [ ] Ambos legíveis e íntegros

### Validações Database
- [ ] Coleção: `projectgalleries`
- [ ] Documento com `projectId: "cosmopolitan"` existe
- [ ] Array `images` contém 2+ objetos com paths em `/images/gallery/cosmopolitan/detalhe/`

---

## 📋 TESTE 3: Compatibilidade com Rotas Legadas

### Passo 1: Redirect do Editor de Plantas
- [ ] Acesse: `/admin/edit-planta/cosmopolitan`
- [ ] Esperado: Redireciona para `/admin/edit-project/cosmopolitan#planta`
- [ ] Aba "Plantas" ativada automaticamente

### Passo 2: Redirect do Editor de Galeria
- [ ] Acesse: `/admin/edit-gallery/cosmopolitan`
- [ ] Esperado: Redireciona para `/admin/edit-project/cosmopolitan#gallery`
- [ ] Aba "Galeria Geral" ativada automaticamente

---

## 📋 TESTE 4: Validação de Erros

### Teste 4a: Sem Alt Text
- [ ] Tente enviar imagem SEM preencher "Descrição (alt)"
- [ ] Esperado: Toast "Descrição (alt) é obrigatória para {filename}"
- [ ] Arquivo NÃO é enviado
- [ ] Preview continua visível com status de erro

### Teste 4b: Sem Imagem Selecionada
- [ ] Clique "Upload de Imagens" com preview VAZIO
- [ ] Esperado: SweetAlert "Nenhuma imagem selecionada"
- [ ] Arquivo NÃO é enviado

### Teste 4c: Arquivo Muito Grande
- [ ] Selecione imagem >5MB
- [ ] Esperado: Multer ou frontend rejeita
- [ ] Status: "✕ Erro: Arquivo muito grande"

---

## 📋 TESTE 5: Deletar Imagens

### Teste 5a: Deletar Planta
- [ ] Na seção "Galerias Salvas" (Plantas), clique botão "X" de uma imagem
- [ ] Confirme: "Tem certeza?" (SweetAlert)
- [ ] Clique "Sim, deletar!"
- [ ] Esperado:
  - Imagem desaparece do grid
  - Backend log: `[DELETE] Arquivo de planta removido: ...`
  - Arquivo removido de `/public/images/planta/cosmopolitan/`
  - Documento atualizado em BD (array `images` reduzido)

### Teste 5b: Deletar Galeria
- [ ] Na seção "Galerias Salvas" (Galeria), clique "X" de uma imagem
- [ ] Confirme deletar
- [ ] Esperado:
  - Imagem desaparece
  - Arquivo removido de `/public/images/gallery/cosmopolitan/detalhe/`
  - BD atualizado

---

## 🔍 Checklist de Diagnóstico (Se Algo Falhar)

| Problema | Checklist |
|----------|-----------|
| **Arquivo não aparece no disco** | ✓ Logs mostram "Existe no disco: true"? ✓ `/public/images/` é gravável? ✓ Multer está criando pasta? |
| **Imagem não aparece em BD** | ✓ Coleção `plantagalleries` ou `projectgalleries` existe? ✓ MongoDB conectado? ✓ Logs mostram "✓ Salvo em BD"? |
| **Path web incorreto** | ✓ `toWebPath()` funciona? ✓ "Path web" começa com `/images/`? ✓ Static files servidos? |
| **Upload vazio (file null)** | ✓ FormData.append('image', file) correto? ✓ frontend envia arquivo? ✓ Multer recebe? |
| **Validação de alt falha** | ✓ Frontend valida antes de enviar? ✓ Backend valida também? ✓ Message clara? |
| **Timeout na upload** | ✓ Arquivo muito grande? ✓ Network lento? ✓ Backend em loop infinito? |

---

## 📊 Resultado Final

### ✅ Sucesso
- [ ] TESTE 1 (Planta): arquivo + BD + fs + logs OK
- [ ] TESTE 2 (Galeria): arquivo + BD + fs + logs OK
- [ ] TESTE 3 (Redirects): legados funcionam
- [ ] TESTE 4 (Erros): validações disparam correto
- [ ] TESTE 5 (Delete): remove BD + fs correto

### ⚠️ Parcial
- [ ] N testes passam, M falham
- [ ] Descrever falhas abaixo:

### ❌ Crítico
- [ ] Múltiplos testes falharam
- [ ] Possível: Multer não configurado, BD desconectada, fs não gravável

**Anotações Adicionais:**
```
[Espaço para notas de teste]


```

---

**Data de Execução:** _______________  
**Executor:** _______________  
**Status Final:** ✅ OK / ⚠️ PARCIAL / ❌ CRÍTICO
