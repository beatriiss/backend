import Session, { ISession } from '../models/Session.js';
import mongoose from 'mongoose';

// Duração da sessão: 30 minutos
const SESSION_DURATION_MS = 30 * 60 * 1000;

export async function getOrCreateSession(
  phoneNumber: string,
  userId: mongoose.Types.ObjectId
): Promise<ISession> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  let session = await Session.findOne({ phoneNumber });

  if (!session) {
    session = await Session.create({
      phoneNumber,
      userId,
      status: 'active',
      context: {},
      expiresAt
    });
  } else {
    // Renova expiração
    session.expiresAt = expiresAt;
    await session.save();
  }

  return session;
}

export async function updateSessionStatus(
  phoneNumber: string,
  status: ISession['status'],
  context?: Partial<ISession['context']>
): Promise<void> {
  const update: any = {
    status,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
  };

  if (context) {
    update['context'] = context;
  }

  await Session.updateOne({ phoneNumber }, { $set: update });
}

export async function clearSession(phoneNumber: string): Promise<void> {
  await Session.updateOne(
    { phoneNumber },
    {
      $set: {
        status: 'active',
        context: {},
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
      }
    }
  );
}

export async function getPendingTransaction(phoneNumber: string) {
  const session = await Session.findOne({ phoneNumber });
  return session?.context?.pendingTransaction || null;
}

export async function savePendingTransaction(
  phoneNumber: string,
  transaction: {
    value: number;
    description: string;
    category?: string;
    date?: Date;
    originalMessage: string;
  }
): Promise<void> {
  await Session.updateOne(
    { phoneNumber },
    {
      $set: {
        'context.pendingTransaction': transaction,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
      }
    }
  );
}

export async function getSession(phoneNumber: string): Promise<ISession | null> {
  return await Session.findOne({ phoneNumber });
}