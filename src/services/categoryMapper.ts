// ─── Mapa de categorias de GASTOS ────────────────────────────────────────────

export const DEFAULT_CATEGORY_MAP: Record<string, string> = {
  // Transporte
  'uber': 'transporte',
  '99': 'transporte',
  'taxi': 'transporte',
  'onibus': 'transporte',
  'ônibus': 'transporte',
  'metro': 'transporte',
  'metrô': 'transporte',
  'gasolina': 'transporte',
  'combustivel': 'transporte',
  'combustível': 'transporte',
  'estacionamento': 'transporte',
  'pedagio': 'transporte',
  'pedágio': 'transporte',
  'passagem': 'transporte',
  'carro': 'transporte',
  'moto': 'transporte',

  // Alimentação
  'almoco': 'alimentação',
  'almoço': 'alimentação',
  'jantar': 'alimentação',
  'cafe': 'alimentação',
  'café': 'alimentação',
  'lanche': 'alimentação',
  'pizza': 'alimentação',
  'hamburguer': 'alimentação',
  'hamburger': 'alimentação',
  'torta': 'alimentação',
  'pastel': 'alimentação',
  'sanduiche': 'alimentação',
  'sanduíche': 'alimentação',
  'restaurante': 'alimentação',
  'ifood': 'alimentação',
  'rappi': 'alimentação',
  'marmita': 'alimentação',
  'comida': 'alimentação',
  'salgado': 'alimentação',
  'doce': 'alimentação',
  'sobremesa': 'alimentação',
  'sorvete': 'alimentação',
  'acai': 'alimentação',
  'açai': 'alimentação',
  'sushi': 'alimentação',
  'japonês': 'alimentação',
  'japones': 'alimentação',
  'churrasco': 'alimentação',
  'churrascaria': 'alimentação',

  // Mercado
  'mercado': 'mercado',
  'supermercado': 'mercado',
  'feira': 'mercado',
  'padaria': 'mercado',
  'açougue': 'mercado',
  'acougue': 'mercado',
  'hortifruti': 'mercado',
  'compras': 'mercado',
  'sacolao': 'mercado',
  'sacolão': 'mercado',

  // Saúde
  'farmacia': 'saúde',
  'farmácia': 'saúde',
  'remedio': 'saúde',
  'remédio': 'saúde',
  'consulta': 'saúde',
  'medico': 'saúde',
  'médico': 'saúde',
  'dentista': 'saúde',
  'exame': 'saúde',
  'hospital': 'saúde',
  'clinica': 'saúde',
  'clínica': 'saúde',
  'psicólogo': 'saúde',
  'psicologo': 'saúde',
  'terapeuta': 'saúde',

  // Moradia
  'aluguel': 'moradia',
  'condominio': 'moradia',
  'condomínio': 'moradia',
  'luz': 'moradia',
  'energia': 'moradia',
  'agua': 'moradia',
  'água': 'moradia',
  'internet': 'moradia',
  'gas': 'moradia',
  'gás': 'moradia',
  'iptu': 'moradia',
  'reforma': 'moradia',
  'conserto': 'moradia',

  // Vestuário
  'roupa': 'vestuário',
  'sapato': 'vestuário',
  'tenis': 'vestuário',
  'tênis': 'vestuário',
  'camisa': 'vestuário',
  'calca': 'vestuário',
  'calça': 'vestuário',
  'blusa': 'vestuário',
  'vestido': 'vestuário',
  'short': 'vestuário',
  'bermuda': 'vestuário',

  // Lazer
  'cinema': 'lazer',
  'show': 'lazer',
  'bar': 'lazer',
  'balada': 'lazer',
  'netflix': 'lazer',
  'spotify': 'lazer',
  'jogo': 'lazer',
  'game': 'lazer',
  'viagem': 'lazer',
  'passeio': 'lazer',
  'parque': 'lazer',
  'diversão': 'lazer',
  'diversao': 'lazer',

  // Educação
  'curso': 'educação',
  'livro': 'educação',
  'faculdade': 'educação',
  'mensalidade': 'educação',
  'escola': 'educação',
  'material': 'educação',
  'aula': 'educação',

  // Trabalho
  'escritorio': 'trabalho',
  'escritório': 'trabalho',
  'equipamento': 'trabalho',
  'ferramenta': 'trabalho',
  'notebook': 'trabalho',
  'impressora': 'trabalho',
};

// ─── Mapa de categorias de ENTRADAS ──────────────────────────────────────────

export const INCOME_CATEGORY_MAP: Record<string, string> = {
  // Salário
  'salario': 'salário',
  'salário': 'salário',
  'pagamento': 'salário',
  'contra-cheque': 'salário',
  'contracheque': 'salário',
  'quinzena': 'salário',
  'holerite': 'salário',

  // Freelance
  'freelance': 'freelance',
  'freela': 'freelance',
  'freelas': 'freelance',
  'trampo': 'freelance',
  'bico': 'freelance',
  'servico': 'freelance',
  'serviço': 'freelance',
  'projeto': 'freelance',

  // Bolsa
  'bolsa': 'bolsa',
  'auxilio': 'bolsa',
  'auxílio': 'bolsa',
  'bolsista': 'bolsa',
  'capes': 'bolsa',
  'cnpq': 'bolsa',
  'fapesp': 'bolsa',
  'estagio': 'bolsa',
  'estágio': 'bolsa',

  // Aluguel recebido
  'aluguel': 'aluguel recebido',
  'locacao': 'aluguel recebido',
  'locação': 'aluguel recebido',
  'inquilino': 'aluguel recebido',

  // Investimento resgatado
  'resgate': 'investimento resgatado',
  'retirada': 'investimento resgatado',
  'dividendo': 'investimento resgatado',
  'dividendos': 'investimento resgatado',
  'rendimento': 'investimento resgatado',
  'lucro': 'investimento resgatado',
};

