import mongoose, { Schema, Document, Model } from 'mongoose';

export type SavingEntryType = 'aporte' | 'retirada' | 'rendimento_manual';

export interface ISavingEntry extends Document {
  savingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: SavingEntryType;
  value: number;
  description?: string;
  date: Date;
  createdAt: Date;
}

const savingEntrySchema = new Schema<ISavingEntry>({
  savingId: {
    type: Schema.Types.ObjectId,
    ref: 'Saving',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['aporte', 'retirada', 'rendimento_manual'],
    required: true
  },
  value: {
    type: Number,
    required: true
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

savingEntrySchema.index({ savingId: 1, date: -1 });
savingEntrySchema.index({ userId: 1, date: -1 });

const SavingEntry: Model<ISavingEntry> = mongoose.model<ISavingEntry>('SavingEntry', savingEntrySchema);

export default SavingEntry;