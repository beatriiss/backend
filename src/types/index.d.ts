import { Document, Types } from 'mongoose';
import { Request } from 'express';

// Interfaces base
export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: Types.ObjectId;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Interface para Request com usuário autenticado
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// DTOs (Data Transfer Objects)
export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface CreateCategoryDTO {
  name: string;
  icon?: string;
  color?: string;
  type?: 'income' | 'expense' | 'both';
}

export interface UpdateCategoryDTO {
  name?: string;
  icon?: string;
  color?: string;
  type?: 'income' | 'expense' | 'both';
}

export interface CreateTransactionDTO {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  date?: Date;
}

export interface UpdateTransactionDTO {
  type?: 'income' | 'expense';
  amount?: number;
  description?: string;
  category?: string;
  date?: Date;
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: 'income' | 'expense';
  startDate?: Date;
  endDate?: Date;
  category?: string;
}

// Responses da API
export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    current: number;
    pages: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FinancialSummary {
  income: {
    total: number;
    count: number;
  };
  expense: {
    total: number;
    count: number;
  };
  balance: number;
}

// Enums
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

export enum CategoryType {
  INCOME = 'income',
  EXPENSE = 'expense',
  BOTH = 'both'
}

// Constantes
export const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', icon: '🍽️', color: '#EF4444', type: CategoryType.EXPENSE },
  { name: 'Transporte', icon: '🚗', color: '#F59E0B', type: CategoryType.EXPENSE },
  { name: 'Moradia', icon: '🏠', color: '#8B5CF6', type: CategoryType.EXPENSE },
  { name: 'Saúde', icon: '⚕️', color: '#EF4444', type: CategoryType.EXPENSE },
  { name: 'Lazer', icon: '🎮', color: '#10B981', type: CategoryType.EXPENSE },
  { name: 'Educação', icon: '📚', color: '#3B82F6', type: CategoryType.EXPENSE },
  { name: 'Roupas', icon: '👕', color: '#EC4899', type: CategoryType.EXPENSE },
  { name: 'Tecnologia', icon: '💻', color: '#6366F1', type: CategoryType.EXPENSE },
  { name: 'Salário', icon: '💼', color: '#10B981', type: CategoryType.INCOME },
  { name: 'Freelance', icon: '💻', color: '#06B6D4', type: CategoryType.INCOME },
  { name: 'Investimentos', icon: '📈', color: '#8B5CF6', type: CategoryType.INCOME },
  { name: 'Vendas', icon: '💰', color: '#F59E0B', type: CategoryType.INCOME }
] as const;