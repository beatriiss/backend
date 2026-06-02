import { parseMessage, parseDate, formatDateLabel } from '../services/messageParser.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  test('sem data → retorna hoje', () => {
    const { date } = parseDate('almoço 35');
    expect(sameDay(date, todayMidnight())).toBe(true);
  });

  test('"ontem" → retorna ontem', () => {
    const { date } = parseDate('uber 25 ontem');
    expect(sameDay(date, daysAgo(1))).toBe(true);
  });

  test('"anteontem" → retorna 2 dias atrás', () => {
    const { date } = parseDate('mercado 50 anteontem');
    expect(sameDay(date, daysAgo(2))).toBe(true);
  });

  test('"ontem" remove o trecho do cleanText', () => {
    const { cleanText } = parseDate('uber 25 ontem');
    expect(cleanText.toLowerCase()).not.toContain('ontem');
  });

  test('"dia 20" → nunca retorna data futura', () => {
    const { date } = parseDate('mercado 100 dia 20');
    expect(date <= todayMidnight()).toBe(true);
  });

  test('"20/05" → nunca retorna data futura', () => {
    const { date } = parseDate('almoço 35 20/05');
    expect(date <= todayMidnight()).toBe(true);
  });

  test('dia da semana → nunca retorna data futura', () => {
    const days = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
    for (const day of days) {
      const { date } = parseDate(`uber 25 ${day}`);
      expect(date <= todayMidnight()).toBe(true);
    }
  });
});

// ─── formatDateLabel ──────────────────────────────────────────────────────────

describe('formatDateLabel', () => {
  test('hoje → retorna null', () => {
    expect(formatDateLabel(todayMidnight())).toBeNull();
  });

  test('ontem → retorna "ontem"', () => {
    expect(formatDateLabel(daysAgo(1))).toBe('ontem');
  });

  test('anteontem → retorna "anteontem"', () => {
    expect(formatDateLabel(daysAgo(2))).toBe('anteontem');
  });

  test('3 dias atrás → retorna dd/mm', () => {
    const d = daysAgo(3);
    const label = formatDateLabel(d);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    expect(label).toBe(`${dd}/${mm}`);
  });
});

// ─── parseMessage — comandos ──────────────────────────────────────────────────

describe('parseMessage — comandos', () => {
  test('/hoje → command', () => {
    const result = parseMessage('/hoje');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('hoje');
  });

  test('/resumo → command', () => {
    const result = parseMessage('/resumo');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('resumo');
  });

  test('/entradas → command', () => {
    const result = parseMessage('/entradas');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('entradas');
  });

  test('/mudar → command', () => {
    const result = parseMessage('/mudar');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('mudar');
  });

  test('/apagar uber → command', () => {
    const result = parseMessage('/apagar uber');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('apagar uber');
  });

  test('/editar → command', () => {
    const result = parseMessage('/editar');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('editar');
  });

  test('/saldo → command', () => {
    const result = parseMessage('/saldo');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('saldo');
  });

  test('/viagem floripa → command', () => {
    const result = parseMessage('/viagem floripa');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('viagem floripa');
  });

  test('/viagens → command', () => {
    const result = parseMessage('/viagens');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('viagens');
  });

  test('/encerrar floripa → command', () => {
    const result = parseMessage('/encerrar floripa');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('encerrar floripa');
  });

  test('/role show → command', () => {
    const result = parseMessage('/role show');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('role show');
  });

  test('/passeio parque → command', () => {
    const result = parseMessage('/passeio parque');
    expect(result.type).toBe('command');
    expect(result.data.command).toBe('passeio parque');
  });
});

// ─── parseMessage — transações simples ───────────────────────────────────────

