import { IUser } from '../models/User.js';
import Saving, { RateType } from '../models/Saving.js';
import SavingEntry from '../models/SavingEntry.js';
import { sendMessage } from '../services/whatsapp.js';
import { updateSessionStatus, clearSession, getSession } from '../services/sessionService.js';
import { calculateRendimento, formatTaxaLabel } from '../services/BcbService';
import { normalizeText } from '../services/categoryMapper.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSavingBalance(savingId: any): Promise<number> {
  const entries = await SavingEntry.find({ savingId });
  const aportes = entries.filter(e => e.type === 'aporte').reduce((s, e) => s + e.value, 0);
  const retiradas = entries.filter(e => e.type === 'retirada').reduce((s, e) => s + e.value, 0);
  const rendimentos = entries.filter(e => e.type === 'rendimento_manual').reduce((s, e) => s + e.value, 0);
  return aportes - retiradas + rendimentos;
}

// ─── Fluxo principal: "guardei X nome" ───────────────────────────────────────

export async function handleSavingMessage(
  from: string,
  user: IUser,
  value: number,
  savingName: string,
  date: Date
) {
  const phoneNumber = from.split('@')[0];
  const normalizedName = normalizeText(savingName);

  // Verifica se já existe
  const existing = await Saving.findOne({
    userId: user._id,
    normalizedName,
    active: true
  });

  if (existing) {
    // Guardado já existe — pergunta se é aporte ou novo
    await updateSessionStatus(phoneNumber, 'pending_saving_deposit', {
      awaitingInput: 'saving_deposit',
      pendingSaving: {
        savingId: existing._id.toString(),
        name: existing.name,
        value,
        date
      }
    });

    const balance = await getSavingBalance(existing._id);

    await sendMessage(
      from,
      `🏦 *${existing.name}* já existe!\n\n` +
      `💵 Saldo atual: R$ ${balance.toFixed(2)}\n` +
      `📈 Taxa: ${formatTaxaLabel(existing.rateType, existing.rateValue)}\n\n` +
      `O que deseja fazer?\n\n` +
      `1️⃣ Registrar aporte de R$ ${value.toFixed(2)}\n` +
      `2️⃣ Criar novo guardado com este nome`
    );
    return;
  }

  // Guardado novo — inicia fluxo de cadastro
  await updateSessionStatus(phoneNumber, 'pending_saving_rate', {
    awaitingInput: 'saving_rate',
    pendingSaving: {
      name: savingName,
      normalizedName,
      value,
      date
    }
  });

  await sendMessage(
    from,
    `🏦 Novo guardado: *${savingName}*\n` +
    `💵 Valor: R$ ${value.toFixed(2)}\n\n` +
    `Esse dinheiro rende?\n\n` +
    `1️⃣ Sim\n` +
    `2️⃣ Não`
  );
}

// ─── Escolha se rende ou não ──────────────────────────────────────────────────

export async function handleSavingRateChoice(
  from: string,
  user: IUser,
  choice: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const pending = session?.context?.pendingSaving;

  if (!pending) {
    await sendMessage(from, '❌ Sessão expirada. Tente novamente.');
    await clearSession(phoneNumber);
    return;
  }

  if (choice === '2') {
    // Não rende → cria direto com rateType 'none'
    await createSavingAndEntry(from, user, pending, 'none', 0);
    return;
  }

  if (choice === '1') {
    // Rende → pergunta o tipo
    await updateSessionStatus(phoneNumber, 'pending_saving_rate_type', {
      awaitingInput: 'saving_rate_type',
      pendingSaving: pending
    });

    await sendMessage(
      from,
      `📈 Qual o tipo de rendimento?\n\n` +
      `1️⃣ % do CDI (ex: 105% do CDI)\n` +
      `2️⃣ % ao ano (ex: 12% a.a.)\n` +
      `3️⃣ % ao mês (ex: 1% a.m.)\n` +
      `4️⃣ SELIC + spread (ex: SELIC + 0,5%)\n` +
      `5️⃣ Poupança`
    );
    return;
  }

  await sendMessage(from, '❌ Opção inválida. Responda com 1 ou 2.');
}

// ─── Escolha do tipo de rendimento ───────────────────────────────────────────

