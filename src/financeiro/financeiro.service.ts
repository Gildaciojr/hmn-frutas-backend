import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  FormaPagamento,
  Prisma,
  StatusCompra,
  StatusFinanceiro,
  StatusVenda,
  TipoTransacao,
} from '@prisma/client';

import {
  assertFinancialConsistency,
  financialDueOrder,
  financialProjection,
  isOverdue,
  openFinancialStatuses,
  paymentStatus,
  serializableTransaction,
  summarizeTitles,
} from './financial-state';
import type { RegistrarPagamentoDto } from './dto/registrar-pagamento.dto';
import { AlertasService } from '../alertas/alertas.service';
import { PrismaService } from '../prisma/prisma.service';

import { Response } from 'express';

import { RelatorioProducaoDto } from './dto/relatorio-producao.dto';

import { gerarRelatorioProducaoPdf } from './templates/producao-relatorio.template';
import {
  getOperationalDateRange,
  parseOperationalDate,
} from '../common/utils/report-period';

type ProducaoCompra = Prisma.CompraGetPayload<{
  include: { fornecedor: { select: { nome: true } } };
}>;
type ProducaoVenda = Prisma.VendaGetPayload<{
  include: { cliente: { select: { nome: true } } };
}>;

@Injectable()
export class FinanceiroService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly alertasService: AlertasService,
  ) {}

  ////////////////////////////////////////////////////////////
  // RESUMO GERAL
  ////////////////////////////////////////////////////////////

  async resumoGeral() {
    const [entradasResult, saidasResult, comprasAgg, vendasAgg] =
      await Promise.all([
        //////////////////////////////////////////////////////////
        // ENTRADAS
        //////////////////////////////////////////////////////////

        this.prisma.transacao.aggregate({
          where: {
            tipo: TipoTransacao.ENTRADA,
            statusFinanceiro: { not: StatusFinanceiro.CANCELADO },
          },

          _sum: {
            valor: true,
          },

          _count: true,
        }),

        //////////////////////////////////////////////////////////
        // SAÍDAS
        //////////////////////////////////////////////////////////

        this.prisma.transacao.aggregate({
          where: {
            tipo: TipoTransacao.SAIDA,
            statusFinanceiro: { not: StatusFinanceiro.CANCELADO },
          },

          _sum: {
            valor: true,
          },

          _count: true,
        }),

        //////////////////////////////////////////////////////////
        // COMPRAS
        //////////////////////////////////////////////////////////

        this.prisma.compra.aggregate({
          where: { status: { not: StatusCompra.CANCELADA } },
          _sum: {
            valorTotal: true,

            totalBruto: true,

            despesas: true,

            kgBruto: true,

            kgLiquido: true,
          },

          _count: true,
        }),

        //////////////////////////////////////////////////////////
        // VENDAS
        //////////////////////////////////////////////////////////

        this.prisma.venda.aggregate({
          where: {
            status: {
              not: StatusVenda.CANCELADA,
            },
          },

          _sum: {
            valorTotal: true,

            pesoBruto: true,

            pesoLiquido: true,

            freteTotal: true,
          },

          _count: true,
        }),
      ]);

    ////////////////////////////////////////////////////////////
    // FINANCEIRO
    ////////////////////////////////////////////////////////////

    const [recebido, pago, receber, pagar] = await Promise.all([
      this.prisma.pagamentoTransacao.aggregate({
        where: { transacao: { tipo: TipoTransacao.ENTRADA } },
        _sum: { valor: true },
      }),
      this.prisma.pagamentoTransacao.aggregate({
        where: { transacao: { tipo: TipoTransacao.SAIDA } },
        _sum: { valor: true },
      }),
      this.prisma.transacao.aggregate({
        where: {
          tipo: TipoTransacao.ENTRADA,
          statusFinanceiro: { in: openFinancialStatuses },
          valorRestante: { gt: 0 },
        },
        _sum: { valorRestante: true },
      }),
      this.prisma.transacao.aggregate({
        where: {
          tipo: TipoTransacao.SAIDA,
          statusFinanceiro: { in: openFinancialStatuses },
          valorRestante: { gt: 0 },
        },
        _sum: { valorRestante: true },
      }),
    ]);
    const totalRecebido = Number(recebido._sum.valor ?? 0);
    const totalPago = Number(pago._sum.valor ?? 0);
    const totalAReceber = Number(receber._sum.valorRestante ?? 0);
    const totalAPagar = Number(pagar._sum.valorRestante ?? 0);
    const totalEntradas = Number(entradasResult._sum.valor ?? 0);

    const totalSaidas = Number(saidasResult._sum.valor ?? 0);

    ////////////////////////////////////////////////////////////
    // ESTOQUE REAL
    ////////////////////////////////////////////////////////////

    const totalKgComprado = Number(comprasAgg._sum.kgBruto ?? 0);

    const totalKgVendido = Number(vendasAgg._sum.pesoBruto ?? 0);

    ////////////////////////////////////////////////////////////
    // OPERACIONAL
    ////////////////////////////////////////////////////////////

    const totalKgLiquidoComprado = Number(comprasAgg._sum.kgLiquido ?? 0);

    const totalKgLiquidoVendido = Number(vendasAgg._sum.pesoLiquido ?? 0);

    ////////////////////////////////////////////////////////////
    // FINANCEIRO COMPRAS
    ////////////////////////////////////////////////////////////

    const totalComprado = Number(comprasAgg._sum.valorTotal ?? 0);

    const totalBrutoCompras = Number(comprasAgg._sum.totalBruto ?? 0);

    const totalDespesas = Number(comprasAgg._sum.despesas ?? 0);

    ////////////////////////////////////////////////////////////
    // FINANCEIRO VENDAS
    ////////////////////////////////////////////////////////////

    const totalVendido = Number(vendasAgg._sum.valorTotal ?? 0);

    const totalFretesVenda = Number(vendasAgg._sum.freteTotal ?? 0);

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      //////////////////////////////////////////////////////////
      // FINANCEIRO
      //////////////////////////////////////////////////////////

      totalEntradas,
      titulosEntrada: totalEntradas,
      titulosSaida: totalSaidas,
      totalRecebido,
      totalPago,
      totalAReceber,
      totalAPagar,
      resultadoCaixa: totalRecebido - totalPago,
      diferencaOperacional: totalVendido - totalComprado,

      totalSaidas,

      saldo: totalEntradas - totalSaidas,

      // Deprecated compatibility alias: operational difference, not profit.
      lucroBruto: totalVendido - totalComprado,

      //////////////////////////////////////////////////////////
      // COMPRAS
      //////////////////////////////////////////////////////////

      totalComprado,

      totalBrutoCompras,

      totalDespesas,

      //////////////////////////////////////////////////////////
      // VENDAS
      //////////////////////////////////////////////////////////

      totalVendido,

      totalFretesVenda,

      //////////////////////////////////////////////////////////
      // ESTOQUE REAL
      //////////////////////////////////////////////////////////

      totalKgComprado,

      totalKgVendido,

      estoqueAtualKg: totalKgComprado - totalKgVendido,

      //////////////////////////////////////////////////////////
      // OPERACIONAL
      //////////////////////////////////////////////////////////

      totalKgLiquidoComprado,

      totalKgLiquidoVendido,

      //////////////////////////////////////////////////////////
      // CONTADORES
      //////////////////////////////////////////////////////////

      totalCompras: comprasAgg._count,

      totalVendas: vendasAgg._count,

      totalEntradasLancamentos: entradasResult._count,

      totalSaidasLancamentos: saidasResult._count,
    };
  }

  ////////////////////////////////////////////////////////////
  // FLUXO
  ////////////////////////////////////////////////////////////

  async fluxo() {
    const events = await this.prisma.pagamentoTransacao.findMany({
      include: {
        transacao: {
          include: {
            cliente: true,
            fornecedor: true,
            compra: true,
            venda: true,
          },
        },
      },
      orderBy: [{ pagoEm: 'desc' }, { id: 'desc' }],
    });
    return events.map((event) => ({
      ...event.transacao,
      id: event.id,
      transacaoId: event.transacaoId,
      valor: event.valor,
      pagoEm: event.pagoEm,
      formaPagamento: event.formaPagamento,
      observacoes: event.observacoes,
      createdAt: event.pagoEm,
    }));
  }

  ////////////////////////////////////////////////////////////
  // DADOS RELATÓRIO PRODUÇÃO — unchanged operational source
  ////////////////////////////////////////////////////////////

  async obterDadosRelatorioProducao(
    filtros: RelatorioProducaoDto,
    emissor?: string,
  ) {
    const range = getOperationalDateRange(
      filtros.dataInicial,
      filtros.dataFinal,
    );
    const dataInicio = parseOperationalDate(filtros.dataInicial);
    const dataFim = parseOperationalDate(filtros.dataFinal);
    const tipo = filtros.tipo ?? 'AMBOS';

    const compraWhere: Prisma.CompraWhereInput = {
      dataCompra: range,

      status: {
        not: StatusCompra.CANCELADA,
      },
    };

    const vendaWhere: Prisma.VendaWhereInput = {
      dataVenda: range,

      status: {
        not: StatusVenda.CANCELADA,
      },
    };

    const compraOptionsWhere = { ...compraWhere };
    const vendaOptionsWhere = { ...vendaWhere };

    if (filtros.usuarioId) {
      compraWhere.usuarioResponsavelId = filtros.usuarioId;

      vendaWhere.usuarioResponsavelId = filtros.usuarioId;
    }

    const [compras, vendas, usuariosCompras, usuariosVendas] =
      await Promise.all([
        tipo === 'VENDAS'
          ? Promise.resolve<ProducaoCompra[]>([])
          : this.prisma.compra.findMany({
              where: compraWhere,
              include: { fornecedor: { select: { nome: true } } },
              orderBy: [{ dataCompra: 'desc' }, { id: 'desc' }],
            }),
        tipo === 'COMPRAS'
          ? Promise.resolve<ProducaoVenda[]>([])
          : this.prisma.venda.findMany({
              where: vendaWhere,
              include: { cliente: { select: { nome: true } } },
              orderBy: [{ dataVenda: 'desc' }, { id: 'desc' }],
            }),
        tipo === 'VENDAS'
          ? Promise.resolve([])
          : this.prisma.compra.groupBy({
              by: ['usuarioResponsavelId', 'usuarioResponsavelNome'],
              where: compraOptionsWhere,
            }),
        tipo === 'COMPRAS'
          ? Promise.resolve([])
          : this.prisma.venda.groupBy({
              by: ['usuarioResponsavelId', 'usuarioResponsavelNome'],
              where: vendaOptionsWhere,
            }),
      ]);

    const availableUsers = new Map<string, { id: string; nome: string }>();
    for (const item of [...usuariosCompras, ...usuariosVendas]) {
      if (item.usuarioResponsavelId) {
        availableUsers.set(item.usuarioResponsavelId, {
          id: item.usuarioResponsavelId,
          nome: item.usuarioResponsavelNome ?? 'Não identificado',
        });
      }
    }
    const usuariosDisponiveis = [...availableUsers.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    );

    const usuarios = new Map<
      string,
      {
        usuarioId: string | null;

        usuarioNome: string;

        quantidadeCompras: number;

        quantidadeVendas: number;

        kgComprado: number;

        kgVendido: number;

        valorComprado: number;

        valorVendido: number;
      }
    >();

    for (const compra of compras) {
      const chave =
        compra.usuarioResponsavelId ??
        compra.usuarioResponsavelNome ??
        'SEM_USUARIO';

      if (!usuarios.has(chave)) {
        usuarios.set(chave, {
          usuarioId: compra.usuarioResponsavelId ?? null,

          usuarioNome: compra.usuarioResponsavelNome ?? 'Não identificado',

          quantidadeCompras: 0,

          quantidadeVendas: 0,

          kgComprado: 0,

          kgVendido: 0,

          valorComprado: 0,

          valorVendido: 0,
        });
      }

      const item = usuarios.get(chave)!;

      item.quantidadeCompras += 1;

      item.kgComprado = new Prisma.Decimal(item.kgComprado)
        .add(compra.kgLiquido)
        .toNumber();

      item.valorComprado = new Prisma.Decimal(item.valorComprado)
        .add(compra.valorTotal)
        .toNumber();
    }

    for (const venda of vendas) {
      const chave =
        venda.usuarioResponsavelId ??
        venda.usuarioResponsavelNome ??
        'SEM_USUARIO';

      if (!usuarios.has(chave)) {
        usuarios.set(chave, {
          usuarioId: venda.usuarioResponsavelId ?? null,

          usuarioNome: venda.usuarioResponsavelNome ?? 'Não identificado',

          quantidadeCompras: 0,

          quantidadeVendas: 0,

          kgComprado: 0,

          kgVendido: 0,

          valorComprado: 0,

          valorVendido: 0,
        });
      }

      const item = usuarios.get(chave)!;

      item.quantidadeVendas += 1;

      item.kgVendido = new Prisma.Decimal(item.kgVendido)
        .add(venda.pesoLiquido)
        .toNumber();

      item.valorVendido = new Prisma.Decimal(item.valorVendido)
        .add(venda.valorTotal)
        .toNumber();
    }

    const producaoPorUsuario = Array.from(usuarios.values()).sort(
      (a, b) =>
        b.quantidadeCompras +
        b.quantidadeVendas -
        (a.quantidadeCompras + a.quantidadeVendas),
    );

    return {
      periodo: {
        dataInicio,

        dataFim,
      },

      filtros: { ...filtros, tipo },
      usuariosDisponiveis,
      usuarioSelecionado: filtros.usuarioId
        ? (availableUsers.get(filtros.usuarioId)?.nome ?? filtros.usuarioId)
        : 'Todos',
      emissor,

      totais: {
        compras: compras.length,

        vendas: vendas.length,

        valorComprado: compras
          .reduce(
            (acc, item) => acc.add(item.valorTotal),
            new Prisma.Decimal(0),
          )
          .toNumber(),

        valorVendido: vendas
          .reduce(
            (acc, item) => acc.add(item.valorTotal),
            new Prisma.Decimal(0),
          )
          .toNumber(),

        kgComprado: compras
          .reduce((acc, item) => acc.add(item.kgLiquido), new Prisma.Decimal(0))
          .toNumber(),

        kgVendido: vendas
          .reduce(
            (acc, item) => acc.add(item.pesoLiquido),
            new Prisma.Decimal(0),
          )
          .toNumber(),
      },

      producaoPorUsuario,

      compras,

      vendas,
    };
  }
  ////////////////////////////////////////////////////////////
  // PDF RELATÓRIO PRODUÇÃO
  ////////////////////////////////////////////////////////////

  async gerarRelatorioProducaoPdf(
    filtros: RelatorioProducaoDto,
    res: Response,
    emissor?: string,
  ) {
    const dados = await this.obterDadosRelatorioProducao(filtros, emissor);

    const pdfBuffer = await gerarRelatorioProducaoPdf(dados);

    res.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',

      'Content-Disposition': `attachment; filename=relatorio-producao.pdf`,

      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  ////////////////////////////////////////////////////////////
  // FINANCEIRO CLIENTE
  ////////////////////////////////////////////////////////////

  async financeiroPorCliente(clienteId: string) {
    ////////////////////////////////////////////////////////////
    // CLIENTE
    ////////////////////////////////////////////////////////////

    const cliente = await this.prisma.cliente.findUnique({
      where: {
        id: clienteId,
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    ////////////////////////////////////////////////////////////
    // TRANSAÇÕES
    ////////////////////////////////////////////////////////////

    const [entradasResult, saidasResult, compras, vendas, transacoes] =
      await Promise.all([
        //////////////////////////////////////////////////////////
        // ENTRADAS
        //////////////////////////////////////////////////////////

        this.prisma.transacao.aggregate({
          where: {
            clienteId,

            tipo: TipoTransacao.ENTRADA,
          },

          _sum: {
            valor: true,
          },
        }),

        //////////////////////////////////////////////////////////
        // SAÍDAS
        //////////////////////////////////////////////////////////

        this.prisma.transacao.aggregate({
          where: {
            clienteId,

            tipo: TipoTransacao.SAIDA,
          },

          _sum: {
            valor: true,
          },
        }),

        //////////////////////////////////////////////////////////
        // COMPRAS
        //////////////////////////////////////////////////////////

        this.prisma.compra.findMany({
          where: {
            clienteId,
          },

          orderBy: {
            dataCompra: 'desc',
          },
        }),

        //////////////////////////////////////////////////////////
        // VENDAS
        //////////////////////////////////////////////////////////

        this.prisma.venda.findMany({
          where: {
            clienteId,

            status: {
              not: StatusVenda.CANCELADA,
            },
          },

          orderBy: {
            dataVenda: 'desc',
          },
        }),

        //////////////////////////////////////////////////////////
        // TRANSAÇÕES FINANCEIRAS
        //////////////////////////////////////////////////////////

        this.prisma.transacao.findMany({
          where: {
            clienteId,
          },

          include: {
            pagamentos: true,
            ////////////////////////////////////////////////////////
            // CLIENTE
            ////////////////////////////////////////////////////////

            cliente: true,

            ////////////////////////////////////////////////////////
            // COMPRA
            ////////////////////////////////////////////////////////

            compra: true,

            ////////////////////////////////////////////////////////
            // VENDA
            ////////////////////////////////////////////////////////

            venda: true,
          },

          orderBy: {
            createdAt: 'desc',
          },
        }),
      ]);

    ////////////////////////////////////////////////////////////
    // TOTAIS
    ////////////////////////////////////////////////////////////

    const totalEntradas = Number(entradasResult._sum.valor ?? 0);

    const totalSaidas = Number(saidasResult._sum.valor ?? 0);

    ////////////////////////////////////////////////////////////
    // TOTAL PAGO
    ////////////////////////////////////////////////////////////

    const financial = summarizeTitles(transacoes, TipoTransacao.ENTRADA);
    const totalPago = financial.realizado;

    ////////////////////////////////////////////////////////////
    // TOTAL PENDENTE
    ////////////////////////////////////////////////////////////

    const totalPendente = financial.aberto;

    ////////////////////////////////////////////////////////////
    // SALDO
    ////////////////////////////////////////////////////////////

    const saldo = totalPendente;

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      //////////////////////////////////////////////////////////
      // CLIENTE
      //////////////////////////////////////////////////////////

      cliente: {
        id: cliente.id,

        nome: cliente.nome,

        telefone: cliente.telefone,

        documento: cliente.cpf ?? cliente.cnpj ?? null,
      },

      //////////////////////////////////////////////////////////
      // RESUMO LEGADO
      //////////////////////////////////////////////////////////

      totalComprado: compras
        .filter((item) => item.status !== StatusCompra.CANCELADA)
        .reduce((sum, item) => sum.add(item.valorTotal), new Prisma.Decimal(0))
        .toNumber(),

      totalVendido: vendas
        .reduce((sum, item) => sum.add(item.valorTotal), new Prisma.Decimal(0))
        .toNumber(),

      saldo,

      //////////////////////////////////////////////////////////
      // RESUMO FINANCEIRO
      //////////////////////////////////////////////////////////

      resumoFinanceiro: {
        totalEntradas,

        totalSaidas,

        totalPago,
        totalPendente,
        totalRecebido: financial.realizado,
        totalAReceber: financial.aberto,
        totalVencido: financial.vencido,

        saldoAtual: saldo,
      },

      //////////////////////////////////////////////////////////
      // TRANSAÇÕES
      //////////////////////////////////////////////////////////

      transacoes: transacoes.map((transacao) => ({
        ////////////////////////////////////////////////////////
        // IDENTIFICAÇÃO
        ////////////////////////////////////////////////////////

        id: transacao.id,

        tipo: transacao.tipo,

        ////////////////////////////////////////////////////////
        // FINANCEIRO
        ////////////////////////////////////////////////////////

        valor: Number(transacao.valor),

        valorPago: Number(transacao.valorPago ?? 0),

        valorRestante: Number(transacao.valorRestante ?? 0),

        ////////////////////////////////////////////////////////
        // STATUS
        ////////////////////////////////////////////////////////

        statusFinanceiro: transacao.statusFinanceiro,

        ////////////////////////////////////////////////////////
        // PAGAMENTO
        ////////////////////////////////////////////////////////

        formaPagamento: transacao.formaPagamento,

        ////////////////////////////////////////////////////////
        // DATAS
        ////////////////////////////////////////////////////////

        vencimento: transacao.vencimento,
        vencido:
          openFinancialStatuses.includes(transacao.statusFinanceiro) &&
          new Prisma.Decimal(transacao.valorRestante ?? 0).gt(0) &&
          isOverdue(transacao.vencimento),

        pagoEm: transacao.pagoEm,

        createdAt: transacao.createdAt,

        ////////////////////////////////////////////////////////
        // DESCRIÇÃO
        ////////////////////////////////////////////////////////

        descricao: transacao.descricao,
        referencia: transacao.referencia,

        observacoes: transacao.observacoes,

        ////////////////////////////////////////////////////////
        // RELAÇÕES
        ////////////////////////////////////////////////////////

        compraId: transacao.compraId,

        vendaId: transacao.vendaId,

        ////////////////////////////////////////////////////////
        // CLIENTE
        ////////////////////////////////////////////////////////

        cliente: transacao.cliente,

        ////////////////////////////////////////////////////////
        // COMPRA
        ////////////////////////////////////////////////////////

        compra: transacao.compra,

        ////////////////////////////////////////////////////////
        // VENDA
        ////////////////////////////////////////////////////////

        venda: transacao.venda,
      })),

      //////////////////////////////////////////////////////////
      // HISTÓRICO LEGADO
      //////////////////////////////////////////////////////////

      compras,

      vendas,
    };
  }

  ////////////////////////////////////////////////////////////
  // PAGAMENTOS CLIENTE
  ////////////////////////////////////////////////////////////

  async pagamentosCliente(clienteId: string) {
    ////////////////////////////////////////////////////////////
    // CLIENTE
    ////////////////////////////////////////////////////////////

    const cliente = await this.prisma.cliente.findUnique({
      where: {
        id: clienteId,
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    ////////////////////////////////////////////////////////////
    // TRANSAÇÕES
    ////////////////////////////////////////////////////////////

    const transacoes = await this.prisma.transacao.findMany({
      where: {
        clienteId,
      },

      include: {
        pagamentos: true,
        //////////////////////////////////////////////////////
        // COMPRA
        //////////////////////////////////////////////////////

        compra: true,

        //////////////////////////////////////////////////////
        // VENDA
        //////////////////////////////////////////////////////

        venda: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    ////////////////////////////////////////////////////////////
    // PAGAMENTOS GRANULARES
    ////////////////////////////////////////////////////////////

    const pagamentosGranulares = await this.prisma.pagamentoTransacao.findMany({
      where: {
        transacao: { clienteId, tipo: TipoTransacao.ENTRADA },
      },

      include: {
        //////////////////////////////////////////////////////
        // TRANSAÇÃO
        //////////////////////////////////////////////////////

        transacao: {
          include: {
            compra: true,

            venda: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    ////////////////////////////////////////////////////////////
    // TOTAIS
    ////////////////////////////////////////////////////////////

    const financial = summarizeTitles(transacoes, TipoTransacao.ENTRADA);
    const totalPago = financial.realizado;

    const totalPendente = financial.aberto;

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      //////////////////////////////////////////////////////////
      // CLIENTE
      //////////////////////////////////////////////////////////

      cliente: {
        id: cliente.id,

        nome: cliente.nome,

        telefone: cliente.telefone,

        documento: cliente.cpf ?? cliente.cnpj ?? null,
      },

      //////////////////////////////////////////////////////////
      // RESUMO
      //////////////////////////////////////////////////////////

      resumo: {
        totalPago,
        totalPendente,
        totalRecebido: financial.realizado,
        totalAReceber: financial.aberto,
        totalVencido: financial.vencido,

        quantidadeTransacoes: transacoes.length,
      },

      //////////////////////////////////////////////////////////
      // PAGAMENTOS GRANULARES
      //////////////////////////////////////////////////////////

      pagamentosGranulares,

      //////////////////////////////////////////////////////////
      // PAGAMENTOS / CONTA CORRENTE
      //////////////////////////////////////////////////////////

      pagamentos: transacoes.map((transacao) => ({
        ////////////////////////////////////////////////////////
        // IDENTIFICAÇÃO
        ////////////////////////////////////////////////////////

        id: transacao.id,

        tipo: transacao.tipo,

        ////////////////////////////////////////////////////////
        // VALORES
        ////////////////////////////////////////////////////////

        valor: Number(transacao.valor),

        valorPago: Number(transacao.valorPago ?? 0),

        valorRestante: Number(transacao.valorRestante ?? 0),

        ////////////////////////////////////////////////////////
        // STATUS
        ////////////////////////////////////////////////////////

        statusFinanceiro: transacao.statusFinanceiro,

        ////////////////////////////////////////////////////////
        // PAGAMENTO
        ////////////////////////////////////////////////////////

        formaPagamento: transacao.formaPagamento,

        ////////////////////////////////////////////////////////
        // DATAS
        ////////////////////////////////////////////////////////

        vencimento: transacao.vencimento,
        vencido:
          openFinancialStatuses.includes(transacao.statusFinanceiro) &&
          new Prisma.Decimal(transacao.valorRestante ?? 0).gt(0) &&
          isOverdue(transacao.vencimento),

        pagoEm: transacao.pagoEm,

        createdAt: transacao.createdAt,

        ////////////////////////////////////////////////////////
        // DESCRIÇÃO
        ////////////////////////////////////////////////////////

        descricao: transacao.descricao,
        referencia: transacao.referencia,

        observacoes: transacao.observacoes,

        ////////////////////////////////////////////////////////
        // RELAÇÕES
        ////////////////////////////////////////////////////////

        compraId: transacao.compraId,

        vendaId: transacao.vendaId,

        ////////////////////////////////////////////////////////
        // COMPRA
        ////////////////////////////////////////////////////////

        compra: transacao.compra,

        ////////////////////////////////////////////////////////
        // VENDA
        ////////////////////////////////////////////////////////

        venda: transacao.venda,
      })),
    };
  }

  ////////////////////////////////////////////////////////////
  // PAGAMENTOS TRANSAÇÃO
  ////////////////////////////////////////////////////////////

  async pagamentosTransacao(transacaoId: string) {
    ////////////////////////////////////////////////////////////
    // TRANSAÇÃO
    ////////////////////////////////////////////////////////////

    const transacao = await this.prisma.transacao.findUnique({
      where: {
        id: transacaoId,
      },

      include: {
        ////////////////////////////////////////////////////////
        // CLIENTE
        ////////////////////////////////////////////////////////

        cliente: true,

        ////////////////////////////////////////////////////////
        // FORNECEDOR
        ////////////////////////////////////////////////////////

        fornecedor: true,

        ////////////////////////////////////////////////////////
        // COMPRA
        ////////////////////////////////////////////////////////

        compra: true,

        ////////////////////////////////////////////////////////
        // VENDA
        ////////////////////////////////////////////////////////

        venda: true,
      },
    });

    if (!transacao) {
      throw new NotFoundException('Transação não encontrada');
    }

    ////////////////////////////////////////////////////////////
    // PAGAMENTOS
    ////////////////////////////////////////////////////////////

    const pagamentos = await this.prisma.pagamentoTransacao.findMany({
      where: {
        transacaoId,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    ////////////////////////////////////////////////////////////
    // TOTAL PAGO
    ////////////////////////////////////////////////////////////

    const totalPago = pagamentos.reduce((acc, pagamento) => {
      return acc + Number(pagamento.valor);
    }, 0);

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      //////////////////////////////////////////////////////////
      // TRANSAÇÃO
      //////////////////////////////////////////////////////////

      transacao: {
        id: transacao.id,

        tipo: transacao.tipo,

        valor: Number(transacao.valor),

        valorPago: Number(transacao.valorPago ?? 0),

        valorRestante: Number(transacao.valorRestante ?? 0),

        statusFinanceiro: transacao.statusFinanceiro,

        descricao: transacao.descricao,
        referencia: transacao.referencia,

        vencimento: transacao.vencimento,
        vencido:
          openFinancialStatuses.includes(transacao.statusFinanceiro) &&
          new Prisma.Decimal(transacao.valorRestante ?? 0).gt(0) &&
          isOverdue(transacao.vencimento),

        pagoEm: transacao.pagoEm,

        createdAt: transacao.createdAt,

        cliente: transacao.cliente,

        fornecedor: transacao.fornecedor,

        compra: transacao.compra,

        venda: transacao.venda,
      },

      //////////////////////////////////////////////////////////
      // RESUMO
      //////////////////////////////////////////////////////////

      resumo: {
        quantidadePagamentos: pagamentos.length,

        totalPago,

        valorRestante: Number(transacao.valorRestante ?? 0),
      },

      //////////////////////////////////////////////////////////
      // PAGAMENTOS
      //////////////////////////////////////////////////////////

      pagamentos: pagamentos.map((pagamento) => ({
        id: pagamento.id,

        valor: Number(pagamento.valor),

        valorRestanteApos: Number(pagamento.valorRestanteApos),

        formaPagamento: pagamento.formaPagamento,

        pagoEm: pagamento.pagoEm,

        vencimento: pagamento.vencimento,

        observacoes: pagamento.observacoes,

        createdAt: pagamento.createdAt,
      })),
    };
  }

  ////////////////////////////////////////////////////////////
  // CONTAS RECEBER
  ////////////////////////////////////////////////////////////

  async contasReceber() {
    const transacoes = await this.prisma.transacao.findMany({
      where: {
        tipo: TipoTransacao.ENTRADA,

        statusFinanceiro: {
          in: openFinancialStatuses,
        },
        valorRestante: { gt: 0 },
      },

      include: {
        ////////////////////////////////////////////////////////
        // CLIENTE
        ////////////////////////////////////////////////////////

        cliente: true,

        ////////////////////////////////////////////////////////
        // VENDA
        ////////////////////////////////////////////////////////

        venda: true,
      },

      orderBy: financialDueOrder,
    });

    return transacoes.map((transacao) => ({
      //////////////////////////////////////////////////////////
      // IDENTIFICAÇÃO
      //////////////////////////////////////////////////////////

      id: transacao.id,

      tipo: transacao.tipo,

      //////////////////////////////////////////////////////////
      // VALORES
      //////////////////////////////////////////////////////////

      valor: Number(transacao.valor),

      valorPago: Number(transacao.valorPago ?? 0),

      valorRestante: Number(transacao.valorRestante ?? 0),

      //////////////////////////////////////////////////////////
      // STATUS
      //////////////////////////////////////////////////////////

      statusFinanceiro: transacao.statusFinanceiro,

      //////////////////////////////////////////////////////////
      // PAGAMENTO
      //////////////////////////////////////////////////////////

      formaPagamento: transacao.formaPagamento,

      //////////////////////////////////////////////////////////
      // DATAS
      //////////////////////////////////////////////////////////

      vencimento: transacao.vencimento,
      vencido:
        openFinancialStatuses.includes(transacao.statusFinanceiro) &&
        new Prisma.Decimal(transacao.valorRestante ?? 0).gt(0) &&
        isOverdue(transacao.vencimento),

      pagoEm: transacao.pagoEm,

      createdAt: transacao.createdAt,

      //////////////////////////////////////////////////////////
      // DESCRIÇÃO
      //////////////////////////////////////////////////////////

      descricao: transacao.descricao,
      referencia: transacao.referencia,

      //////////////////////////////////////////////////////////
      // CLIENTE
      //////////////////////////////////////////////////////////

      cliente: transacao.cliente,

      //////////////////////////////////////////////////////////
      // VENDA
      //////////////////////////////////////////////////////////

      venda: transacao.venda,
    }));
  }

  ////////////////////////////////////////////////////////////
  // CONTAS PAGAR
  ////////////////////////////////////////////////////////////

  async contasPagar() {
    const transacoes = await this.prisma.transacao.findMany({
      where: {
        tipo: TipoTransacao.SAIDA,

        statusFinanceiro: {
          in: openFinancialStatuses,
        },
        valorRestante: { gt: 0 },
      },

      include: {
        ////////////////////////////////////////////////////////
        // CLIENTE
        ////////////////////////////////////////////////////////

        cliente: true,

        fornecedor: true,

        ////////////////////////////////////////////////////////
        // COMPRA
        ////////////////////////////////////////////////////////

        compra: true,
      },

      orderBy: financialDueOrder,
    });

    return transacoes.map((transacao) => ({
      //////////////////////////////////////////////////////////
      // IDENTIFICAÇÃO
      //////////////////////////////////////////////////////////

      id: transacao.id,

      tipo: transacao.tipo,

      //////////////////////////////////////////////////////////
      // VALORES
      //////////////////////////////////////////////////////////

      valor: Number(transacao.valor),

      valorPago: Number(transacao.valorPago ?? 0),

      valorRestante: Number(transacao.valorRestante ?? 0),

      //////////////////////////////////////////////////////////
      // STATUS
      //////////////////////////////////////////////////////////

      statusFinanceiro: transacao.statusFinanceiro,

      //////////////////////////////////////////////////////////
      // PAGAMENTO
      //////////////////////////////////////////////////////////

      formaPagamento: transacao.formaPagamento,

      //////////////////////////////////////////////////////////
      // DATAS
      //////////////////////////////////////////////////////////

      vencimento: transacao.vencimento,
      vencido:
        openFinancialStatuses.includes(transacao.statusFinanceiro) &&
        new Prisma.Decimal(transacao.valorRestante ?? 0).gt(0) &&
        isOverdue(transacao.vencimento),

      pagoEm: transacao.pagoEm,

      createdAt: transacao.createdAt,

      //////////////////////////////////////////////////////////
      // DESCRIÇÃO
      //////////////////////////////////////////////////////////

      descricao: transacao.descricao,
      referencia: transacao.referencia,

      //////////////////////////////////////////////////////////
      // CLIENTE
      //////////////////////////////////////////////////////////

      cliente: transacao.cliente,

      fornecedor: transacao.fornecedor,

      //////////////////////////////////////////////////////////
      // COMPRA
      //////////////////////////////////////////////////////////

      compra: transacao.compra,
    }));
  }

  ////////////////////////////////////////////////////////////
  // REGISTRAR PAGAMENTO
  ////////////////////////////////////////////////////////////

  async registrarPagamento(transacaoId: string, data: RegistrarPagamentoDto) {
    this.validatePayment(data);
    return serializableTransaction(this.prisma, async (tx) => {
      const transacao = await tx.transacao.findUnique({
        where: { id: transacaoId },
      });
      if (!transacao) throw new NotFoundException('Transação não encontrada');
      return this.applyPayment(tx, transacao, data);
    });
  }

  private validatePayment(data: RegistrarPagamentoDto) {
    if (
      !Number.isFinite(data.valor) ||
      data.valor <= 0 ||
      !new Prisma.Decimal(data.valor).eq(
        new Prisma.Decimal(data.valor).toDecimalPlaces(2),
      )
    ) {
      throw new BadRequestException(
        'Valor do pagamento deve ser positivo, com até duas casas decimais',
      );
    }
    if (!Object.values(FormaPagamento).includes(data.formaPagamento))
      throw new BadRequestException('Forma de pagamento inválida');
    if (
      data.pagoEm &&
      (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data.pagoEm) ||
        Number.isNaN(new Date(data.pagoEm).getTime()))
    )
      throw new BadRequestException('Instante de pagamento inválido');
  }

  private async applyPayment(
    tx: Prisma.TransactionClient,
    transacao: Prisma.TransacaoGetPayload<Record<string, never>>,
    data: RegistrarPagamentoDto,
  ) {
    if (transacao.vendaId && transacao.tipo !== TipoTransacao.ENTRADA)
      throw new ConflictException('Título de venda deve ser ENTRADA');
    if (transacao.statusFinanceiro === StatusFinanceiro.CANCELADO)
      throw new ConflictException('Título cancelado não recebe pagamentos');
    if (transacao.vendaId && !transacao.clienteId)
      throw new BadRequestException(
        'Vincule um cliente à venda antes de registrar pagamento',
      );
    const aggregate = await tx.pagamentoTransacao.aggregate({
      where: { transacaoId: transacao.id },
      _sum: { valor: true },
    });
    const paid = new Prisma.Decimal(aggregate._sum.valor ?? 0);
    const current = assertFinancialConsistency(transacao, paid);
    const amount = new Prisma.Decimal(data.valor);
    if (amount.gt(current.valorRestante))
      throw new BadRequestException(
        'Pagamento excede o valor restante da transação',
      );
    const projection = financialProjection(transacao.valor, paid.add(amount));
    const paidAt = data.pagoEm ? new Date(data.pagoEm) : new Date();
    const pagamento = await tx.pagamentoTransacao.create({
      data: {
        transacaoId: transacao.id,
        clienteId: transacao.clienteId,
        fornecedorId: transacao.fornecedorId,
        valor: amount,
        valorRestanteApos: projection.valorRestante,
        formaPagamento: data.formaPagamento,
        pagoEm: paidAt,
        vencimento: data.vencimento
          ? new Date(data.vencimento)
          : transacao.vencimento,
        observacoes: data.observacoes,
      },
    });
    // Projection of the latest payment instant, including backdated entries.
    const latest = await tx.pagamentoTransacao.findFirst({
      where: { transacaoId: transacao.id },
      orderBy: [{ pagoEm: 'desc' }, { id: 'desc' }],
    });
    const historico = [
      '[PAGAMENTO REGISTRADO]',
      'Valor: R$ ' + amount.toFixed(2),
      'Forma: ' + data.formaPagamento,
      'Data: ' + paidAt.toISOString(),
      data.observacoes,
    ]
      .filter(Boolean)
      .join('\n');
    const updated = await tx.transacao.update({
      where: { id: transacao.id },
      data: {
        ...projection,
        pagoEm: latest?.pagoEm ?? paidAt,
        formaPagamento: latest?.formaPagamento ?? data.formaPagamento,
        observacoes: [transacao.observacoes, historico]
          .filter(Boolean)
          .join('\n'),
      },
      include: {
        cliente: true,
        compra: true,
        venda: true,
        pagamentos: { orderBy: [{ pagoEm: 'desc' }, { id: 'desc' }] },
      },
    });
    if (transacao.vendaId) {
      const related = await tx.transacao.findMany({
        where: {
          vendaId: transacao.vendaId,
          tipo: TipoTransacao.ENTRADA,
          statusFinanceiro: { not: StatusFinanceiro.CANCELADO },
        },
        include: { pagamentos: true },
      });
      for (const title of related)
        assertFinancialConsistency(
          title,
          title.pagamentos.reduce(
            (sum, event) => sum.add(event.valor),
            new Prisma.Decimal(0),
          ),
        );
      const total = related.reduce(
        (sum, title) => sum.add(title.valor),
        new Prisma.Decimal(0),
      );
      const received = related.reduce(
        (sum, title) => sum.add(title.valorPago ?? 0),
        new Prisma.Decimal(0),
      );
      await tx.venda.update({
        where: { id: transacao.vendaId },
        data: {
          statusPagamento: paymentStatus(
            financialProjection(total, received).statusFinanceiro,
          ),
        },
      });
    }
    return { ...updated, pagamentoRegistrado: pagamento };
  }

  ////////////////////////////////////////////////////////////
  // TRANSAÇÃO MANUAL
  ////////////////////////////////////////////////////////////

  async createTransacaoManual(data: {
    tipo: TipoTransacao;

    valor: number;

    descricao?: string;

    clienteId?: string;

    fornecedorId?: string;

    formaPagamento?: FormaPagamento;

    statusFinanceiro?: StatusFinanceiro;

    valorPago?: number;

    valorRestante?: number;

    vencimento?: string;

    pagoEm?: string;

    referencia?: string;

    observacoes?: string;
  }) {
    ////////////////////////////////////////////////////////////
    // VALIDAÇÃO
    ////////////////////////////////////////////////////////////

    if (!data.valor || data.valor <= 0) {
      throw new BadRequestException('Valor inválido');
    }

    ////////////////////////////////////////////////////////////
    // CLIENTE
    ////////////////////////////////////////////////////////////

    if (data.clienteId) {
      const cliente = await this.prisma.cliente.findUnique({
        where: {
          id: data.clienteId,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente não encontrado');
      }
    }

    ////////////////////////////////////////////////////////////
    // FORNECEDOR
    ////////////////////////////////////////////////////////////

    if (data.fornecedorId) {
      const fornecedor = await this.prisma.fornecedor.findUnique({
        where: {
          id: data.fornecedorId,
        },
      });

      if (!fornecedor) {
        throw new NotFoundException('Fornecedor não encontrado');
      }
    }

    ////////////////////////////////////////////////////////////
    // VALOR PRINCIPAL
    ////////////////////////////////////////////////////////////

    const valorDecimal = new Prisma.Decimal(data.valor);

    ////////////////////////////////////////////////////////////
    // VALOR PAGO
    ////////////////////////////////////////////////////////////

    if (
      data.valorPago !== undefined ||
      data.valorRestante !== undefined ||
      data.statusFinanceiro !== undefined ||
      data.pagoEm !== undefined
    ) {
      throw new BadRequestException(
        'Projeções financeiras não são entrada manual. Registre a baixa pelo fluxo de pagamento.',
      );
    }
    const valorPago = new Prisma.Decimal(0);
    const valorRestante = valorDecimal;
    const statusFinanceiro = StatusFinanceiro.PENDENTE;

    return this.prisma.transacao.create({
      data: {
        ////////////////////////////////////////////////////////
        // FINANCEIRO
        ////////////////////////////////////////////////////////

        tipo: data.tipo,

        valor: valorDecimal,

        formaPagamento: data.formaPagamento,

        statusFinanceiro,

        ////////////////////////////////////////////////////////
        // VALORES
        ////////////////////////////////////////////////////////

        valorPago,

        valorRestante,

        ////////////////////////////////////////////////////////
        // DATAS
        ////////////////////////////////////////////////////////

        vencimento: data.vencimento ? new Date(data.vencimento) : undefined,

        pagoEm: data.pagoEm ? new Date(data.pagoEm) : undefined,

        ////////////////////////////////////////////////////////
        // DESCRIÇÃO
        ////////////////////////////////////////////////////////

        descricao: data.descricao,

        referencia: data.referencia,

        observacoes: data.observacoes
          ? `[TRANSAÇÃO MANUAL]\n${data.observacoes}`
          : '[TRANSAÇÃO MANUAL]',

        ////////////////////////////////////////////////////////
        // CLIENTE
        ////////////////////////////////////////////////////////

        clienteId: data.clienteId ?? null,

        fornecedorId: data.fornecedorId ?? null,
      },

      include: {
        ////////////////////////////////////////////////////////
        // CLIENTE
        ////////////////////////////////////////////////////////

        cliente: true,

        ////////////////////////////////////////////////////////
        // FORNECEDOR
        ////////////////////////////////////////////////////////

        fornecedor: true,

        ////////////////////////////////////////////////////////
        // COMPRA
        ////////////////////////////////////////////////////////

        compra: true,

        ////////////////////////////////////////////////////////
        // VENDA
        ////////////////////////////////////////////////////////

        venda: true,
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // FINANCEIRO FORNECEDOR
  ////////////////////////////////////////////////////////////

  async financeiroPorFornecedor(fornecedorId: string) {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id: fornecedorId,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    const transacoes = await this.prisma.transacao.findMany({
      where: {
        fornecedorId,

        tipo: TipoTransacao.SAIDA,
      },

      include: {
        compra: true,

        pagamentos: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    const purchases = await this.prisma.compra.findMany({
      where: { fornecedorId, status: { not: StatusCompra.CANCELADA } },
      select: { valorTotal: true },
    });
    const totalComprado = purchases
      .reduce((sum, item) => sum.add(item.valorTotal), new Prisma.Decimal(0))
      .toNumber();

    const financial = summarizeTitles(transacoes, TipoTransacao.SAIDA);
    const totalPago = financial.realizado;

    const saldoDevedor = financial.aberto;

    const limiteFinanceiro = Number(fornecedor.limiteFinanceiroValor ?? 0);

    const percentualLimite =
      limiteFinanceiro > 0 ? (saldoDevedor / limiteFinanceiro) * 100 : 0;
    ////////////////////////////////////////////////////////////
    // ALERTA LIMITE FINANCEIRO
    ////////////////////////////////////////////////////////////

    return {
      fornecedor,

      resumo: {
        totalComprado,

        totalPago,

        saldoDevedor,
        totalAPagar: saldoDevedor,
        totalVencido: financial.vencido,

        limiteFinanceiro,

        percentualLimite,
      },

      transacoes,
    };
  }

  ////////////////////////////////////////////////////////////
  // PAGAMENTOS FORNECEDOR
  ////////////////////////////////////////////////////////////

  async pagamentosFornecedor(fornecedorId: string) {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id: fornecedorId,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    const pagamentos = await this.prisma.pagamentoTransacao.findMany({
      where: {
        transacao: { fornecedorId, tipo: TipoTransacao.SAIDA },
      },

      include: {
        transacao: {
          include: {
            compra: true,
          },
        },
      },

      orderBy: {
        pagoEm: 'desc',
      },
    });

    const totalPago = pagamentos.reduce((acc, pagamento) => {
      return acc + Number(pagamento.valor ?? 0);
    }, 0);

    return {
      fornecedor,

      resumo: {
        quantidadePagamentos: pagamentos.length,

        totalPago,
      },

      pagamentos,
    };
  }

  ////////////////////////////////////////////////////////////
  // PAGAMENTO FORNECEDOR (FIFO)
  ////////////////////////////////////////////////////////////

  async registrarPagamentoFornecedor(
    fornecedorId: string,
    data: RegistrarPagamentoDto,
  ) {
    this.validatePayment(data);
    return serializableTransaction(this.prisma, async (tx) => {
      const payload = {
        ...data,
        pagoEm: data.pagoEm ?? new Date().toISOString(),
      };
      const fornecedor = await tx.fornecedor.findUnique({
        where: { id: fornecedorId },
      });
      if (!fornecedor) throw new NotFoundException('Fornecedor não encontrado');
      const titles = await tx.transacao.findMany({
        where: {
          fornecedorId,
          tipo: TipoTransacao.SAIDA,
          statusFinanceiro: { in: openFinancialStatuses },
          valorRestante: { gt: 0 },
        },
        orderBy: financialDueOrder,
      });
      if (!titles.length)
        throw new BadRequestException(
          'Fornecedor não possui débitos pendentes',
        );
      const total = titles.reduce(
        (sum, title) => sum.add(title.valorRestante ?? 0),
        new Prisma.Decimal(0),
      );
      let remaining = new Prisma.Decimal(data.valor);
      if (remaining.gt(total))
        throw new BadRequestException(
          'Pagamento excede o total em aberto do fornecedor',
        );
      const transacoesAtualizadas: string[] = [];
      for (const title of titles) {
        if (remaining.isZero()) break;
        const amount = Prisma.Decimal.min(remaining, title.valorRestante ?? 0);
        await this.applyPayment(tx, title, {
          ...payload,
          valor: amount.toNumber(),
        });
        remaining = remaining.minus(amount);
        transacoesAtualizadas.push(title.id);
      }
      return {
        fornecedorId,
        valorRecebido: data.valor,
        valorNaoUtilizado: remaining.toNumber(),
        transacoesAtualizadas,
      };
    });
  }
}