describe('parseMessage — transações simples', () => {
  test('"uber 25" → transporte', () => {
    const result = parseMessage('uber 25');
    expect(result.type).toBe('transaction');
    expect(result.data.value).toBe(25);
    expect(result.data.category).toBe('transporte');
  });

  test('"almoço 35" → alimentação', () => {
    const result = parseMessage('almoço 35');
    expect(result.type).toBe('transaction');
    expect(result.data.value).toBe(35);
    expect(result.data.category).toBe('alimentação');
  });

  test('"mercado 250.50" → mercado', () => {
    const result = parseMessage('mercado 250.50');
    expect(result.type).toBe('transaction');
    expect(result.data.value).toBe(250.50);
    expect(result.data.category).toBe('mercado');
  });

  test('"farmácia 45" → saúde', () => {
    const result = parseMessage('farmácia 45');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('saúde');
  });

  test('"netflix 45" → lazer', () => {
    const result = parseMessage('netflix 45');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('lazer');
  });

  test('valor com vírgula "35,50"', () => {
    const result = parseMessage('almoço 35,50');
    expect(result.type).toBe('transaction');
    expect(result.data.value).toBe(35.50);
  });

  test('sem tag → tripTag null', () => {
    const result = parseMessage('uber 25');
    expect(result.type).toBe('transaction');
    expect(result.data.tripTag).toBeNull();
  });
});

// ─── parseMessage — verbos de gasto ──────────────────────────────────────────

describe('parseMessage — verbos de gasto', () => {
  test('"gastei 30 reais" → outros', () => {
    const result = parseMessage('gastei 30 reais');
    expect(result.type).toBe('transaction');
    expect(result.data.value).toBe(30);
    expect(result.data.category).toBe('outros');
  });

  test('"paguei 50" → outros', () => {
    const result = parseMessage('paguei 50');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('outros');
  });

  test('"comprei no mercado 50" → mercado', () => {
    const result = parseMessage('comprei no mercado 50');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('mercado');
  });

  test('"gastei no uber 25" → transporte', () => {
    const result = parseMessage('gastei no uber 25');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('transporte');
  });

  test('"paguei a farmácia 80" → saúde', () => {
    const result = parseMessage('paguei a farmácia 80');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('saúde');
  });

  test('needsCategory sempre false', () => {
    const result = parseMessage('qualquer coisa 99');
    expect(result.type).toBe('transaction');
    expect(result.data.needsCategory).toBe(false);
  });
});

// ─── parseMessage — entradas ──────────────────────────────────────────────────

describe('parseMessage — entradas', () => {
  test('"recebi 6000 salário" → income salário', () => {
    const result = parseMessage('recebi 6000 salário');
    expect(result.type).toBe('income');
    expect(result.data.value).toBe(6000);
    expect(result.data.category).toBe('salário');
  });

  test('"recebi 700 bolsa" → income bolsa', () => {
    const result = parseMessage('recebi 700 bolsa');
    expect(result.type).toBe('income');
    expect(result.data.value).toBe(700);
    expect(result.data.category).toBe('bolsa');
  });

  test('"caiu 500 freela" → income freelance', () => {
    const result = parseMessage('caiu 500 freela');
    expect(result.type).toBe('income');
    expect(result.data.category).toBe('freelance');
  });

  test('"ganhei 1200 freela" → income freelance', () => {
    const result = parseMessage('ganhei 1200 freela');
    expect(result.type).toBe('income');
    expect(result.data.category).toBe('freelance');
  });

  test('"recebi 800" → income outros (sem keyword)', () => {
    const result = parseMessage('recebi 800');
    expect(result.type).toBe('income');
    expect(result.data.category).toBe('outros');
  });

  test('"recebi 6000 salário ontem" → income + data ontem', () => {
    const result = parseMessage('recebi 6000 salário ontem');
    expect(result.type).toBe('income');
    expect(result.data.value).toBe(6000);
    expect(result.data.category).toBe('salário');
    const yesterday = daysAgo(1);
    expect(sameDay(result.data.date, yesterday)).toBe(true);
  });

  test('"entrou 300 aluguel" → income aluguel recebido', () => {
    const result = parseMessage('entrou 300 aluguel');
    expect(result.type).toBe('income');
    expect(result.data.category).toBe('aluguel recebido');
  });
});

// ─── parseMessage — datas combinadas ─────────────────────────────────────────

