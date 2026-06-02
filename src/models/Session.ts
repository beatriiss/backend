import mongoose, { Schema, Document, Model } from 'mongoose';

interface PendingTransaction {
  value: number;
  description: string;
  category?: string;
  keyword?: string;
  date?: Date;
  originalMessage: string;
  tripId?: string;
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
    | 'delete_confirm'
    | 'editar_choice'
    | 'editar_field'
    | 'editar_description'
    | 'editar_value_input'
    | 'editar_viagem'
    | 'planilha_mes'
    | 'evolucao_choice';
  categoryOptions?: string[];
  newCategoryKeyword?: string;
  lastTransactionId?: mongoose.Types.ObjectId;
  lastIncomeId?: mongoose.Types.ObjectId;
  editBoth?: boolean;
  mesOptions?: { label: string; year: number; month: number }[];
  deleteOptions?: string[];
  deleteTargetId?: string;
  deleteTargetType?: 'transaction' | 'income' | 'saving_entry';
  editarOptions?: string[];
  editarViagemOptions?: string[];
  planilhaOptions?: { label: string; year: number; month: number }[];
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
    | 'pending_editar_choice'
    | 'pending_editar_field'
    | 'pending_editar_description'
    | 'pending_editar_value_input'
    | 'pending_editar_viagem'
    | 'pending_planilha_mes'
    | 'pending_evolucao_choice'
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
      'pending_editar_choice',
      'pending_editar_field',
      'pending_editar_description',
      'pending_editar_value_input',
      'pending_editar_viagem',
      'pending_planilha_mes',
      'pending_evolucao_choice',
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
      originalMessage: String,
      tripId: String
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
        'delete_saving_choice', 'delete_entry', 'delete_confirm',
        'editar_choice', 'editar_field', 'editar_description', 'editar_value_input',
        'editar_viagem', 'planilha_mes', 'evolucao_choice'
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
    deleteTargetType: String,
    editarOptions: [String],
    editarViagemOptions: [String],
    planilhaOptions: [{ label: String, year: Number, month: Number }]
  },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session: Model<ISession> = mongoose.model<ISession>('Session', sessionSchema);

export default Session;