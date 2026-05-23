import { findCategory } from './categoryMapper.js';

export interface ParsedMessage {
  type: 'transaction' | 'command' | 'unknown';
  data?: any;
}

export function parseMessage(text: string, userMappings?: Record<string, string>): ParsedMessage {
  const trimmed = text.trim();

  // Comandos com /
  if (trimmed.startsWith('/')) {
    return {
      type: 'command',
      data: { command: trimmed.substring(1).toLowerCase() }
    };
  }

  // Tenta parsear como transação
  return parseTransaction(trimmed, userMappings);
}

function parseTransaction(text: string, userMappings?: Record<string, string>): ParsedMessage {
  // Regex pra encontrar valores: 35, 35.50, 35,50, R$ 35
  const valueMatch = text.match(/\d+([.,]\d{1,2})?/);
  
  if (!valueMatch) {
    return { type: 'unknown' };
  }

  // Converte valor
  const value = parseFloat(valueMatch[0].replace(',', '.'));
  
  // Remove o valor do texto pra pegar o resto
  const textWithoutValue = text.replace(valueMatch[0], '').trim();
  
  // Pega primeira palavra como keyword
  const words = textWithoutValue.split(/\s+/).filter(w => w.length > 0);
  const keyword = words[0]?.toLowerCase() || 'outros';
  
  // Descrição é o texto sem o valor
  const description = textWithoutValue || keyword;
  
  // Tenta encontrar categoria
  const category = findCategory(keyword, userMappings);

  return {
    type: 'transaction',
    data: {
      value,
      keyword,
      description,
      category, // pode ser null se não encontrou
      needsCategory: category === null
    }
  };
}