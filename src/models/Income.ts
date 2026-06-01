import mongoose, { Schema, Document, Model } from 'mongoose';

export type IncomeCategory =
  | 'salário'
  | 'freelance'
  | 'bolsa'
  | 'aluguel recebido'
  | 'investimento resgatado'
  | 'outros';

export interface IIncome extends Document {
  userId: mongoose.Types.ObjectId;
  value: number;
  category: IncomeCategory;
  description: string;
  date: Date;
  month?: number;
  year?: number;
  yearMonth?: string;
  createdAt: Date;
}

const incomeSchema = new Schema<IIncome>({
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
    enum: ['salário', 'freelance', 'bolsa', 'aluguel recebido', 'investimento resgatado', 'outros'],
    default: 'outros'
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
  month: { type: Number },
  year: { type: Number },
  yearMonth: { type: String, index: true },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

incomeSchema.index({ userId: 1, yearMonth: 1 });
incomeSchema.index({ userId: 1, date: -1 });

incomeSchema.pre<IIncome>('save', function (next) {
  if (this.date) {
    this.month = this.date.getMonth() + 1;
    this.year = this.date.getFullYear();
    this.yearMonth = `${this.year}-${String(this.month).padStart(2, '0')}`;
  }
  next();
});

const Income: Model<IIncome> = mongoose.model<IIncome>('Income', incomeSchema);

export default Income;