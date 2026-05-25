# Segurança - Senha, SESSION_SECRET e Autenticação

## 🔐 Gerenciamento de Senhas

### Entendendo o Armazenamento Seguro

A senha **NÃO é armazenada em texto plano** no banco de dados. Em vez disso, é armazenada como um **hash bcrypt**.

#### O que é Hash Bcrypt?

- ✅ Uma senha **criptografada irreversível**
- ✅ Impossível descobrir a senha original pelo hash
- ✅ Mesmo hash diferentes para mesma senha
- ✅ Extremamente seguro contra ataques

#### Exemplo:

```
Senha Original: admin123

No Banco de Dados:
$2a$10$K1.Hmz59mFrMKJl8H8KYu.eKJP8I8n8mP9b5V5n5h5y5Y5T5O5Lkm2

(Este é o hash bcrypt - irreversível)
```

### Como a Senha Nunca é Mostrada

1. **Ao Fazer Login**
   - Você digita: `admin123`
   - Sistema faz hash: `$2a$10$...`
   - Compara com hash no banco
   - Se forem iguais, login é válido

2. **No Código**
   ```javascript
   // Comparação segura (nunca retorna a senha)
   const isPasswordValid = await bcrypt.compare(password, admin.password);
   ```

3. **No Banco de Dados**
   ```javascript
   // Salvo assim:
   {
     "_id": ObjectId(...),
     "username": "admin",
     "password": "$2a$10$K1.Hmz59...",  // Hash, não a senha
     "email": "admin@example.com"
   }
   ```

### Alterando a Senha

Para mudar a senha do admin (existem 2 formas):

#### Opção 1: Via MongoDB Compass (GUI - Recomendado)

