import { RateType } from '../models/Saving.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DailyRate {
  date: Date;
  value: number; // taxa diária em decimal (ex: 0.000523)
}

// ─── Cache simples em memória ─────────────────────────────────────────────────
// Evita chamar a API do BCB a cada cálculo

const cache: {
  cdi?: { data: DailyRate[]; fetchedAt: Date };
  selic?: { value: number; fetchedAt: Date };
} = {};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

// ─── API do Banco Central ─────────────────────────────────────────────────────

/**
 * Busca CDI diário histórico do BCB
 * Série 12 = CDI Over (taxa diária)
 */
async function fetchDailyCDI(startDate: Date, endDate: Date): Promise<DailyRate[]> {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados` +
    `?formato=json&dataInicial=${fmt(startDate)}&dataFinal=${fmt(endDate)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`BCB API erro: ${res.status}`);

  const json = await res.json() as { data: string; valor: string }[];

  return json.map(item => {
    const [day, month, year] = item.data.split('/').map(Number);
    return {
      date: new Date(year, month - 1, day),
      value: parseFloat(item.valor) / 100 // converte % pra decimal
    };
  });
}

/**
 * Busca SELIC atual do BCB
 * Série 432 = Taxa SELIC acumulada no mês anualizada
 */
async function fetchCurrentSelic(): Promise<number> {
  // Verifica cache
  if (cache.selic && Date.now() - cache.selic.fetchedAt.getTime() < CACHE_TTL_MS) {
    return cache.selic.value;
  }

  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`BCB API erro: ${res.status}`);

  const json = await res.json() as { data: string; valor: string }[];
  const selic = parseFloat(json[0].valor); // % ao ano

  cache.selic = { value: selic, fetchedAt: new Date() };
  return selic;
}

/**
 * Busca CDI com cache
 */
async function getCDIRates(startDate: Date, endDate: Date): Promise<DailyRate[]> {
  // Se tem cache e cobre o período → usa cache
  if (cache.cdi && Date.now() - cache.cdi.fetchedAt.getTime() < CACHE_TTL_MS) {
    return cache.cdi.data.filter(r => r.date >= startDate && r.date <= endDate);
  }

  // Busca do início até hoje
  const rates = await fetchDailyCDI(startDate, endDate);

  cache.cdi = { data: rates, fetchedAt: new Date() };
  return rates;
}

// ─── Cálculo de rendimento ────────────────────────────────────────────────────

export interface SavingEntryForCalc {
  type: 'aporte' | 'retirada' | 'rendimento_manual';
  value: number;
  date: Date;
}

export interface RendimentoResult {
  totalAportado: number;
  totalRetirado: number;
  rendimentoCalculado: number;
  saldoAtual: number;
  taxaUsada: string;
  periodoInicio: Date;
  periodoFim: Date;
}

/**
 * Calcula rendimento de um guardado com base nos aportes e tipo de taxa
 */
export async function calculateRendimento(
  entries: SavingEntryForCalc[],
  rateType: RateType,
  rateValue: number
): Promise<RendimentoResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const aportes = entries.filter(e => e.type === 'aporte');
  const retiradas = entries.filter(e => e.type === 'retirada');
  const rendimentosManuais = entries.filter(e => e.type === 'rendimento_manual');

  const totalAportado = aportes.reduce((s, e) => s + e.value, 0);
  const totalRetirado = retiradas.reduce((s, e) => s + e.value, 0);
  const totalRendimentoManual = rendimentosManuais.reduce((s, e) => s + e.value, 0);

  if (rateType === 'none') {
    return {
      totalAportado,
      totalRetirado,
      rendimentoCalculado: totalRendimentoManual,
      saldoAtual: totalAportado - totalRetirado + totalRendimentoManual,
      taxaUsada: 'Sem rendimento',
      periodoInicio: aportes[0]?.date || today,
      periodoFim: today
    };
  }

  // Ordena aportes por data
  const sortedAportes = [...aportes].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sortedRetiradas = [...retiradas].sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sortedAportes.length === 0) {
    return {
      totalAportado: 0,
      totalRetirado,
      rendimentoCalculado: 0,
      saldoAtual: 0,
      taxaUsada: formatTaxaLabel(rateType, rateValue),
      periodoInicio: today,
      periodoFim: today
    };
  }

  const startDate = sortedAportes[0].date;

  // Poupança e taxas prefixadas têm cálculo diferente
  if (rateType === 'poupanca') {
    return await calculatePoupanca(sortedAportes, sortedRetiradas, totalAportado, totalRetirado, startDate, today);
  }

  if (rateType === 'month_percent') {
    return calculateMonthPercent(sortedAportes, sortedRetiradas, totalAportado, totalRetirado, rateValue, startDate, today);
  }

  if (rateType === 'year_percent') {
    return calculateYearPercent(sortedAportes, sortedRetiradas, totalAportado, totalRetirado, rateValue, startDate, today);
  }

  // CDI percent e SELIC spread — precisam do histórico do BCB
  return await calculateCDIBased(sortedAportes, sortedRetiradas, totalAportado, totalRetirado, rateType, rateValue, startDate, today);
}

// ─── Cálculos por tipo ────────────────────────────────────────────────────────

