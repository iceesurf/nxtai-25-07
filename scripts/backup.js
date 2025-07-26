#!/usr/bin/env node
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');
const timestamp = new Date().toISOString().replace(/:/g, '-');

// Criar diretório de backup se não existir
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('🔄 Iniciando backup...');

// Backup do Firestore
exec(`firebase firestore:backup gs://nxtai-backups/backup-${timestamp}`, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Erro no backup:', error);
    return;
  }
  console.log('✅ Backup concluído:', stdout);
});

// Limpar backups antigos (mais de 30 dias)
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
fs.readdirSync(BACKUP_DIR).forEach(file => {
  const filePath = path.join(BACKUP_DIR, file);
  const stats = fs.statSync(filePath);
  if (stats.mtime.getTime() < thirtyDaysAgo) {
    fs.unlinkSync(filePath);
    console.log(`🗑️  Removido backup antigo: ${file}`);
  }
});
