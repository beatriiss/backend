// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export const AuthController = {
  async register(req: Request, res: Response) {
    try {
      const { nome, email, senha, whatsapp } = req.body;

      if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios' });
      }

      const result = await AuthService.register(nome, email, senha, whatsapp);
      
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
      }

      const result = await AuthService.login(email, senha);
      
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  },

  async me(req: Request, res: Response) {
    try {
      const user = req.user;
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
};