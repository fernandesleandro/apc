/**
 * Atualiza páginas de obras no MongoDB a partir de data/database.json
 * (útil quando o banco já foi seedado e só o JSON mudou).
 * Uso: node scripts/sync-project-pages.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ap_construcoes';
const PROJECT_IDS = ['monumental', 'cosmopolitan', 'barao-maua'];

const pageSchema = new mongoose.Schema({
  id: String,
  title: String,
  description: String,
  hero: Object,
  details: Object,
  content: Object
});
const Page = mongoose.model('Page', pageSchema);

async function main() {
  const dbFile = path.join(__dirname, '..', 'data', 'database.json');
  const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  await mongoose.connect(MONGO_URI);
  for (const p of data.pages.filter((x) => PROJECT_IDS.includes(x.id))) {
    const result = await Page.updateOne(
      { id: p.id },
      { $set: { title: p.title, description: p.description, hero: p.hero, details: p.details } }
    );
    console.log(`${p.id}: ${result.matchedCount ? 'atualizado' : 'não encontrado (crie a página no admin)'}`);
  }
  await mongoose.disconnect();
  console.log('Concluído.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
