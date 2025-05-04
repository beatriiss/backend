// src/controllers/categoria.controller.ts
import { Request, Response } from 'express';
import { CategoriaService } from '../services/categoria.service';
import { TipoTransacao } from '../models/categoria';
import { AuthRequest } from '../types/auth';

export class CategoriaController {
  static async criar(req: AuthRequest, res: Response) {
    try {
      const { nome, icone, cor, tipo } = req.body;
      const usuario_id = req.user.id;

      if (!nome || !icone || !cor || !tipo) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
      }

      if (!Object.values(TipoTransacao).includes(tipo)) {
        return res.status(400).json({ message: 'Tipo inválido. Use RECEITA ou DESPESA' });
      }

      const categoria = await CategoriaService.criar(usuario_id, nome, icone, cor, tipo);
      
      res.status(201).json(categoria);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async listar(req: AuthRequest, res: Response) {
    try {
      const usuario_id = req.user.id;
      const tipo = req.query.tipo as TipoTransacao | undefined;

      const categorias = await CategoriaService.listar(usuario_id, tipo);
      
      res.json(categorias);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  static async buscarPorId(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const usuario_id = req.user.id;

      const categoria = await CategoriaService.buscarPorId(id, usuario_id);
      
      res.json(categoria);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  }

  static async atualizar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const usuario_id = req.user.id;
      const dados = req.body;

      const categoria = await CategoriaService.atualizar(id, usuario_id, dados);
      
      res.json(categoria);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  static async deletar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const usuario_id = req.user.id;

      await CategoriaService.deletar(id, usuario_id);
      
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}