import { IUser } from '../models/User.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { sendMessage } from '../services/whatsapp.js';
import {
  formatCategoryOptions,
  getCategoryByNumber,
  DEFAULT_CATEGORIES,
  getCategoryEmoji,
  normalizeText
} from '../services/categoryMapper.js';
import {
  updateSessionStatus,
  clearSession,
  getSession
} from '../services/sessionService.js';
import { handleTransaction } from './transactionCOntroller.js';

export async function askForCategory(
  from: string,
  phoneNumber: string,
  transaction: any
) {
  await updateSessionStatus(phoneNumber, 'pending_category', {
    pendingTransaction: transaction,
    awaitingInput: 'category_choice'
  });

  const message = formatCategoryOptions();
  await sendMessage(from, message);
}

export async function handleCategoryChoice(
  from: string,
  user: IUser,
  choice: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.pendingTransaction) {
    await sendMessage(from, '❌ Nenhuma transação pendente.');
    await clearSession(phoneNumber);
    return;
  }

  const choiceNum = parseInt(choice);

  if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > DEFAULT_CATEGORIES.length) {
    await sendMessage(
      from,
      `❌ Opção inválida. Responda com um número de 1 a ${DEFAULT_CATEGORIES.length}`
    );
    return;
  }

  if (choiceNum === DEFAULT_CATEGORIES.length) {
    await updateSessionStatus(phoneNumber, 'pending_category_creation', {
      pendingTransaction: session.context.pendingTransaction,
      awaitingInput: 'category_creation',
      newCategoryKeyword: session.context.pendingTransaction.keyword
    });

    await sendMessage(
      from,
      '🖉 Digite o nome da nova categoria:\n\n' +
      '(ex: pet, games, beleza, etc)'
    );
    return;
  }

  const category = getCategoryByNumber(choiceNum);

  if (!category) {
    await sendMessage(from, '❌ Categoria inválida.');
    return;
  }

  const keyword = session.context.pendingTransaction.keyword;
  if (keyword) {
    const normalizedKeyword = normalizeText(keyword);
    const mappings = user.categoryMappings || {};
    mappings[normalizedKeyword] = category;
    user.categoryMappings = mappings;
    user.markModified('categoryMappings');
    await user.save();
  }

  const transactionData = {
    type: 'transaction',
    data: {
      value: session.context.pendingTransaction.value,
      description: session.context.pendingTransaction.description,
      category,
      date: session.context.pendingTransaction.date
        ? new Date(session.context.pendingTransaction.date)
        : new Date()
    }
  };

  await handleTransaction(from, user, transactionData, false);
  await clearSession(phoneNumber);

  await sendMessage(
    from,
    `💡 Salvei: "${keyword}" = ${getCategoryEmoji(category)} ${category}\n` +
    `Próxima vez já sei!`
  );
}

export async function handleCategoryCreation(
  from: string,
  user: IUser,
  categoryName: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.pendingTransaction) {
    await sendMessage(from, '❌ Nenhuma transação pendente.');
    await clearSession(phoneNumber);
    return;
  }

  const cleanName = categoryName.toLowerCase().trim();

  if (cleanName.length < 2) {
    await sendMessage(from, '❌ Nome muito curto. Digite um nome com pelo menos 2 letras.');
    return;
  }

  if (cleanName.length > 20) {
    await sendMessage(from, '❌ Nome muito longo. Use no máximo 20 caracteres.');
    return;
  }

  if (!user.customCategories.includes(cleanName)) {
    user.customCategories.push(cleanName);
  }

  const keyword = session.context.pendingTransaction.keyword || session.context.newCategoryKeyword;
  if (keyword) {
    const normalizedKeyword = normalizeText(keyword);
    const mappings = user.categoryMappings || {};
    mappings[normalizedKeyword] = cleanName;
    user.categoryMappings = mappings;
    user.markModified('categoryMappings');
  }

  await user.save();

  // ── Se veio do /mudar → só atualiza a transação existente ─────────────────
  if (session.context.lastTransactionId) {
    const transaction = await Transaction.findById(session.context.lastTransactionId);

    if (transaction) {
      const oldCategory = transaction.category;
      transaction.category = cleanName;
      await transaction.save();

      // Se editBoth → ainda precisa pedir data
      if (session.context.editBoth) {
        await updateSessionStatus(phoneNumber, 'pending_date_edit', {
          lastTransactionId: session.context.lastTransactionId,
          pendingTransaction: session.context.pendingTransaction,
          awaitingInput: 'date_edit',
          editBoth: false
        });

        await sendMessage(
          from,
          `🗸 Categoria alterada para ${getCategoryEmoji(cleanName)} ${cleanName}!\n\n` +
          `📅 *Agora, qual a nova data?*\n\n` +
          `Exemplos:\n` +
          `• ontem\n` +
          `• dia 15\n` +
          `• 20/05\n` +
          `• sexta`
        );
        return;
      }

      await clearSession(phoneNumber);
      await sendMessage(
        from,
        `🗸 Categoria alterada!\n\n` +
        `De: ${oldCategory}\n` +
        `Para: ${getCategoryEmoji(cleanName)} ${cleanName}\n\n` +
        `💡 Mapeamento de "${keyword}" atualizado!`
      );
      return;
    }
  }

  // ── Fluxo normal → cria transação nova ────────────────────────────────────
  const transactionData = {
    type: 'transaction',
    data: {
      value: session.context.pendingTransaction.value,
      description: session.context.pendingTransaction.description,
      category: cleanName,
      date: session.context.pendingTransaction.date
        ? new Date(session.context.pendingTransaction.date)
        : new Date()
    }
  };

  await handleTransaction(from, user, transactionData, false);
  await clearSession(phoneNumber);

  await sendMessage(
    from,
    `🗸 Categoria "${cleanName}" criada!\n\n` +
    `💡 Salvei: "${keyword}" = ${cleanName}`
  );
}

