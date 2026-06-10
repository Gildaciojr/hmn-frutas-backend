import {
  BadRequestException,
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

import { AlertasService } from '../alertas/alertas.service';
import { PrismaService } from '../prisma/prisma.service';

import { Response } from 'express';

import { RelatorioProducaoDto } from './dto/relatorio-producao.dto';

import { gerarRelatorioProducaoPdf } from './templates/producao-relatorio.template';

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

      totalSaidas,

      saldo: totalEntradas - totalSaidas,

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

  async fluxo(): Promise<
    Prisma.TransacaoGetPayload<{
      include: {
        cliente: true;

        fornecedor: true;

        compra: true;

        venda: true;
      };
    }>[]
  > {
    return this.prisma.transacao.findMany({
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

      orderBy: {
        createdAt: 'desc',
      },

      take: 300,
    });
  }

  ////////////////////////////////////////////////////////////
  // DADOS RELATÓRIO PRODUÇÃO
  ////////////////////////////////////////////////////////////

  private async obterDadosRelatorioProducao(filtros: RelatorioProducaoDto) {
    const dataInicio = new Date(filtros.dataInicial);

    const dataFim = new Date(filtros.dataFinal);

    dataFim.setHours(23, 59, 59, 999);

    const compraWhere: Prisma.CompraWhereInput = {
      dataCompra: {
        gte: dataInicio,
        lte: dataFim,
      },

      status: {
        not: StatusCompra.CANCELADA,
      },
    };

    const vendaWhere: Prisma.VendaWhereInput = {
      dataVenda: {
        gte: dataInicio,
        lte: dataFim,
      },

      status: {
        not: StatusVenda.CANCELADA,
      },
    };

    if (filtros.usuarioId) {
      compraWhere.usuarioResponsavelId = filtros.usuarioId;

      vendaWhere.usuarioResponsavelId = filtros.usuarioId;
    }

    const [compras, vendas] = await Promise.all([
      this.prisma.compra.findMany({
        where: compraWhere,

        orderBy: {
          createdAt: 'asc',
        },
      }),

      this.prisma.venda.findMany({
        where: vendaWhere,

        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);

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

      item.kgComprado += Number(compra.kgLiquido ?? 0);

      item.valorComprado += Number(compra.valorTotal ?? 0);
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

      item.kgVendido += Number(venda.pesoLiquido ?? 0);

      item.valorVendido += Number(venda.valorTotal ?? 0);
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

      filtros,

      totais: {
        compras: compras.length,

        vendas: vendas.length,

        valorComprado: compras.reduce(
          (acc, item) => acc + Number(item.valorTotal ?? 0),
          0,
        ),

        valorVendido: vendas.reduce(
          (acc, item) => acc + Number(item.valorTotal ?? 0),
          0,
        ),

        kgComprado: compras.reduce(
          (acc, item) => acc + Number(item.kgLiquido ?? 0),
          0,
        ),

        kgVendido: vendas.reduce(
          (acc, item) => acc + Number(item.pesoLiquido ?? 0),
          0,
        ),
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
  ) {
    const dados = await this.obterDadosRelatorioProducao(filtros);

    const pdfBuffer = await gerarRelatorioProducaoPdf(dados);

    res.set({
      'Content-Type': 'application/pdf',

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

    const totalPago = transacoes.reduce((acc, transacao) => {
      return acc + Number(transacao.valorPago ?? 0);
    }, 0);

    ////////////////////////////////////////////////////////////
    // TOTAL PENDENTE
    ////////////////////////////////////////////////////////////

    const totalPendente = transacoes.reduce((acc, transacao) => {
      return acc + Number(transacao.valorRestante ?? 0);
    }, 0);

    ////////////////////////////////////////////////////////////
    // SALDO
    ////////////////////////////////////////////////////////////

    const saldo = totalEntradas - totalSaidas;

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

      totalComprado: totalSaidas,

      totalVendido: totalEntradas,

      saldo,

      //////////////////////////////////////////////////////////
      // RESUMO FINANCEIRO
      //////////////////////////////////////////////////////////

      resumoFinanceiro: {
        totalEntradas,

        totalSaidas,

        totalPago,

        totalPendente,

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
        clienteId,
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

    const totalPago = transacoes.reduce((acc, transacao) => {
      return acc + Number(transacao.valorPago ?? 0);
    }, 0);

    const totalPendente = transacoes.reduce((acc, transacao) => {
      return acc + Number(transacao.valorRestante ?? 0);
    }, 0);

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
          not: StatusFinanceiro.PAGO,
        },
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

      orderBy: {
        createdAt: 'desc',
      },
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

      pagoEm: transacao.pagoEm,

      createdAt: transacao.createdAt,

      //////////////////////////////////////////////////////////
      // DESCRIÇÃO
      //////////////////////////////////////////////////////////

      descricao: transacao.descricao,

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
          not: StatusFinanceiro.PAGO,
        },
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

      orderBy: {
        createdAt: 'desc',
      },
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

      pagoEm: transacao.pagoEm,

      createdAt: transacao.createdAt,

      //////////////////////////////////////////////////////////
      // DESCRIÇÃO
      //////////////////////////////////////////////////////////

      descricao: transacao.descricao,

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

  async registrarPagamento(
    transacaoId: string,
    data: {
      valor: number;

      formaPagamento: FormaPagamento;

      pagoEm?: string;

      vencimento?: string;

      observacoes?: string;
    },
  ) {
    ////////////////////////////////////////////////////////////
    // VALIDAÇÃO VALOR
    ////////////////////////////////////////////////////////////

    if (!data.valor || data.valor <= 0) {
      throw new BadRequestException('Valor do pagamento inválido');
    }

    ////////////////////////////////////////////////////////////
    // TRANSAÇÃO
    ////////////////////////////////////////////////////////////

    const transacao = await this.prisma.transacao.findUnique({
      where: {
        id: transacaoId,
      },
    });

    if (!transacao) {
      throw new NotFoundException('Transação não encontrada');
    }

    ////////////////////////////////////////////////////////////
    // STATUS
    ////////////////////////////////////////////////////////////

    if (transacao.statusFinanceiro === StatusFinanceiro.PAGO) {
      throw new BadRequestException('Esta transação já está quitada');
    }

    ////////////////////////////////////////////////////////////
    // VALORES
    ////////////////////////////////////////////////////////////

    const valorTotal = new Prisma.Decimal(transacao.valor);

    const valorPagoAtual = new Prisma.Decimal(transacao.valorPago ?? 0);

    const novoPagamento = new Prisma.Decimal(data.valor);

    ////////////////////////////////////////////////////////////
    // NOVO VALOR PAGO
    ////////////////////////////////////////////////////////////

    const novoValorPago = valorPagoAtual.plus(novoPagamento);

    ////////////////////////////////////////////////////////////
    // OVERPAYMENT
    ////////////////////////////////////////////////////////////

    if (novoValorPago.greaterThan(valorTotal)) {
      throw new BadRequestException(
        'Pagamento excede o valor restante da transação',
      );
    }

    ////////////////////////////////////////////////////////////
    // RESTANTE
    ////////////////////////////////////////////////////////////

    const novoValorRestante = valorTotal.minus(novoValorPago);

    ////////////////////////////////////////////////////////////
    // STATUS AUTOMÁTICO
    ////////////////////////////////////////////////////////////

    let novoStatus: StatusFinanceiro;

    if (novoValorPago.equals(0)) {
      novoStatus = StatusFinanceiro.PENDENTE;
    } else if (
      novoValorPago.greaterThan(0) &&
      novoValorRestante.greaterThan(0)
    ) {
      novoStatus = StatusFinanceiro.PARCIAL;
    } else {
      novoStatus = StatusFinanceiro.PAGO;
    }

    ////////////////////////////////////////////////////////////
    // HISTÓRICO PAGAMENTO
    ////////////////////////////////////////////////////////////

    const historicoPagamento = [
      '',
      '[PAGAMENTO REGISTRADO]',
      `Valor: R$ ${Number(data.valor).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      })}`,
      `Forma: ${data.formaPagamento}`,
      `Data: ${data.pagoEm ?? new Date().toISOString()}`,
      data.observacoes ? `Obs: ${data.observacoes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    ////////////////////////////////////////////////////////////
    // TRANSACTION
    ////////////////////////////////////////////////////////////

    return this.prisma.$transaction(async (tx) => {
      //////////////////////////////////////////////////////////
      // REGISTRA PAGAMENTO GRANULAR
      //////////////////////////////////////////////////////////

      const pagamento = await tx.pagamentoTransacao.create({
        data: {
          //////////////////////////////////////////////////////
          // RELAÇÕES
          //////////////////////////////////////////////////////

          transacaoId: transacao.id,

          clienteId: transacao.clienteId,

          fornecedorId: transacao.fornecedorId,

          //////////////////////////////////////////////////////
          // VALORES
          //////////////////////////////////////////////////////

          valor: novoPagamento,

          valorRestanteApos: novoValorRestante,

          //////////////////////////////////////////////////////
          // PAGAMENTO
          //////////////////////////////////////////////////////

          formaPagamento: data.formaPagamento,

          ////////////////////////////////////////////////////
          // DATAS
          ////////////////////////////////////////////////////

          pagoEm: data.pagoEm ? new Date(data.pagoEm) : new Date(),

          vencimento: data.vencimento ? new Date(data.vencimento) : null,

          //////////////////////////////////////////////////////
          // OBSERVAÇÕES
          //////////////////////////////////////////////////////

          observacoes: data.observacoes,
        },
      });

      //////////////////////////////////////////////////////////
      // UPDATE TRANSAÇÃO
      //////////////////////////////////////////////////////////

      const transacaoAtualizada = await tx.transacao.update({
        where: {
          id: transacaoId,
        },

        data: {
          //////////////////////////////////////////////////////
          // PAGAMENTO
          //////////////////////////////////////////////////////

          formaPagamento: data.formaPagamento,

          pagoEm: data.pagoEm ? new Date(data.pagoEm) : new Date(),

          //////////////////////////////////////////////////////
          // VALORES
          //////////////////////////////////////////////////////

          valorPago: novoValorPago,

          valorRestante: novoValorRestante,

          //////////////////////////////////////////////////////
          // STATUS
          //////////////////////////////////////////////////////

          statusFinanceiro: novoStatus,

          //////////////////////////////////////////////////////
          // OBSERVAÇÕES
          //////////////////////////////////////////////////////

          observacoes: transacao.observacoes
            ? `${transacao.observacoes}\n${historicoPagamento}`
            : historicoPagamento,
        },

        include: {
          //////////////////////////////////////////////////////
          // CLIENTE
          //////////////////////////////////////////////////////

          cliente: true,

          //////////////////////////////////////////////////////
          // COMPRA
          //////////////////////////////////////////////////////

          compra: true,

          //////////////////////////////////////////////////////
          // VENDA
          //////////////////////////////////////////////////////

          venda: true,

          //////////////////////////////////////////////////////
          // PAGAMENTOS
          //////////////////////////////////////////////////////

          pagamentos: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      //////////////////////////////////////////////////////////
      // SINCRONIZA STATUS VENDA
      //////////////////////////////////////////////////////////

      if (transacao.vendaId) {
        await tx.venda.update({
          where: {
            id: transacao.vendaId,
          },

          data: {
            statusPagamento:
              novoStatus === StatusFinanceiro.PAGO
                ? 'PAGO'
                : novoStatus === StatusFinanceiro.PARCIAL
                  ? 'PARCIAL'
                  : 'PENDENTE',
          },
        });
      }

      //////////////////////////////////////////////////////////
      // RESPONSE
      //////////////////////////////////////////////////////////

      return {
        ...transacaoAtualizada,

        pagamentoRegistrado: pagamento,
      };
    });
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

    const valorPago =
      data.valorPago !== undefined
        ? new Prisma.Decimal(data.valorPago)
        : new Prisma.Decimal(0);

    ////////////////////////////////////////////////////////////
    // VALOR RESTANTE
    ////////////////////////////////////////////////////////////

    const valorRestante =
      data.valorRestante !== undefined
        ? new Prisma.Decimal(data.valorRestante)
        : valorDecimal.minus(valorPago);

    ////////////////////////////////////////////////////////////
    // OVERPAYMENT
    ////////////////////////////////////////////////////////////

    if (valorPago.greaterThan(valorDecimal)) {
      throw new BadRequestException(
        'Valor pago não pode ser maior que o valor total',
      );
    }

    ////////////////////////////////////////////////////////////
    // STATUS AUTOMÁTICO
    ////////////////////////////////////////////////////////////

    let statusFinanceiro: StatusFinanceiro;

    if (data.statusFinanceiro) {
      statusFinanceiro = data.statusFinanceiro;
    } else if (valorPago.equals(0)) {
      statusFinanceiro = StatusFinanceiro.PENDENTE;
    } else if (valorPago.greaterThan(0) && valorRestante.greaterThan(0)) {
      statusFinanceiro = StatusFinanceiro.PARCIAL;
    } else {
      statusFinanceiro = StatusFinanceiro.PAGO;
    }

    ////////////////////////////////////////////////////////////
    // CREATE
    ////////////////////////////////////////////////////////////

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

    const totalComprado = transacoes.reduce((acc, transacao) => {
      return acc + Number(transacao.valor ?? 0);
    }, 0);

    const totalPago = transacoes.reduce((acc, transacao) => {
      return acc + Number(transacao.valorPago ?? 0);
    }, 0);

    const saldoDevedor = transacoes.reduce((acc, transacao) => {
      return acc + Number(transacao.valorRestante ?? 0);
    }, 0);

    const limiteFinanceiro = Number(fornecedor.limiteFinanceiroValor ?? 0);

    const percentualLimite =
      limiteFinanceiro > 0 ? (saldoDevedor / limiteFinanceiro) * 100 : 0;
    ////////////////////////////////////////////////////////////
    // ALERTA LIMITE FINANCEIRO
    ////////////////////////////////////////////////////////////

    if (fornecedor.limiteFinanceiroValor && percentualLimite >= 80) {
      await this.alertasService.criarOuAtualizar({
        categoria: 'LIMITE_FINANCEIRO',

        severidade:
          percentualLimite >= 100
            ? 'CRITICA'
            : percentualLimite >= 90
              ? 'ALTA'
              : 'MEDIA',

        fornecedorId: fornecedor.id,

        titulo:
          percentualLimite >= 100
            ? 'Limite financeiro ultrapassado'
            : 'Limite financeiro próximo',

        mensagem:
          percentualLimite >= 100
            ? `Fornecedor atingiu ${percentualLimite.toFixed(1)}% do limite financeiro.`
            : `Fornecedor atingiu ${percentualLimite.toFixed(1)}% do limite financeiro.`,
      });
    }
    return {
      fornecedor,

      resumo: {
        totalComprado,

        totalPago,

        saldoDevedor,

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
        fornecedorId,
      },

      include: {
        transacao: {
          include: {
            compra: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
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
    data: {
      valor: number;

      formaPagamento: FormaPagamento;

      pagoEm?: string;

      vencimento?: string;

      observacoes?: string;
    },
  ) {
    ////////////////////////////////////////////////////////////
    // VALIDAÇÃO
    ////////////////////////////////////////////////////////////

    if (!data.valor || data.valor <= 0) {
      throw new BadRequestException('Valor inválido');
    }

    ////////////////////////////////////////////////////////////
    // FORNECEDOR
    ////////////////////////////////////////////////////////////

    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id: fornecedorId,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    ////////////////////////////////////////////////////////////
    // TRANSAÇÕES EM ABERTO
    ////////////////////////////////////////////////////////////

    const transacoes = await this.prisma.transacao.findMany({
      where: {
        fornecedorId,

        tipo: TipoTransacao.SAIDA,

        statusFinanceiro: {
          not: StatusFinanceiro.PAGO,
        },
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    if (transacoes.length === 0) {
      throw new BadRequestException('Fornecedor não possui débitos pendentes');
    }

    ////////////////////////////////////////////////////////////
    // TRANSACTION
    ////////////////////////////////////////////////////////////

    return this.prisma.$transaction(async (tx) => {
      let saldoPagamento = new Prisma.Decimal(data.valor);

      const transacoesAtualizadas: string[] = [];

      //////////////////////////////////////////////////////////
      // FIFO
      //////////////////////////////////////////////////////////

      for (const transacao of transacoes) {
        if (saldoPagamento.lte(0)) {
          break;
        }

        const valorRestanteAtual = new Prisma.Decimal(
          transacao.valorRestante ?? 0,
        );

        if (valorRestanteAtual.lte(0)) {
          continue;
        }

        ////////////////////////////////////////////////////////
        // VALOR APLICADO
        ////////////////////////////////////////////////////////

        const valorAplicado = saldoPagamento.greaterThan(valorRestanteAtual)
          ? valorRestanteAtual
          : saldoPagamento;

        ////////////////////////////////////////////////////////
        // NOVOS VALORES
        ////////////////////////////////////////////////////////

        const novoValorPago = new Prisma.Decimal(transacao.valorPago ?? 0).plus(
          valorAplicado,
        );

        const novoValorRestante = valorRestanteAtual.minus(valorAplicado);

        ////////////////////////////////////////////////////////
        // STATUS
        ////////////////////////////////////////////////////////

        let novoStatus: StatusFinanceiro;

        if (novoValorRestante.equals(0)) {
          novoStatus = StatusFinanceiro.PAGO;
        } else {
          novoStatus = StatusFinanceiro.PARCIAL;
        }

        ////////////////////////////////////////////////////////
        // PAGAMENTO GRANULAR
        ////////////////////////////////////////////////////////

        await tx.pagamentoTransacao.create({
          data: {
            transacaoId: transacao.id,

            fornecedorId,

            valor: valorAplicado,

            valorRestanteApos: novoValorRestante,

            formaPagamento: data.formaPagamento,

            pagoEm: data.pagoEm ? new Date(data.pagoEm) : new Date(),

            vencimento: data.vencimento ? new Date(data.vencimento) : null,

            observacoes: data.observacoes,
          },
        });

        ////////////////////////////////////////////////////////
        // UPDATE TRANSAÇÃO
        ////////////////////////////////////////////////////////

        await tx.transacao.update({
          where: {
            id: transacao.id,
          },

          data: {
            valorPago: novoValorPago,

            valorRestante: novoValorRestante,

            formaPagamento: data.formaPagamento,

            pagoEm: data.pagoEm ? new Date(data.pagoEm) : new Date(),

            statusFinanceiro: novoStatus,
          },
        });

        transacoesAtualizadas.push(transacao.id);

        saldoPagamento = saldoPagamento.minus(valorAplicado);
      }

      //////////////////////////////////////////////////////////
      // RESPONSE
      //////////////////////////////////////////////////////////

      return {
        fornecedorId,

        valorRecebido: Number(data.valor),

        valorNaoUtilizado: Number(saldoPagamento),

        transacoesAtualizadas,
      };
    });
  }
}