describe('parseMessage — datas combinadas', () => {
  test('"almoço 35 ontem" → data ontem', () => {
    const result = parseMessage('almoço 35 ontem');
    expect(result.type).toBe('transaction');
    expect(sameDay(result.data.date, daysAgo(1))).toBe(true);
  });

  test('"uber 25 sexta" → data passada', () => {
    const result = parseMessage('uber 25 sexta');
    expect(result.type).toBe('transaction');
    expect(result.data.date <= todayMidnight()).toBe(true);
  });

  test('"gastei 30 reais ontem" → outros + data ontem', () => {
    const result = parseMessage('gastei 30 reais ontem');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('outros');
    expect(sameDay(result.data.date, daysAgo(1))).toBe(true);
  });

  test('"mercado 100 dia 20" → mercado + data passada', () => {
    const result = parseMessage('mercado 100 dia 20');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('mercado');
    expect(result.data.date <= todayMidnight()).toBe(true);
  });
});

// ─── parseMessage — mapeamentos do usuário ────────────────────────────────────

describe('parseMessage — mapeamentos do usuário', () => {
  const userMappings = { academia: 'saúde', pet: 'outros' };

  test('keyword mapeada pelo usuário → categoria correta', () => {
    const result = parseMessage('academia 120', userMappings);
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('saúde');
  });

  test('keyword "pet" mapeada → outros', () => {
    const result = parseMessage('pet 80', userMappings);
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('outros');
  });
});

// ─── parseMessage — tag de viagem (#) ────────────────────────────────────────

describe('parseMessage — tag de viagem', () => {
  test('"almoço 35 #floripa" → extrai tripTag', () => {
    const result = parseMessage('almoço 35 #floripa');
    expect(result.type).toBe('transaction');
    expect(result.data.tripTag).toBe('floripa');
  });

  test('"almoço 35 #floripa" → categoria alimentação preservada', () => {
    const result = parseMessage('almoço 35 #floripa');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('alimentação');
    expect(result.data.value).toBe(35);
  });

  test('"uber 25 #floripa" → categoria transporte + tag floripa', () => {
    const result = parseMessage('uber 25 #floripa');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('transporte');
    expect(result.data.tripTag).toBe('floripa');
  });

  test('tag no início da mensagem → funciona', () => {
    const result = parseMessage('#floripa almoço 35');
    expect(result.type).toBe('transaction');
    expect(result.data.tripTag).toBe('floripa');
    expect(result.data.value).toBe(35);
  });

  test('tag com acento → preserva', () => {
    const result = parseMessage('almoço 35 #são paulo');
    expect(result.type).toBe('transaction');
    expect(result.data.tripTag).not.toBeNull();
  });

  test('"almoço 35 #floripa ontem" → tag + data ontem', () => {
    const result = parseMessage('almoço 35 #floripa ontem');
    expect(result.type).toBe('transaction');
    expect(result.data.tripTag).toBe('floripa');
    expect(sameDay(result.data.date, daysAgo(1))).toBe(true);
  });

  test('"mercado 150 #viagem dia 20" → tag + data passada', () => {
    const result = parseMessage('mercado 150 #viagem dia 20');
    expect(result.type).toBe('transaction');
    expect(result.data.tripTag).toBe('viagem');
    expect(result.data.date <= todayMidnight()).toBe(true);
  });

  test('tag não afeta o valor', () => {
    const result = parseMessage('cinema 60 #aniversario');
    expect(result.type).toBe('transaction');
    expect(result.data.value).toBe(60);
    expect(result.data.tripTag).toBe('aniversario');
  });

  test('tag não afeta categorização', () => {
    const result = parseMessage('farmácia 45 #floripa');
    expect(result.type).toBe('transaction');
    expect(result.data.category).toBe('saúde');
    expect(result.data.tripTag).toBe('floripa');
  });

  test('sem # → tripTag null', () => {
    const result = parseMessage('almoço 35');
    expect(result.type).toBe('transaction');
    expect(result.data.tripTag).toBeNull();
  });

  test('tag não aparece na descrição final', () => {
    const result = parseMessage('almoço 35 #floripa');
    expect(result.type).toBe('transaction');
    expect(result.data.description).not.toContain('#floripa');
  });
});

// ─── parseMessage — desconhecido ──────────────────────────────────────────────

describe('parseMessage — desconhecido', () => {
  test('mensagem sem número → unknown', () => {
    const result = parseMessage('oi tudo bem');
    expect(result.type).toBe('unknown');
  });

  test('texto vazio → unknown', () => {
    const result = parseMessage('   ');
    expect(result.type).toBe('unknown');
  });
});