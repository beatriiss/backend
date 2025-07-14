// src/types/auth.d.ts
import { Request } from 'express';
import { IUser } from './index';

// Extensão global do Express Request
declare global {
  namespace Express {
    export interface Request {
      user?: IUser;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export { Request };