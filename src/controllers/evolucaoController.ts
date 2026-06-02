import { IUser } from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import SavingEntry from '../models/SavingEntry.js';
import { sendMessage } from '../services/whatsapp.js';
import { updateSessionStatus, clearSession, getSession } from '../services/sessionService.js';

// ─── /evolucao — escolha do período ──────────────────────────────────────────

export async function handleEvolucaoCommand(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];

  await updateSessionStatus(phoneNumber, 'pending_evolucao_choice', {
    awaitingInput: 'evolucao_choice'
  });

  await sendMessage(
    from,
    `📈 *Qual período deseja comparar?*\n\n` +
    `1️⃣ Últimos 2 meses\n` +
    `2️⃣ Últimos 3 meses\n` +
    `3️⃣ Últimos 6 meses\n\n` +
    `Responda com 1, 2 ou 3`
  );
}

// ─── Escolha do período ───────────────────────────────────────────────────────

export async function handleEvolucaoChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];

  const periodMap: Record<string, number> = { '1': 2, '2': 3, '3': 6 };
  const months = periodMap[choice];

  if (!months) {
    await sendMessage(from, '❌ Opção inválida. Responda com 1, 2 ou 3.');
    return;
  }

  await clearSession(phoneNumber);
  await sendEvolucao(from, user, months);
}

// ─── Gera comparativo ─────────────────────────────────────────────────────────

async function sendEvolucao(from: string, user: IUser, numMonths: number) {
  const now = new Date();

  // Coleta dados de cada mês
  const meses: {
    label: string;
    entradas: number;
    gastos: number;
    guardado: number;
    saldo: number;
  }[] = [];

  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace('.', '')
      .replace(' de ', '/')
      .replace(/^\w/, c => c.toUpperCase());

    const [transactions, incomes, savingEntries] = await Promise.all([
      Transaction.find({ userId: user._id, date: { $gte: start, $lt: end } }),
      Income.find({ userId: user._id, date: { $gte: start, $lt: end } }),
      SavingEntry.find({ userId: user._id, type: 'aporte', date: { $gte: start, $lt: end } })
    ]);

    const entradas  = incomes.reduce((s, i) => s + i.value, 0);
    const gastos    = transactions.reduce((s, t) => s + t.value, 0);
    const guardado  = savingEntries.reduce((s, e) => s + e.value, 0);
    const saldo     = entradas - gastos;

    meses.push({ label, entradas, gastos, guardado, saldo });
  }

  // Formata resposta
  let resp = `📈 *Evolução — últimos ${numMonths} meses:*\n`;

  // ── Entradas ───────────────────────────────────────────────────────────────
  resp += `\n💵 *Entradas:*\n`;
  meses.forEach((m, i) => {
    const arrow = i === 0 ? '' : buildArrow(meses[i - 1].entradas, m.entradas);
    resp += `  ${m.label}: R$ ${m.entradas.toFixed(2)}${arrow}\n`;
  });

  // ── Gastos ─────────────────────────────────────────────────────────────────
  resp += `\n🛒 *Gastos:*\n`;
  meses.forEach((m, i) => {
    const arrow = i === 0 ? '' : buildArrow(meses[i - 1].gastos, m.gastos, true);
    resp += `  ${m.label}: R$ ${m.gastos.toFixed(2)}${arrow}\n`;
  });

  // ── Guardado ───────────────────────────────────────────────────────────────
  const hasGuardado = meses.some(m => m.guardado > 0);
  if (hasGuardado) {
    resp += `\n🏦 *Guardado:*\n`;
    meses.forEach((m, i) => {
      const arrow = i === 0 ? '' : buildArrow(meses[i - 1].guardado, m.guardado);
      resp += `  ${m.label}: R$ ${m.guardado.toFixed(2)}${arrow}\n`;
    });
  }

  // ── Saldo ──────────────────────────────────────────────────────────────────
  resp += `\n💰 *Saldo do período:*\n`;
  meses.forEach((m, i) => {
    const arrow = i === 0 ? '' : buildArrow(meses[i - 1].saldo, m.saldo);
    const emoji = m.saldo >= 0 ? '🟢' : '🔴';
    resp += `  ${emoji} ${m.label}: R$ ${m.saldo.toFixed(2)}${arrow}\n`;
  });

  // ── Destaques ──────────────────────────────────────────────────────────────
  const melhorMes = [...meses].sort((a, b) => b.saldo - a.saldo)[0];
  const maiorGasto = [...meses].sort((a, b) => b.gastos - a.gastos)[0];

  resp += `\n━━━━━━━━━━━━━━━\n`;
  resp += `🏆 Melhor mês: *${melhorMes.label}* (saldo R$ ${melhorMes.saldo.toFixed(2)})\n`;
  resp += `⚠️ Maior gasto: *${maiorGasto.label}* (R$ ${maiorGasto.gastos.toFixed(2)})`;

  await sendMessage(from, resp);
}

// ─── Helper: seta com % de variação ──────────────────────────────────────────

function buildArrow(prev: number, curr: number, invertGood = false): string {
  if (prev === 0) return '';

  const diff = curr - prev;
  const pct  = Math.abs((diff / prev) * 100).toFixed(0);

  if (Math.abs(diff) < 0.01) return ' →';

  const isUp   = diff > 0;
  const isGood = invertGood ? !isUp : isUp;

  const arrow = isUp ? '↑' : '↓';
  const emoji = isGood ? '✅' : '⚠️';

  return ` ${arrow}${pct}% ${emoji}`;
}