async function calculateCDIBased(
  aportes: SavingEntryForCalc[],
  retiradas: SavingEntryForCalc[],
  totalAportado: number,
  totalRetirado: number,
  rateType: RateType,
  rateValue: number,
  startDate: Date,
  today: Date
): Promise<RendimentoResult> {
  const cdiRates = await getCDIRates(startDate, today);

  let saldo = 0;
  let rendimento = 0;

  const eventos = [
    ...aportes.map(e => ({ ...e, sinal: 1 })),
    ...retiradas.map(e => ({ ...e, sinal: -1 }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let eventoIdx = 0;
  const current = new Date(startDate);

  while (current <= today) {
    // Aplica eventos do dia
    while (eventoIdx < eventos.length && sameDay(eventos[eventoIdx].date, current)) {
      saldo += eventos[eventoIdx].value * eventos[eventoIdx].sinal;
      eventoIdx++;
    }

    if (saldo > 0) {
      // Taxa do dia
      const cdiDia = cdiRates.find(r => sameDay(r.date, current));
      if (cdiDia) {
        let taxaDia: number;
        if (rateType === 'cdi_percent') {
          taxaDia = cdiDia.value * (rateValue / 100);
        } else {
          // selic_spread — usa CDI como proxy da SELIC diária
          taxaDia = cdiDia.value + rateValue / 100 / 252;
        }
        const ganho = saldo * taxaDia;
        rendimento += ganho;
        saldo += ganho;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    totalAportado,
    totalRetirado,
    rendimentoCalculado: rendimento,
    saldoAtual: totalAportado - totalRetirado + rendimento,
    taxaUsada: formatTaxaLabel(rateType, rateValue),
    periodoInicio: startDate,
    periodoFim: today
  };
}

async function calculatePoupanca(
  aportes: SavingEntryForCalc[],
  retiradas: SavingEntryForCalc[],
  totalAportado: number,
  totalRetirado: number,
  startDate: Date,
  today: Date
): Promise<RendimentoResult> {
  const selicAnual = await fetchCurrentSelic();

  // Regra da poupança:
  // SELIC > 8.5% ao ano → 0.5% ao mês + TR (TR ≈ 0 atualmente)
  // SELIC ≤ 8.5% ao ano → 70% da SELIC ao ano / 12 por mês
  let taxaMensal: number;
  if (selicAnual > 8.5) {
    taxaMensal = 0.5 / 100;
  } else {
    taxaMensal = (selicAnual * 0.7) / 100 / 12;
  }

  const rendimento = calculateMonthlyCompound(aportes, retiradas, taxaMensal, startDate, today);

  return {
    totalAportado,
    totalRetirado,
    rendimentoCalculado: rendimento,
    saldoAtual: totalAportado - totalRetirado + rendimento,
    taxaUsada: `Poupança (SELIC ${selicAnual}% a.a.)`,
    periodoInicio: startDate,
    periodoFim: today
  };
}

function calculateMonthPercent(
  aportes: SavingEntryForCalc[],
  retiradas: SavingEntryForCalc[],
  totalAportado: number,
  totalRetirado: number,
  rateValue: number,
  startDate: Date,
  today: Date
): RendimentoResult {
  const taxaMensal = rateValue / 100;
  const rendimento = calculateMonthlyCompound(aportes, retiradas, taxaMensal, startDate, today);

  return {
    totalAportado,
    totalRetirado,
    rendimentoCalculado: rendimento,
    saldoAtual: totalAportado - totalRetirado + rendimento,
    taxaUsada: formatTaxaLabel('month_percent', rateValue),
    periodoInicio: startDate,
    periodoFim: today
  };
}

function calculateYearPercent(
  aportes: SavingEntryForCalc[],
  retiradas: SavingEntryForCalc[],
  totalAportado: number,
  totalRetirado: number,
  rateValue: number,
  startDate: Date,
  today: Date
): RendimentoResult {
  // Converte taxa anual pra mensal: (1 + taxa_anual)^(1/12) - 1
  const taxaMensal = Math.pow(1 + rateValue / 100, 1 / 12) - 1;
  const rendimento = calculateMonthlyCompound(aportes, retiradas, taxaMensal, startDate, today);

  return {
    totalAportado,
    totalRetirado,
    rendimentoCalculado: rendimento,
    saldoAtual: totalAportado - totalRetirado + rendimento,
    taxaUsada: formatTaxaLabel('year_percent', rateValue),
    periodoInicio: startDate,
    periodoFim: today
  };
}

/**
 * Capitalização mensal composta com múltiplos aportes e retiradas
 */
function calculateMonthlyCompound(
  aportes: SavingEntryForCalc[],
  retiradas: SavingEntryForCalc[],
  taxaMensal: number,
  startDate: Date,
  today: Date
): number {
  const eventos = [
    ...aportes.map(e => ({ date: e.date, value: e.value })),
    ...retiradas.map(e => ({ date: e.date, value: -e.value }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let saldo = 0;
  let rendimentoTotal = 0;
  let lastDate = new Date(startDate);

  for (const evento of eventos) {
    const meses = monthsBetween(lastDate, evento.date);
    if (meses > 0 && saldo > 0) {
      const ganho = saldo * (Math.pow(1 + taxaMensal, meses) - 1);
      rendimentoTotal += ganho;
      saldo += ganho;
    }
    saldo += evento.value;
    lastDate = new Date(evento.date);
  }

  // Rendimento do último período até hoje
  const mesesFinal = monthsBetween(lastDate, today);
  if (mesesFinal > 0 && saldo > 0) {
    const ganho = saldo * (Math.pow(1 + taxaMensal, mesesFinal) - 1);
    rendimentoTotal += ganho;
  }

  return rendimentoTotal;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function monthsBetween(a: Date, b: Date): number {
  return (
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth())
  );
}

export function formatTaxaLabel(rateType: RateType, rateValue: number): string {
  switch (rateType) {
    case 'cdi_percent': return `${rateValue}% do CDI`;
    case 'year_percent': return `${rateValue}% a.a.`;
    case 'month_percent': return `${rateValue}% a.m.`;
    case 'selic_spread': return `SELIC + ${rateValue}%`;
    case 'poupanca': return 'Poupança';
    case 'none': return 'Sem rendimento';
  }
}

export { fetchCurrentSelic };