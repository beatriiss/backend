import { IUser } from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import SavingEntry from '../models/SavingEntry.js';
import Saving from '../models/Saving.js';
import Trip from '../models/Trip.js';
import { sendMessage } from '../services/whatsapp.js';
import { getCategoryEmoji, getIncomeCategoryEmoji, formatCategoryOptions } from '../services/categoryMapper.js';
import { updateSessionStatus, getSession, clearSession } from '../services/sessionService.js';
import { parseDate, formatDateLabel } from '../services/messageParser.js';
import { handleEditarViagemStart } from './viagemController.js';

export async function handleTransaction(
  from: string,
  user: IUser,
  parsed: any,
  autoCategorizacao: boolean = false
) {
  try {
    const { value, category, description, date, tripId } = parsed.data;

    const transactionDate = date instanceof Date ? date : new Date();

    const transaction = await Transaction.create({
      userId: user._id,
      value,
      category,
      description,
      paymentMethod: 'dinheiro',
      date: transactionDate,
      ...(tripId && { tripId })
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

    let tripLine = '';
    if (tripId) {
      const trip = await Trip.findById(tripId);
      if (trip) {
        const isNew = parsed.data.tripCreated;
        tripLine = isNew
          ? `\n✈️ Nova viagem criada: *${trip.name}*`
          : `\n✈️ ${trip.name}`;
      }
    }

    let response =
      `🗸 Gasto registrado!\n\n` +
      `🗒️ ${description}\n` +
      `💵 R$ ${value.toFixed(2)}\n` +
      `🏷️ ${emoji} ${category}` +
      `${dateLine}` +
      `${tripLine}\n\n` +
      `📈 Total hoje: R$ ${todayTotal.toFixed(2)}`;

    if (autoCategorizacao) {
      const phoneNumber = from.split('@')[0];

      await updateSessionStatus(phoneNumber, 'active', {
        lastTransactionId: transaction._id,
        awaitingInput: undefined
      });

      response += `\n\n💡 Categorizei automaticamente como "${category}"`;
      response += `\nQuer mudar? /mudar  |  Editar mais: /editar`;
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

    for (const [index, t] of transactions.entries()) {
      const date = t.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const emoji = getCategoryEmoji(t.category);
      let tripTag = '';
      if (t.tripId) {
        const trip = await Trip.findById(t.tripId);
        if (trip) tripTag = ` ✈️ ${trip.name}`;
      }
      response += `${index + 1}. ${t.description} - R$ ${t.value.toFixed(2)}\n`;
      response += `   ${date} • ${emoji} ${t.category}${tripTag}\n\n`;
    }

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

    if (incomes.length > 0) {
      response += `\n💵 *Entradas: R$ ${totalEntradas.toFixed(2)}*\n`;
      incomes.forEach(i => {
        const time = i.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const emoji = getIncomeCategoryEmoji(i.category);
        response += `• ${i.description} - R$ ${i.value.toFixed(2)}\n`;
        response += `  ${time} • ${emoji} ${i.category}\n`;
      });
    }

    if (transactions.length > 0) {
      response += `\n🛒 *Gastos: R$ ${totalGastos.toFixed(2)}*\n`;
      transactions.forEach(t => {
        const time = t.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const emoji = getCategoryEmoji(t.category);
        response += `• ${t.description} - R$ ${t.value.toFixed(2)}\n`;
        response += `  ${time} • ${emoji} ${t.category}\n`;
      });
    }

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

    const [transactions, incomes, savingEntries] = await Promise.all([
      Transaction.find({
        userId: user._id,
        date: { $gte: startOfMonth, $lt: endOfMonth }
      }),
      Income.find({
        userId: user._id,
        date: { $gte: startOfMonth, $lt: endOfMonth }
      }),
      SavingEntry.find({
        userId: user._id,
        type: 'aporte',
        date: { $gte: startOfMonth, $lt: endOfMonth }
      }).populate<{ savingId: { name: string } }>('savingId', 'name')
    ]);

    const totalGastos = transactions.reduce((sum, t) => sum + t.value, 0);
    const totalEntradas = incomes.reduce((sum, i) => sum + i.value, 0);
    const saldo = totalEntradas - totalGastos;

    const porCategoria: Record<string, number> = {};
    transactions.forEach(t => {
      porCategoria[t.category] = (porCategoria[t.category] || 0) + t.value;
    });

    const mesNome = now.toLocaleDateString('pt-BR', { month: 'long' });

    let response = `📈 *Resumo de ${mesNome}:*\n\n`;

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

    // Guardados
    const totalGuardado = savingEntries.reduce((s, e) => s + e.value, 0);
    if (totalGuardado > 0) {
      response += `\n🏦 *Guardado: R$ ${totalGuardado.toFixed(2)}* _(não é gasto)_\n`;
    }

    // Viagens
    const tripIds = [...new Set(transactions.filter(t => t.tripId).map(t => t.tripId!.toString()))];
    if (tripIds.length > 0) {
      response += `\n✈️ *Por viagem:*\n`;
      for (const tid of tripIds) {
        const trip = await Trip.findById(tid);
        const tripTotal = transactions
          .filter(t => t.tripId?.toString() === tid)
          .reduce((s, t) => s + t.value, 0);
        if (trip) response += `  ✈️ ${trip.name}: R$ ${tripTotal.toFixed(2)}\n`;
      }
    }

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
    `• "almoço 35"\n` +
    `• "uber 25 ontem"\n` +
    `• "mercado 250.50 dia 20"\n` +
    `• "cinema 60 #floripa" ← associa à viagem\n\n` +
    `💵 *Registrar entradas:*\n` +
    `• "recebi 6000 salário"\n` +
    `• "caiu 700 bolsa"\n` +
    `• "ganhei 500 freela"\n\n` +
    `🏦 *Guardados:*\n` +
    `• "guardei 500 caixinha viagem"\n` +
    `• "tirei 200 caixinha viagem"\n\n` +
    `✈️ *Viagens:*\n` +
    `• /viagem [nome] - Criar ou ver viagem\n` +
    `• /viagens - Listar viagens ativas\n` +
    `• /encerrar [nome] - Encerrar viagem\n` +
    `• "gasto 35 #nome" - Associar inline\n\n` +
    `📈 *Comandos:*\n` +
    `/hoje - Resumo do dia\n` +
    `/saldo - Saldo do mês + semanas\n` +
    `/resumo - Resumo do mês por categoria\n` +
    `/mes - Resumo de outro mês\n` +
    `/ultimos - Últimos 5 gastos\n` +
    `/editar - Editar qualquer gasto\n` +
    `/mudar - Editar o último gasto rapidinho\n` +
    `/entradas - Entradas do mês\n` +
    `/guardados - Seus guardados\n` +
    `/categorias - Ver categorias\n` +
    `/mapear - Ver mapeamentos\n` +
    `/apagar [palavra] - Remover mapeamento\n` +
    `/deletar - Deletar um registro\n` +
    `/ajuda - Esta mensagem\n\n` +
    `💡 O bot aprende suas preferências!`;

  await sendMessage(from, help);
}

// ─── /mudar ───────────────────────────────────────────────────────────────────

export async function handleMudarCommand(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.lastTransactionId) {
    await sendMessage(
      from,
      '❌ Nenhum gasto recente para alterar.\n\n' +
      'Use /mudar logo após registrar um gasto.\n' +
      'Para editar gastos mais antigos, use /editar'
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
    `3️⃣ Ambos\n` +
    `4️⃣ Cancelar\n\n` +
    `Responda com 1, 2, 3 ou 4`
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

  if (choiceNum === 4) {
    await clearSession(phoneNumber);
    await sendMessage(from, '🗸 Operação cancelada.');
    return;
  }

  if (![1, 2, 3].includes(choiceNum)) {
    await sendMessage(from, '❌ Opção inválida. Responda com 1, 2, 3 ou 4.');
    return;
  }

  if (choiceNum === 1) {
    await updateSessionStatus(phoneNumber, 'pending_category_change', {
      lastTransactionId: session.context.lastTransactionId,
      pendingTransaction: session.context.pendingTransaction,
      awaitingInput: 'category_change'
    });

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

// ─── /editar ──────────────────────────────────────────────────────────────────

export async function handleEditarCommand(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];

  const transactions = await Transaction.find({ userId: user._id })
    .sort({ date: -1 })
    .limit(10);

  if (transactions.length === 0) {
    await sendMessage(from, '📭 Nenhum gasto registrado ainda.');
    return;
  }

  const options = await Promise.all(transactions.map(async (t, i) => {
    const date = t.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const emoji = getCategoryEmoji(t.category);
    let tripTag = '';
    if (t.tripId) {
      const trip = await Trip.findById(t.tripId);
      if (trip) tripTag = ` ✈️${trip.name}`;
    }
    return {
      id: t._id.toString(),
      label: `${i + 1}️⃣ ${t.description} - R$ ${t.value.toFixed(2)} - ${date} ${emoji}${tripTag}`
    };
  }));

  await updateSessionStatus(phoneNumber, 'pending_editar_choice', {
    awaitingInput: 'editar_choice',
    editarOptions: options.map(o => o.id)
  });

  let message = `🖉 *Qual gasto deseja editar?*\n\n`;
  options.forEach(o => { message += `${o.label}\n`; });
  message += `\n${transactions.length + 1}️⃣ Cancelar`;

  await sendMessage(from, message);
}

export async function handleEditarChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const options = session?.context?.editarOptions;

  if (!options) {
    await sendMessage(from, '❌ Sessão expirada. Use /editar novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const choiceNum = parseInt(choice);

  if (choiceNum === options.length + 1) {
    await clearSession(phoneNumber);
    await sendMessage(from, '🗸 Operação cancelada.');
    return;
  }

  if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > options.length) {
    await sendMessage(from, `❌ Opção inválida. Responda com um número de 1 a ${options.length + 1}`);
    return;
  }

  const transactionId = options[choiceNum - 1];
  const transaction = await Transaction.findById(transactionId);

  if (!transaction) {
    await sendMessage(from, '❌ Gasto não encontrado.');
    await clearSession(phoneNumber);
    return;
  }

  const date = transaction.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const emoji = getCategoryEmoji(transaction.category);
  let tripLine = '';
  if (transaction.tripId) {
    const trip = await Trip.findById(transaction.tripId);
    if (trip) tripLine = `\n✈️ ${trip.name}`;
  }

  const pendingTransaction = {
    value: transaction.value,
    description: transaction.description,
    category: transaction.category,
    keyword: transaction.description.split(' ')[0],
    originalMessage: ''
  };

  await updateSessionStatus(phoneNumber, 'pending_editar_field', {
    awaitingInput: 'editar_field',
    lastTransactionId: transaction._id,
    pendingTransaction,
    editarOptions: options
  });

  await sendMessage(
    from,
    `🖉 *O que deseja alterar?*\n\n` +
    `🗒️ ${transaction.description}\n` +
    `💵 R$ ${transaction.value.toFixed(2)}\n` +
    `🏷️ ${emoji} ${transaction.category}\n` +
    `📅 ${date}` +
    `${tripLine}\n\n` +
    `1️⃣ Descrição\n` +
    `2️⃣ Valor\n` +
    `3️⃣ Categoria\n` +
    `4️⃣ Data\n` +
    `5️⃣ Viagem\n` +
    `6️⃣ Cancelar\n\n` +
    `Responda com 1, 2, 3, 4, 5 ou 6`
  );
}

export async function handleEditarFieldChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.lastTransactionId) {
    await sendMessage(from, '❌ Sessão expirada. Use /editar novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const choiceNum = parseInt(choice);

  if (choiceNum === 6) {
    await clearSession(phoneNumber);
    await sendMessage(from, '🗸 Operação cancelada.');
    return;
  }

  if (![1, 2, 3, 4, 5].includes(choiceNum)) {
    await sendMessage(from, '❌ Opção inválida. Responda com 1, 2, 3, 4, 5 ou 6.');
    return;
  }

  const transaction = await Transaction.findById(session.context.lastTransactionId);
  if (!transaction) {
    await sendMessage(from, '❌ Gasto não encontrado.');
    await clearSession(phoneNumber);
    return;
  }

  if (choiceNum === 1) {
    await updateSessionStatus(phoneNumber, 'pending_editar_description', {
      awaitingInput: 'editar_description',
      lastTransactionId: transaction._id,
      pendingTransaction: session.context.pendingTransaction
    });
    await sendMessage(from, `📝 *Digite a nova descrição:*\n\nAtual: "${transaction.description}"`);
    return;
  }

  if (choiceNum === 2) {
    await updateSessionStatus(phoneNumber, 'pending_editar_value_input', {
      awaitingInput: 'editar_value_input',
      lastTransactionId: transaction._id,
      pendingTransaction: session.context.pendingTransaction
    });
    await sendMessage(from, `💵 *Digite o novo valor:*\n\nAtual: R$ ${transaction.value.toFixed(2)}`);
    return;
  }

  if (choiceNum === 3) {
    await updateSessionStatus(phoneNumber, 'pending_category_change', {
      lastTransactionId: transaction._id,
      pendingTransaction: session.context.pendingTransaction,
      awaitingInput: 'category_change'
    });
    await sendMessage(
      from,
      `🔄 Alterar categoria de:\n` +
      `🗒️ ${transaction.description}\n` +
      `💵 R$ ${transaction.value.toFixed(2)}\n\n` +
      formatCategoryOptions()
    );
    return;
  }

  if (choiceNum === 4) {
    await updateSessionStatus(phoneNumber, 'pending_date_edit', {
      lastTransactionId: transaction._id,
      pendingTransaction: session.context.pendingTransaction,
      awaitingInput: 'date_edit'
    });
    await sendMessage(
      from,
      `📅 *Digite a nova data:*\n\n` +
      `Atual: ${transaction.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}\n\n` +
      `Exemplos:\n• ontem\n• dia 15\n• 20/05\n• sexta`
    );
    return;
  }

  if (choiceNum === 5) {
    await handleEditarViagemStart(from, user, transaction._id.toString(), session.context.pendingTransaction);
    return;
  }
}

export async function handleEditarDescription(from: string, user: IUser, text: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.lastTransactionId) {
    await sendMessage(from, '❌ Sessão expirada. Use /editar novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const newDescription = text.trim();

  if (newDescription.length < 2) {
    await sendMessage(from, '❌ Descrição muito curta. Digite pelo menos 2 caracteres.');
    return;
  }

  if (newDescription.startsWith('/')) {
    await sendMessage(from, '❌ A descrição não pode começar com /.');
    return;
  }

  const transaction = await Transaction.findById(session.context.lastTransactionId);

  if (!transaction) {
    await sendMessage(from, '❌ Gasto não encontrado.');
    await clearSession(phoneNumber);
    return;
  }

  const oldDescription = transaction.description;
  transaction.description = newDescription;
  await transaction.save();

  await clearSession(phoneNumber);

  await sendMessage(from, `🗸 Descrição alterada!\n\nDe: "${oldDescription}"\nPara: "${newDescription}"`);
}

export async function handleEditarValueInput(from: string, user: IUser, text: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.lastTransactionId) {
    await sendMessage(from, '❌ Sessão expirada. Use /editar novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const newValue = parseFloat(text.replace(',', '.'));

  if (isNaN(newValue) || newValue <= 0) {
    await sendMessage(from, '❌ Valor inválido. Digite apenas o número (ex: 35.50 ou 35,50).');
    return;
  }

  const transaction = await Transaction.findById(session.context.lastTransactionId);

  if (!transaction) {
    await sendMessage(from, '❌ Gasto não encontrado.');
    await clearSession(phoneNumber);
    return;
  }

  const oldValue = transaction.value;
  transaction.value = newValue;
  await transaction.save();

  await clearSession(phoneNumber);

  await sendMessage(from, `🗸 Valor alterado!\n\nDe: R$ ${oldValue.toFixed(2)}\nPara: R$ ${newValue.toFixed(2)}`);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getTodayTotal(userId: any): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await Transaction.aggregate([
    { $match: { userId, date: { $gte: today, $lt: tomorrow } } },
    { $group: { _id: null, total: { $sum: '$value' } } }
  ]);

  return result[0]?.total || 0;
}

// ─── /mes ─────────────────────────────────────────────────────────────────────

export async function handleMesCommand(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];
  const now = new Date();
  const options: { label: string; year: number; month: number }[] = [];

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
  options.forEach((opt, i) => { message += `${i + 1}️⃣ ${opt.label}\n`; });
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

async function sendResumoMes(from: string, user: IUser, year: number, month: number, label: string) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 1);

  const [transactions, incomes] = await Promise.all([
    Transaction.find({ userId: user._id, date: { $gte: startOfMonth, $lt: endOfMonth } }),
    Income.find({ userId: user._id, date: { $gte: startOfMonth, $lt: endOfMonth } })
  ]);

  const totalGastos = transactions.reduce((sum, t) => sum + t.value, 0);
  const totalEntradas = incomes.reduce((sum, i) => sum + i.value, 0);
  const saldo = totalEntradas - totalGastos;

  const porCategoria: Record<string, number> = {};
  transactions.forEach(t => { porCategoria[t.category] = (porCategoria[t.category] || 0) + t.value; });

  const porCatIncome: Record<string, number> = {};
  incomes.forEach(i => { porCatIncome[i.category] = (porCatIncome[i.category] || 0) + i.value; });

  let response = `📈 *Resumo de ${label}:*\n\n`;

  response += `💵 *Entradas: R$ ${totalEntradas.toFixed(2)}*\n`;
  if (incomes.length === 0) {
    response += `  Nenhuma entrada registrada\n`;
  } else {
    Object.entries(porCatIncome).forEach(([cat, val]) => {
      response += `  ${getIncomeCategoryEmoji(cat)} ${cat}: R$ ${val.toFixed(2)}\n`;
    });
  }

  response += `\n🛒 *Gastos: R$ ${totalGastos.toFixed(2)}*\n`;
  if (transactions.length === 0) {
    response += `  Nenhum gasto registrado\n`;
  } else {
    Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, val]) => {
        const pct = totalGastos > 0 ? ((val / totalGastos) * 100).toFixed(0) : '0';
        response += `  ${getCategoryEmoji(cat)} ${cat}: R$ ${val.toFixed(2)} (${pct}%)\n`;
      });
  }

  // Viagens do mês
  const tripIds = [...new Set(transactions.filter(t => t.tripId).map(t => t.tripId!.toString()))];
  if (tripIds.length > 0) {
    response += `\n✈️ *Por viagem:*\n`;
    for (const tid of tripIds) {
      const trip = await Trip.findById(tid);
      const tripTotal = transactions.filter(t => t.tripId?.toString() === tid).reduce((s, t) => s + t.value, 0);
      if (trip) response += `  ✈️ ${trip.name}: R$ ${tripTotal.toFixed(2)}\n`;
    }
  }

  response += `\n━━━━━━━━━━━━━━━\n`;
  const saldoEmoji = saldo >= 0 ? '🗸' : '❌';
  response += `${saldoEmoji} *Saldo: R$ ${saldo.toFixed(2)}*`;

  await sendMessage(from, response);
}

// ─── /saldo ───────────────────────────────────────────────────────────────────

export async function handleSaldoCommand(from: string, user: IUser) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [transactions, incomes, savingEntries] = await Promise.all([
      Transaction.find({ userId: user._id, date: { $gte: startOfMonth, $lt: endOfMonth } }),
      Income.find({ userId: user._id, date: { $gte: startOfMonth, $lt: endOfMonth } }),
      SavingEntry.find({
        userId: user._id,
        type: 'aporte',
        date: { $gte: startOfMonth, $lt: endOfMonth }
      }).populate<{ savingId: { name: string } }>('savingId', 'name')
    ]);

    const totalEntradas  = incomes.reduce((s, i) => s + i.value, 0);
    const totalGastos    = transactions.reduce((s, t) => s + t.value, 0);
    const totalGuardado  = savingEntries.reduce((s, e) => s + e.value, 0);
    const saldoDisponivel = totalEntradas - totalGastos;

    const mesNome = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    let resp = `📊 *Saldo de ${mesNome}:*\n\n`;

    // Entradas
    resp += `💵 *Entradas: R$ ${totalEntradas.toFixed(2)}*\n`;
    if (incomes.length === 0) {
      resp += `  Nenhuma entrada registrada\n`;
    } else {
      const porCat: Record<string, number> = {};
      incomes.forEach(i => { porCat[i.category] = (porCat[i.category] || 0) + i.value; });
      Object.entries(porCat).forEach(([cat, val]) => {
        resp += `  ${getIncomeCategoryEmoji(cat)} ${cat}: R$ ${val.toFixed(2)}\n`;
      });
    }

    // Gastos
    resp += `\n🛒 *Gastos: R$ ${totalGastos.toFixed(2)}*\n`;
    if (transactions.length === 0) {
      resp += `  Nenhum gasto registrado\n`;
    } else {
      const porCat: Record<string, number> = {};
      transactions.forEach(t => { porCat[t.category] = (porCat[t.category] || 0) + t.value; });
      Object.entries(porCat)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, val]) => {
          const pct = totalGastos > 0 ? ((val / totalGastos) * 100).toFixed(0) : '0';
          resp += `  ${getCategoryEmoji(cat)} ${cat}: R$ ${val.toFixed(2)} (${pct}%)\n`;
        });
    }

    // Guardado
    resp += `\n🏦 *Guardado este mês: R$ ${totalGuardado.toFixed(2)}*\n`;
    resp += `  _(dinheiro guardado não é gasto)_\n`;
    if (savingEntries.length > 0) {
      const porNome: Record<string, number> = {};
      savingEntries.forEach(e => {
        const nome = (e.savingId as any)?.name || 'guardado';
        porNome[nome] = (porNome[nome] || 0) + e.value;
      });
      Object.entries(porNome).forEach(([nome, val]) => {
        resp += `  💰 ${nome}: R$ ${val.toFixed(2)}\n`;
      });
    }

    // Viagens
    const tripIds = [...new Set(transactions.filter(t => t.tripId).map(t => t.tripId!.toString()))];
    if (tripIds.length > 0) {
      resp += `\n✈️ *Por viagem:*\n`;
      for (const tid of tripIds) {
        const trip = await Trip.findById(tid);
        const tripTotal = transactions.filter(t => t.tripId?.toString() === tid).reduce((s, t) => s + t.value, 0);
        if (trip) resp += `  ✈️ ${trip.name}: R$ ${tripTotal.toFixed(2)}\n`;
      }
    }

    // Saldo
    const saldoEmoji = saldoDisponivel >= 0 ? '🗸' : '❌';
    resp += `\n━━━━━━━━━━━━━━━\n`;
    resp += `${saldoEmoji} *Saldo disponível: R$ ${saldoDisponivel.toFixed(2)}*\n`;
    resp += `_(entradas − gastos)_\n`;

    if (totalGuardado > 0) {
      const saldoLiquido = saldoDisponivel - totalGuardado;
      const emojiLiq = saldoLiquido >= 0 ? '💰' : '⚠️';
      resp += `\n${emojiLiq} Saldo livre (descontando guardado): R$ ${saldoLiquido.toFixed(2)}\n`;
    }

    // Semanal
    resp += `\n📅 *Por semana:*\n`;
    const weeks = buildWeeks(startOfMonth, now);

    for (const week of weeks) {
      const wInc   = incomes.filter(i => i.date >= week.start && i.date < week.end).reduce((s, i) => s + i.value, 0);
      const wGas   = transactions.filter(t => t.date >= week.start && t.date < week.end).reduce((s, t) => s + t.value, 0);
      const wGuard = savingEntries.filter(e => e.date >= week.start && e.date < week.end).reduce((s, e) => s + e.value, 0);
      const wSaldo = wInc - wGas;

      const startLabel = week.start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const endDay = new Date(week.end.getTime() - 1);
      const endLabel = endDay.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      resp += `\n${wSaldo >= 0 ? '🟢' : '🔴'} *Sem ${week.num} (${startLabel}–${endLabel})*\n`;
      if (wInc   > 0) resp += `  💵 Entradas: R$ ${wInc.toFixed(2)}\n`;
      if (wGas   > 0) resp += `  🛒 Gastos:   R$ ${wGas.toFixed(2)}\n`;
      if (wGuard > 0) resp += `  🏦 Guardado: R$ ${wGuard.toFixed(2)} _(não é gasto)_\n`;
      resp += `  ${wSaldo >= 0 ? '✅' : '⚠️'} Saldo: R$ ${wSaldo.toFixed(2)}\n`;
    }

    await sendMessage(from, resp);

  } catch (error) {
    console.error('❌ Erro no saldo:', error);
    await sendMessage(from, '❌ Erro ao calcular saldo. Tente novamente.');
  }
}

interface Week { num: number; start: Date; end: Date; }

function buildWeeks(monthStart: Date, today: Date): Week[] {
  const weeks: Week[] = [];
  let cursor = new Date(monthStart);
  cursor.setHours(0, 0, 0, 0);
  let weekNum = 1;

  while (cursor <= today) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    const daysUntilSunday = 7 - end.getDay();
    end.setDate(end.getDate() + (end.getDay() === 0 ? 7 : daysUntilSunday));
    end.setHours(0, 0, 0, 0);
    const realEnd = end > today ? new Date(today.getTime() + 86400000) : end;
    weeks.push({ num: weekNum++, start, end: realEnd });
    cursor = new Date(end);
  }

  return weeks;
}