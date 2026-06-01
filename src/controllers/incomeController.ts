import { IUser } from '../models/User.js';
import Income from '../models/Income.js';
import { sendMessage } from '../services/whatsapp.js';
import { getIncomeCategoryEmoji } from '../services/categoryMapper.js';
import { updateSessionStatus } from '../services/sessionService.js';
import { formatDateLabel } from '../services/messageParser.js';

export async function handleIncome(
  from: string,
  user: IUser,
  parsed: any
) {
  try {
    const { value, category, description, date } = parsed.data;

    const incomeDate = date instanceof Date ? date : new Date();

    const income = await Income.create({
      userId: user._id,
      value,
      category,
      description,
      date: incomeDate
    });

    const phoneNumber = from.split('@')[0];
    await updateSessionStatus(phoneNumber, 'active', {
      lastIncomeId: income._id,
      awaitingInput: undefined
    });

    const emoji = getIncomeCategoryEmoji(category);
    const dateLabel = formatDateLabel(incomeDate);
    const dateFormatted = incomeDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
    const dateLine = dateLabel
      ? `\n📅 ${dateLabel} (${dateFormatted})`
      : `\n📅 ${dateFormatted}`;

    const monthTotal = await getMonthTotal(user._id);

    const response =
      `🗸 Entrada registrada!\n\n` +
      `🗒️ ${description}\n` +
      `💵 R$ ${value.toFixed(2)}\n` +
      `${emoji} ${category}` +
      `${dateLine}\n\n` +
      `📈 Total entradas este mês: R$ ${monthTotal.toFixed(2)}`;

    await sendMessage(from, response);

    console.log(`✅ Entrada salva: ${description} - R$ ${value} - ${category} - ${incomeDate.toLocaleDateString('pt-BR')}`);

  } catch (error) {
    console.error('❌ Erro ao salvar entrada:', error);
    await sendMessage(from, '❌ Erro ao salvar entrada. Tente novamente.');
  }
}

export async function handleIncomeListCommand(from: string, user: IUser) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const incomes = await Income.find({
      userId: user._id,
      date: { $gte: startOfMonth, $lt: endOfMonth }
    }).sort({ date: -1 });

    if (incomes.length === 0) {
      await sendMessage(from, '📭 Nenhuma entrada registrada este mês.');
      return;
    }

    const total = incomes.reduce((sum, i) => sum + i.value, 0);

    let response = `💵 *Entradas do mês:*\n\n`;

    incomes.forEach(i => {
      const date = i.date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
      const emoji = getIncomeCategoryEmoji(i.category);
      response += `• ${i.description} - R$ ${i.value.toFixed(2)}\n`;
      response += `  ${date} • ${emoji} ${i.category}\n\n`;
    });

    response += `━━━━━━━━━━━━━━━\n💵 *Total: R$ ${total.toFixed(2)}*`;

    await sendMessage(from, response);

  } catch (error) {
    console.error('❌ Erro ao listar entradas:', error);
    await sendMessage(from, '❌ Erro ao buscar entradas.');
  }
}

export async function handleTodayIncomes(userId: any): Promise<{ items: any[]; total: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const incomes = await Income.find({
    userId,
    date: { $gte: today, $lt: tomorrow }
  }).sort({ date: -1 });

  const total = incomes.reduce((sum, i) => sum + i.value, 0);
  return { items: incomes, total };
}

async function getMonthTotal(userId: any): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await Income.aggregate([
    {
      $match: {
        userId,
        date: { $gte: startOfMonth, $lt: endOfMonth }
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