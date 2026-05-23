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

export const DEFAULT_CATEGORIES = [
  { emoji: '🚗', name: 'transporte' },
  { emoji: '🍔', name: 'alimentação' },
  { emoji: '🛒', name: 'mercado' },
  { emoji: '💊', name: 'saúde' },
  { emoji: '🏠', name: 'moradia' },
  { emoji: '👕', name: 'vestuário' },
  { emoji: '🎮', name: 'lazer' },
  { emoji: '📚', name: 'educação' },
  { emoji: '💼', name: 'trabalho' },
  { emoji: '💰', name: 'outros' },
];

export function getCategoryEmoji(category: string): string {
  const found = DEFAULT_CATEGORIES.find(c => c.name === category);
  return found?.emoji || '💰';
}

// NOVA FUNÇÃO: Normaliza texto removendo acentos
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
}

export function findCategory(keyword: string, userMappings?: Record<string, string>): string | null {
  const normalized = normalizeText(keyword);
  
  // 1. Tenta no dicionário padrão (match exato)
  if (DEFAULT_CATEGORY_MAP[normalized]) {
    return DEFAULT_CATEGORY_MAP[normalized];
  }
  
  // Também tenta com a palavra original (case insensitive)
  const lower = keyword.toLowerCase().trim();
  if (DEFAULT_CATEGORY_MAP[lower]) {
    return DEFAULT_CATEGORY_MAP[lower];
  }
  
  // 2. Tenta no dicionário padrão (palavra contida)
  for (const [key, category] of Object.entries(DEFAULT_CATEGORY_MAP)) {
    const normalizedKey = normalizeText(key);
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return category;
    }
  }
  
  // 3. Tenta nos mapeamentos do usuário (NORMALIZADO)
  if (userMappings) {
    // Procura com texto normalizado
    if (userMappings[normalized]) {
      return userMappings[normalized];
    }
    
    // Também tenta com texto original
    if (userMappings[lower]) {
      return userMappings[lower];
    }
  }
  
  // Não encontrou
  return null;
}

export function formatCategoryOptions(): string {
  let message = '🤔 Em qual categoria fica esse gasto?\n\n';
  
  DEFAULT_CATEGORIES.forEach((cat, index) => {
    if (cat.name !== 'outros') {
      message += `${index + 1}️⃣ ${cat.emoji} ${cat.name}\n`;
    }
  });
  
  message += `${DEFAULT_CATEGORIES.length}️⃣ ✏️ criar nova categoria\n\n`;
  message += `Responda com o número (1-${DEFAULT_CATEGORIES.length})`;
  
  return message;
}

export function getCategoryByNumber(number: number): string | null {
  if (number < 1 || number > DEFAULT_CATEGORIES.length) {
    return null;
  }
  
  return DEFAULT_CATEGORIES[number - 1].name;
}