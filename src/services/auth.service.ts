// src/services/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/usuario';

export const AuthService = {
  async register(nome: string, email: string, senha: string, whatsapp?: string) {
    // Verifica se usuário já existe
    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('Email já cadastrado');
    }

    // Hash da senha
    const senha_hash = await bcrypt.hash(senha, 10);

    // Cria usuário
    const usuario = await Usuario.create({
      nome,
      email,
      senha_hash,
      whatsapp,
    });

    // Gera token
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return { token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
  },

  async login(email: string, senha: string) {
    // Busca usuário
    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario) {
      throw new Error('Email ou senha incorretos');
    }

    // Verifica senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      throw new Error('Email ou senha incorretos');
    }

    // Gera token
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return { token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
  }
};