import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvestmentTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  assetType: 'ações' | 'renda_fixa' | 'tesouro' | 'cripto' | 'outros';
  type: 'aporte' | 'resgate' | 'rendimento';
  value: number;
  description: string;
  date: Date;
  createdAt: Date;
}

const investmentTransactionSchema = new Schema<IInvestmentTransaction>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assetType: {
    type: String,
    required: true,
    enum: ['ações', 'renda_fixa', 'tesouro', 'cripto', 'outros']
  },
  type: {
    type: String,
    required: true,
    enum: ['aporte', 'resgate', 'rendimento']
  },
  value: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

investmentTransactionSchema.index({ userId: 1, date: -1 });

const InvestmentTransaction: Model<IInvestmentTransaction> = mongoose.model<IInvestmentTransaction>('InvestmentTransaction', investmentTransactionSchema);

export default InvestmentTransaction;