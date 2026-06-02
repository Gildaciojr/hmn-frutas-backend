import { Injectable, NotFoundException } from '@nestjs/common';

import { CategoriaAlerta, SeveridadeAlerta } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

interface FindAllParams {
  resolvido?: boolean;

  lido?: boolean;
}

interface CriarAlertaParams {
  categoria: CategoriaAlerta;

  severidade: SeveridadeAlerta;

  titulo: string;

  mensagem: string;

  clienteId?: string | null;

  fornecedorId?: string | null;
}

@Injectable()
export class AlertasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindAllParams) {
    const alertas = await this.prisma.alertaSistema.findMany({
      where: {
        ...(params.resolvido !== undefined && {
          resolvido: params.resolvido,
        }),

        ...(params.lido !== undefined && {
          lido: params.lido,
        }),
      },

      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            telefone: true,
          },
        },

        fornecedor: {
          select: {
            id: true,
            nome: true,
            sobrenome: true,
            telefone: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 100,
    });

    return alertas;
  }

  async criarOuAtualizar(params: CriarAlertaParams) {
    const alertaExistente = await this.prisma.alertaSistema.findFirst({
      where: {
        categoria: params.categoria,

        clienteId: params.clienteId ?? null,

        fornecedorId: params.fornecedorId ?? null,

        resolvido: false,

        titulo: params.titulo,
      },
    });

    if (alertaExistente) {
      return this.prisma.alertaSistema.update({
        where: {
          id: alertaExistente.id,
        },

        data: {
          severidade: params.severidade,

          mensagem: params.mensagem,

          lido: false,
        },
      });
    }

    return this.prisma.alertaSistema.create({
      data: {
        categoria: params.categoria,

        severidade: params.severidade,

        titulo: params.titulo,

        mensagem: params.mensagem,

        clienteId: params.clienteId ?? null,

        fornecedorId: params.fornecedorId ?? null,
      },
    });
  }

  async marcarComoLido(id: string) {
    const alerta = await this.prisma.alertaSistema.findUnique({
      where: {
        id,
      },
    });

    if (!alerta) {
      throw new NotFoundException('Alerta não encontrado');
    }

    return this.prisma.alertaSistema.update({
      where: {
        id,
      },

      data: {
        lido: true,
      },
    });
  }

  async resolver(id: string) {
    const alerta = await this.prisma.alertaSistema.findUnique({
      where: {
        id,
      },
    });

    if (!alerta) {
      throw new NotFoundException('Alerta não encontrado');
    }

    return this.prisma.alertaSistema.update({
      where: {
        id,
      },

      data: {
        resolvido: true,
        lido: true,
      },
    });
  }
}
