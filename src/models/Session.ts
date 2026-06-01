import mongoose, { Schema, Document, Model } from 'mongoose';

interface PendingTransaction {
  value: number;
  description: string;
  category?: string;
  keyword?: string;
  date?: Date;
  originalMessage: string;
}

interface PendingSaving {
  savingId?: string;
  name?: string;
  normalizedName?: string;
  value?: number;
  date?: Date;
  rateType?: string;
  currentBalance?: number;
}

interface SessionContext {
  pendingTransaction?: PendingTransaction;
  pendingSaving?: PendingSaving;
  awaitingInput?:
    | 'name'
    | 'category_choice'
    | 'category_creation'
    | 'category_change'
    | 'edit_choice'
    | 'date_edit'
    | 'mes_choice'
    | 'saving_rate'
    | 'saving_rate_type'
    | 'saving_rate_value'
    | 'saving_deposit'
    | 'saving_withdrawal'
    | 'saving_rename'
    | 'delete_type'
    | 'delete_transaction'
    | 'delete_income'
    | 'delete_saving_choice'
    | 'delete_entry'
    | 'delete_confirm';
  categoryOptions?: string[];
  newCategoryKeyword?: string;
  lastTransactionId?: mongoose.Types.ObjectId;
  lastIncomeId?: mongoose.Types.ObjectId;
  editBoth?: boolean;
  mesOptions?: { label: string; year: number; month: number }[];
  deleteOptions?: string[];
  deleteTargetId?: string;
  deleteTargetType?: 'transaction' | 'income' | 'saving_entry';
}

export interface ISession extends Document {
  phoneNumber: string;
  userId: mongoose.Types.ObjectId;
  status:
    | 'pending_name'
    | 'pending_category'
    | 'pending_category_creation'
    | 'pending_category_change'
    | 'pending_edit_choice'
    | 'pending_date_edit'
    | 'pending_mes_choice'
    | 'pending_saving_rate'
    | 'pending_saving_rate_type'
    | 'pending_saving_rate_value'
    | 'pending_saving_deposit'
    | 'pending_saving_withdrawal'
    | 'pending_saving_rename'
    | 'pending_delete_type'
    | 'pending_delete_transaction'
    | 'pending_delete_income'
    | 'pending_delete_saving_choice'
    | 'pending_delete_entry'
    | 'pending_delete_confirm'
    | 'active';
  context: SessionContext;
  expiresAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<ISession>({
  phoneNumber: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: [
      'pending_name',
      'pending_category',
      'pending_category_creation',
      'pending_category_change',
      'pending_edit_choice',
      'pending_date_edit',
      'pending_mes_choice',
      'pending_saving_rate',
      'pending_saving_rate_type',
      'pending_saving_rate_value',
      'pending_saving_deposit',
      'pending_saving_withdrawal',
      'pending_saving_rename',
      'pending_delete_type',
      'pending_delete_transaction',
      'pending_delete_income',
      'pending_delete_saving_choice',
      'pending_delete_entry',
      'pending_delete_confirm',
      'active'
    ],
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
    pendingSaving: {
      savingId: String,
      name: String,
      normalizedName: String,
      value: Number,
      date: Date,
      rateType: String,
      currentBalance: Number
    },
    awaitingInput: {
      type: String,
      enum: [
        'name', 'category_choice', 'category_creation', 'category_change',
        'edit_choice', 'date_edit', 'mes_choice',
        'saving_rate', 'saving_rate_type', 'saving_rate_value',
        'saving_deposit', 'saving_withdrawal', 'saving_rename',
        'delete_type', 'delete_transaction', 'delete_income',
        'delete_saving_choice', 'delete_entry', 'delete_confirm'
      ]
    },
    categoryOptions: [String],
    newCategoryKeyword: String,
    lastTransactionId: Schema.Types.ObjectId,
    lastIncomeId: Schema.Types.ObjectId,
    editBoth: Boolean,
    mesOptions: [{ label: String, year: Number, month: Number }],
    deleteOptions: [String],
    deleteTargetId: String,
    deleteTargetType: String
  },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session: Model<ISession> = mongoose.model<ISession>('Session', sessionSchema);

export default Session;