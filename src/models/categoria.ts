// src/models/categoria.ts
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum TipoTransacao {
  RECEITA = 'RECEITA',
  DESPESA = 'DESPESA'
}

export class Categoria extends Model {
  public id!: number;
  public usuario_id!: number;
  public nome!: string;
  public icone!: string;
  public cor!: string;
  public tipo!: TipoTransacao;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Categoria.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id',
      },
    },
    nome: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    icone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    cor: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.ENUM('RECEITA', 'DESPESA'),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Categoria',
    tableName: 'categorias',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);