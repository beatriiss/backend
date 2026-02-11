export interface ParsedMessage {
  type: 'transaction' | 'command' | 'unknown';
  data?: any;
}

export function parseMessage(text: string): ParsedMessage {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Comandos com /
  if (trimmed.startsWith('/')) {
    return {
      type: 'command',
      data: { command: trimmed.substring(1).toLowerCase() }
    };
  }

  // Tenta parsear como transação
  return parseTransaction(trimmed);
}

function parseTransaction(text: string): ParsedMessage {
  // Regex pra encontrar valores: 35, 35.50, 35,50, R$ 35
  const valueMatch = text.match(/\d+([.,]\d{1,2})?/);
  
  if (!valueMatch) {
    return { type: 'unknown' };
  }

  // Converte valor
  const value = parseFloat(valueMatch[0].replace(',', '.'));
  
  // Remove o valor do texto pra pegar o resto
  const textWithoutValue = text.replace(valueMatch[0], '').trim();
  
  // Pega primeira palavra como categoria (ou usa o texto todo se só tiver uma palavra)
  const words = textWithoutValue.split(/\s+/).filter(w => w.length > 0);
  const category = words[0]?.toLowerCase() || 'outros';
  
  // Descrição é o texto original
  const description = textWithoutValue || category;

  return {
    type: 'transaction',
    data: {
      value,
      category,
      description
    }
  };
}