import { IUser } from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { sendMessage } from '../services/whatsapp.js';
import { getCategoryEmoji } from '../services/categoryMapper.js';
import { updateSessionStatus } from '../services/sessionService.js';
import mongoose from 'mongoose';

export async function handleTransaction(
  from: string,
  user: IUser,
  parsed: any,
  autoCategorizacao: boolean = false
) {
  try {
    const { value, category, description, keyword } = parsed.data;

    const transaction = await Transaction.create({
      userId: user._id,
      value,
      category,
      description,
      paymentMethod: 'dinheiro',
      date: new Date()
    });

    const todayTotal = await getTodayTotal(user._id);
    const emoji = getCategoryEmoji(category);

    let response = `✅ Gasto registrado!

📝 ${description}
💰 R$ ${value.toFixed(2)}
🏷️ ${emoji} ${category}

📊 Total hoje: R$ ${todayTotal.toFixed(2)}`;

    // Se foi categorização automática, oferece opção de mudar
    if (autoCategorizacao) {
      const phoneNumber = from.split('@')[0];
      
      // Salva ID da transação na sessão
      await updateSessionStatus(phoneNumber, 'active', {
        lastTransactionId: transaction._id,
        awaitingInput: undefined
      });

      response += `\n\n💡 Categorizei automaticamente como "${category}"`;
      response += `\n\nQuer mudar? Digite: /mudar`;
    }

    await sendMessage(from, response);
    
    console.log(`✅ Transação salva: ${description} - R$ ${value} - ${category}`);

  } catch (error) {
    console.error('❌ Erro ao salvar transação:', error);
    await sendMessage(from, '❌ Erro ao salvar gasto. Tente novamente.');
  }
}

export async function handleListCommand(from: string, user: IUser) {
  try {
    const transactions = await Transaction.find({ userId: user._id })
      .sort({ date: -1 })
      .limit(5);

    if (transactions.length === 0) {
      await sendMessage(from, '📭 Nenhum gasto registrado ainda.');
      return;
    }

    let response = '📝 *Últimos gastos:*\n\n';
    
    transactions.forEach((t, index) => {
      const date = t.date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
      const emoji = getCategoryEmoji(t.category);
      response += `${index + 1}. ${t.description} - R$ ${t.value.toFixed(2)}\n`;
      response += `   ${date} • ${emoji} ${t.category}\n\n`;
    });

    await sendMessage(from, response);

  } catch (error) {
    console.error('❌ Erro ao listar:', error);
    await sendMessage(from, '❌ Erro ao buscar gastos.');
  }
}

export async function handleTodayCommand(from: string, user: IUser) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const transactions = await Transaction.find({
      userId: user._id,
      date: { $gte: today, $lt: tomorrow }
    }).sort({ date: -1 });

    if (transactions.length === 0) {
      await sendMessage(from, '📭 Nenhum gasto hoje.');
      return;
    }

    const total = transactions.reduce((sum, t) => sum + t.value, 0);

    let response = `📊 *Gastos de hoje:*\n\n`;
    
    transactions.forEach((t) => {
      const time = t.date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const emoji = getCategoryEmoji(t.category);
      response += `• ${t.description} - R$ ${t.value.toFixed(2)}\n`;
      response += `  ${time} • ${emoji} ${t.category}\n\n`;
    });

    response += `━━━━━━━━━━━━━━━\n💰 *Total: R$ ${total.toFixed(2)}*`;

    await sendMessage(from, response);

  } catch (error) {
    console.error('❌ Erro:', error);
    await sendMessage(from, '❌ Erro ao buscar gastos de hoje.');
  }
}

export async function handleHelpCommand(from: string) {
  const help = `🤖 *Bot de Finanças*

📝 *Registrar gastos:*
Digite: [descrição] [valor]

Exemplos:
- Uber 25
- Almoço 35
- Mercado 250.50

📊 *Comandos:*
/hoje - Gastos de hoje
/ultimos - Últimos 5 gastos
/categorias - Ver categorias
/mapear - Ver mapeamentos
/mudar - Mudar categoria do último gasto
/apagar [palavra] - Remover mapeamento
/ajuda - Esta mensagem

💡 O bot aprende suas preferências!`;

  await sendMessage(from, help);
}

async function getTodayTotal(userId: any): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await Transaction.aggregate([
    {
      $match: {
        userId,
        date: { $gte: today, $lt: tomorrow }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$value' }
      }
    }
  ]);

  return result[0]?.total || 0;
}