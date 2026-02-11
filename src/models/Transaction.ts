import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface do documento
export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  value: number;
  category: string;
  description: string;
  paymentMethod: 'dinheiro' | 'pix' | 'debito';
  date: Date;
  month?: number;
  year?: number;
  yearMonth?: string;
  createdAt: Date;
}

// Schema
const transactionSchema = new Schema<ITransaction>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  paymentMethod: {
    type: String,
    enum: ['dinheiro', 'pix', 'debito'],
    default: 'dinheiro'
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  month: {
    type: Number
  },
  year: {
    type: Number
  },
  yearMonth: {
    type: String,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Índices compostos
transactionSchema.index({ userId: 1, yearMonth: 1 });
transactionSchema.index({ userId: 1, date: -1 });

// Middleware com tipagem correta
transactionSchema.pre<ITransaction>('save', function(next) {
  if (this.date) {
    this.month = this.date.getMonth() + 1;
    this.year = this.date.getFullYear();
    this.yearMonth = `${this.year}-${String(this.month).padStart(2, '0')}`;
  }
  next();
});

// Export do model
const Transaction: Model<ITransaction> = mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;