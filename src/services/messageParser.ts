import {
  findCategory,
  findIncomeCategory,
  EXPENSE_VERBS,
  INCOME_VERBS,
  NOISE_WORDS
} from './categoryMapper.js';

export interface ParsedMessage {
  type: 'transaction' | 'income' | 'saving' | 'withdrawal' | 'command' | 'unknown';
  data?: any;
}

// ─── Verbos de guardado e retirada ────────────────────────────────────────────

const SAVING_VERBS = new Set([
  'guardei', 'guardo', 'guardar',
  'reservei', 'reservo', 'reservar',
  'poupei', 'poupo', 'poupar',
  'separei', 'separo', 'separar',
  'investi', 'invisto', 'investir',
  'apliquei', 'aplico', 'aplicar',
]);

const WITHDRAWAL_VERBS = new Set([
  'tirei', 'tiro', 'tirar',
  'retirei', 'retiro', 'retirar',
  'resgatei', 'resgato', 'resgatar',
  'saquei', 'saco', 'sacar',
]);

// ─── Date Parser ─────────────────────────────────────────────────────────────

const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terca: 2,
  terça: 2,
  'terca-feira': 2,
  'terça-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sabado: 6,
  sábado: 6,
};

export function parseDate(text: string): { date: Date; cleanText: string } {
  const lower = text.toLowerCase().trim();
  let date = new Date();
  let cleanText = text;

  const midnight = (d: Date) => {
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return midnight(d);
  };

  const strip = (pattern: RegExp) => {
    cleanText = cleanText.replace(pattern, ' ').replace(/\s{2,}/g, ' ').trim();
  };

  if (/\bontem\b/.test(lower)) {
    date = daysAgo(1);
    strip(/\bontem\b/i);
    return { date, cleanText };
  }

  if (/\banteontem\b/.test(lower)) {
    date = daysAgo(2);
    strip(/\banteontem\b/i);
    return { date, cleanText };
  }

  for (const [word, weekday] of Object.entries(WEEKDAY_MAP)) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      const today = new Date();
      const todayWeekday = today.getDay();
      let diff = todayWeekday - weekday;
      if (diff <= 0) diff += 7;
      date = daysAgo(diff);
      strip(regex);
      return { date, cleanText };
    }
  }

  const diaMatch = lower.match(/\bdia\s+(\d{1,2})\b/);
  if (diaMatch) {
    date = resolveDay(parseInt(diaMatch[1]));
    strip(/\bdia\s+\d{1,2}\b/i);
    return { date, cleanText };
  }

  const fullDateMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (fullDateMatch) {
    let year = parseInt(fullDateMatch[3]);
    if (year < 100) year += 2000;
    const month = parseInt(fullDateMatch[2]) - 1;
    const day = parseInt(fullDateMatch[1]);
    const parsed = new Date(year, month, day);
    date = ensurePast(parsed);
    strip(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
    return { date, cleanText };
  }

  const shortDateMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (shortDateMatch) {
    const month = parseInt(shortDateMatch[2]) - 1;
    const day = parseInt(shortDateMatch[1]);
    const parsed = new Date(new Date().getFullYear(), month, day);
    date = ensurePast(parsed);
    strip(/\b\d{1,2}\/\d{1,2}\b/);
    return { date, cleanText };
  }

  return { date: midnight(new Date()), cleanText };
}

function resolveDay(day: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attempt = new Date(today.getFullYear(), today.getMonth(), day);
  if (attempt > today) {
    attempt.setMonth(attempt.getMonth() - 1);
  }
  return attempt;
}

function ensurePast(d: Date): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d > today) {
    d.setFullYear(d.getFullYear() - 1);
  }
  return d;
}

export function formatDateLabel(date: Date): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - d.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return null;
  if (diffDays === 1) return 'ontem';
  if (diffDays === 2) return 'anteontem';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

// ─── Message Parser ───────────────────────────────────────────────────────────

export function parseMessage(text: string, userMappings?: Record<string, string>): ParsedMessage {
  const trimmed = text.trim();

  if (trimmed.startsWith('/')) {
    return {
      type: 'command',
      data: { command: trimmed.substring(1).toLowerCase() }
    };
  }

  return parseIntent(trimmed, userMappings);
}

function normalizeWord(w: string): string {
  return w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseIntent(text: string, userMappings?: Record<string, string>): ParsedMessage {
  // 1. Extrai data
  const { date, cleanText } = parseDate(text);

  // 2. Detecta tipo pela primeira palavra (verbo)
  const firstWord = normalizeWord(cleanText.split(/\s+/)[0] || '');
  const isIncome = INCOME_VERBS.has(firstWord);
  const isSaving = SAVING_VERBS.has(firstWord);
  const isWithdrawal = WITHDRAWAL_VERBS.has(firstWord);

  // 3. Procura valor
  const valueMatch = cleanText.match(/\d+([.,]\d{1,2})?/);
  if (!valueMatch) return { type: 'unknown' };

  const value = parseFloat(valueMatch[0].replace(',', '.'));

  // 4. Remove valor do texto
  const textWithoutValue = cleanText.replace(valueMatch[0], '').trim();

  // 5. Filtra palavras — remove todos os verbos conhecidos e noise words
  const allVerbs = new Set([...EXPENSE_VERBS, ...INCOME_VERBS, ...SAVING_VERBS, ...WITHDRAWAL_VERBS]);
  const words = textWithoutValue
    .split(/\s+/)
    .filter(w => w.length > 0)
    .filter(w => !allVerbs.has(normalizeWord(w)))
    .filter(w => !NOISE_WORDS.has(normalizeWord(w)));

  // ── Guardado ────────────────────────────────────────────────────────────────
  if (isSaving) {
    const savingName = words.join(' ').trim();
    if (!savingName) return { type: 'unknown' };
    return {
      type: 'saving',
      data: { value, savingName, date }
    };
  }

  // ── Retirada ────────────────────────────────────────────────────────────────
  if (isWithdrawal) {
    const savingName = words.join(' ').trim();
    if (!savingName) return { type: 'unknown' };
    return {
      type: 'withdrawal',
      data: { value, savingName, date }
    };
  }

  // ── Entrada ─────────────────────────────────────────────────────────────────
  if (isIncome) {
    let category = 'outros';
    let keyword = '';

    for (const word of words) {
      const found = findIncomeCategory(word);
      if (found) {
        category = found;
        keyword = word.toLowerCase();
        break;
      }
    }

    if (!keyword) keyword = words[0]?.toLowerCase() || 'outros';
    const description = words.join(' ') || 'entrada';

    return {
      type: 'income',
      data: { value, keyword, description, category, date }
    };
  }

  // ── Gasto (verbo de gasto ou sem verbo) ─────────────────────────────────────
  const description = words.join(' ') || textWithoutValue || 'gasto';

  let category: string | null = null;
  let keyword = '';

  for (const word of words) {
    const found = findCategory(word, userMappings);
    if (found) {
      category = found;
      keyword = word.toLowerCase();
      break;
    }
  }

  if (!category) {
    category = 'outros';
    keyword = words[0]?.toLowerCase() || 'outros';
  }

  return {
    type: 'transaction',
    data: {
      value,
      keyword,
      description,
      category,
      date,
      needsCategory: false
    }
  };
}