import { Injectable } from '@nestjs/common';

import { StatusVenda, TipoTransacao } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  ////////////////////////////////////////////////////////////
  // ADMIN DASHBOARD
  ////////////////////////////////////////////////////////////

  async getAdminDashboard() {
    const [compras, vendas, clientes] = await Promise.all([
      this.prisma.compra.findMany(),

      this.prisma.venda.findMany({
        where: {
          status: {
            not: StatusVenda.CANCELADA,
          },
        },
      }),

      this.prisma.cliente.count(),
    ]);

    ////////////////////////////////////////////////////////////
    // FINANCEIRO
    ////////////////////////////////////////////////////////////

    const totalComprado = compras.reduce((acc, compra) => {
      return acc + Number(compra.valorTotal);
    }, 0);

    const totalVendido = vendas.reduce((acc, venda) => {
      return acc + Number(venda.valorTotal);
    }, 0);

    ////////////////////////////////////////////////////////////
    // ESTOQUE REAL
    ////////////////////////////////////////////////////////////

    const totalKgComprado = compras.reduce((acc, compra) => {
      return acc + Number(compra.kgBruto);
    }, 0);

    const totalKgVendido = vendas.reduce((acc, venda) => {
      return acc + Number(venda.pesoBruto);
    }, 0);

    ////////////////////////////////////////////////////////////
    // FRUTAS
    ////////////////////////////////////////////////////////////

    const totalFrutasCompradas = compras.reduce((acc, compra) => {
      return acc + Number(compra.quantidadeFrutas);
    }, 0);

    const totalFrutasVendidas = vendas.reduce((acc, venda) => {
      return acc + Number(venda.quantidadeFrutas ?? 0);
    }, 0);

    ////////////////////////////////////////////////////////////
    // MÉDIAS
    ////////////////////////////////////////////////////////////

    const mediaCompra = compras.length > 0 ? totalComprado / compras.length : 0;

    const mediaVenda = vendas.length > 0 ? totalVendido / vendas.length : 0;

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      //////////////////////////////////////////////////////////
      // FINANCEIRO
      //////////////////////////////////////////////////////////

      totalComprado,

      totalVendido,

      lucroBruto: totalVendido - totalComprado,

      //////////////////////////////////////////////////////////
      // ESTOQUE
      //////////////////////////////////////////////////////////

      totalKgComprado,

      totalKgVendido,

      estoqueAtual: totalKgComprado - totalKgVendido,

      //////////////////////////////////////////////////////////
      // MÉDIAS
      //////////////////////////////////////////////////////////

      mediaCompra,

      mediaVenda,

      //////////////////////////////////////////////////////////
      // CLIENTES
      //////////////////////////////////////////////////////////

      clientesAtivos: clientes,

      //////////////////////////////////////////////////////////
      // FRUTAS
      //////////////////////////////////////////////////////////

      totalFrutasCompradas,

      totalFrutasVendidas,
    };
  }

  ////////////////////////////////////////////////////////////
  // DASHBOARD COMPRAS
  ////////////////////////////////////////////////////////////

  async getComprasDashboard() {
    ////////////////////////////////////////////////////////////
    // DATA OPERACIONAL
    ////////////////////////////////////////////////////////////

    const hoje = new Date();

    hoje.setHours(0, 0, 0, 0);

    ////////////////////////////////////////////////////////////
    // COMPRAS HOJE
    ////////////////////////////////////////////////////////////

    const comprasHoje = await this.prisma.compra.findMany({
      where: {
        dataCompra: {
          gte: hoje,
        },
      },

      include: {
        cliente: true,

        fornecedor: true,

        fazendaFornecedor: true,
      },

      orderBy: {
        dataCompra: 'desc',
      },
    });

    ////////////////////////////////////////////////////////////
    // TODAS COMPRAS
    ////////////////////////////////////////////////////////////

    const todasCompras = await this.prisma.compra.findMany({
      include: {
        cliente: true,

        fornecedor: true,

        fazendaFornecedor: true,
      },

      orderBy: {
        dataCompra: 'desc',
      },
    });

    ////////////////////////////////////////////////////////////
    // DESPESAS OPERACIONAIS
    ////////////////////////////////////////////////////////////

    const despesasOperacionais =
      await this.prisma.despesaOperacional.findMany();

    ////////////////////////////////////////////////////////////
    // ÚLTIMAS
    ////////////////////////////////////////////////////////////

    const ultimasCompras = todasCompras.slice(0, 10);

    ////////////////////////////////////////////////////////////
    // TOTAL HOJE
    ////////////////////////////////////////////////////////////

    const comprasHojeValor = comprasHoje.reduce((acc, compra) => {
      return acc + Number(compra.valorTotal);
    }, 0);

    ////////////////////////////////////////////////////////////
    // KG MOVIMENTADO
    ////////////////////////////////////////////////////////////

    const kgMovimentado = todasCompras.reduce((acc, compra) => {
      return acc + Number(compra.kgBruto);
    }, 0);

    ////////////////////////////////////////////////////////////
    // TOTAL GERAL
    ////////////////////////////////////////////////////////////

    const totalGeral = todasCompras.reduce((acc, compra) => {
      return acc + Number(compra.valorTotal);
    }, 0);

    ////////////////////////////////////////////////////////////
    // MÉDIA
    ////////////////////////////////////////////////////////////

    const mediaCompra =
      todasCompras.length > 0 ? totalGeral / todasCompras.length : 0;

    ////////////////////////////////////////////////////////////
    // CLIENTES
    ////////////////////////////////////////////////////////////

    const fornecedoresUnicos = new Set(
      todasCompras.map((compra) => compra.fornecedorId),
    );

    ////////////////////////////////////////////////////////////
    // FRUTAS
    ////////////////////////////////////////////////////////////

    const totalFrutas = todasCompras.reduce((acc, compra) => {
      return acc + Number(compra.quantidadeFrutas);
    }, 0);

    ////////////////////////////////////////////////////////////
    // MÉDIA FRUTAS
    ////////////////////////////////////////////////////////////

    const mediaFrutaGeral =
      todasCompras.length > 0
        ? todasCompras.reduce((acc, compra) => {
            return acc + Number(compra.mediaFruta);
          }, 0) / todasCompras.length
        : 0;

    ////////////////////////////////////////////////////////////
    // DESPESAS OPERACIONAIS
    ////////////////////////////////////////////////////////////

    const totalDespesasOperacionais = despesasOperacionais.reduce(
      (acc, despesa) => {
        return acc + Number(despesa.valor);
      },
      0,
    );

    const quantidadeDespesasOperacionais = despesasOperacionais.length;

    ////////////////////////////////////////////////////////////
    // FORNECEDORES
    ////////////////////////////////////////////////////////////

    const totalFornecedores = await this.prisma.fornecedor.count();

    ////////////////////////////////////////////////////////////
    // FAZENDAS
    ////////////////////////////////////////////////////////////

    const totalFazendas = await this.prisma.fazendaFornecedor.count();

    ////////////////////////////////////////////////////////////
    // TIMELINE
    ////////////////////////////////////////////////////////////

    const timeline = ultimasCompras.map((compra) => ({
      id: compra.id,

      //////////////////////////////////////////////////////////
      // AUDITORIA
      //////////////////////////////////////////////////////////

      usuarioResponsavelId: compra.usuarioResponsavelId,

      usuarioResponsavelNome: compra.usuarioResponsavelNome,

      //////////////////////////////////////////////////////////
      // CLIENTE (LEGADO)
      //////////////////////////////////////////////////////////

      cliente: compra.cliente
        ? {
            id: compra.cliente.id,
            nome: compra.cliente.nome,
          }
        : null,

      //////////////////////////////////////////////////////////
      // FORNECEDOR
      //////////////////////////////////////////////////////////

      fornecedor: compra.fornecedor
        ? {
            id: compra.fornecedor.id,

            nome: compra.fornecedor.nome,
          }
        : null,

      //////////////////////////////////////////////////////////
      // FAZENDA
      //////////////////////////////////////////////////////////

      fazendaFornecedor: compra.fazendaFornecedor
        ? {
            id: compra.fazendaFornecedor.id,

            nome: compra.fazendaFornecedor.nome,
          }
        : null,

      safra: compra.safra,

      dataCompra: compra.dataCompra,

      modeloCaminhao: compra.modeloCaminhao,

      placa: compra.placa,

      numeroFolha: compra.numeroFolha,

      kgBruto: Number(compra.kgBruto),

      quantidadeFrutas: compra.quantidadeFrutas,

      mediaFruta: Number(compra.mediaFruta),

      kgDescontado: Number(compra.kgDescontado),

      kgLiquido: Number(compra.kgLiquido),

      tipoDesconto: compra.tipoDesconto,

      descontoPercentualAplicado: compra.descontoPercentualAplicado,

      descontoKgManual: compra.descontoKgManual,

      descontoKgCalculado: Number(compra.descontoKgCalculado),

      precoKg: Number(compra.precoKg),

      totalBruto: Number(compra.totalBruto),

      despesas: Number(compra.despesas),

      valorTotal: Number(compra.valorTotal),

      observacoes: compra.observacoes,

      createdAt: compra.createdAt,
    }));

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      //////////////////////////////////////////////////////////
      // KPIs
      //////////////////////////////////////////////////////////

      comprasHoje: comprasHojeValor,

      kgMovimentado,

      mediaCompra,

      fornecedoresAtivos: fornecedoresUnicos.size,

      totalOperacoes: comprasHoje.length,

      totalFrutas,

      mediaFrutaGeral,

      totalFornecedores,

      totalFazendas,

      //////////////////////////////////////////////////////////
      // DESPESAS OPERACIONAIS
      //////////////////////////////////////////////////////////

      totalDespesasOperacionais,

      quantidadeDespesasOperacionais,

      //////////////////////////////////////////////////////////
      // OPERAÇÕES
      //////////////////////////////////////////////////////////

      ultimasCompras: timeline,
    };
  }

  ////////////////////////////////////////////////////////////
  // DASHBOARD VENDAS
  ////////////////////////////////////////////////////////////

  async getVendasDashboard() {
    ////////////////////////////////////////////////////////////
    // DATA OPERACIONAL
    ////////////////////////////////////////////////////////////

    const hoje = new Date();

    hoje.setHours(0, 0, 0, 0);

    ////////////////////////////////////////////////////////////
    // VENDAS HOJE
    ////////////////////////////////////////////////////////////

    const vendasHoje = await this.prisma.venda.findMany({
      where: {
        dataVenda: {
          gte: hoje,
        },

        status: {
          not: StatusVenda.CANCELADA,
        },
      },

      include: {
        cliente: true,
      },

      orderBy: {
        dataVenda: 'desc',
      },
    });

    ////////////////////////////////////////////////////////////
    // TODAS VENDAS
    ////////////////////////////////////////////////////////////

    const todasVendas = await this.prisma.venda.findMany({
      where: {
        status: {
          not: StatusVenda.CANCELADA,
        },
      },

      include: {
        cliente: true,
      },

      orderBy: {
        dataVenda: 'desc',
      },
    });

    ////////////////////////////////////////////////////////////
    // TOTAL HOJE
    ////////////////////////////////////////////////////////////

    const totalHoje = vendasHoje.reduce((acc, venda) => {
      return acc + Number(venda.valorTotal);
    }, 0);

    ////////////////////////////////////////////////////////////
    // TOTAL GERAL
    ////////////////////////////////////////////////////////////

    const totalGeral = todasVendas.reduce((acc, venda) => {
      return acc + Number(venda.valorTotal);
    }, 0);

    ////////////////////////////////////////////////////////////
    // KG
    ////////////////////////////////////////////////////////////

    const totalKg = todasVendas.reduce((acc, venda) => {
      return acc + Number(venda.pesoBruto);
    }, 0);

    ////////////////////////////////////////////////////////////
    // FRUTAS
    ////////////////////////////////////////////////////////////

    const totalFrutas = todasVendas.reduce((acc, venda) => {
      return acc + Number(venda.quantidadeFrutas ?? 0);
    }, 0);

    ////////////////////////////////////////////////////////////
    // MÉDIA
    ////////////////////////////////////////////////////////////

    const mediaVenda =
      todasVendas.length > 0 ? totalGeral / todasVendas.length : 0;

    ////////////////////////////////////////////////////////////
    // TIMELINE
    ////////////////////////////////////////////////////////////

    const ultimasVendas = todasVendas.slice(0, 10).map((venda) => ({
      id: venda.id,

      usuarioResponsavelId: venda.usuarioResponsavelId,

      usuarioResponsavelNome: venda.usuarioResponsavelNome,

      numeroPedido: venda.numeroPedido,

      cliente: {
        id: venda.cliente.id,

        nome: venda.cliente.nome,
      },

      dataVenda: venda.dataVenda,

      produto: venda.produto,

      qualidade: venda.qualidade,

      cidade: venda.cidade,

      placa: venda.placa,

      motoristaNome: venda.motoristaNome,

      pesoBruto: Number(venda.pesoBruto),

      pesoDesconto: Number(venda.pesoDesconto),

      pesoLiquido: Number(venda.pesoLiquido),

      quantidadeFrutas: venda.quantidadeFrutas,

      mediaFruta: venda.mediaFruta,

      precoMelancia: Number(venda.precoMelancia),

      valorMelancia: Number(venda.valorMelancia),

      freteTotal: Number(venda.freteTotal ?? 0),

      valorTotal: Number(venda.valorTotal),

      status: venda.status,

      statusPagamento: venda.statusPagamento,
    }));

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      totalHoje,

      totalGeral,

      totalKg,

      totalFrutas,

      mediaVenda,

      totalOperacoes: todasVendas.length,

      ultimasVendas,
    };
  }

  ////////////////////////////////////////////////////////////
  // ESTOQUE
  ////////////////////////////////////////////////////////////

  async getEstoqueDashboard() {
    ////////////////////////////////////////////////////////////
    // COMPRAS
    ////////////////////////////////////////////////////////////

    const compras = await this.prisma.compra.aggregate({
      _sum: {
        kgBruto: true,
      },
    });

    ////////////////////////////////////////////////////////////
    // VENDAS
    ////////////////////////////////////////////////////////////

    const vendas = await this.prisma.venda.aggregate({
      where: {
        status: {
          not: StatusVenda.CANCELADA,
        },
      },

      _sum: {
        pesoBruto: true,
      },
    });

    ////////////////////////////////////////////////////////////
    // TOTAIS
    ////////////////////////////////////////////////////////////

    const totalComprado = Number(compras._sum.kgBruto ?? 0);

    const totalVendido = Number(vendas._sum.pesoBruto ?? 0);

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      estoqueEntrada: totalComprado,

      estoqueSaida: totalVendido,

      estoqueAtual: totalComprado - totalVendido,
    };
  }

  ////////////////////////////////////////////////////////////
  // FINANCEIRO
  ////////////////////////////////////////////////////////////

  async getFinanceiroDashboard() {
    ////////////////////////////////////////////////////////////
    // TRANSAÇÕES
    ////////////////////////////////////////////////////////////

    const [entradas, saidas, despesasOperacionais] = await Promise.all([
      this.prisma.transacao.aggregate({
        where: {
          tipo: TipoTransacao.ENTRADA,
        },

        _sum: {
          valor: true,
        },
      }),

      this.prisma.transacao.aggregate({
        where: {
          tipo: TipoTransacao.SAIDA,
        },

        _sum: {
          valor: true,
        },
      }),

      this.prisma.despesaOperacional.findMany(),
    ]);

    ////////////////////////////////////////////////////////////
    // TOTAIS
    ////////////////////////////////////////////////////////////

    const totalEntradas = Number(entradas._sum.valor ?? 0);

    const totalSaidas = Number(saidas._sum.valor ?? 0);

    ////////////////////////////////////////////////////////////
    // DESPESAS OPERACIONAIS
    ////////////////////////////////////////////////////////////

    const totalDespesasOperacionais = despesasOperacionais.reduce(
      (acc, despesa) => {
        return acc + Number(despesa.valor);
      },
      0,
    );

    const quantidadeDespesasOperacionais = despesasOperacionais.length;

    ////////////////////////////////////////////////////////////
    // RESPONSE
    ////////////////////////////////////////////////////////////

    return {
      totalEntradas,

      totalSaidas,

      saldo: totalEntradas - totalSaidas,

      //////////////////////////////////////////////////////////
      // DESPESAS OPERACIONAIS
      //////////////////////////////////////////////////////////

      totalDespesasOperacionais,

      quantidadeDespesasOperacionais,
    };
  }
}
