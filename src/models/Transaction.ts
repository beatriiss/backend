import mongoose, { Schema } from 'mongoose';
import { ITransaction, TransactionType } from '../types';

const transactionSchema = new Schema<ITransaction>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Usuário é obrigatório']
  },
  type: {
    type: String,
    enum: {
      values: [TransactionType.INCOME, TransactionType.EXPENSE],
      message: 'Tipo deve ser income ou expense'
    },
    required: [true, 'Tipo da transação é obrigatório']
  },
  amount: {
    type: Number,
    required: [true, 'Valor é obrigatório'],
    min: [0.01, 'Valor deve ser maior que 0'],
    max: [999999999.99, 'Valor muito alto'],
    set: (value: number) => Math.round(value * 100) / 100 // Arredondar para 2 casas decimais
  },
  description: {
    type: String,
    required: [true, 'Descrição é obrigatória'],
    trim: true,
    minlength: [1, 'Descrição não pode estar vazia'],
    maxlength: [200, 'Descrição deve ter no máximo 200 caracteres']
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Categoria é obrigatória']
  },
  date: {
    type: Date,
    required: [true, 'Data é obrigatória'],
    default: Date.now,
    validate: {
      validator: function(value: Date) {
        // Não permitir datas muito futuras (mais de 1 ano)
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        return value <= oneYearFromNow;
      },
      message: 'Data não pode ser mais de 1 ano no futuro'
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

// Índices para otimizar consultas
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1, date: -1 });
transactionSchema.index({ user: 1, createdAt: -1 });

// Middleware para validar se a categoria pertence ao usuário
transactionSchema.pre<ITransaction>('save', async function(next) {
  try {
    const Category = mongoose.model('Category');
    const category = await Category.findOne({
      _id: this.category,
      user: this.user
    });
    
    if (!category) {
      const error = new Error('Categoria não encontrada ou não pertence ao usuário');
      (error as any).statusCode = 400;
      return next(error);
    }
    
    // Verificar se o tipo da transação é compatível com a categoria
    if (category.type !== 'both' && category.type !== this.type) {
      const error = new Error(`Esta categoria é apenas para ${category.type === 'income' ? 'ganhos' : 'gastos'}`);
      (error as any).statusCode = 400;
      return next(error);
    }
    
    next();
  } catch (error: any) {
    next(error);
  }
});

// Método estático para obter resumo financeiro
transactionSchema.statics.getFinancialSummary = async function(
  userId: string,
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: any = { user: new mongoose.Types.ObjectId(userId) };
  
  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = startDate;
    if (endDate) matchStage.date.$lte = endDate;
  }
  
  const summary = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    income: { total: 0, count: 0 },
    expense: { total: 0, count: 0 },
    balance: 0
  };
  
  summary.forEach(item => {
    result[item._id as keyof typeof result] = {
      total: item.total,
      count: item.count
    };
  });
  
  result.balance = result.income.total - result.expense.total;
  
  return result;
};

const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;