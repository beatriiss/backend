import mongoose from 'mongoose';
import { IUser } from '../models/User.js';
import Trip, { ITrip } from '../models/Trip.js';
import Transaction from '../models/Transaction.js';
import { sendMessage } from '../services/whatsapp.js';
import { getCategoryEmoji } from '../services/categoryMapper.js';
import { normalizeText } from '../services/categoryMapper.js';
import { updateSessionStatus, clearSession, getSession } from '../services/sessionService.js';

// ─── Criar ou mostrar viagem ──────────────────────────────────────────────────

export async function handleViagemCommand(from: string, user: IUser, nome: string) {
  if (!nome.trim()) {
    await sendMessage(
      from,
      `✈️ *Viagens:*\n\n` +
      `Para criar: /viagem [nome]\n` +
      `Ex: /viagem floripa\n\n` +
      `Para ver todas: /viagens`
    );
    return;
  }

  const normalizedName = normalizeText(nome);

  const existing = await Trip.findOne({ userId: user._id, normalizedName });

  if (existing) {
    if (!existing.active) {
      // Reativa
      existing.active = true;
      await existing.save();
      await sendMessage(
        from,
        `✈️ Viagem *${existing.name}* reativada!\n\n` +
        `Para registrar gastos:\n` +
        `• Tag inline: "almoço 35 #${normalizedName}"\n` +
        `• Ou edite um gasto com /editar`
      );
      return;
    }
    // Já existe e está ativa — mostra resumo
    await showViagemSummary(from, user, existing);
    return;
  }

  // Cria nova
  const trip = await Trip.create({
    userId: user._id,
    name: nome,
    normalizedName
  });

  await sendMessage(
    from,
    `✈️ Viagem *${nome}* criada!\n\n` +
    `Para registrar gastos:\n` +
    `• Tag inline: "almoço 35 #${normalizedName}"\n` +
    `• Ou edite um gasto com /editar\n\n` +
    `💡 Use /encerrar ${nome} quando terminar`
  );
}

// ─── Resumo da viagem ─────────────────────────────────────────────────────────

async function showViagemSummary(from: string, user: IUser, trip: ITrip) {
  const transactions = await Transaction.find({
    userId: user._id,
    tripId: trip._id
  }).sort({ date: -1 });

  const total = transactions.reduce((s, t) => s + t.value, 0);

  let resp = `✈️ *${trip.name}*\n\n`;

  if (transactions.length === 0) {
    resp +=
      `Nenhum gasto registrado ainda.\n\n` +
      `Para registrar:\n` +
      `"almoço 35 #${trip.normalizedName}"`;
  } else {
    // Por categoria
    const porCat: Record<string, number> = {};
    transactions.forEach(t => {
      porCat[t.category] = (porCat[t.category] || 0) + t.value;
    });

    Object.entries(porCat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, val]) => {
        const pct = total > 0 ? ((val / total) * 100).toFixed(0) : '0';
        resp += `  ${getCategoryEmoji(cat)} ${cat}: R$ ${val.toFixed(2)} (${pct}%)\n`;
      });

    resp += `\n━━━━━━━━━━━━━━━\n`;
    resp += `💵 *Total: R$ ${total.toFixed(2)}*\n\n`;

    // Últimos gastos
    resp += `*Últimos gastos:*\n`;
    transactions.slice(0, 5).forEach(t => {
      const date = t.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      resp += `• ${t.description} - R$ ${t.value.toFixed(2)} - ${date} ${getCategoryEmoji(t.category)}\n`;
    });

    if (transactions.length > 5) {
      resp += `_...e mais ${transactions.length - 5} gastos_\n`;
    }
  }

  resp += `\n💡 /encerrar ${trip.name} para encerrar esta viagem`;

  await sendMessage(from, resp);
}

// ─── Encerrar viagem ──────────────────────────────────────────────────────────

export async function handleEncerrarCommand(from: string, user: IUser, nome: string) {
  if (!nome.trim()) {
    await sendMessage(from, '❌ Informe o nome da viagem. Ex: /encerrar floripa');
    return;
  }

  const normalizedName = normalizeText(nome);

  let trip = await Trip.findOne({ userId: user._id, normalizedName, active: true });

  // Tenta busca parcial
  if (!trip) {
    const trips = await Trip.find({ userId: user._id, active: true });
    trip = trips.find(t =>
      t.normalizedName.includes(normalizedName) ||
      normalizedName.includes(t.normalizedName)
    ) || null;
  }

  if (!trip) {
    await sendMessage(
      from,
      `❌ Viagem "${nome}" não encontrada ou já encerrada.\n\n` +
      `Use /viagens para ver suas viagens ativas.`
    );
    return;
  }

  const transactions = await Transaction.find({ userId: user._id, tripId: trip._id });
  const total = transactions.reduce((s, t) => s + t.value, 0);

  trip.active = false;
  await trip.save();

  await sendMessage(
    from,
    `🗸 Viagem *${trip.name}* encerrada!\n\n` +
    `📊 Total gasto: R$ ${total.toFixed(2)}\n` +
    `🗒️ ${transactions.length} gasto${transactions.length !== 1 ? 's' : ''} registrado${transactions.length !== 1 ? 's' : ''}\n\n` +
    `💡 Use /viagem ${trip.name} para reativar se precisar`
  );
}

