import { IUser } from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import { sendMessage } from '../services/whatsapp.js';
import { getCategoryEmoji, getIncomeCategoryEmoji } from '../services/categoryMapper.js';
import { updateSessionStatus, getSession, clearSession } from '../services/sessionService.js';
import { parseDate, formatDateLabel } from '../services/messageParser.js';

export async function handleTransaction(
  from: string,
  user: IUser,
  parsed: any,
  autoCategorizacao: boolean = false
) {
  try {
    const { value, category, description, date } = parsed.data;

    const transactionDate = date instanceof Date ? date : new Date();

    const transaction = await Transaction.create({
      userId: user._id,
      value,
      category,
      description,
      paymentMethod: 'dinheiro',
      date: transactionDate
    });

    const todayTotal = await getTodayTotal(user._id);
    const emoji = getCategoryEmoji(category);
    const dateLabel = formatDateLabel(transactionDate);
    const dateFormatted = transactionDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
    const dateLine = dateLabel
      ? `\n📅 ${dateLabel} (${dateFormatted})`
      : `\n📅 ${dateFormatted}`;

    let response =
      `🗸 Gasto registrado!\n\n` +
      `🗒️ ${description}\n` +
      `💵 R$ ${value.toFixed(2)}\n` +
      `🏷️ ${emoji} ${category}` +
      `${dateLine}\n\n` +
      `📈 Total hoje: R$ ${todayTotal.toFixed(2)}`;

    if (autoCategorizacao) {
      const phoneNumber = from.split('@')[0];

      await updateSessionStatus(phoneNumber, 'active', {
        lastTransactionId: transaction._id,
        awaitingInput: undefined
      });

      response += `\n\n💡 Categorizei automaticamente como "${category}"`;
      response += `\nQuer mudar? Digite: /mudar`;
    }

    await sendMessage(from, response);

    console.log(`✅ Transação salva: ${description} - R$ ${value} - ${category} - ${transactionDate.toLocaleDateString('pt-BR')}`);

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

    let response = '🗒️ *Últimos gastos:*\n\n';

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

    // Busca gastos e entradas do dia
    const [transactions, incomes] = await Promise.all([
      Transaction.find({
        userId: user._id,
        date: { $gte: today, $lt: tomorrow }
      }).sort({ date: -1 }),
      Income.find({
        userId: user._id,
        date: { $gte: today, $lt: tomorrow }
      }).sort({ date: -1 })
    ]);

    if (transactions.length === 0 && incomes.length === 0) {
      await sendMessage(from, '📭 Nenhum registro hoje.');
      return;
    }

    const totalGastos = transactions.reduce((sum, t) => sum + t.value, 0);
    const totalEntradas = incomes.reduce((sum, i) => sum + i.value, 0);
    const saldo = totalEntradas - totalGastos;

    let response = `📈 *Resumo de hoje:*\n`;

    // Entradas
    if (incomes.length > 0) {
      response += `\n💵 *Entradas: R$ ${totalEntradas.toFixed(2)}*\n`;
      incomes.forEach(i => {
        const time = i.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const emoji = getIncomeCategoryEmoji(i.category);
        response += `• ${i.description} - R$ ${i.value.toFixed(2)}\n`;
        response += `  ${time} • ${emoji} ${i.category}\n`;
      });
    }

    // Gastos
    if (transactions.length > 0) {
      response += `\n🛒 *Gastos: R$ ${totalGastos.toFixed(2)}*\n`;
      transactions.forEach(t => {
        const time = t.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const emoji = getCategoryEmoji(t.category);
        response += `• ${t.description} - R$ ${t.value.toFixed(2)}\n`;
        response += `  ${time} • ${emoji} ${t.category}\n`;
      });
    }

    // Saldo
    response += `\n━━━━━━━━━━━━━━━\n`;
    if (totalEntradas > 0) {
      const saldoEmoji = saldo >= 0 ? '🗸' : '❌';
      response += `${saldoEmoji} *Saldo: R$ ${saldo.toFixed(2)}*`;
    } else {
      response += `💵 *Total gastos: R$ ${totalGastos.toFixed(2)}*`;
    }

    await sendMessage(from, response);

  } catch (error) {
    console.error('❌ Erro:', error);
    await sendMessage(from, '❌ Erro ao buscar registros de hoje.');
  }
}

