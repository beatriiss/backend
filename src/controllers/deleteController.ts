import { IUser } from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import Saving from '../models/Saving.js';
import SavingEntry from '../models/SavingEntry.js';
import { sendMessage } from '../services/whatsapp.js';
import { updateSessionStatus, clearSession, getSession } from '../services/sessionService.js';
import { getCategoryEmoji, getIncomeCategoryEmoji } from '../services/categoryMapper.js';
import { formatTaxaLabel } from '../services/bcbService.js';

// ─── /deletar — menu inicial ──────────────────────────────────────────────────

export async function handleDeleteCommand(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];

  await updateSessionStatus(phoneNumber, 'pending_delete_type', {
    awaitingInput: 'delete_type'
  });

  await sendMessage(
    from,
    `🗑️ *O que deseja deletar?*\n\n` +
    `1️⃣ Gasto\n` +
    `2️⃣ Entrada\n` +
    `3️⃣ Movimentação de guardado\n\n` +
    `Responda com 1, 2 ou 3`
  );
}

// ─── Escolha do tipo ──────────────────────────────────────────────────────────

export async function handleDeleteTypeChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];

  if (!['1', '2', '3'].includes(choice)) {
    await sendMessage(from, '❌ Opção inválida. Responda com 1, 2 ou 3.');
    return;
  }

  if (choice === '1') {
    await listRecentTransactions(from, user);
    return;
  }

  if (choice === '2') {
    await listRecentIncomes(from, user);
    return;
  }

  if (choice === '3') {
    await listSavingsForDelete(from, user);
    return;
  }
}

// ─── Lista últimos gastos ─────────────────────────────────────────────────────

async function listRecentTransactions(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];

  const transactions = await Transaction.find({ userId: user._id })
    .sort({ date: -1 })
    .limit(5);

  if (transactions.length === 0) {
    await clearSession(phoneNumber);
    await sendMessage(from, '📭 Nenhum gasto registrado.');
    return;
  }

  const options = transactions.map((t, i) => {
    const date = t.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const emoji = getCategoryEmoji(t.category);
    return {
      id: t._id.toString(),
      label: `${i + 1}️⃣ ${t.description} - R$ ${t.value.toFixed(2)} - ${date} ${emoji}`
    };
  });

  await updateSessionStatus(phoneNumber, 'pending_delete_transaction', {
    awaitingInput: 'delete_transaction',
    deleteOptions: options.map(o => o.id)
  });

  let message = `🗑️ *Qual gasto deseja deletar?*\n\n`;
  options.forEach(o => { message += `${o.label}\n`; });
  message += `${transactions.length + 1}️⃣ Cancelar`;

  await sendMessage(from, message);
}

// ─── Confirma delete de gasto ─────────────────────────────────────────────────

export async function handleDeleteTransactionChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const options = session?.context?.deleteOptions;

  if (!options) {
    await sendMessage(from, '❌ Sessão expirada. Use /deletar novamente.');
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

  await updateSessionStatus(phoneNumber, 'pending_delete_confirm', {
    awaitingInput: 'delete_confirm',
    deleteTargetId: transactionId,
    deleteTargetType: 'transaction'
  });

  await sendMessage(
    from,
    `⚠️ *Confirmar exclusão?*\n\n` +
    `🗒️ ${transaction.description}\n` +
    `💵 R$ ${transaction.value.toFixed(2)}\n` +
    `${emoji} ${transaction.category} • ${date}\n\n` +
    `1️⃣ Sim, deletar\n` +
    `2️⃣ Cancelar`
  );
}

// ─── Lista últimas entradas ───────────────────────────────────────────────────

async function listRecentIncomes(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];

  const incomes = await Income.find({ userId: user._id })
    .sort({ date: -1 })
    .limit(5);

  if (incomes.length === 0) {
    await clearSession(phoneNumber);
    await sendMessage(from, '📭 Nenhuma entrada registrada.');
    return;
  }

  const options = incomes.map((i, idx) => {
    const date = i.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const emoji = getIncomeCategoryEmoji(i.category);
    return {
      id: i._id.toString(),
      label: `${idx + 1}️⃣ ${i.description} - R$ ${i.value.toFixed(2)} - ${date} ${emoji}`
    };
  });

  await updateSessionStatus(phoneNumber, 'pending_delete_income', {
    awaitingInput: 'delete_income',
    deleteOptions: options.map(o => o.id)
  });

  let message = `🗑️ *Qual entrada deseja deletar?*\n\n`;
  options.forEach(o => { message += `${o.label}\n`; });
  message += `${incomes.length + 1}️⃣ Cancelar`;

  await sendMessage(from, message);
}

// ─── Confirma delete de entrada ───────────────────────────────────────────────

export async function handleDeleteIncomeChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const options = session?.context?.deleteOptions;

  if (!options) {
    await sendMessage(from, '❌ Sessão expirada. Use /deletar novamente.');
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

  const incomeId = options[choiceNum - 1];
  const income = await Income.findById(incomeId);

  if (!income) {
    await sendMessage(from, '❌ Entrada não encontrada.');
    await clearSession(phoneNumber);
    return;
  }

  const date = income.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const emoji = getIncomeCategoryEmoji(income.category);

  await updateSessionStatus(phoneNumber, 'pending_delete_confirm', {
    awaitingInput: 'delete_confirm',
    deleteTargetId: incomeId,
    deleteTargetType: 'income'
  });

  await sendMessage(
    from,
    `⚠️ *Confirmar exclusão?*\n\n` +
    `🗒️ ${income.description}\n` +
    `💵 R$ ${income.value.toFixed(2)}\n` +
    `${emoji} ${income.category} • ${date}\n\n` +
    `1️⃣ Sim, deletar\n` +
    `2️⃣ Cancelar`
  );
}