// ─── Listar viagens ativas ────────────────────────────────────────────────────

export async function handleViagensListCommand(from: string, user: IUser) {
  const trips = await Trip.find({ userId: user._id, active: true }).sort({ createdAt: -1 });

  if (trips.length === 0) {
    await sendMessage(
      from,
      '📭 Nenhuma viagem ativa.\n\n' +
      'Para criar: /viagem [nome]\n' +
      'Ex: /viagem floripa'
    );
    return;
  }

  let resp = `✈️ *Viagens ativas:*\n\n`;

  for (const trip of trips) {
    const transactions = await Transaction.find({ userId: user._id, tripId: trip._id });
    const total = transactions.reduce((s, t) => s + t.value, 0);
    const inicio = trip.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    resp += `• *${trip.name}* — R$ ${total.toFixed(2)} (${transactions.length} gastos) desde ${inicio}\n`;
  }

  resp += `\nUse /viagem [nome] para ver detalhes`;

  await sendMessage(from, resp);
}

// ─── Associar viagem no /editar ───────────────────────────────────────────────

export async function handleEditarViagemStart(from: string, user: IUser, transactionId: string, pendingTransaction: any) {
  const phoneNumber = from.split('@')[0];

  const trips = await Trip.find({ userId: user._id, active: true });
  const transaction = await Transaction.findById(transactionId);

  if (!transaction) {
    await sendMessage(from, '❌ Gasto não encontrado.');
    await clearSession(phoneNumber);
    return;
  }

  const hasTrip = !!transaction.tripId;

  if (trips.length === 0 && !hasTrip) {
    await sendMessage(
      from,
      '❌ Nenhuma viagem ativa.\n\n' +
      'Crie uma com /viagem [nome]\nEx: /viagem floripa'
    );
    return;
  }

  const options = trips.map((t, i) => ({
    id: t._id.toString(),
    label: `${i + 1}️⃣ ✈️ ${t.name}`
  }));

  await updateSessionStatus(phoneNumber, 'pending_editar_viagem', {
    awaitingInput: 'editar_viagem',
    lastTransactionId: transaction._id,
    pendingTransaction,
    editarViagemOptions: options.map(o => o.id)
  });

  let message = `✈️ *Associar a qual viagem?*\n\n`;
  options.forEach(o => { message += `${o.label}\n`; });

  let cancelNum = trips.length + 1;
  if (hasTrip) {
    const currentTrip = await Trip.findById(transaction.tripId);
    message += `${trips.length + 1}️⃣ ❌ Remover vínculo _(atual: ${currentTrip?.name || 'desconhecida'})_\n`;
    cancelNum = trips.length + 2;
  }

  message += `${cancelNum}️⃣ Cancelar`;

  await sendMessage(from, message);
}

export async function handleEditarViagemChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const options = session?.context?.editarViagemOptions || [];

  const transaction = await Transaction.findById(session?.context?.lastTransactionId);

  if (!transaction) {
    await sendMessage(from, '❌ Sessão expirada. Use /editar novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const hasTrip = !!transaction.tripId;
  const choiceNum = parseInt(choice);
  const cancelNum = options.length + (hasTrip ? 2 : 1);

  if (isNaN(choiceNum)) {
    await sendMessage(from, `❌ Opção inválida.`);
    return;
  }

  // Cancelar
  if (choiceNum === cancelNum) {
    await clearSession(phoneNumber);
    await sendMessage(from, '🗸 Operação cancelada.');
    return;
  }

  // Remover vínculo
  if (hasTrip && choiceNum === options.length + 1) {
    const oldTrip = await Trip.findById(transaction.tripId);
    (transaction as any).tripId = undefined;
    await transaction.save();
    await clearSession(phoneNumber);
    await sendMessage(from, `🗸 Vínculo com *${oldTrip?.name || 'viagem'}* removido!`);
    return;
  }

  if (choiceNum < 1 || choiceNum > options.length) {
    await sendMessage(from, `❌ Opção inválida.`);
    return;
  }

  const tripId = options[choiceNum - 1];
  const trip = await Trip.findById(tripId);

  if (!trip) {
    await sendMessage(from, '❌ Viagem não encontrada.');
    await clearSession(phoneNumber);
    return;
  }

  transaction.tripId = trip._id as mongoose.Types.ObjectId;
  await transaction.save();
  await clearSession(phoneNumber);

  await sendMessage(from, `🗸 Gasto associado à viagem *${trip.name}*!`);
}

// ─── Helper: busca ou cria viagem por tag ─────────────────────────────────────

export async function findOrCreateTrip(
  userId: mongoose.Types.ObjectId,
  tagName: string
): Promise<{ id: mongoose.Types.ObjectId; name: string; created: boolean }> {
  const normalizedName = normalizeText(tagName);

  let trip = await Trip.findOne({ userId, normalizedName });

  if (trip) {
    if (!trip.active) {
      trip.active = true;
      await trip.save();
    }
    return { id: trip._id as mongoose.Types.ObjectId, name: trip.name, created: false };
  }

  // Cria automaticamente
  trip = await Trip.create({
    userId,
    name: tagName,
    normalizedName
  });

  return { id: trip._id as mongoose.Types.ObjectId, name: trip.name, created: true };
}