export async function handleSavingRateType(
  from: string,
  user: IUser,
  choice: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const pending = session?.context?.pendingSaving;

  if (!pending) {
    await sendMessage(from, '❌ Sessão expirada. Tente novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const typeMap: Record<string, RateType> = {
    '1': 'cdi_percent',
    '2': 'year_percent',
    '3': 'month_percent',
    '4': 'selic_spread',
    '5': 'poupanca'
  };

  const rateType = typeMap[choice];

  if (!rateType) {
    await sendMessage(from, '❌ Opção inválida. Responda com um número de 1 a 5.');
    return;
  }

  // Poupança não precisa de valor
  if (rateType === 'poupanca') {
    await createSavingAndEntry(from, user, pending, 'poupanca', 0);
    return;
  }

  // Outros → pede o valor da taxa
  await updateSessionStatus(phoneNumber, 'pending_saving_rate_value', {
    awaitingInput: 'saving_rate_value',
    pendingSaving: { ...pending, rateType }
  });

  const examples: Record<string, string> = {
    cdi_percent: 'ex: 105 para 105% do CDI',
    year_percent: 'ex: 12 para 12% ao ano',
    month_percent: 'ex: 1 para 1% ao mês',
    selic_spread: 'ex: 0.5 para SELIC + 0,5%'
  };

  await sendMessage(
    from,
    `📈 Digite o valor da taxa:\n\n` +
    `(${examples[rateType]})\n\n` +
    `Responda apenas com o número`
  );
}

// ─── Valor da taxa ────────────────────────────────────────────────────────────

export async function handleSavingRateValue(
  from: string,
  user: IUser,
  text: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const pending = session?.context?.pendingSaving;

  if (!pending) {
    await sendMessage(from, '❌ Sessão expirada. Tente novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const rateValue = parseFloat(text.replace(',', '.'));

  if (isNaN(rateValue) || rateValue <= 0) {
    await sendMessage(from, '❌ Valor inválido. Digite apenas o número (ex: 105).');
    return;
  }

  await createSavingAndEntry(from, user, pending, pending.rateType, rateValue);
}

// ─── Aporte em guardado existente ─────────────────────────────────────────────

export async function handleSavingDepositChoice(
  from: string,
  user: IUser,
  choice: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const pending = session?.context?.pendingSaving;

  if (!pending) {
    await sendMessage(from, '❌ Sessão expirada. Tente novamente.');
    await clearSession(phoneNumber);
    return;
  }

  if (choice === '1') {
    // Registra aporte no guardado existente
    await SavingEntry.create({
      savingId: pending.savingId,
      userId: user._id,
      type: 'aporte',
      value: pending.value,
      date: pending.date || new Date()
    });

    const balance = await getSavingBalance(pending.savingId);
    await clearSession(phoneNumber);

    await sendMessage(
      from,
      `🗸 Aporte registrado!\n\n` +
      `🏦 ${pending.name}\n` +
      `💵 + R$ ${pending.value.toFixed(2)}\n\n` +
      `📊 Saldo atual: R$ ${balance.toFixed(2)}`
    );
    return;
  }

  if (choice === '2') {
    // Cria novo guardado com nome diferente — pede pra renomear
    await updateSessionStatus(phoneNumber, 'pending_saving_rename', {
      awaitingInput: 'saving_rename',
      pendingSaving: pending
    });

    await sendMessage(
      from,
      `📝 Digite o nome do novo guardado:\n\n` +
      `(o nome "${pending.name}" já está em uso)`
    );
    return;
  }

  await sendMessage(from, '❌ Opção inválida. Responda com 1 ou 2.');
}

// ─── Renomear guardado ────────────────────────────────────────────────────────

export async function handleSavingRename(
  from: string,
  user: IUser,
  newName: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const pending = session?.context?.pendingSaving;

  if (!pending) {
    await sendMessage(from, '❌ Sessão expirada. Tente novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const normalizedName = normalizeText(newName);

  const existing = await Saving.findOne({ userId: user._id, normalizedName, active: true });
  if (existing) {
    await sendMessage(from, `❌ Já existe um guardado com o nome "${newName}". Escolha outro nome.`);
    return;
  }

  await updateSessionStatus(phoneNumber, 'pending_saving_rate', {
    awaitingInput: 'saving_rate',
    pendingSaving: { ...pending, name: newName, normalizedName }
  });

  await sendMessage(
    from,
    `🏦 Novo guardado: *${newName}*\n` +
    `💵 Valor: R$ ${pending.value.toFixed(2)}\n\n` +
    `Esse dinheiro rende?\n\n` +
    `1️⃣ Sim\n` +
    `2️⃣ Não`
  );
}

// ─── Retirada ─────────────────────────────────────────────────────────────────

export async function handleWithdrawalMessage(
  from: string,
  user: IUser,
  value: number,
  savingName: string,
  date: Date
) {
  const phoneNumber = from.split('@')[0];
  const normalizedName = normalizeText(savingName);

  const saving = await Saving.findOne({ userId: user._id, normalizedName, active: true });

  if (!saving) {
    await sendMessage(
      from,
      `❌ Guardado "${savingName}" não encontrado.\n\n` +
      `Use /guardados para ver seus guardados.`
    );
    return;
  }

  const balance = await getSavingBalance(saving._id);

  if (value > balance) {
    await sendMessage(
      from,
      `❌ Saldo insuficiente!\n\n` +
      `🏦 ${saving.name}\n` +
      `💵 Saldo atual: R$ ${balance.toFixed(2)}\n` +
      `💵 Retirada solicitada: R$ ${value.toFixed(2)}`
    );
    return;
  }

  // Confirma retirada
  await updateSessionStatus(phoneNumber, 'pending_saving_withdrawal', {
    awaitingInput: 'saving_withdrawal',
    pendingSaving: {
      savingId: saving._id.toString(),
      name: saving.name,
      value,
      date,
      currentBalance: balance
    }
  });

  await sendMessage(
    from,
    `💸 Confirmar retirada?\n\n` +
    `🏦 ${saving.name}\n` +
    `💵 Retirada: R$ ${value.toFixed(2)}\n` +
    `📊 Saldo após: R$ ${(balance - value).toFixed(2)}\n\n` +
    `1️⃣ Sim\n` +
    `2️⃣ Não`
  );
}

export async function handleWithdrawalConfirm(
  from: string,
  user: IUser,
  choice: string
) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const pending = session?.context?.pendingSaving;

  if (!pending) {
    await sendMessage(from, '❌ Sessão expirada. Tente novamente.');
    await clearSession(phoneNumber);
    return;
  }

  if (choice === '2') {
    await clearSession(phoneNumber);
    await sendMessage(from, '🗸 Retirada cancelada.');
    return;
  }

  if (choice === '1') {
    await SavingEntry.create({
      savingId: pending.savingId,
      userId: user._id,
      type: 'retirada',
      value: pending.value,
      date: pending.date || new Date()
    });

    const newBalance = pending.currentBalance - pending.value;
    await clearSession(phoneNumber);

    await sendMessage(
      from,
      `🗸 Retirada registrada!\n\n` +
      `🏦 ${pending.name}\n` +
      `💵 - R$ ${pending.value.toFixed(2)}\n\n` +
      `📊 Saldo atual: R$ ${newBalance.toFixed(2)}`
    );
    return;
  }

  await sendMessage(from, '❌ Opção inválida. Responda com 1 ou 2.');
}

// ─── /guardados ───────────────────────────────────────────────────────────────

export async function handleSavingsListCommand(from: string, user: IUser) {
  const savings = await Saving.find({ userId: user._id, active: true }).sort({ createdAt: 1 });

  if (savings.length === 0) {
    await sendMessage(
      from,
      '📭 Você ainda não tem guardados.\n\n' +
      'Para criar, envie:\n"guardei [valor] [nome]"\n\n' +
      'Ex: guardei 500 caixinha viagem'
    );
    return;
  }

  let response = `🏦 *Seus guardados:*\n\n`;

  for (const saving of savings) {
    const entries = await SavingEntry.find({ savingId: saving._id });
    const aportes = entries.filter(e => e.type === 'aporte').reduce((s, e) => s + e.value, 0);
    const retiradas = entries.filter(e => e.type === 'retirada').reduce((s, e) => s + e.value, 0);
    const rendimentoManual = entries.filter(e => e.type === 'rendimento_manual').reduce((s, e) => s + e.value, 0);
    const saldo = aportes - retiradas + rendimentoManual;

    response += `*${saving.name}*\n`;
    response += `  💵 Aportado: R$ ${aportes.toFixed(2)}\n`;
    if (retiradas > 0) response += `  💸 Retirado: R$ ${retiradas.toFixed(2)}\n`;
    response += `  📈 Taxa: ${formatTaxaLabel(saving.rateType, saving.rateValue)}\n`;
    response += `  📊 Saldo: R$ ${saldo.toFixed(2)}\n`;
    response += `  💡 Use /rendimento ${saving.name} para calcular rendimento\n\n`;
  }

  await sendMessage(from, response);
}

// ─── /rendimento [nome] ───────────────────────────────────────────────────────

export async function handleRendimentoCommand(from: string, user: IUser, savingName: string) {
  const normalizedName = normalizeText(savingName);

  const saving = await Saving.findOne({ userId: user._id, normalizedName, active: true });

  if (!saving) {
    // Tenta busca parcial
    const savings = await Saving.find({ userId: user._id, active: true });
    const partial = savings.find(s => s.normalizedName.includes(normalizedName) || normalizedName.includes(s.normalizedName));

    if (!partial) {
      await sendMessage(
        from,
        `❌ Guardado "${savingName}" não encontrado.\n\n` +
        `Use /guardados para ver seus guardados.`
      );
      return;
    }

    return handleRendimentoCommand(from, user, partial.name);
  }

  if (saving.rateType === 'none') {
    const balance = await getSavingBalance(saving._id);
    await sendMessage(
      from,
      `🏦 *${saving.name}*\n\n` +
      `💵 Saldo: R$ ${balance.toFixed(2)}\n` +
      `📈 Sem rendimento configurado\n\n` +
      `💡 Use /mudar para configurar uma taxa`
    );
    return;
  }

  await sendMessage(from, `⏳ Calculando rendimento de *${saving.name}*...`);

  try {
    const entries = await SavingEntry.find({ savingId: saving._id }).sort({ date: 1 });

    const result = await calculateRendimento(
      entries.map(e => ({ type: e.type, value: e.value, date: e.date })),
      saving.rateType,
      saving.rateValue
    );

    const inicio = result.periodoInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fim = result.periodoFim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let response =
      `🏦 *${saving.name}*\n\n` +
      `📈 Taxa: ${result.taxaUsada}\n` +
      `📅 Período: ${inicio} → ${fim}\n\n` +
      `💵 Total aportado: R$ ${result.totalAportado.toFixed(2)}\n`;

    if (result.totalRetirado > 0) {
      response += `💸 Total retirado: R$ ${result.totalRetirado.toFixed(2)}\n`;
    }

    response +=
      `📈 Rendimento: R$ ${result.rendimentoCalculado.toFixed(2)}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📊 *Saldo atual: R$ ${result.saldoAtual.toFixed(2)}*`;

    await sendMessage(from, response);

  } catch (error) {
    console.error('❌ Erro ao calcular rendimento:', error);
    await sendMessage(
      from,
      `❌ Não foi possível calcular o rendimento agora.\n\n` +
      `Isso pode acontecer se a API do Banco Central estiver indisponível. Tente novamente mais tarde.`
    );
  }
}

// ─── Criar guardado + primeiro aporte ────────────────────────────────────────

async function createSavingAndEntry(
  from: string,
  user: IUser,
  pending: any,
  rateType: RateType,
  rateValue: number
) {
  const phoneNumber = from.split('@')[0];

  const saving = await Saving.create({
    userId: user._id,
    name: pending.name,
    normalizedName: pending.normalizedName,
    rateType,
    rateValue
  });

  await SavingEntry.create({
    savingId: saving._id,
    userId: user._id,
    type: 'aporte',
    value: pending.value,
    date: pending.date || new Date()
  });

  await clearSession(phoneNumber);

  const taxaLine = rateType !== 'none'
    ? `\n📈 Taxa: ${formatTaxaLabel(rateType, rateValue)}`
    : '';

  await sendMessage(
    from,
    `🗸 Guardado criado!\n\n` +
    `🏦 ${saving.name}\n` +
    `💵 R$ ${pending.value.toFixed(2)}` +
    `${taxaLine}\n\n` +
    `💡 Use /rendimento ${saving.name} para ver o rendimento\n` +
    `💡 Use /guardados para ver todos`
  );
}