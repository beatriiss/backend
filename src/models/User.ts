import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  phoneNumber: string;
  name?: string;
  status: 'pending_name' | 'active';
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending_name', 'active'],
    default: 'pending_name'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;