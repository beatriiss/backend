import { IUser } from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { sendMessage } from '../services/whatsapp.js';

export async function handleTransaction(
  from: string,
  user: IUser,
  parsed: any
) {
  try {
    const { value, category, description } = parsed.data;

    const transaction = await Transaction.create({
      userId: user._id,
      value,
      category,
      description,
      paymentMethod: 'dinheiro',
      date: new Date()
    });

    const todayTotal = await getTodayTotal(user._id);

    const response = `✅ Gasto registrado!

📝 ${description}
💰 R$ ${value.toFixed(2)}
🏷️ Categoria: ${category}

📊 Total hoje: R$ ${todayTotal.toFixed(2)}`;

    await sendMessage(from, response);
    
    console.log(`✅ Transação salva: ${description} - R$ ${value}`);

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

    let response = '📝 Últimos gastos:\n\n';
    
    transactions.forEach((t, index) => {
      const date = t.date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
      response += `${index + 1}. ${t.description} - R$ ${t.value.toFixed(2)}\n`;
      response += `   ${date} • ${t.category}\n\n`;
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

    let response = `📊 Gastos de hoje:\n\n`;
    
    transactions.forEach((t) => {
      const time = t.date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      response += `• ${t.description} - R$ ${t.value.toFixed(2)}\n`;
      response += `  ${time}\n\n`;
    });

    response += `━━━━━━━━━━━━━━━\n💰 Total: R$ ${total.toFixed(2)}`;

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
- Almoço 35
- Uber 15.50
- Mercado 250

📊 *Comandos:*
/hoje - Gastos de hoje
/ultimos - Últimos 5 gastos
/ajuda - Esta mensagem

Em breve: relatórios, cartão, investimentos!`;

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