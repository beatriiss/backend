import express, { Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import { AuthenticatedRequest, CreateCategoryDTO, UpdateCategoryDTO, CategoryType } from '../types';
import { auth } from '../middlewares/auth';

const router = express.Router();

// Validações para criar categoria
const createCategoryValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Nome da categoria deve ter entre 1 e 30 caracteres'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Ícone deve ter no máximo 10 caracteres'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Cor deve estar no formato hexadecimal (#000000)'),
  body('type')
    .optional()
    .isIn([CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.BOTH])
    .withMessage('Tipo deve ser income, expense ou both')
];

// Validações para atualizar categoria
const updateCategoryValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Nome da categoria deve ter entre 1 e 30 caracteres'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Ícone deve ter no máximo 10 caracteres'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Cor deve estar no formato hexadecimal (#000000)'),
  body('type')
    .optional()
    .isIn([CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.BOTH])
    .withMessage('Tipo deve ser income, expense ou both')
];

// Listar categorias
router.get('/', auth, [
  query('type')
    .optional()
    .isIn([CategoryType.INCOME, CategoryType.EXPENSE])
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

    const { type } = req.query;
    
    const filters: any = { user: req.user._id };
    
    if (type && [CategoryType.INCOME, CategoryType.EXPENSE].includes(type as CategoryType)) {
      filters.$or = [
        { type: type },
        { type: CategoryType.BOTH }
      ];
    }

    const categories = await Category.find(filters)
      .sort({ name: 1 })
      .lean();
    
    res.json({
      success: true,
      categories
    });
  } catch (error: any) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Criar categoria
router.post('/', auth, createCategoryValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const { name, icon, color, type }: CreateCategoryDTO = req.body;

    // Verificar se já existe categoria com esse nome para o usuário
    const existingCategory = await Category.findOne({
      name: name.trim(),
      user: req.user._id
    });

    if (existingCategory) {
      res.status(400).json({
        success: false,
        message: 'Já existe uma categoria com este nome'
      });
      return;
    }

    const category = new Category({
      name: name.trim(),
      icon: icon || '💰',
      color: color || '#3B82F6',
      type: type || CategoryType.BOTH,
      user: req.user._id
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso',
      category
    });
  } catch (error: any) {
    console.error('Erro ao criar categoria:', error);
    
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Já existe uma categoria com este nome'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Obter categoria por ID
router.get('/:id', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const category = await Category.findOne({
      _id: req.params.id,
      user: req.user._id
    }).lean();

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
      return;
    }

    res.json({
      success: true,
      category
    });
  } catch (error: any) {
    console.error('Erro ao obter categoria:', error);
    
    if (error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: 'ID da categoria inválido'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Atualizar categoria
router.put('/:id', auth, updateCategoryValidation, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const updates: UpdateCategoryDTO = req.body;

    // Se o nome está sendo atualizado, verificar duplicata
    if (updates.name) {
      const existingCategory = await Category.findOne({
        name: updates.name.trim(),
        user: req.user._id,
        _id: { $ne: req.params.id }
      });

      if (existingCategory) {
        res.status(400).json({
          success: false,
          message: 'Já existe uma categoria com este nome'
        });
        return;
      }
    }

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true }
    );

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      category
    });
  } catch (error: any) {
    console.error('Erro ao atualizar categoria:', error);
    
    if (error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: 'ID da categoria inválido'
      });
      return;
    }
    
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Já existe uma categoria com este nome'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Deletar categoria
router.delete('/:id', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    // Verificar se existem transações usando esta categoria
    const transactionsCount = await Transaction.countDocuments({
      category: req.params.id,
      user: req.user._id
    });

    if (transactionsCount > 0) {
      res.status(400).json({
        success: false,
        message: `Não é possível deletar esta categoria pois existem ${transactionsCount} transação(ões) vinculada(s) a ela`
      });
      return;
    }

    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Categoria deletada com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao deletar categoria:', error);
    
    if (error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: 'ID da categoria inválido'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Obter estatísticas de uso das categorias
router.get('/stats/usage', auth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    const stats = await Transaction.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          lastUsed: { $max: '$date' }
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
          count: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          avgAmount: { $round: ['$avgAmount', 2] },
          lastUsed: 1,
          category: {
            name: '$category.name',
            icon: '$category.icon',
            color: '$category.color',
            type: '$category.type'
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Erro ao obter estatísticas das categorias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

export default router;