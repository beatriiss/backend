import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Conectar ao MongoDB
const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_db';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado ao MongoDB com sucesso');
  } catch (error) {
    console.error('❌ Erro ao conectar com MongoDB:', error);
    process.exit(1);
  }
};

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logs das requisições (apenas em desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    next();
  });
}

// Routes
app.use('/api', routes);

// Middleware de tratamento de erros (deve vir por último)
app.use(errorHandler);

// Tratamento para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// Start server
const startServer = async () => {
  try {
    await connectMongoDB();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 API disponível em: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Tratamento de erros não capturados
process.on('unhandledRejection', (err: any) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err: any) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

startServer();