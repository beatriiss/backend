// src/types/auth.d.ts
import { Request } from 'express';

// Isto é necessário para que o TypeScript reconheça a propriedade customizada
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

export { Request };
