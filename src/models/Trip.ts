import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITrip extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  normalizedName: string;
  active: boolean;
  createdAt: Date;
}

const tripSchema = new Schema<ITrip>({
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
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

tripSchema.index({ userId: 1, normalizedName: 1 }, { unique: true });
tripSchema.index({ userId: 1, active: 1 });

const Trip: Model<ITrip> = mongoose.model<ITrip>('Trip', tripSchema);

export default Trip;