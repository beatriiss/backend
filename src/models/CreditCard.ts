import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICreditCard extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  dueDay: number;
  closingDay: number;
  limit: number;
  active: boolean;
  createdAt: Date;
}

const creditCardSchema = new Schema<ICreditCard>({
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
  dueDay: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  closingDay: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  limit: {
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

const CreditCard: Model<ICreditCard> = mongoose.model<ICreditCard>('CreditCard', creditCardSchema);

export default CreditCard;