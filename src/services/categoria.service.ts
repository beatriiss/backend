// src/services/categoria.service.ts
import { Categoria, TipoTransacao } from '../models/categoria';

export class CategoriaService {
  static async criar(usuario_id: number, nome: string, icone: string, cor: string, tipo: TipoTransacao) {
    const categoria = await Categoria.create({
      usuario_id,
      nome,
      icone,
      cor,
      tipo,
    });

    return categoria;
  }

  static async listar(usuario_id: number, tipo?: TipoTransacao) {
    const where: any = { usuario_id };
    
    if (tipo) {
      where.tipo = tipo;
    }

    const categorias = await Categoria.findAll({
      where,
      order: [['created_at', 'DESC']],
    });

    return categorias;
  }

  static async buscarPorId(id: number, usuario_id: number) {
    const categoria = await Categoria.findOne({
      where: { id, usuario_id },
    });

    if (!categoria) {
      throw new Error('Categoria não encontrada');
    }

    return categoria;
  }

  static async atualizar(id: number, usuario_id: number, dados: Partial<Omit<Categoria, 'id' | 'usuario_id'>>) {
    const categoria = await this.buscarPorId(id, usuario_id);
    
    await categoria.update(dados);
    return categoria;
  }

  static async deletar(id: number, usuario_id: number) {
    const categoria = await this.buscarPorId(id, usuario_id);
    await categoria.destroy();
  }
}