export async function handleCategoryChange(
  from: string,
  user: IUser,
  choice: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);

  if (!session?.context?.lastTransactionId) {
    await sendMessage(from, '❌ Nenhuma transação para alterar.');
    await clearSession(phoneNumber);
    return;
  }

  const choiceNum = parseInt(choice);

  if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > DEFAULT_CATEGORIES.length) {
    await sendMessage(
      from,
      `❌ Opção inválida. Responda com um número de 1 a ${DEFAULT_CATEGORIES.length}`
    );
    return;
  }

  if (choiceNum === DEFAULT_CATEGORIES.length) {
    await updateSessionStatus(phoneNumber, 'pending_category_creation', {
      pendingTransaction: session.context.pendingTransaction,
      lastTransactionId: session.context.lastTransactionId,
      awaitingInput: 'category_creation',
      newCategoryKeyword: session.context.pendingTransaction?.keyword,
      editBoth: session.context.editBoth
    });

    await sendMessage(
      from,
      '🖉 Digite o nome da nova categoria:\n\n' +
      '(ex: pet, games, beleza, etc)'
    );
    return;
  }

  const category = getCategoryByNumber(choiceNum);

  if (!category) {
    await sendMessage(from, '❌ Categoria inválida.');
    return;
  }

  const transaction = await Transaction.findById(session.context.lastTransactionId);

  if (!transaction) {
    await sendMessage(from, '❌ Transação não encontrada.');
    await clearSession(phoneNumber);
    return;
  }

  const oldCategory = transaction.category;
  transaction.category = category;
  await transaction.save();

  const keyword = session.context.pendingTransaction?.keyword;
  if (keyword) {
    const normalizedKeyword = normalizeText(keyword);
    const mappings = user.categoryMappings || {};
    mappings[normalizedKeyword] = category;
    user.categoryMappings = mappings;
    user.markModified('categoryMappings');
    await user.save();
  }

  const emoji = getCategoryEmoji(category);

  if (session.context.editBoth) {
    await updateSessionStatus(phoneNumber, 'pending_date_edit', {
      lastTransactionId: session.context.lastTransactionId,
      pendingTransaction: session.context.pendingTransaction,
      awaitingInput: 'date_edit',
      editBoth: false
    });

    await sendMessage(
      from,
      `🗸 Categoria alterada para ${emoji} ${category}!\n\n` +
      `📅 *Agora, qual a nova data?*\n\n` +
      `Exemplos:\n` +
      `• ontem\n` +
      `• dia 15\n` +
      `• 20/05\n` +
      `• sexta`
    );
    return;
  }

  await clearSession(phoneNumber);

  await sendMessage(
    from,
    `🗸 Categoria alterada!\n\n` +
    `De: ${oldCategory}\n` +
    `Para: ${emoji} ${category}\n\n` +
    `💡 Mapeamento de "${keyword}" atualizado!`
  );
}

export async function handleListCategoriesCommand(from: string, user: IUser) {
  let message = '📈 *Suas categorias:*\n\n';

  message += '*PADRÃO:*\n';
  DEFAULT_CATEGORIES.forEach(cat => {
    if (cat.name !== 'outros') {
      message += `${cat.emoji} ${cat.name}\n`;
    }
  });

  if (user.customCategories.length > 0) {
    message += '\n*PERSONALIZADAS:*\n';
    user.customCategories.forEach(cat => {
      message += `✦ ${cat}\n`;
    });
  }

  message += '\n💡 Use /mapear para ver seus mapeamentos';

  await sendMessage(from, message);
}

export async function handleListMappingsCommand(from: string, user: IUser) {
  const mappings = user.categoryMappings;

  if (!mappings || Object.keys(mappings).length === 0) {
    await sendMessage(
      from,
      '📭 Você ainda não tem mapeamentos salvos.\n\n' +
      'Eles são criados automaticamente quando você registra gastos!'
    );
    return;
  }

  let message = '🗒️ *Seus mapeamentos:*\n\n';

  Object.entries(mappings).forEach(([keyword, category]) => {
    const emoji = getCategoryEmoji(category);
    message += `"${keyword}" → ${emoji} ${category}\n`;
  });

  message += '\n💡 Para remover um mapeamento, use:\n/apagar [palavra]';

  await sendMessage(from, message);
}

export async function handleDeleteMappingCommand(
  from: string,
  user: IUser,
  keyword: string
) {
  const normalizedKeyword = normalizeText(keyword);
  const mappings = user.categoryMappings;

  if (!mappings || !mappings[normalizedKeyword]) {
    await sendMessage(
      from,
      `❌ Mapeamento "${keyword}" não encontrado.\n\n` +
      'Use /mapear para ver seus mapeamentos.'
    );
    return;
  }

  const category = mappings[normalizedKeyword];
  delete mappings[normalizedKeyword];

  user.categoryMappings = mappings;
  user.markModified('categoryMappings');
  await user.save();

  await sendMessage(
    from,
    `🗸 Mapeamento removido!\n\n` +
    `"${keyword}" não será mais categorizado como "${category}"`
  );
}