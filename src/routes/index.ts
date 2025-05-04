// src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import categoriaRoutes from './categoria.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/categorias', categoriaRoutes);

export default router;