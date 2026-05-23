import mongoose, { Schema, Document, Model } from 'mongoose';

interface PendingTransaction {
  value: number;
  description: string;
  category?: string;
  keyword?: string;
  date?: Date;
  originalMessage: string;
}

interface SessionContext {
  pendingTransaction?: PendingTransaction;
  awaitingInput?: 'name' | 'category_choice' | 'category_creation' | 'category_change';
  categoryOptions?: string[];
  newCategoryKeyword?: string;
  lastTransactionId?: mongoose.Types.ObjectId;
}

export interface ISession extends Document {
  phoneNumber: string;
  userId: mongoose.Types.ObjectId;
  status: 'pending_name' | 'pending_category' | 'pending_category_creation' | 'pending_category_change' | 'active';
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
    enum: ['pending_name', 'pending_category', 'pending_category_creation', 'pending_category_change', 'active'],
    default: 'active'
  },
  context: {
    pendingTransaction: {
      value: Number,
      description: String,
      category: String,
      keyword: String,
      date: Date,
      originalMessage: String
    },
    awaitingInput: {
      type: String,
      enum: ['name', 'category_choice', 'category_creation', 'category_change']
    },
    categoryOptions: [String],
    newCategoryKeyword: String,
    lastTransactionId: Schema.Types.ObjectId
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