import mongoose, { Schema, Document, Model } from 'mongoose';

export type RateType = 'cdi_percent' | 'year_percent' | 'month_percent' | 'selic_spread' | 'poupanca' | 'none';

export interface ISaving extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  normalizedName: string;
  rateType: RateType;
  rateValue: number; // ex: 105 para 105% CDI, 12 para 12% aa, 0.5 para SELIC+0.5
  active: boolean;
  createdAt: Date;
}

const savingSchema = new Schema<ISaving>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  normalizedName: {
    type: String,
    required: true,
    index: true
  },
  rateType: {
    type: String,
    enum: ['cdi_percent', 'year_percent', 'month_percent', 'selic_spread', 'poupanca', 'none'],
    default: 'none'
  },
  rateValue: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Índice composto pra evitar guardados duplicados por usuário
savingSchema.index({ userId: 1, normalizedName: 1 }, { unique: true });

const Saving: Model<ISaving> = mongoose.model<ISaving>('Saving', savingSchema);

export default Saving;