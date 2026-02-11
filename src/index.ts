import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase } from './config/database.js';
import { startWhatsApp } from './services/whatsapp.js';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Finance Bot Iniciando...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await connectDatabase();
  await startWhatsApp();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Bot pronto!');
  console.log('💬 Aguardando mensagens...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});