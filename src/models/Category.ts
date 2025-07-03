import mongoose, { Schema } from 'mongoose';
import { ICategory, CategoryType } from '../types';

const categorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: [true, 'Nome da categoria é obrigatório'],
    trim: true,
    minlength: [1, 'Nome da categoria não pode estar vazio'],
    maxlength: [30, 'Nome da categoria deve ter no máximo 30 caracteres']
  },
  icon: {
    type: String,
    default: '💰',
    maxlength: [10, 'Ícone deve ter no máximo 10 caracteres']
  },
  color: {
    type: String,
    default: '#3B82F6',
    match: [/^#[0-9A-F]{6}$/i, 'Cor deve estar no formato hexadecimal (#000000)']
  },
  type: {
    type: String,
    enum: {
      values: [CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.BOTH],
      message: 'Tipo deve ser income, expense ou both'
    },
    default: CategoryType.BOTH
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Usuário é obrigatório']
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

// Índices
categorySchema.index({ user: 1, name: 1 }, { unique: true });
categorySchema.index({ user: 1, type: 1 });

// Middleware para validar nome único por usuário
categorySchema.pre<ICategory>('save', async function(next) {
  if (!this.isModified('name')) return next();
  
  try {
    const existingCategory = await Category.findOne({
      name: this.name,
      user: this.user,
      _id: { $ne: this._id }
    });
    
    if (existingCategory) {
      const error = new Error('Já existe uma categoria com este nome');
      (error as any).statusCode = 400;
      return next(error);
    }
    
    next();
  } catch (error: any) {
    next(error);
  }
});

// Middleware para impedir exclusão se houver transações
categorySchema.pre(['deleteOne', 'findOneAndDelete'], async function(next) {
  try {
    const categoryId = this.getQuery()._id;
    
    // Importação dinâmica para evitar dependência circular
    const Transaction = mongoose.model('Transaction');
    const transactionCount = await Transaction.countDocuments({ category: categoryId });
    
    if (transactionCount > 0) {
      const error = new Error(`Não é possível deletar esta categoria pois existem ${transactionCount} transação(ões) vinculada(s) a ela`);
      (error as any).statusCode = 400;
      return next(error);
    }
    
    next();
  } catch (error: any) {
    next(error);
  }
});

const Category = mongoose.model<ICategory>('Category', categorySchema);

export default Category;