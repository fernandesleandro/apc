/**
 * Sincroniza obras, páginas e galerias do data/database.json → MongoDB.
 * Uso: node scripts/sync-project-pages.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ap_construcoes';

const projectSchema = new mongoose.Schema({
  id: String,
  title: String,
  description: String,
  image: String,
  href: String,
  badge: String,
  category: String
});
const pageSchema = new mongoose.Schema({
  id: String,
  title: String,
  description: String,
  hero: Object,
  details: Object,
  content: Object
});
const gallerySchema = new mongoose.Schema({ projectId: String, images: Array });

const Project = mongoose.model('Project', projectSchema);
const Page = mongoose.model('Page', pageSchema);
const PlantaGallery = mongoose.model('PlantaGallery', gallerySchema);
const ProjectGallery = mongoose.model('ProjectGallery', gallerySchema);

const PROJECT_PAGE_IDS = [
  'monumental', 'cosmopolitan', 'barao-maua',
  'barao-rio-branco', 'chateau-valois', 'metropolitan', 'olympique'
];

async function main() {
  const dbFile = path.join(__dirname, '..', 'data', 'database.json');
  const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  await mongoose.connect(MONGO_URI);

  for (const p of data.projects || []) {
    const result = await Project.updateOne({ id: p.id }, { $set: p }, { upsert: true });
    console.log(`Project ${p.id}: ${result.upsertedCount ? 'criado' : 'atualizado'}`);
  }

  for (const p of (data.pages || []).filter((x) => PROJECT_PAGE_IDS.includes(x.id))) {
    const result = await Page.updateOne(
      { id: p.id },
      { $set: { title: p.title, description: p.description, hero: p.hero, details: p.details } },
      { upsert: true }
    );
    console.log(`Page ${p.id}: ${result.upsertedCount ? 'criada' : 'atualizada'}`);
  }

  for (const [projectId, images] of Object.entries(data.projectGalleries || {})) {
    await ProjectGallery.updateOne({ projectId }, { $set: { images } }, { upsert: true });
    console.log(`ProjectGallery ${projectId}: ${images.length} imagem(ns)`);
  }

  for (const [projectId, images] of Object.entries(data.plantaGalleries || {})) {
    await PlantaGallery.updateOne({ projectId }, { $set: { images } }, { upsert: true });
    console.log(`PlantaGallery ${projectId}: ${images.length} planta(s)`);
  }

  await mongoose.disconnect();
  console.log('Concluído.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
