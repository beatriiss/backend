// src/routes/categoria.routes.ts
import { Router } from 'express';
import { CategoriaController } from '../controllers/categoria.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas de categoria requerem autenticação
router.use(authMiddleware);

router.post('/', CategoriaController.criar);
router.get('/', CategoriaController.listar);
router.get('/:id', CategoriaController.buscarPorId);
router.put('/:id', CategoriaController.atualizar);
router.delete('/:id', CategoriaController.deletar);

export default router;