// ─── Lista guardados para escolha ─────────────────────────────────────────────

async function listSavingsForDelete(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];

  const savings = await Saving.find({ userId: user._id, active: true }).sort({ createdAt: 1 });

  if (savings.length === 0) {
    await clearSession(phoneNumber);
    await sendMessage(from, '📭 Nenhum guardado registrado.');
    return;
  }

  const options = savings.map((s, i) => ({
    id: s._id.toString(),
    label: `${i + 1}️⃣ ${s.name} (${formatTaxaLabel(s.rateType, s.rateValue)})`
  }));

  await updateSessionStatus(phoneNumber, 'pending_delete_saving_choice', {
    awaitingInput: 'delete_saving_choice',
    deleteOptions: options.map(o => o.id)
  });

  let message = `🗑️ *Qual guardado?*\n\n`;
  options.forEach(o => { message += `${o.label}\n`; });
  message += `${savings.length + 1}️⃣ Cancelar`;

  await sendMessage(from, message);
}

// ─── Lista movimentações do guardado ──────────────────────────────────────────

export async function handleDeleteSavingChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const options = session?.context?.deleteOptions;

  if (!options) {
    await sendMessage(from, '❌ Sessão expirada. Use /deletar novamente.');
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

  const savingId = options[choiceNum - 1];
  const saving = await Saving.findById(savingId);

  if (!saving) {
    await sendMessage(from, '❌ Guardado não encontrado.');
    await clearSession(phoneNumber);
    return;
  }

  const entries = await SavingEntry.find({ savingId }).sort({ date: -1 }).limit(5);

  if (entries.length === 0) {
    await clearSession(phoneNumber);
    await sendMessage(from, `📭 Nenhuma movimentação em *${saving.name}*.`);
    return;
  }

  const entryOptions = entries.map((e, i) => {
    const date = e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const typeLabel = e.type === 'aporte' ? '💵 Aporte' : e.type === 'retirada' ? '💸 Retirada' : '📈 Rendimento';
    return {
      id: e._id.toString(),
      label: `${i + 1}️⃣ ${typeLabel} R$ ${e.value.toFixed(2)} - ${date}`
    };
  });

  await updateSessionStatus(phoneNumber, 'pending_delete_entry', {
    awaitingInput: 'delete_entry',
    deleteOptions: entryOptions.map(o => o.id),
    deleteTargetId: savingId
  });

  let message = `🗑️ *Qual movimentação de "${saving.name}" deseja deletar?*\n\n`;
  entryOptions.forEach(o => { message += `${o.label}\n`; });
  message += `${entries.length + 1}️⃣ Cancelar`;

  await sendMessage(from, message);
}

// ─── Confirma delete de movimentação ─────────────────────────────────────────

export async function handleDeleteEntryChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const options = session?.context?.deleteOptions;

  if (!options) {
    await sendMessage(from, '❌ Sessão expirada. Use /deletar novamente.');
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

  const entryId = options[choiceNum - 1];
  const entry = await SavingEntry.findById(entryId);

  if (!entry) {
    await sendMessage(from, '❌ Movimentação não encontrada.');
    await clearSession(phoneNumber);
    return;
  }

  const date = entry.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const typeLabel = entry.type === 'aporte' ? '💵 Aporte' : entry.type === 'retirada' ? '💸 Retirada' : '📈 Rendimento';

  await updateSessionStatus(phoneNumber, 'pending_delete_confirm', {
    awaitingInput: 'delete_confirm',
    deleteTargetId: entryId,
    deleteTargetType: 'saving_entry'
  });

  await sendMessage(
    from,
    `⚠️ *Confirmar exclusão?*\n\n` +
    `${typeLabel} R$ ${entry.value.toFixed(2)} • ${date}\n\n` +
    `1️⃣ Sim, deletar\n` +
    `2️⃣ Cancelar`
  );
}

// ─── Confirmação final ────────────────────────────────────────────────────────

export async function handleDeleteConfirm(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const targetId = session?.context?.deleteTargetId;
  const targetType = session?.context?.deleteTargetType;

  if (!targetId || !targetType) {
    await sendMessage(from, '❌ Sessão expirada. Use /deletar novamente.');
    await clearSession(phoneNumber);
    return;
  }

  if (choice === '2') {
    await clearSession(phoneNumber);
    await sendMessage(from, '🗸 Operação cancelada.');
    return;
  }

  if (choice !== '1') {
    await sendMessage(from, '❌ Opção inválida. Responda com 1 ou 2.');
    return;
  }

  try {
    if (targetType === 'transaction') {
      await Transaction.findByIdAndDelete(targetId);
      await clearSession(phoneNumber);
      await sendMessage(from, '🗸 Gasto deletado com sucesso!');
      return;
    }

    if (targetType === 'income') {
      await Income.findByIdAndDelete(targetId);
      await clearSession(phoneNumber);
      await sendMessage(from, '🗸 Entrada deletada com sucesso!');
      return;
    }

    if (targetType === 'saving_entry') {
      await SavingEntry.findByIdAndDelete(targetId);
      await clearSession(phoneNumber);
      await sendMessage(from, '🗸 Movimentação deletada com sucesso!');
      return;
    }

  } catch (error) {
    console.error('❌ Erro ao deletar:', error);
    await sendMessage(from, '❌ Erro ao deletar. Tente novamente.');
    await clearSession(phoneNumber);
  }
}