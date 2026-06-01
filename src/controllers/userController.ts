import { IUser } from '../models/User.js';
import User from '../models/User.js';
import { sendMessage, sendDocument } from '../services/whatsapp.js';
import {
  getPendingTransaction,
  clearSession
} from '../services/sessionService.js';
import { parseMessage } from '../services/messageParser.js';
import { handleTransaction } from './transactionCOntroller.js';

const MANUAL_PATH = './manual_bot_financas.pdf';

export async function handleNameRegistration(
  from: string,
  user: IUser,
  name: string
) {
  try {
    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      await sendMessage(from, '❌ Nome muito curto. Por favor, digite seu nome completo.');
      return;
    }

    if (trimmedName.startsWith('/')) {
      await sendMessage(from, '❌ Por favor, digite seu nome (não um comando).');
      return;
    }

    user.name = trimmedName;
    user.status = 'active';
    await user.save();

    console.log(`✨ Nome registrado: ${trimmedName}`);

    const phoneNumber = from.split('@')[0];
    const pendingTx = await getPendingTransaction(phoneNumber);

    if (pendingTx && pendingTx.originalMessage) {
      await sendMessage(
        from,
        `🗸 Prazer, ${trimmedName}!\n\nAgora vou processar seu gasto...`
      );

      const parsed = parseMessage(pendingTx.originalMessage);
      if (parsed.type === 'transaction') {
        await handleTransaction(from, user, parsed);
      }

      await clearSession(phoneNumber);

    } else {
      const welcomeMsg =
        `🗸 Prazer, ${trimmedName}!\n\n` +
        `🤖 Agora você pode registrar seus gastos.\n\n` +
        `📝 *Como usar:*\n` +
        `Digite: [descrição] [valor]\n\n` +
        `Exemplos:\n` +
        `- Almoço 35\n` +
        `- Uber 15.50\n` +
        `- Recebi 6000 salário\n` +
        `- Guardei 500 caixinha viagem\n\n` +
        `📊 *Comandos:*\n` +
        `/hoje - Resumo do dia\n` +
        `/resumo - Resumo do mês\n` +
        `/guardados - Seus guardados\n` +
        `/ajuda - Ver todos os comandos\n\n` +
        `💡 Enviando o manual completo...`;

      await sendMessage(from, welcomeMsg);

      // Limpa sessão antes de enviar o manual
      await clearSession(phoneNumber);

      // Envia o manual em PDF
      try {
        await sendDocument(from, MANUAL_PATH, 'Manual do Bot de Financas.pdf');
      } catch (err) {
        console.warn('⚠️ Não foi possível enviar o manual:', err);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao registrar nome:', error);
    await sendMessage(from, '❌ Erro ao salvar nome. Tente novamente.');
  }
}