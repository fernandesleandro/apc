# 🧹 LIMPEZA DE CACHE - INSTRUÇÕES COMPLETAS

## ✅ Alteração Visual Aplicada

**Cor de fundo**: Azul escuro (#001a4d) adicionada à página de edição de projeto para validar que as alterações estão sendo carregadas.

---

## 🔄 Passos para Limpar Cache

### 1️⃣ LIMPAR CACHE DO NAVEGADOR

#### No Google Chrome
1. Pressione: `Ctrl + Shift + Delete` (Windows) ou `Cmd + Shift + Delete` (Mac)
2. Ou vá: Menu → Ferramentas → Limpar Dados de Navegação
3. Selecione:
   - ✅ Cookies e outros dados de site
   - ✅ Imagens e arquivos em cache
   - **Intervalo de tempo**: Selecione "Sempre" ou "Últimas 24 horas"
4. Clique: "Limpar dados"
5. Recarregue a página: `Ctrl + F5` ou `Ctrl + Shift + R`

#### No Firefox
1. Pressione: `Ctrl + Shift + Delete` (Windows) ou `Cmd + Shift + Delete` (Mac)
2. Ou vá: Menu → Configurações → Privacidade & Segurança
3. Selecione:
   - ✅ Cookies
   - ✅ Cache
4. Clique: "Limpar Agora"
5. Recarregue a página: `Ctrl + F5`

#### No Safari
1. Vá: Safari → Limpar Histórico
2. Selecione: "Todo o histórico"
3. Clique: "Limpar Histórico"
4. Recarregue a página: `Cmd + Shift + R`

#### No Edge
1. Pressione: `Ctrl + Shift + Delete`
2. Ou vá: Menu → Configurações → Privacidade
3. Selecione:
   - ✅ Cookies e dados de site
   - ✅ Arquivos em cache
4. Clique: "Limpar agora"

---

### 2️⃣ LIMPAR CACHE DO SERVIDOR (Node.js)

#### Opção A: Reiniciar o Servidor (Recomendado)

**No Terminal:**
```bash
# Parar o servidor (se está rodando)
Ctrl + C

# Limpar cache (Node)
npm cache clean --force

# Reiniciar o servidor
npm start
```

#### Opção B: Hard Refresh no Navegador
- **Chrome/Edge**: `Ctrl + Shift + R`
- **Firefox**: `Ctrl + Shift + R`
- **Safari**: `Cmd + Shift + R`

---

### 3️⃣ LIMPAR CACHE DO VERCEL (Se em Produção)

Se o site está deployado no Vercel:

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá para: **Settings → Caching**
4. Clique: **Purge Cache**
5. Aguarde 30-60 segundos

---

### 4️⃣ LIMPAR CACHE LOCAL DO PROJETO

**No Terminal (na pasta do projeto):**
```bash
# Limpar node_modules e reinstalar
rm -rf node_modules
rm package-lock.json
npm install

# Limpar cache do npm
npm cache clean --force
```

---

## ✅ Como Validar que o Cache Foi Limpo

### Teste Visual: Fundo Azul Escuro

1. **Abra o navegador DevTools** (`F12`)
2. **Vá para aba "Network"** 
3. **Marque a checkbox "Disable cache"**
4. **Recarregue a página** (`F5`)
5. **Vá para `/admin/edit-project/{projectId}`**

**Esperado**: Fundo da página **AZUL ESCURO (#001a4d)**

Se você ver:
- ✅ **Azul escuro** → Cache foi limpo, alterações carregadas! 🎉
- ❌ **Branco/cinza** → Cache ainda ativo, repetir passos acima

---

## 📋 Checklist de Limpeza Completa

- [ ] 1. Limpar cache do navegador (Ctrl + Shift + Delete)
- [ ] 2. Limpar cookies e cache de site
- [ ] 3. Fechar aba/janela do navegador completamente
- [ ] 4. Reabrir navegador
- [ ] 5. Acessar `/admin/edit-project/`
- [ ] 6. Ver fundo **azul escuro**?
- [ ] 7. Ativar DevTools (F12) → Network → "Disable cache"
- [ ] 8. Hard refresh (Ctrl + Shift + R)
- [ ] 9. Confirmar azul escuro visível

---

## 🚀 Se Ainda Não Aparecer Azul Escuro

### Passo 1: Verificar se arquivo foi modificado
```bash
grep -n "001a4d\|background-color.*#001a4d" views/admin-edit-project-new.ejs
```
**Esperado**: Deve retornar 2 linhas (body + edit-container)

### Passo 2: Restart completo do servidor
```bash
# Terminal 1: Parar servidor
Ctrl + C

# Terminal 1: Limpar tudo
npm cache clean --force
rm -rf .next (se tiver)
rm -rf node_modules/.cache (se tiver)

# Terminal 1: Reiniciar
npm start
```

### Passo 3: Verificar console do servidor
Procure por logs assim:
```
[timestamp] GET /admin/edit-project/cosmopolitan
[timestamp] GET /admin/edit-project-new (ou similar)
```

Se não aparecer: Pode estar usando cache em memória (Node caches views)

### Passo 4: Forçar recarga no Node
Em `server.js`, adicione no início:
```javascript
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
```

Mas já está em server.js? Procure por:
```bash
grep -n "Cache-Control\|no-cache\|no-store" server.js
```

---

## 💡 Tips Adicionais

### Ambiente de Desenvolvimento
- Sempre ativar **"Disable cache"** em DevTools → Network
- Usar **"Hard Refresh"** ao invés de simples F5
- Considerar usar **modo incógnito** para teste limpo

### Ambiente de Produção (Vercel)
- Purgar cache do Vercel (Settings → Caching)
- Fazer novo deploy: `git push`
- Aguardar 1-2 min de propagação

### Localizar Arquivos em Cache
- **Chrome**: `C:\Users\{USER}\AppData\Local\Google\Chrome\User Data\Default\Cache`
- **Firefox**: `C:\Users\{USER}\AppData\Local\Mozilla\Firefox\Profiles\{random}\cache2`
- **Edge**: `C:\Users\{USER}\AppData\Local\Microsoft\Edge\User Data\Default\Cache`

---

## ✨ Resultado Esperado

### Antes (com cache)
```
Fundo branco/cinza
Alterações não aparecem
Console Network mostra status 304 (Not Modified)
```

### Depois (cache limpo)
```
✅ Fundo AZUL ESCURO (#001a4d)
✅ Alterações aparecem
✅ Console Network mostra status 200 (OK)
```

---

## 📞 Se Persistir o Problema

1. **Verifique DevTools**:
   - Abra: F12 → Console
   - Procure por erros em vermelho
   - Cole aqui

2. **Verifique Terminal do Servidor**:
   - Procure por logs de erro
   - Procure por `[UPLOAD]` ou `[ERROR]`
   - Cole aqui

3. **Verifique Network**:
   - F12 → Network
   - Recarregue
   - Procure por status HTTP
   - 200 = OK, 304 = Cache, 500 = Erro Servidor

---

## 🎯 Próximo Passo

1. Execute **todos os passos acima**
2. Recarregue `/admin/edit-project/{projectId}`
3. **Você deve ver fundo AZUL ESCURO**
4. Se sim: ✅ Cache limpo, alterações funcionando!
5. Se não: Veja seção "Se Ainda Não Aparecer"

**Status**: Aguardando confirmação visual do fundo azul 🔵