export async function handleResumoCommand(from: string, user: IUser) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [transactions, incomes] = await Promise.all([
      Transaction.find({
        userId: user._id,
        date: { $gte: startOfMonth, $lt: endOfMonth }
      }),
      Income.find({
        userId: user._id,
        date: { $gte: startOfMonth, $lt: endOfMonth }
      })
    ]);

    const totalGastos = transactions.reduce((sum, t) => sum + t.value, 0);
    const totalEntradas = incomes.reduce((sum, i) => sum + i.value, 0);
    const saldo = totalEntradas - totalGastos;

    // Agrupa gastos por categoria
    const porCategoria: Record<string, number> = {};
    transactions.forEach(t => {
      porCategoria[t.category] = (porCategoria[t.category] || 0) + t.value;
    });

    const mesNome = now.toLocaleDateString('pt-BR', { month: 'long' });

    let response = `📈 *Resumo de ${mesNome}:*\n\n`;

    // Entradas
    response += `💵 *Entradas: R$ ${totalEntradas.toFixed(2)}*\n`;
    if (incomes.length === 0) {
      response += `  Nenhuma entrada registrada\n`;
    } else {
      const porCatIncome: Record<string, number> = {};
      incomes.forEach(i => {
        porCatIncome[i.category] = (porCatIncome[i.category] || 0) + i.value;
      });
      Object.entries(porCatIncome).forEach(([cat, val]) => {
        const emoji = getIncomeCategoryEmoji(cat);
        response += `  ${emoji} ${cat}: R$ ${val.toFixed(2)}\n`;
      });
    }

    // Gastos
    response += `\n🛒 *Gastos: R$ ${totalGastos.toFixed(2)}*\n`;
    if (transactions.length === 0) {
      response += `  Nenhum gasto registrado\n`;
    } else {
      Object.entries(porCategoria)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, val]) => {
          const emoji = getCategoryEmoji(cat);
          const pct = totalGastos > 0 ? ((val / totalGastos) * 100).toFixed(0) : '0';
          response += `  ${emoji} ${cat}: R$ ${val.toFixed(2)} (${pct}%)\n`;
        });
    }

    // Saldo
    response += `\n━━━━━━━━━━━━━━━\n`;
    const saldoEmoji = saldo >= 0 ? '🗸' : '❌';
    response += `${saldoEmoji} *Saldo do mês: R$ ${saldo.toFixed(2)}*`;

    await sendMessage(from, response);

  } catch (error) {
    console.error('❌ Erro no resumo:', error);
    await sendMessage(from, '❌ Erro ao gerar resumo.');
  }
}

export async function handleHelpCommand(from: string) {
  const help =
    `🤖 *Bot de Finanças*\n\n` +
    `🗒️ *Registrar gastos:*\n` +
    `Digite: [descrição] [valor] [data opcional]\n\n` +
    `Exemplos:\n` +
    `- Uber 25\n` +
    `- Almoço 35 ontem\n` +
    `- Mercado 250.50 dia 20\n` +
    `- Cinema 60 sexta\n\n` +
    `💵 *Registrar entradas:*\n` +
    `- Recebi 6000 salário\n` +
    `- Caiu 700 bolsa\n` +
    `- Ganhei 500 freela\n\n` +
    `📈 *Comandos:*\n` +
    `/hoje - Resumo do dia\n` +
    `/resumo - Resumo do mês\n` +
    `/ultimos - Últimos 5 gastos\n` +
    `/entradas - Entradas do mês\n` +
    `/categorias - Ver categorias\n` +
    `/mapear - Ver mapeamentos\n` +
    `/mudar - Mudar categoria ou data do último gasto\n` +
    `/apagar [palavra] - Remover mapeamento\n` +
    `/ajuda - Esta mensagem\n\n` +
    `💡 O bot aprende suas preferências!`;

  await sendMessage(from, help);
}

// ─── /mudar expandido ─────────────────────────────────────────────────────────

