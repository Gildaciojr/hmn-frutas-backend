import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma, StatusFinanceiro, TipoTransacao } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateDespesaOperacionalDto } from './dto/create-despesa-operacional.dto';

import { SearchDespesaOperacionalDto } from './dto/search-despesa-operacional.dto';

@Injectable()
export class DespesasOperacionaisService {
  constructor(private readonly prisma: PrismaService) {}

  ////////////////////////////////////////////////////////////
  // CREATE
  ////////////////////////////////////////////////////////////

  async create(data: CreateDespesaOperacionalDto) {
    return this.prisma.$transaction(async (tx) => {
      //////////////////////////////////////////////////////////
      // TRANSAÇÃO FINANCEIRA
      //////////////////////////////////////////////////////////

      const transacao = await tx.transacao.create({
        data: {
          tipo: TipoTransacao.SAIDA,

          valor: new Prisma.Decimal(data.valor),

          valorPago: new Prisma.Decimal(data.valor),

          valorRestante: new Prisma.Decimal(0),

          statusFinanceiro: StatusFinanceiro.PAGO,

          descricao: data.atividade,

          observacoes: data.observacoes,

          pagoEm: new Date(data.data),

          vencimento: new Date(data.data),
        },
      });

      //////////////////////////////////////////////////////////
      // DESPESA
      //////////////////////////////////////////////////////////

      const despesa = await tx.despesaOperacional.create({
        data: {
          data: new Date(data.data),

          atividade: data.atividade,

          valor: new Prisma.Decimal(data.valor),

          observacoes: data.observacoes,

          transacaoId: transacao.id,
        },
      });

      return despesa;
    });
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  findAll() {
    return this.prisma.despesaOperacional.findMany({
      include: {
        transacao: true,
      },

      orderBy: {
        data: 'desc',
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // SEARCH
  ////////////////////////////////////////////////////////////

  search(filters: SearchDespesaOperacionalDto) {
    return this.prisma.despesaOperacional.findMany({
      where: {
        //////////////////////////////////////////////////////
        // ATIVIDADE
        //////////////////////////////////////////////////////

        atividade: filters.atividade
          ? {
              contains: filters.atividade,
              mode: 'insensitive',
            }
          : undefined,

        //////////////////////////////////////////////////////
        // DATA
        //////////////////////////////////////////////////////

        data:
          filters.dataInicial || filters.dataFinal
            ? {
                gte: filters.dataInicial
                  ? new Date(filters.dataInicial)
                  : undefined,

                lte: filters.dataFinal
                  ? new Date(filters.dataFinal)
                  : undefined,
              }
            : undefined,

        //////////////////////////////////////////////////////
        // VALOR
        //////////////////////////////////////////////////////

        valor:
          filters.valorMinimo || filters.valorMaximo
            ? {
                gte: filters.valorMinimo
                  ? new Prisma.Decimal(filters.valorMinimo)
                  : undefined,

                lte: filters.valorMaximo
                  ? new Prisma.Decimal(filters.valorMaximo)
                  : undefined,
              }
            : undefined,
      },

      include: {
        transacao: true,
      },

      orderBy: {
        data: 'desc',
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // FIND ONE
  ////////////////////////////////////////////////////////////

  async findOne(id: string) {
    const despesa = await this.prisma.despesaOperacional.findUnique({
      where: {
        id,
      },

      include: {
        transacao: true,
      },
    });

    if (!despesa) {
      throw new NotFoundException('Despesa não encontrada');
    }

    return despesa;
  }

  ////////////////////////////////////////////////////////////
  // RESUMO
  ////////////////////////////////////////////////////////////

  async resumo() {
    const despesas = await this.prisma.despesaOperacional.findMany();

    const total = despesas.reduce((acc, despesa) => {
      return acc + Number(despesa.valor);
    }, 0);

    const maiorDespesa = despesas.reduce((maior, despesa) => {
      const valor = Number(despesa.valor);

      return valor > maior ? valor : maior;
    }, 0);

    const menorDespesa =
      despesas.length > 0
        ? despesas.reduce((menor, despesa) => {
            const valor = Number(despesa.valor);

            return valor < menor ? valor : menor;
          }, Number(despesas[0].valor))
        : 0;

    const mediaDespesa = despesas.length > 0 ? total / despesas.length : 0;

    const ultimaDespesa =
      despesas.length > 0
        ? [...despesas].sort((a, b) => b.data.getTime() - a.data.getTime())[0]
        : null;

    return {
      quantidadeDespesas: despesas.length,

      total,

      mediaDespesa,

      maiorDespesa,

      menorDespesa,

      ultimaDespesa,
    };
  }
}
