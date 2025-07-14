import express from 'express';
import authRoutes from './auth';
import categoryRoutes from './categories';
import transactionRoutes from './transaction';

const router = express.Router();

// Rotas da API
router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/transactions', transactionRoutes);

// Rota de health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando corretamente',
    timestamp: new Date().toISOString()
  });
});

export default router;