import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthenticatedRequest } from '../types/auth';


interface JwtPayload {
  userId: string;
}

export const auth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // 1. Obter o token do header Authorization
    const authHeader = req.headers['authorization'];

    // 2. Verificar se o token existe e está no formato correto
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido ou formato inválido'
      });
    }

    // 3. Extrair o token
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // 4. Verificar o JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET não configurado');
    }

    // 5. Verificar e decodificar o token
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // 6. Buscar o usuário no banco de dados
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido - usuário não encontrado'
      });
    }

    // 7. Adicionar o usuário ao request (com type assertion)
    (req as AuthenticatedRequest).user = user;

    // 8. Prosseguir para a próxima middleware/controller
    next();
  } catch (error: any) {
    console.error('Erro na autenticação:', error);

    // Tratamento específico para erros do JWT
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    // Erro genérico do servidor
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};