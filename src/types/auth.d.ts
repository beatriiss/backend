// src/types/auth.d.ts
import { Request } from 'express';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: number;
        email: string;
      };
    }
  }
}

export interface AuthRequest extends Request {
  user: {
    id: number;
    email: string;
  };
}