import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  proto,
  WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import User from '../models/User.js';
import { parseMessage } from './messageParser.js';
import {
  handleTransaction,
  handleListCommand,
  handleTodayCommand,
  handleHelpCommand
} from '../controllers/transactionCOntroller.js';
import { handleNameRegistration } from '../controllers/userController.js';
import {
  getOrCreateSession,
  savePendingTransaction
} from './sessionService.js';

let sock: WASocket | null = null;

export async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Finance Bot', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 ESCANEIE O QR CODE:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      qrcode.generate(qr, { small: true });
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso!');
      console.log('🤖 Bot está rodando...\n');
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log('❌ Conexão fechada.');

      if (shouldReconnect) {
        console.log('🔄 Reconectando...');
        await startWhatsApp();
      } else {
        console.log('🚪 Deslogado. Delete "auth_info" e rode novamente.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const message of messages) {
      await handleIncomingMessage(message);
    }
  });

  return sock;
}

async function handleIncomingMessage(msg: proto.IWebMessageInfo) {
  // Validações básicas
  if (!msg.message || !msg.key.remoteJid) return;
  if (msg.key.fromMe) return;
  if (msg.key.remoteJid.includes('@g.us')) return;
  if (msg.key.remoteJid === 'status@broadcast') return;

  const from = msg.key.remoteJid;
  const phoneNumber = from.split('@')[0];

  // Extrai texto
  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    '';

  if (!text.trim()) return;

  console.log(`\n📩 [${phoneNumber}]: "${text}"`);

  try {
    // 1. Busca ou cria usuário
    let user = await User.findOne({ phoneNumber });

    if (!user) {
      // NOVO USUÁRIO
      console.log(`✨ Novo usuário detectado: ${phoneNumber}`);

      user = await User.create({
        phoneNumber,
        status: 'pending_name'
      });

      // Cria sessão
      await getOrCreateSession(phoneNumber, user._id);

      // Parseia mensagem pra ver se é um gasto
      const parsed = parseMessage(text);

      if (parsed.type === 'transaction') {
        // É um gasto! Salva como pendente
        console.log('💾 Salvando transação pendente...');
        await savePendingTransaction(phoneNumber, {
          ...parsed.data,
          originalMessage: text
        });

        await sendMessage(
          from,
          '👋 Olá! Seja bem-vindo ao Bot de Finanças!\n\n' +
            'Vi que você já quer registrar um gasto. Ótimo!\n\n' +
            'Mas primeiro, *qual é o seu nome?*'
        );
      } else {
        // Não é gasto, só pede nome
        await sendMessage(
          from,
          '👋 Olá! Seja bem-vindo ao Bot de Finanças!\n\n' +
            'Para começar, *qual é o seu nome?*'
        );
      }

      return;
    }

    // 2. USUÁRIO EXISTE - Verifica status
    if (user.status === 'pending_name') {
      // Aguardando nome
      console.log('📝 Processando nome...');
      await handleNameRegistration(from, user, text);
      return;
    }

    // 3. USUÁRIO ATIVO - Fluxo normal
    const parsed = parseMessage(text);

    if (parsed.type === 'command') {
      const { command } = parsed.data;

      if (command === 'ultimos' || command === 'lista') {
        await handleListCommand(from, user);
      } else if (command === 'hoje') {
        await handleTodayCommand(from, user);
      } else if (command === 'ajuda' || command === 'help') {
        await handleHelpCommand(from);
      } else {
        await sendMessage(from, '❓ Comando não reconhecido. Use /ajuda');
      }
    } else if (parsed.type === 'transaction') {
      await handleTransaction(from, user, parsed);
    } else {
      await sendMessage(from, '❓ Não entendi. Use /ajuda pra ver os comandos.');
    }
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    await sendMessage(from, '❌ Erro ao processar. Tente novamente.');
  }
}

export async function sendMessage(to: string, text: string) {
  if (!sock) {
    throw new Error('WhatsApp não conectado!');
  }

  await sock.sendMessage(to, { text });
  console.log(`✅ Resposta enviada`);
}

export function getWhatsAppInstance() {
  return sock;
}