import { IUser } from '../models/User.js';
import User from '../models/User.js';
import { sendMessage } from '../services/whatsapp.js';
import {
  getPendingTransaction,
  clearSession
} from '../services/sessionService.js';
import { parseMessage } from '../services/messageParser.js';
import { handleTransaction } from './transactionCOntroller.js';

export async function handleNameRegistration(
  from: string,
  user: IUser,
  name: string
) {
  try {
    // Valida nome (não pode ser muito curto ou comando)
    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      await sendMessage(
        from,
        '❌ Nome muito curto. Por favor, digite seu nome completo.'
      );
      return;
    }

    if (trimmedName.startsWith('/')) {
      await sendMessage(
        from,
        '❌ Por favor, digite seu nome (não um comando).'
      );
      return;
    }

    // Atualiza user
    user.name = trimmedName;
    user.status = 'active';
    await user.save();

    console.log(`✨ Nome registrado: ${trimmedName}`);

    // Verifica se tinha transação pendente
    const phoneNumber = from.split('@')[0];
    const pendingTx = await getPendingTransaction(phoneNumber);

    if (pendingTx && pendingTx.originalMessage) {
      // Tinha mensagem pendente - processa agora
      await sendMessage(
        from,
        `✅ Prazer, ${trimmedName}!\n\nAgora vou processar seu gasto...`
      );

      // Processa a transação pendente
      const parsed = parseMessage(pendingTx.originalMessage);

      if (parsed.type === 'transaction') {
        await handleTransaction(from, user, parsed);
      }

      // Limpa sessão
      await clearSession(phoneNumber);
    } else {
      // Não tinha mensagem pendente - só boas vindas
      const welcomeMsg = `✅ Prazer, ${trimmedName}! 

🤖 Agora você pode registrar seus gastos.

📝 *Como usar:*
Digite: [descrição] [valor]

Exemplos:
- Almoço 35
- Uber 15.50
- Mercado 250

📊 *Comandos:*
/hoje - Gastos de hoje
/ultimos - Últimos 5 gastos
/ajuda - Ver todos os comandos`;

      await sendMessage(from, welcomeMsg);
    }
  } catch (error) {
    console.error('❌ Erro ao registrar nome:', error);
    await sendMessage(from, '❌ Erro ao salvar nome. Tente novamente.');
  }
}