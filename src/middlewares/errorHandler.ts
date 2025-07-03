import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';

interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  keyPattern?: Record<string, any>;
  errors?: Record<string, any>;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log do erro
  console.error('❌ Erro:', err);

  // Erro de validação do Mongoose
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors!).map((error: any) => error.message).join(', ');
    error = {
      ...error,
      message,
      statusCode: 400
    };
  }

  // Erro de cast do Mongoose (ObjectId inválido)
  if (err.name === 'CastError') {
    const message = 'Recurso não encontrado';
    error = {
      ...error,
      message,
      statusCode: 404
    };
  }

  // Erro de chave duplicada do MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern!)[0];
    const message = `${field} já está em uso`;
    error = {
      ...error,
      message,
      statusCode: 400
    };
  }

  // Erro JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = {
      ...error,
      message,
      statusCode: 401
    };
  }

  // Erro JWT expirado
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = {
      ...error,
      message,
      statusCode: 401
    };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};