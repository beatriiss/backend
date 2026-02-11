import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICreditCardPurchase extends Document {
  userId: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  totalValue: number;
  description: string;
  category: string;
  installments: number;
  installmentValue: number;
  purchaseDate: Date;
  status: 'active' | 'paid_off' | 'cancelled';
  createdAt: Date;
}

const creditCardPurchaseSchema = new Schema<ICreditCardPurchase>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  cardId: {
    type: Schema.Types.ObjectId,
    ref: 'CreditCard',
    required: true,
    index: true
  },
  totalValue: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'outros'
  },
  installments: {
    type: Number,
    default: 1,
    min: 1
  },
  installmentValue: {
    type: Number,
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'paid_off', 'cancelled'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const CreditCardPurchase: Model<ICreditCardPurchase> = mongoose.model<ICreditCardPurchase>('CreditCardPurchase', creditCardPurchaseSchema);

export default CreditCardPurchase;