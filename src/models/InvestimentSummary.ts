import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInvestmentSummary extends Document {
  userId: mongoose.Types.ObjectId;
  assetType: 'ações' | 'renda_fixa' | 'tesouro' | 'cripto' | 'outros';
  totalInvested: number;
  totalReturns: number;
  updatedAt: Date;
}

const investmentSummarySchema = new Schema<IInvestmentSummary>({
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
  totalInvested: {
    type: Number,
    default: 0
  },
  totalReturns: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

investmentSummarySchema.index({ userId: 1, assetType: 1 }, { unique: true });

const InvestmentSummary: Model<IInvestmentSummary> = mongoose.model<IInvestmentSummary>('InvestmentSummary', investmentSummarySchema);

export default InvestmentSummary;