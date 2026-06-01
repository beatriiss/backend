import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import type { Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import { parseMessage } from './messageParser.js';
import {
  handleTransaction,
  handleListCommand,
  handleTodayCommand,
  handleHelpCommand,
  handleMudarCommand,
  handleEditChoice,
  handleDateEdit,
  handleResumoCommand,
  handleMesCommand,
  handleMesChoice
} from '../controllers/transactionCOntroller.js';
import { handleNameRegistration } from '../controllers/userController.js';
import {
  handleCategoryChoice,
  handleCategoryCreation,
  handleCategoryChange,
  handleListCategoriesCommand,
  handleListMappingsCommand,
  handleDeleteMappingCommand,
  askForCategory
} from '../controllers/categoryController.js';
import {
  handleIncome,
  handleIncomeListCommand
} from '../controllers/incomeController.js';
import {
  handleSavingMessage,
  handleSavingRateChoice,
  handleSavingRateType,
  handleSavingRateValue,
  handleSavingDepositChoice,
  handleSavingRename,
  handleWithdrawalMessage,
  handleWithdrawalConfirm,
  handleSavingsListCommand,
  handleRendimentoCommand
} from '../controllers/savingController.js';
import {
  handleDeleteCommand,
  handleDeleteTypeChoice,
  handleDeleteTransactionChoice,
  handleDeleteIncomeChoice,
  handleDeleteSavingChoice,
  handleDeleteEntryChoice,
  handleDeleteConfirm
} from '../controllers/deleteController.js';
import {
  getOrCreateSession,
  savePendingTransaction,
  getSession
} from './sessionService.js';

let client: InstanceType<typeof Client> | null = null;

export async function startWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './auth_info' }),
    puppeteer: {
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', (qr) => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 ESCANEIE O QR CODE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    qrcode.generate(qr, { small: true });
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
    console.log('🤖 Bot está rodando...\n');
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
  });

  client.on('disconnected', (reason) => {
    console.log('❌ Desconectado:', reason);
    console.log('🔄 Reiniciando em 5s...');
    setTimeout(() => startWhatsApp(), 5000);
  });

  client.on('message_create', async (msg: Message) => {
    // Ignora mensagens enviadas pelo próprio bot
    if (msg.fromMe) return;
    // Ignora mensagens que não sejam texto puro
    if (msg.type !== 'chat') return;
    await handleIncomingMessage(msg);
  });

  await client.initialize();
  return client;
}