export async function handleMudarCommand(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.lastTransactionId) {
    await sendMessage(
      from,
      '❌ Nenhum gasto recente para alterar.\n\n' +
      'Use /mudar logo após registrar um gasto.'
    );
    return;
  }

  const transaction = await Transaction.findById(session.context.lastTransactionId);

  if (!transaction) {
    await sendMessage(from, '❌ Transação não encontrada.');
    await clearSession(phoneNumber);
    return;
  }

  const dateFormatted = transaction.date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
  const emoji = getCategoryEmoji(transaction.category);

  await updateSessionStatus(phoneNumber, 'pending_edit_choice', {
    lastTransactionId: transaction._id,
    pendingTransaction: {
      value: transaction.value,
      description: transaction.description,
      category: transaction.category,
      keyword: transaction.description.split(' ')[0],
      originalMessage: ''
    },
    awaitingInput: 'edit_choice'
  });

  await sendMessage(
    from,
    `🖉 *O que deseja alterar?*\n\n` +
    `🗒️ ${transaction.description}\n` +
    `💵 R$ ${transaction.value.toFixed(2)}\n` +
    `🏷️ ${emoji} ${transaction.category}\n` +
    `📅 ${dateFormatted}\n\n` +
    `1️⃣ Categoria\n` +
    `2️⃣ Data\n` +
    `3️⃣ Ambos\n\n` +
    `Responda com 1, 2 ou 3`
  );
}

export async function handleEditChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.lastTransactionId) {
    await sendMessage(from, '❌ Nenhuma transação para alterar.');
    await clearSession(phoneNumber);
    return;
  }

  const choiceNum = parseInt(choice);

  if (![1, 2, 3].includes(choiceNum)) {
    await sendMessage(from, '❌ Opção inválida. Responda com 1, 2 ou 3.');
    return;
  }

  if (choiceNum === 1) {
    await updateSessionStatus(phoneNumber, 'pending_category_change', {
      lastTransactionId: session.context.lastTransactionId,
      pendingTransaction: session.context.pendingTransaction,
      awaitingInput: 'category_change'
    });

    const { formatCategoryOptions } = await import('../services/categoryMapper.js');
    const transaction = await Transaction.findById(session.context.lastTransactionId);
    await sendMessage(
      from,
      `🔄 Alterar categoria de:\n` +
      `🗒️ ${transaction?.description}\n` +
      `💵 R$ ${transaction?.value.toFixed(2)}\n\n` +
      formatCategoryOptions()
    );

  } else if (choiceNum === 2) {
    await updateSessionStatus(phoneNumber, 'pending_date_edit', {
      lastTransactionId: session.context.lastTransactionId,
      pendingTransaction: session.context.pendingTransaction,
      awaitingInput: 'date_edit'
    });

    await sendMessage(
      from,
      `📅 *Digite a nova data:*\n\n` +
      `Exemplos:\n` +
      `• ontem\n` +
      `• dia 15\n` +
      `• 20/05\n` +
      `• sexta`
    );

  } else {
    await updateSessionStatus(phoneNumber, 'pending_category_change', {
      lastTransactionId: session.context.lastTransactionId,
      pendingTransaction: session.context.pendingTransaction,
      awaitingInput: 'category_change',
      editBoth: true
    });

    const { formatCategoryOptions } = await import('../services/categoryMapper.js');
    const transaction = await Transaction.findById(session.context.lastTransactionId);
    await sendMessage(
      from,
      `🖉 Primeiro, escolha a nova categoria:\n\n` +
      `🗒️ ${transaction?.description}\n` +
      `💵 R$ ${transaction?.value.toFixed(2)}\n\n` +
      formatCategoryOptions()
    );
  }
}