// ─── Verbos de introdução de GASTOS ──────────────────────────────────────────

export const EXPENSE_VERBS = new Set([
  'gastei', 'gasto', 'gastar',
  'paguei', 'pago', 'pagar',
  'comprei', 'compro', 'comprar',
  'custou', 'custa',
  'deu', 'saiu',
  'usei', 'uso',
  'precisei', 'preciso',
]);

// ─── Verbos de ENTRADA ────────────────────────────────────────────────────────

export const INCOME_VERBS = new Set([
  'recebi', 'recebo', 'receber',
  'entrou', 'caiu',
  'ganhei', 'ganho', 'ganhar',
  'depositaram', 'depositou',
  'transferiram', 'transferiu',
  'pagaram', 'pagou',
]);

// ─── Noise words ──────────────────────────────────────────────────────────────

export const NOISE_WORDS = new Set([
  'no', 'na', 'nos', 'nas',
  'o', 'a', 'os', 'as',
  'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das',
  'em', 'com', 'por', 'para', 'pra',
  'reais', 'real', 'reis',
  'hoje', 'agora', 'meu', 'minha',
]);

// ─── Categorias de GASTOS ─────────────────────────────────────────────────────

export const DEFAULT_CATEGORIES = [
  { emoji: '🚎', name: 'transporte' },
  { emoji: '🍔', name: 'alimentação' },
  { emoji: '🛒', name: 'mercado' },
  { emoji: '🏥', name: 'saúde' },
  { emoji: '🏠', name: 'moradia' },
  { emoji: '👕', name: 'vestuário' },
  { emoji: '🎮', name: 'lazer' },
  { emoji: '📚', name: 'educação' },
  { emoji: '💼', name: 'trabalho' },
  { emoji: '💵', name: 'outros' },
];

// ─── Categorias de ENTRADAS ───────────────────────────────────────────────────

export const INCOME_CATEGORIES = [
  { emoji: '💼', name: 'salário' },
  { emoji: '💻', name: 'freelance' },
  { emoji: '🎓', name: 'bolsa' },
  { emoji: '🏠', name: 'aluguel recebido' },
  { emoji: '📈', name: 'investimento resgatado' },
  { emoji: '💵', name: 'outros' },
];

// ─── Helper: capitaliza primeira letra ───────────────────────────────────────

export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getCategoryEmoji(category: string): string {
  const expense = DEFAULT_CATEGORIES.find(c => c.name === category);
  if (expense) return expense.emoji;
  const income = INCOME_CATEGORIES.find(c => c.name === category);
  return income?.emoji || '💵';
}

export function getIncomeCategoryEmoji(category: string): string {
  const found = INCOME_CATEGORIES.find(c => c.name === category);
  return found?.emoji || '💵';
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function findCategory(keyword: string, userMappings?: Record<string, string>): string | null {
  const normalized = normalizeText(keyword);
  const lower = keyword.toLowerCase().trim();

  if (DEFAULT_CATEGORY_MAP[normalized]) return DEFAULT_CATEGORY_MAP[normalized];
  if (DEFAULT_CATEGORY_MAP[lower]) return DEFAULT_CATEGORY_MAP[lower];

  for (const [key, category] of Object.entries(DEFAULT_CATEGORY_MAP)) {
    const normalizedKey = normalizeText(key);
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return category;
    }
  }

  if (userMappings) {
    if (userMappings[normalized]) return userMappings[normalized];
    if (userMappings[lower]) return userMappings[lower];
  }

  return null;
}

export function findIncomeCategory(keyword: string): string | null {
  const normalized = normalizeText(keyword);
  const lower = keyword.toLowerCase().trim();

  if (INCOME_CATEGORY_MAP[normalized]) return INCOME_CATEGORY_MAP[normalized];
  if (INCOME_CATEGORY_MAP[lower]) return INCOME_CATEGORY_MAP[lower];

  for (const [key, category] of Object.entries(INCOME_CATEGORY_MAP)) {
    const normalizedKey = normalizeText(key);
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return category;
    }
  }

  return null;
}

export function formatCategoryOptions(): string {
  let message = '🤔 Em qual categoria fica esse gasto?\n\n';

  DEFAULT_CATEGORIES.forEach((cat, index) => {
    if (cat.name !== 'outros') {
      message += `${index + 1}. ${cat.emoji} ${capitalize(cat.name)}\n`;
    }
  });

  message += `${DEFAULT_CATEGORIES.length}. 🖉 Criar nova categoria\n\n`;
  message += `Responda com o número (1-${DEFAULT_CATEGORIES.length})`;

  return message;
}

export function getCategoryByNumber(number: number): string | null {
  if (number < 1 || number > DEFAULT_CATEGORIES.length) return null;
  return DEFAULT_CATEGORIES[number - 1].name;
}