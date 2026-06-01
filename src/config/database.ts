import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Saving from '../models/Saving.js';
import SavingEntry from '../models/SavingEntry.js';
import CreditCard from '../models/CreditCard.js';
import CreditCardPurchase from '../models/CreditCardPurchase.js';
import CreditCardInstallment from '../models/CreditCardInstallment.js';
import Session from '../models/Session.js';
import InvestmentSummary from '../models/InvestimentSummary.js';
import InvestmentTransaction from '../models/InvestimentTransaction.js';

export async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✅ MongoDB conectado!');
    await syncIndexes();
  } catch (error) {
    console.error('❌ Erro ao conectar MongoDB:', error);
    process.exit(1);
  }
}

async function syncIndexes() {
  try {
    console.log('🔄 Sincronizando índices...');

    const models = [
      { name: 'User', model: User },
      { name: 'Transaction', model: Transaction },
      { name: 'Income', model: Income },
      { name: 'Saving', model: Saving },
      { name: 'SavingEntry', model: SavingEntry },
      { name: 'CreditCard', model: CreditCard },
      { name: 'CreditCardPurchase', model: CreditCardPurchase },
      { name: 'CreditCardInstallment', model: CreditCardInstallment },
      { name: 'InvestmentSummary', model: InvestmentSummary },
      { name: 'InvestmentTransaction', model: InvestmentTransaction },
      { name: 'Session', model: Session },
    ];

    for (const { name, model } of models) {
      try {
        await model.syncIndexes();
        console.log(`  ✓ ${name}`);
      } catch (error: any) {
        if (error.code === 85) {
          console.log(`  ⚠ ${name} (índice já existe)`);
        } else {
          console.warn(`  ⚠ ${name}:`, error.message);
        }
      }
    }

    console.log('✅ Sincronização concluída!');
  } catch (error) {
    console.warn('⚠️ Aviso na sincronização de índices');
  }
}