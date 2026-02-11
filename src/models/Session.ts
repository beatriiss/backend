import mongoose, { Schema, Document, Model } from 'mongoose';

interface PendingTransaction {
  value: number;
  description: string;
  category?: string;
  date?: Date;
  originalMessage: string;
}

interface SessionContext {
  pendingTransaction?: PendingTransaction;
  awaitingInput?: 'name' | 'category' | 'date_confirmation';
  categoryOptions?: string[];
  dateToConfirm?: Date;
}

export interface ISession extends Document {
  phoneNumber: string;
  userId: mongoose.Types.ObjectId;
  status: 'pending_name' | 'pending_category' | 'pending_date_confirmation' | 'active';
  context: SessionContext;
  expiresAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<ISession>({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending_name', 'pending_category', 'pending_date_confirmation', 'active'],
    default: 'active'
  },
  context: {
    pendingTransaction: {
      value: Number,
      description: String,
      category: String,
      date: Date,
      originalMessage: String
    },
    awaitingInput: {
      type: String,
      enum: ['name', 'category', 'date_confirmation']
    },
    categoryOptions: [String],
    dateToConfirm: Date
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL Index
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session: Model<ISession> = mongoose.model<ISession>('Session', sessionSchema);

export default Session;