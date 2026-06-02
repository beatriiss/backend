import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { IUser } from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Income from '../models/Income.js';
import SavingEntry from '../models/SavingEntry.js';
import Saving from '../models/Saving.js';
import Trip from '../models/Trip.js';
import { sendMessage, sendDocument } from '../services/whatsapp.js';
import { getCategoryEmoji } from '../services/categoryMapper.js';
import { updateSessionStatus, clearSession, getSession } from '../services/sessionService.js';

// ─── /planilha — escolha do mês ───────────────────────────────────────────────

export async function handlePlanilhaCommand(from: string, user: IUser) {
  const phoneNumber = from.split('@')[0];
  const now = new Date();
  const options: { label: string; year: number; month: number }[] = [];

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    options.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      year: d.getFullYear(),
      month: d.getMonth() + 1
    });
  }

  await updateSessionStatus(phoneNumber, 'pending_planilha_mes', {
    planilhaOptions: options,
    awaitingInput: 'planilha_mes'
  });

  let message = `📊 *Gerar planilha de qual mês?*\n\n`;
  options.forEach((opt, i) => { message += `${i + 1}️⃣ ${opt.label}\n`; });
  message += `\nResponda com o número (1-${options.length})`;

  await sendMessage(from, message);
}

// ─── Escolha do mês ───────────────────────────────────────────────────────────

export async function handlePlanilhaMesChoice(from: string, user: IUser, choice: string) {
  const phoneNumber = from.split('@')[0];
  const session = await getSession(phoneNumber);
  const options = session?.context?.planilhaOptions;

  if (!options || options.length === 0) {
    await sendMessage(from, '❌ Sessão expirada. Use /planilha novamente.');
    await clearSession(phoneNumber);
    return;
  }

  const choiceNum = parseInt(choice);

  if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > options.length) {
    await sendMessage(from, `❌ Opção inválida. Responda com um número de 1 a ${options.length}`);
    return;
  }

  const selected = options[choiceNum - 1];
  await clearSession(phoneNumber);

  await sendMessage(from, `⏳ Gerando planilha de *${selected.label}*...`);

  try {
    const filePath = await generatePlanilha(user, selected.year, selected.month, selected.label);
    await sendDocument(from, filePath, `Financas_${selected.label.replace(' ', '_')}.xlsx`);
    fs.unlinkSync(filePath); // remove arquivo temporário
  } catch (error) {
    console.error('❌ Erro ao gerar planilha:', error);
    await sendMessage(from, '❌ Erro ao gerar planilha. Tente novamente.');
  }
}

// ─── Geração do Excel ─────────────────────────────────────────────────────────