export async function handleDateEdit(from: string, user: IUser, text: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.lastTransactionId) {
    await sendMessage(from, '❌ Nenhuma transação para alterar.');
    await clearSession(phoneNumber);
    return;
  }

  const { date } = parseDate(text);
  const transaction = await Transaction.findById(session.context.lastTransactionId);

  if (!transaction) {
    await sendMessage(from, '❌ Transação não encontrada.');
    await clearSession(phoneNumber);
    return;
  }

  const oldDateLabel = transaction.date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });

  transaction.date = date;
  transaction.month = date.getMonth() + 1;
  transaction.year = date.getFullYear();
  transaction.yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  await transaction.save();

  const newDateLabel = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });

  await clearSession(phoneNumber);

  await sendMessage(
    from,
    `🗸 Data alterada!\n\n` +
    `De: ${oldDateLabel}\n` +
    `Para: ${newDateLabel}`
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── /mes ─────────────────────────────────────────────────────────────────────

export async function handleMesCommand(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];

  const now = new Date();
  const options: { label: string; year: number; month: number }[] = [];

  // Gera os últimos 5 meses + mês atual
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    options.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      year: d.getFullYear(),
      month: d.getMonth() + 1
    });
  }

  await updateSessionStatus(phoneNumber, 'pending_mes_choice', {
    mesOptions: options,
    awaitingInput: 'mes_choice'
  });

  let message = `📅 *Qual mês deseja ver?*\n\n`;
  options.forEach((opt, i) => {
    message += `${i + 1}️⃣ ${opt.label}\n`;
  });
  message += `\nResponda com o número (1-${options.length})`;

  await sendMessage(from, message);
}

export async function handleMesChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  const options = session?.context?.mesOptions;

  if (!options || options.length === 0) {
    await sendMessage(from, '❌ Sessão expirada. Use /mes novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const choiceNum = parseInt(choice);

  if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > options.length) {
    await sendMessage(from, `❌ Opção inválida. Responda com um número de 1 a ${options.length}`);
    return;
  }

  const selected = options[choiceNum - 1];
  await clearSession(phoneNumber);

  await sendResumoMes(from, user, selected.year, selected.month, selected.label);
}

async function sendResumoMes(
  from: string,
  user: IUser,
  year: number,
  month: number,
  label: string
) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 1);

  const [transactions, incomes] = await Promise.all([
    Transaction.find({
      userId: user._id,
      date: { $gte: startOfMonth, $lt: endOfMonth }
    }),
    Income.find({
      userId: user._id,
      date: { $gte: startOfMonth, $lt: endOfMonth }
    })
  ]);

  const totalGastos = transactions.reduce((sum, t) => sum + t.value, 0);
  const totalEntradas = incomes.reduce((sum, i) => sum + i.value, 0);
  const saldo = totalEntradas - totalGastos;

  // Agrupa gastos por categoria
  const porCategoria: Record<string, number> = {};
  transactions.forEach(t => {
    porCategoria[t.category] = (porCategoria[t.category] || 0) + t.value;
  });

  // Agrupa entradas por categoria
  const porCatIncome: Record<string, number> = {};
  incomes.forEach(i => {
    porCatIncome[i.category] = (porCatIncome[i.category] || 0) + i.value;
  });

  let response = `📈 *Resumo de ${label}:*\n\n`;

  // Entradas
  response += `💵 *Entradas: R$ ${totalEntradas.toFixed(2)}*\n`;
  if (incomes.length === 0) {
    response += `  Nenhuma entrada registrada\n`;
  } else {
    Object.entries(porCatIncome).forEach(([cat, val]) => {
      const emoji = getIncomeCategoryEmoji(cat);
      response += `  ${emoji} ${cat}: R$ ${val.toFixed(2)}\n`;
    });
  }

  // Gastos
  response += `\n🛒 *Gastos: R$ ${totalGastos.toFixed(2)}*\n`;
  if (transactions.length === 0) {
    response += `  Nenhum gasto registrado\n`;
  } else {
    Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, val]) => {
        const emoji = getCategoryEmoji(cat);
        const pct = totalGastos > 0 ? ((val / totalGastos) * 100).toFixed(0) : '0';
        response += `  ${emoji} ${cat}: R$ ${val.toFixed(2)} (${pct}%)\n`;
      });
  }

  // Saldo
  response += `\n━━━━━━━━━━━━━━━\n`;
  const saldoEmoji = saldo >= 0 ? '🗸' : '❌';
  response += `${saldoEmoji} *Saldo: R$ ${saldo.toFixed(2)}*`;

  await sendMessage(from, response);
}