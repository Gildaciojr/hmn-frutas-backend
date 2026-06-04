import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  ////////////////////////////////////////////////////////////
  // FIND LOGIN
  ////////////////////////////////////////////////////////////

  findByLogin(login: string) {
    const normalizedLogin = login.trim().toLowerCase();

    if (normalizedLogin.includes('@')) {
      return this.prisma.user.findUnique({
        where: {
          email: normalizedLogin,
        },
      });
    }

    return this.prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedLogin,
          mode: 'insensitive',
        },
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // FIND EMAIL
  ////////////////////////////////////////////////////////////

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // FIND ID
  ////////////////////////////////////////////////////////////

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  findAll() {
    return this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },

      select: {
        id: true,

        nome: true,

        sobrenome: true,

        username: true,

        email: true,

        telefone: true,

        endereco: true,

        role: true,

        createdAt: true,
      },
    });
  }
}
