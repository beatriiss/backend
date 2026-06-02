import mongoose, { Schema, Document, Model } from 'mongoose';

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
  tripId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

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
  tripId: {
    type: Schema.Types.ObjectId,
    ref: 'Trip',
    default: null,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

transactionSchema.index({ userId: 1, yearMonth: 1 });
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, tripId: 1 });

transactionSchema.pre<ITransaction>('save', function(next) {
  if (this.date) {
    this.month = this.date.getMonth() + 1;
    this.year = this.date.getFullYear();
    this.yearMonth = `${this.year}-${String(this.month).padStart(2, '0')}`;
  }
  next();
});

const Transaction: Model<ITransaction> = mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;