import express, { Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import { AuthenticatedRequest, CreateTransactionDTO, UpdateTransactionDTO, TransactionType, TransactionFilters } from '../types';
import { auth } from '../middlewares/auth';

const router = express.Router();

// Validações para criar transação
const createTransactionValidation = [
  body('type')
    .isIn([TransactionType.INCOME, TransactionType.EXPENSE])
    .withMessage('Tipo deve ser income ou expense'),
  body('amount')
    .isFloat({ min: 0.01, max: 999999999.99 })
    .withMessage('Valor deve ser entre 0.01 e 999999999.99'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Descrição deve ter entre 1 e 200 caracteres'),
  body('category')
    .isMongoId()
    .withMessage('ID da categoria inválido'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Data inválida')
    .custom((value) => {
      const date = new Date(value);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      
      if (date > oneYearFromNow) {
        throw new Error('Data não pode ser mais de 1 ano no futuro');
      }
      return true;
    })
];

// Validações para atualizar transação
const updateTransactionValidation = [
  body('type')
    .optional()
    .isIn([TransactionType.INCOME, TransactionType.EXPENSE])
    .withMessage('Tipo deve ser income ou expense'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01, max: 999999999.99 })
    .withMessage('Valor deve ser entre 0.01 e 999999999.99'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Descrição deve ter entre 1 e 200 caracteres'),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('ID da categoria inválido'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Data inválida')
    .custom((value) => {
      const date = new Date(value);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      
      if (date > oneYearFromNow) {
        throw new Error('Data não pode ser mais de 1 ano no futuro');
      }
      return true;
    })
];

// Validações para listar transações
const listTransactionsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser entre 1 e 100'),
  query('type')
    .optional()
    .isIn([TransactionType.INCOME, TransactionType.EXPENSE])
    .withMessage('Tipo deve ser income ou expense'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data inicial inválida'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data final inválida'),
  query('category')
    .optional()
    .isMongoId()
    .withMessage('ID da categoria inválido')
];

// Criar transação
router.post('/', auth, createTransactionValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const { type, amount, description, category, date }: CreateTransactionDTO = req.body;

    // Verificar se a categoria pertence ao usuário
    const categoryDoc = await Category.findOne({ 
      _id: category, 
      user: req.user._id 
    });

    if (!categoryDoc) {
      res.status(400).json({
        success: false,
        message: 'Categoria não encontrada'
      });
      return;
    }

    // Verificar se o tipo da transação é compatível com a categoria
    if (categoryDoc.type !== 'both' && categoryDoc.type !== type) {
      res.status(400).json({
        success: false,
        message: `Esta categoria é apenas para ${categoryDoc.type === 'income' ? 'ganhos' : 'gastos'}`
      });
      return;
    }

    const transaction = new Transaction({
      user: req.user._id,
      type,
      amount,
      description,
      category,
      date: date || new Date()
    });

    await transaction.save();
    await transaction.populate('category');

    res.status(201).json({
      success: true,
      message: 'Transação criada com sucesso',
      transaction
    });
  } catch (error: any) {
    console.error('Erro ao criar transação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Listar transações com filtros
router.get('/', auth, listTransactionsValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const {
      page = 1,
      limit = 20,
      type,
      startDate,
      endDate,
      category
    }: TransactionFilters = req.query;

    // Construir filtros
    const filters: any = { user: req.user._id };
    
    if (type) filters.type = type;
    if (category) filters.category = category;
    
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.$gte = new Date(startDate);
      if (endDate) filters.date.$lte = new Date(endDate);
    }

    // Executar consulta
    const skip = (Number(page) - 1) * Number(limit);
    const transactions = await Transaction.find(filters)
      .populate('category')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Transaction.countDocuments(filters);

    res.json({
      success: true,
      transactions,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        hasNext: skip + transactions.length < total,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error: any) {
    console.error('Erro ao listar transações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Obter transação por ID
router.get('/:id', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('category').lean();

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transação não encontrada'
      });
      return;
    }

    res.json({
      success: true,
      transaction
    });
  } catch (error: any) {
    console.error('Erro ao obter transação:', error);
    
    if (error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: 'ID da transação inválido'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Atualizar transação
router.put('/:id', auth, updateTransactionValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const updates: UpdateTransactionDTO = req.body;
    
    // Se categoria foi fornecida, verificar se pertence ao usuário
    if (updates.category) {
      const categoryDoc = await Category.findOne({ 
        _id: updates.category, 
        user: req.user._id 
      });
      
      if (!categoryDoc) {
        res.status(400).json({
          success: false,
          message: 'Categoria não encontrada'
        });
        return;
      }

      // Verificar compatibilidade de tipo
      if (updates.type && categoryDoc.type !== 'both' && categoryDoc.type !== updates.type) {
        res.status(400).json({
          success: false,
          message: `Esta categoria é apenas para ${categoryDoc.type === 'income' ? 'ganhos' : 'gastos'}`
        });
        return;
      }
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true }
    ).populate('category');

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transação não encontrada'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Transação atualizada com sucesso',
      transaction
    });
  } catch (error: any) {
    console.error('Erro ao atualizar transação:', error);
    
    if (error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: 'ID da transação inválido'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Deletar transação
router.delete('/:id', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transação não encontrada'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Transação deletada com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao deletar transação:', error);
    
    if (error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: 'ID da transação inválido'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Resumo financeiro
router.get('/summary/stats', auth, [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data inicial inválida'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data final inválida')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const { startDate, endDate } = req.query;
    
    const startDateObj = startDate ? new Date(startDate as string) : undefined;
    const endDateObj = endDate ? new Date(endDate as string) : undefined;

    const summary = await (Transaction as any).getFinancialSummary(
      req.user._id.toString(),
      startDateObj,
      endDateObj
    );

    res.json({
      success: true,
      summary
    });
  } catch (error: any) {
    console.error('Erro ao obter resumo financeiro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Análise por categoria
router.get('/analytics/by-category', auth, [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data inicial inválida'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data final inválida'),
  query('type')
    .optional()
    .isIn([TransactionType.INCOME, TransactionType.EXPENSE])
    .withMessage('Tipo deve ser income ou expense')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const { startDate, endDate, type } = req.query;
    
    const matchStage: any = { user: req.user._id };
    
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate as string);
      if (endDate) matchStage.date.$lte = new Date(endDate as string);
    }
    
    if (type) {
      matchStage.type = type;
    }

    const analytics = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          _id: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          count: 1,
          avgAmount: { $round: ['$avgAmount', 2] },
          minAmount: { $round: ['$minAmount', 2] },
          maxAmount: { $round: ['$maxAmount', 2] },
          category: {
            name: '$category.name',
            icon: '$category.icon',
            color: '$category.color',
            type: '$category.type'
          }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      analytics
    });
  } catch (error: any) {
    console.error('Erro ao obter análise por categoria:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Análise temporal (por mês)
router.get('/analytics/by-month', auth, [
  query('year')
    .optional()
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Ano deve ser entre 2020 e 2030'),
  query('type')
    .optional()
    .isIn([TransactionType.INCOME, TransactionType.EXPENSE])
    .withMessage('Tipo deve ser income ou expense')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const { year, type } = req.query;
    const currentYear = year ? Number(year) : new Date().getFullYear();
    
    const matchStage: any = { 
      user: req.user._id,
      date: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`)
      }
    };
    
    if (type) {
      matchStage.type = type;
    }

    const monthlyData = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            type: '$type'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.month',
          data: {
            $push: {
              type: '$_id.type',
              totalAmount: { $round: ['$totalAmount', 2] },
              count: '$count'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      year: currentYear,
      monthlyData
    });
  } catch (error: any) {
    console.error('Erro ao obter análise mensal:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

export default router;