1. **Abra MongoDB Compass**
   - Download: [mongodb.com/products/compass](https://mongodb.com/products/compass)

2. **Conecte ao banco**
   - URI padrão: `mongodb://localhost:27017`

3. **Navegue até**
   ```
   ap_construcoes → admins → (clique na coleção)
   ```

4. **Procure o documento do admin**
   ```
   { username: "admin" }
   ```

5. **Use o gerador de hash online**
   - Acesse: [bcrypt-generator.com](https://bcrypt-generator.com)
   - Digite sua nova senha
   - Copie o hash gerado

6. **Atualize o campo "password"**
   - Selecione o hash atual
   - Cole o novo hash
   - Clique em "Update"

#### Opção 2: Via Terminal (Avançado)

```bash
# Conecte ao MongoDB
mongo

# Selecione o banco
use ap_construcoes

# Gere hash da nova senha (use script node)
# node -e "require('bcryptjs').hash('sua-nova-senha', 10).then(console.log)"

# Atualize a senha
db.admins.updateOne(
  { username: "admin" },
  { $set: { password: "$2a$10$..." } }  # Cole o hash aqui
)

# Verifique
db.admins.findOne({ username: "admin" })
```

---

## 🔑 Entendendo SESSION_SECRET

### O que é SESSION_SECRET?

`SESSION_SECRET` é uma **chave criptográfica** usada para:

1. **Proteger Sessões de Usuários**
   - Quando você faz login, uma sessão é criada
   - Essa sessão é assinada com SESSION_SECRET
   - Isso impede que alguém falsifique uma sessão

2. **Exemplo de Fluxo**
   ```
   Você faz login
        ↓
   Sistema cria: { user: "admin", timestamp: ... }
   Sistema assina: HASH(dados + SESSION_SECRET)
        ↓
   Envia para seu navegador como cookie
        ↓
   Você volta ao site
        ↓
   Sistema verifica: HASH está correto? Senha válida?
        ↓
   Se sim: Você continua logado
   Se não: Fazer login novamente
   ```

### Por que é Importante?

Sem SESSION_SECRET, alguém poderia:
- ❌ Falsificar um cookie de sessão
- ❌ Acessar o painel sem senha
- ❌ Fazer alterações no site

Com SESSION_SECRET:
- ✅ Sessão é protegida criptograficamente
- ✅ Apenas o servidor pode criar/validar
- ✅ Impossível falsificar

---

## 🛠️ Como Configurar SESSION_SECRET

### Gerar uma Chave Segura

#### Opção 1: Node.js (Recomendado)

Abra terminal no diretório do projeto:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Resultado será algo como:
```
a7f9e2c8d5b1f4a6c9e2d8f1a4b7c0e3d6f9a2b5c8e1f4a7d0b3c6e9f2a5b8
```

#### Opção 2: Online (Menos Seguro)

Acesse [uuid.online](https://uuid.online) ou [random-string-generator.com](https://www.random-string-generator.com/)

Gere uma string hexadecimal de **64 caracteres**

#### Opção 3: OpenSSL

Se tiver OpenSSL instalado:

```bash
openssl rand -hex 32
```

### Onde Guardar a Chave

#### Passo 1: Adicione ao arquivo `.env`

Crie ou edite o arquivo `.env` na raiz do projeto:

```env
# .env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/ap_construcoes
SESSION_SECRET=a7f9e2c8d5b1f4a6c9e2d8f1a4b7c0e3d6f9a2b5c8e1f4a7d0b3c6e9f2a5b8
```

#### Passo 2: O arquivo `.env` já está configurado?

Verifique se existe `.env` na raiz:

```bash
# No terminal, navegue até a pasta do projeto
cd c:\Users\INEX-5000\Pictures\AP_Construcoes_Contato_FullWidth\apc

# Veja se existe .env
dir .env

# Se não existir, crie a partir do .env.example
copy .env.example .env
```

#### Passo 3: Verifique se o arquivo `.gitignore` protege .env

Abra `.gitignore` e certifique-se que contém:

```
.env
```

Isso impede que a chave seja enviada para GitHub.

### Validar a Configuração

Para confirmar que está funcionando:

1. **Reinicie o servidor**
   ```bash
   npm start
   ```

2. **Faça logout** (se estiver logado)

3. **Faça login novamente**
   - Se funcionar, SESSION_SECRET está correto

---

## 📋 Arquivo .env Completo (Exemplo)

```env
# Configuração do Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/ap_construcoes

# Chave Secreta para Sessões
# Gere uma nova: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=a7f9e2c8d5b1f4a6c9e2d8f1a4b7c0e3d6f9a2b5c8e1f4a7d0b3c6e9f2a5b8

# Admin Padrão (criado automaticamente na primeira inicialização)
# Username: admin
# Password: admin123 (altere após primeiro login)
```

---

## 🔄 Procedimento: Alterar SESSION_SECRET

Se precisar trocar a chave (por segurança):

1. **Gere nova chave**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Atualize o .env**
   ```env
   SESSION_SECRET=nova-chave-aqui
   ```

3. **Reinicie o servidor**
   ```bash
   npm start
   ```

4. **Todos os usuários serão deslogados** (sesões antigas não funcionarão)

---

## 🚨 Checklist de Segurança

### ✅ Antes de Colocar em Produção

- [ ] SESSION_SECRET foi alterado do padrão
- [ ] Arquivo .env está no .gitignore
- [ ] Senha do admin foi alterada de "admin123"
- [ ] MongoDB está rodando com autenticação
- [ ] HTTPS está habilitado (em produção)
- [ ] NODE_ENV está definido como "production"
- [ ] Backups do banco estão configurados

### ✅ Gerenciamento de Credenciais

- [ ] SESSION_SECRET é guardado com segurança
- [ ] Não é commitado no Git
- [ ] Não é compartilhado por email
- [ ] Todos os admins têm senhas fortes
- [ ] Senhas são alteradas periodicamente

---

## 🔐 Dicas Profissionais de Segurança

### Senhas Fortes

Ao mudar a senha do admin, use:
- ✅ Mínimo 12 caracteres
- ✅ Maiúsculas e minúsculas
- ✅ Números
- ✅ Caracteres especiais: !@#$%^&*

Exemplo: `Pr0j3to@APC2024!`

### Múltiplos Admins

Para adicionar novos admins manualmente:

```javascript
// Use MongoDB Compass ou terminal
db.admins.insertOne({
  username: "novo-admin",
  password: "$2a$10$...",  // Hash bcrypt da senha
  email: "novo@email.com"
})
```

### Auditoria

Para verificar quem fez alterações (em produção):

```javascript
// Query para ver últimas alterações
db.pages.findOne({ id: "monumental" });
db.projects.findOne({ id: "monumental" });
```

---

## 🆘 Recuperação de Senha Perdida

Se perder a senha do admin:

1. **Acesse MongoDB Compass**
2. **Navegue até ap_construcoes → admins**
3. **Delete o documento do admin**
   ```
   { username: "admin" }
   ```
4. **Reinicie o servidor**
   - Será criado novo admin: admin / admin123
5. **Altere a senha novamente**

---

## 📞 Referências

- **bcryptjs**: [npmjs.com/package/bcryptjs](https://www.npmjs.com/package/bcryptjs)
- **express-session**: [npmjs.com/package/express-session](https://www.npmjs.com/package/express-session)
- **Gerar Hashes**: [bcrypt-generator.com](https://bcrypt-generator.com)
- **MongoDB Compass**: [mongodb.com/products/compass](https://mongodb.com/products/compass)

