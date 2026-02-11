import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICreditCardInstallment extends Document {
  purchaseId: mongoose.Types.ObjectId;
  installmentNumber: number;
  value: number;
  dueDate: Date;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt?: Date;
  createdAt: Date;
}

const creditCardInstallmentSchema = new Schema<ICreditCardInstallment>({
  purchaseId: {
    type: Schema.Types.ObjectId,
    ref: 'CreditCardPurchase',
    required: true,
    index: true
  },
  installmentNumber: {
    type: Number,
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  paidAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

creditCardInstallmentSchema.index({ dueDate: 1, status: 1 });

const CreditCardInstallment: Model<ICreditCardInstallment> = mongoose.model<ICreditCardInstallment>('CreditCardInstallment', creditCardInstallmentSchema);

export default CreditCardInstallment;