async function generatePlanilha(
  user: IUser,
  year: number,
  month: number,
  label: string
): Promise<string> {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth   = new Date(year, month, 1);

  const [transactions, incomes, savingEntries] = await Promise.all([
    Transaction.find({ userId: user._id, date: { $gte: startOfMonth, $lt: endOfMonth } }).sort({ date: 1 }),
    Income.find({ userId: user._id, date: { $gte: startOfMonth, $lt: endOfMonth } }).sort({ date: 1 }),
    SavingEntry.find({ userId: user._id, date: { $gte: startOfMonth, $lt: endOfMonth } }).sort({ date: 1 })
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bot de Finanças';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Relatório');

  // ── Estilos ────────────────────────────────────────────────────────────────

  const titleStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 14, color: { argb: 'FF1F3864' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } },
    alignment: { horizontal: 'left', vertical: 'middle' }
  };

  const sectionStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } },
    alignment: { horizontal: 'left', vertical: 'middle' }
  };

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 10, color: { argb: 'FF1F3864' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      bottom: { style: 'thin', color: { argb: 'FF2F5496' } }
    }
  };

  const totalStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } },
    numFmt: 'R$ #,##0.00'
  };

  const moneyFmt = 'R$ #,##0.00';
  const dateFmt  = 'dd/mm/yyyy';

  // Largura das colunas
  sheet.columns = [
    { width: 12 }, // A - data
    { width: 30 }, // B - descrição
    { width: 18 }, // C - categoria
    { width: 14 }, // D - valor
    { width: 18 }, // E - viagem / tipo / %
    { width: 14 }, // F - saldo acumulado
  ];

  let row = 1;

  const addTitle = () => {
    const r = sheet.getRow(row);
    sheet.mergeCells(`A${row}:F${row}`);
    r.getCell(1).value = `Relatório Financeiro — ${label}`;
    r.getCell(1).style = titleStyle;
    r.height = 24;
    row += 2;
  };

  const addSection = (title: string) => {
    sheet.mergeCells(`A${row}:F${row}`);
    const r = sheet.getRow(row);
    r.getCell(1).value = title;
    r.getCell(1).style = sectionStyle;
    r.height = 20;
    row++;
  };

  const addHeaders = (cols: string[]) => {
    const r = sheet.getRow(row);
    cols.forEach((col, i) => {
      r.getCell(i + 1).value = col;
      r.getCell(i + 1).style = headerStyle;
    });
    r.height = 18;
    row++;
  };

  const addTotalRow = (label: string, total: number, colIdx: number) => {
    const r = sheet.getRow(row);
    r.getCell(colIdx - 1).value = label;
    r.getCell(colIdx - 1).style = { font: { bold: true } };
    r.getCell(colIdx).value = total;
    r.getCell(colIdx).style = totalStyle;
    r.getCell(colIdx).numFmt = moneyFmt;
    row++;
  };

  const addEmpty = () => { row++; };

  // ── TÍTULO ─────────────────────────────────────────────────────────────────
  addTitle();

  // ── ENTRADAS ───────────────────────────────────────────────────────────────
  addSection('💵  ENTRADAS');
  addHeaders(['Data', 'Descrição', 'Categoria', 'Valor']);

  let totalEntradas = 0;
  for (const inc of incomes) {
    const r = sheet.getRow(row);
    r.getCell(1).value = inc.date;
    r.getCell(1).numFmt = dateFmt;
    r.getCell(2).value = inc.description;
    r.getCell(3).value = inc.category;
    r.getCell(4).value = inc.value;
    r.getCell(4).numFmt = moneyFmt;
    totalEntradas += inc.value;
    row++;
  }

  if (incomes.length === 0) {
    sheet.getRow(row).getCell(2).value = 'Nenhuma entrada registrada';
    row++;
  }

  addTotalRow('Total entradas', totalEntradas, 4);
  addEmpty();

  // ── GASTOS ─────────────────────────────────────────────────────────────────
  addSection('🛒  GASTOS');
  addHeaders(['Data', 'Descrição', 'Categoria', 'Valor', 'Viagem']);

  let totalGastos = 0;
  for (const t of transactions) {
    let tripName = '';
    if (t.tripId) {
      const trip = await Trip.findById(t.tripId);
      if (trip) tripName = trip.name;
    }
    const r = sheet.getRow(row);
    r.getCell(1).value = t.date;
    r.getCell(1).numFmt = dateFmt;
    r.getCell(2).value = t.description;
    r.getCell(3).value = t.category;
    r.getCell(4).value = t.value;
    r.getCell(4).numFmt = moneyFmt;
    r.getCell(5).value = tripName;
    totalGastos += t.value;
    row++;
  }

  if (transactions.length === 0) {
    sheet.getRow(row).getCell(2).value = 'Nenhum gasto registrado';
    row++;
  }

  addTotalRow('Total gastos', totalGastos, 4);
  addEmpty();

  // ── GUARDADOS ──────────────────────────────────────────────────────────────
  addSection('🏦  GUARDADOS');
  addHeaders(['Data', 'Guardado', 'Tipo', 'Valor', '', 'Saldo acumulado']);

  // Agrupa por saving pra calcular saldo acumulado
  const savingNomes: Record<string, string> = {};
  const savingBals: Record<string, number> = {};

  for (const entry of savingEntries) {
    const id = entry.savingId.toString();
    if (!savingNomes[id]) {
      const s = await Saving.findById(id);
      savingNomes[id] = s?.name || 'guardado';
      // saldo antes do período
      const prevEntries = await SavingEntry.find({
        savingId: id,
        date: { $lt: startOfMonth }
      });
      savingBals[id] = prevEntries.reduce((acc, e) => {
        if (e.type === 'aporte') return acc + e.value;
        if (e.type === 'retirada') return acc - e.value;
        return acc + e.value;
      }, 0);
    }

    if (entry.type === 'aporte') savingBals[id] += entry.value;
    else if (entry.type === 'retirada') savingBals[id] -= entry.value;
    else savingBals[id] += entry.value;

    const typeLabel =
      entry.type === 'aporte' ? 'Aporte' :
      entry.type === 'retirada' ? 'Retirada' : 'Rendimento';

    const r = sheet.getRow(row);
    r.getCell(1).value = entry.date;
    r.getCell(1).numFmt = dateFmt;
    r.getCell(2).value = savingNomes[id];
    r.getCell(3).value = typeLabel;
    r.getCell(4).value = entry.type === 'retirada' ? -entry.value : entry.value;
    r.getCell(4).numFmt = moneyFmt;
    r.getCell(6).value = savingBals[id];
    r.getCell(6).numFmt = moneyFmt;
    row++;
  }

  if (savingEntries.length === 0) {
    sheet.getRow(row).getCell(2).value = 'Nenhuma movimentação registrada';
    row++;
  }

  const totalGuardado = savingEntries
    .filter(e => e.type === 'aporte')
    .reduce((s, e) => s + e.value, 0);
  const totalRetirado = savingEntries
    .filter(e => e.type === 'retirada')
    .reduce((s, e) => s + e.value, 0);

  if (totalGuardado > 0) addTotalRow('Total aportado', totalGuardado, 4);
  if (totalRetirado > 0) addTotalRow('Total retirado', totalRetirado, 4);
  addEmpty();

  // ── POR CATEGORIA ──────────────────────────────────────────────────────────
  addSection('📊  POR CATEGORIA (gastos)');
  addHeaders(['Categoria', '', 'Total', '%']);

  const porCat: Record<string, number> = {};
  transactions.forEach(t => {
    porCat[t.category] = (porCat[t.category] || 0) + t.value;
  });

  Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, val]) => {
      const pct = totalGastos > 0 ? ((val / totalGastos) * 100).toFixed(1) + '%' : '0%';
      const r = sheet.getRow(row);
      r.getCell(1).value = cat;
      r.getCell(3).value = val;
      r.getCell(3).numFmt = moneyFmt;
      r.getCell(4).value = pct;
      row++;
    });

  addEmpty();

  // ── RESUMO DO PERÍODO ──────────────────────────────────────────────────────
  addSection('📋  RESUMO DO PERÍODO');

  const saldo = totalEntradas - totalGastos;

  const resumoItems = [
    { label: 'Entradas', value: totalEntradas, color: 'FF375623' },
    { label: 'Gastos', value: -totalGastos, color: 'FF833C00' },
    { label: 'Guardado (aportes)', value: -totalGuardado, color: 'FF1F3864' },
  ];

  for (const item of resumoItems) {
    const r = sheet.getRow(row);
    r.getCell(2).value = item.label;
    r.getCell(2).style = { font: { bold: false } };
    r.getCell(4).value = item.value;
    r.getCell(4).numFmt = moneyFmt;
    r.getCell(4).style = { font: { color: { argb: item.color } }, numFmt: moneyFmt };
    row++;
  }

  // linha divisória
  const divRow = sheet.getRow(row);
  ['B', 'C', 'D'].forEach(col => {
    divRow.getCell(col).style = {
      border: { top: { style: 'medium', color: { argb: 'FF2F5496' } } }
    };
  });
  row++;

  // saldo final
  const saldoRow = sheet.getRow(row);
  saldoRow.getCell(2).value = 'Saldo do período';
  saldoRow.getCell(2).style = { font: { bold: true, size: 11 } };
  saldoRow.getCell(4).value = saldo;
  saldoRow.getCell(4).numFmt = moneyFmt;
  saldoRow.getCell(4).style = {
    font: {
      bold: true,
      size: 11,
      color: { argb: saldo >= 0 ? 'FF375623' : 'FF833C00' }
    },
    numFmt: moneyFmt
  };
  row++;

  // ── Salva arquivo ──────────────────────────────────────────────────────────
  const tmpDir = './tmp';
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  const fileName = `planilha_${year}_${String(month).padStart(2, '0')}_${Date.now()}.xlsx`;
  const filePath = path.join(tmpDir, fileName);

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}