async function handleIncomingMessage(msg: Message) {
  if (msg.from.includes('@g.us')) return;
  if (msg.from === 'status@broadcast') return;
  if (!msg.body?.trim()) return;

  const from = msg.from;
  const phoneNumber = from.split('@')[0];
  const text = msg.body.trim();

  console.log(`\n📩 [${phoneNumber}]: "${text}"`);

  try {
    let user = await User.findOne({ phoneNumber });

    if (!user) {
      console.log(`✨ Novo usuário detectado: ${phoneNumber}`);

      user = await User.create({
        phoneNumber,
        status: 'pending_name',
        customCategories: [],
        categoryMappings: {}
      });

      await getOrCreateSession(phoneNumber, user._id);

      const parsed = parseMessage(text);

      if (parsed.type === 'transaction') {
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
        await sendMessage(
          from,
          '👋 Olá! Seja bem-vindo ao Bot de Finanças!\n\n' +
          'Para começar, *qual é o seu nome?*'
        );
      }

      return;
    }

    if (user.status === 'pending_name') {
      console.log('📝 Processando nome...');
      await handleNameRegistration(from, user, text);
      return;
    }

    const session = await getSession(phoneNumber);

    // ── Estados de categoria ─────────────────────────────────────────────────
    if (session?.status === 'pending_category') {
      await handleCategoryChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_category_creation') {
      await handleCategoryCreation(from, user, text);
      return;
    }
    if (session?.status === 'pending_category_change') {
      await handleCategoryChange(from, user, text);
      return;
    }

    // ── Estados de edição ────────────────────────────────────────────────────
    if (session?.status === 'pending_edit_choice') {
      await handleEditChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_date_edit') {
      await handleDateEdit(from, user, text);
      return;
    }

    // ── Estado de mês ────────────────────────────────────────────────────────
    if (session?.status === 'pending_mes_choice') {
      await handleMesChoice(from, user, text);
      return;
    }

    // ── Estados de guardado ──────────────────────────────────────────────────
    if (session?.status === 'pending_saving_rate') {
      await handleSavingRateChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_saving_rate_type') {
      await handleSavingRateType(from, user, text);
      return;
    }
    if (session?.status === 'pending_saving_rate_value') {
      await handleSavingRateValue(from, user, text);
      return;
    }
    if (session?.status === 'pending_saving_deposit') {
      await handleSavingDepositChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_saving_withdrawal') {
      await handleWithdrawalConfirm(from, user, text);
      return;
    }
    if (session?.status === 'pending_saving_rename') {
      await handleSavingRename(from, user, text);
      return;
    }

    // ── Estados de delete ────────────────────────────────────────────────────
    if (session?.status === 'pending_delete_type') {
      await handleDeleteTypeChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_delete_transaction') {
      await handleDeleteTransactionChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_delete_income') {
      await handleDeleteIncomeChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_delete_saving_choice') {
      await handleDeleteSavingChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_delete_entry') {
      await handleDeleteEntryChoice(from, user, text);
      return;
    }
    if (session?.status === 'pending_delete_confirm') {
      await handleDeleteConfirm(from, user, text);
      return;
    }

    // ── Fluxo normal ─────────────────────────────────────────────────────────
    const userMappings = user.categoryMappings as unknown as Record<string, string>;
    const parsed = parseMessage(text, userMappings);

    if (parsed.type === 'command') {
      const { command } = parsed.data;

      if (command === 'ultimos' || command === 'lista') {
        await handleListCommand(from, user);
      } else if (command === 'hoje') {
        await handleTodayCommand(from, user);
      } else if (command === 'resumo') {
        await handleResumoCommand(from, user);
      } else if (command === 'mes') {
        await handleMesCommand(from, user);
      } else if (command === 'ajuda' || command === 'help') {
        await handleHelpCommand(from);
      } else if (command === 'categorias') {
        await handleListCategoriesCommand(from, user);
      } else if (command === 'mapear') {
        await handleListMappingsCommand(from, user);
      } else if (command === 'mudar') {
        await handleMudarCommand(from, user);
      } else if (command === 'entradas') {
        await handleIncomeListCommand(from, user);
      } else if (command === 'guardados') {
        await handleSavingsListCommand(from, user);
      } else if (command === 'deletar') {
        await handleDeleteCommand(from, user);
      } else if (command.startsWith('rendimento ')) {
        const savingName = command.substring(11).trim();
        await handleRendimentoCommand(from, user, savingName);
      } else if (command.startsWith('apagar ')) {
        const keyword = command.substring(7).trim();
        await handleDeleteMappingCommand(from, user, keyword);
      } else {
        await sendMessage(from, '❓ Comando não reconhecido. Use /ajuda');
      }

    } else if (parsed.type === 'income') {
      await handleIncome(from, user, parsed);

    } else if (parsed.type === 'saving') {
      await handleSavingMessage(from, user, parsed.data.value, parsed.data.savingName, parsed.data.date);

    } else if (parsed.type === 'withdrawal') {
      await handleWithdrawalMessage(from, user, parsed.data.value, parsed.data.savingName, parsed.data.date);

    } else if (parsed.type === 'transaction') {
      if (parsed.data.needsCategory) {
        await askForCategory(from, phoneNumber, {
          value: parsed.data.value,
          description: parsed.data.description,
          keyword: parsed.data.keyword,
          date: parsed.data.date,
          originalMessage: text
        });
      } else {
        await handleTransaction(from, user, parsed, true);
      }

    } else {
      const casual = ['oi', 'olá', 'ola', 'hey', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite', 'ei', 'fala ai', 'fala tu'];
      if (casual.includes(text.toLowerCase())) {
        await sendMessage(
          from,
          `Oi${user.name ? ', ' + user.name : ''}! 👋\n\n` +
          `Como posso te ajudar?\n\n` +
          `💵 Gasto: "almoço 35"\n` +
          `💵 Entrada: "recebi 6000 salário"\n` +
          `🏦 Guardado: "guardei 500 caixinha viagem"\n` +
          `💸 Retirada: "tirei 200 caixinha viagem"\n` +
          `📅 Com data: "almoço 35 ontem"\n\n` +
          `📈 Comandos: /hoje /resumo /mes /guardados /deletar /ajuda`
        );
      } else {
        await sendMessage(from, '❓ Não entendi. Use /ajuda pra ver os comandos.');
      }
    }

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    await sendMessage(from, '❌ Erro ao processar. Tente novamente.');
  }
}

export async function sendMessage(to: string, text: string) {
  if (!client) throw new Error('WhatsApp não conectado!');
  await client.sendMessage(to, text);
  console.log(`✅ Resposta enviada`);
}

export async function sendDocument(to: string, filePath: string, filename: string) {
  if (!client) throw new Error('WhatsApp não conectado!');

  const absolutePath = path.resolve(filePath);
  const fileData = fs.readFileSync(absolutePath);
  const base64 = fileData.toString('base64');

  const media = new MessageMedia('application/pdf', base64, filename);
  await client.sendMessage(to, media);
  console.log(`✅ Documento enviado: ${filename}`);
}

export function getWhatsAppInstance() {
  return client;
}