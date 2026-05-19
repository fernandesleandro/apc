# AP Construções - Backend Administrativo

Este projeto adiciona uma área administrativa e conteúdo dinâmico ao site AP Construções. Ele usa Node.js com Express e um banco de dados NoSQL leve (`lowdb`) para armazenar configurações do site e cabeçalho/rodapé.

## O que foi criado

- `server.js` — servidor Express que renderiza páginas com EJS.
- `package.json` — dependências do Node.
- `data/db.json` — banco de dados NoSQL leve com navegação, rodapé, páginas e projetos.
- `data/descriptions/*.txt` — descrições de cada página separadas em arquivos de texto.
- `views/` — templates EJS com header/footer centralizados e páginas dinâmicas.
- `views/admin.ejs` — área administrativa para editar conteúdo.

## Como usar

1. Instale o Node.js e execute o comando abaixo no diretório `apc`:

```bash
npm install
```

2. Inicie o servidor:

```bash
npm start
```

3. Abra no navegador:

- `http://localhost:3000/` — site dinâmico
- `http://localhost:3000/admin` — área administrativa

## Observações

- As descrições das páginas estão em `data/descriptions/*.txt`.
- O menu e o rodapé podem ser atualizados pela área administrativa.
- Se quiser usar MongoDB ou outro banco NoSQL real, posso migrar `lowdb` para `mongodb` em seguida.
