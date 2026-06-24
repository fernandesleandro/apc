/**
 * Extrai imagens base64 do MongoDB para arquivos em public/images/gallery/
 * e atualiza Project + Page.hero.image com caminhos públicos.
 *
 * Uso: node scripts/migrate-base64-images.js
 *      node scripts/migrate-base64-images.js --dry-run
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

const KNOWN_PATHS = {
  'barao-rio-branco': '/images/gallery/barao-rio-branco/capa.webp',
  metropolitan: '/images/gallery/metropolitan/capa.webp'
};

const projectSchema = new mongoose.Schema({
  id: String,
  title: String,
  image: String
});

const pageSchema = new mongoose.Schema({
  id: String,
  hero: Object
});

function publicPathToFile(publicPath) {
  return path.join(__dirname, '..', 'public', publicPath.replace(/^\//, ''));
}

function extractBase64ToFile(projectId, dataUrl) {
  const match = String(dataUrl).match(/^data:image\/([\w+.-]+);base64,(.+)$/s);
  if (!match) throw new Error('Formato base64 inválido');

  let ext = match[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (ext === 'svg+xml') ext = 'svg';

  const dir = path.join(__dirname, '..', 'public', 'images', 'gallery', projectId);
  if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true });

  const filename = `capa.${ext}`;
  const filePath = path.join(dir, filename);
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
  }
  return `/images/gallery/${projectId}/${filename}`;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI não definida');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const Project = mongoose.model('Project', projectSchema);
  const Page = mongoose.model('Page', pageSchema);

  const projects = await Project.find({ image: /^data:/ }).lean();
  if (!projects.length) {
    console.log('Nenhuma imagem base64 encontrada.');
    await mongoose.disconnect();
    return;
  }

  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Migrando ${projects.length} imagem(ns) base64...`);

  for (const project of projects) {
    let imagePath = KNOWN_PATHS[project.id];
    if (imagePath && fs.existsSync(publicPathToFile(imagePath))) {
      console.log(`  ${project.id}: reutilizando ${imagePath}`);
    } else {
      imagePath = extractBase64ToFile(project.id, project.image);
      console.log(`  ${project.id}: extraído -> ${imagePath}`);
    }

    if (!DRY_RUN) {
      await Project.updateOne({ id: project.id }, { $set: { image: imagePath } });
      await Page.updateOne({ id: project.id }, { $set: { 'hero.image': imagePath } });
    }
  }

  console.log('Concluído.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
