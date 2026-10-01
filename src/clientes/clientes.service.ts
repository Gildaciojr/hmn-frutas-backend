import { Injectable, NotFoundException } from '@nestjs/common';

import {
  Cliente,
  Prisma,
  TipoTransacao,
  Compra,
  PagamentoTransacao,
  Transacao,
  Venda,
} from '@prisma/client';

import { summarizeTitles } from '../financeiro/financial-state';
import { PrismaService } from '../prisma/prisma.service';

import { CreateClienteDto } from './dto/create-cliente.dto';

import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  ////////////////////////////////////////////////////////////
  // CREATE
  ////////////////////////////////////////////////////////////

  create(data: CreateClienteDto) {
    return this.prisma.cliente.create({
      data: {
        ////////////////////////////////////////////////////////
        // TIPO
        ////////////////////////////////////////////////////////

        tipoCliente: data.tipoCliente,

        ////////////////////////////////////////////////////////
        // DADOS BÁSICOS
        ////////////////////////////////////////////////////////

        nome: data.nome,

        telefone: data.telefone,

        email: data.email ?? null,

        ////////////////////////////////////////////////////////
        // PESSOA FÍSICA
        ////////////////////////////////////////////////////////

        cpf: data.cpf ?? null,

        ////////////////////////////////////////////////////////
        // PESSOA JURÍDICA
        ////////////////////////////////////////////////////////

        cnpj: data.cnpj ?? null,

        razaoSocial: data.razaoSocial ?? null,

        inscricaoEstadual: data.inscricaoEstadual ?? null,

        nomeFantasia: data.nomeFantasia ?? null,

        proprietarioNome: data.proprietarioNome ?? null,

        ////////////////////////////////////////////////////////
        // ENDEREÇO
        ////////////////////////////////////////////////////////

        endereco: data.endereco ?? null,

        bairro: data.bairro ?? null,

        cep: data.cep ?? null,

        cidade: data.cidade ?? null,

        estado: data.estado ?? null,

        ////////////////////////////////////////////////////////
        // OBSERVAÇÕES
        ////////////////////////////////////////////////////////

        observacoes: data.observacoes ?? null,

        ////////////////////////////////////////////////////////
        // COMERCIAL
        ////////////////////////////////////////////////////////

        descontoPercentual: data.descontoPercentual ?? 0,
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // UPDATE
  ////////////////////////////////////////////////////////////

  async update(id: string, data: UpdateClienteDto) {
    const cliente = await this.prisma.cliente.findUnique({
      where: {
        id,
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return this.prisma.cliente.update({
      where: {
        id,
      },

      data: {
        //////////////////////////////////////////////////////////
        // TIPO
        //////////////////////////////////////////////////////////

        ...(data.tipoCliente !== undefined && {
          tipoCliente: data.tipoCliente,
        }),

        //////////////////////////////////////////////////////////
        // DADOS BÁSICOS
        //////////////////////////////////////////////////////////

        ...(data.nome !== undefined && {
          nome: data.nome,
        }),

        ...(data.telefone !== undefined && {
          telefone: data.telefone,
        }),

        ...(data.email !== undefined && {
          email: data.email,
        }),

        //////////////////////////////////////////////////////////
        // PESSOA FÍSICA
        //////////////////////////////////////////////////////////

        ...(data.cpf !== undefined && {
          cpf: data.cpf,
        }),

        //////////////////////////////////////////////////////////
        // PESSOA JURÍDICA
        //////////////////////////////////////////////////////////

        ...(data.cnpj !== undefined && {
          cnpj: data.cnpj,
        }),

        ...(data.razaoSocial !== undefined && {
          razaoSocial: data.razaoSocial,
        }),

        ...(data.inscricaoEstadual !== undefined && {
          inscricaoEstadual: data.inscricaoEstadual,
        }),

        ...(data.nomeFantasia !== undefined && {
          nomeFantasia: data.nomeFantasia,
        }),

        ...(data.proprietarioNome !== undefined && {
          proprietarioNome: data.proprietarioNome,
        }),

        //////////////////////////////////////////////////////////
        // ENDEREÇO
        //////////////////////////////////////////////////////////

        ...(data.endereco !== undefined && {
          endereco: data.endereco,
        }),

        ...(data.bairro !== undefined && {
          bairro: data.bairro,
        }),

        ...(data.cep !== undefined && {
          cep: data.cep,
        }),

        ...(data.cidade !== undefined && {
          cidade: data.cidade,
        }),

        ...(data.estado !== undefined && {
          estado: data.estado,
        }),

        //////////////////////////////////////////////////////////
        // OBSERVAÇÕES
        //////////////////////////////////////////////////////////

        ...(data.observacoes !== undefined && {
          observacoes: data.observacoes,
        }),

        //////////////////////////////////////////////////////////
        // COMERCIAL
        //////////////////////////////////////////////////////////

        ...(data.descontoPercentual !== undefined && {
          descontoPercentual: data.descontoPercentual,
        }),
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  findAll() {
    return this.prisma.cliente.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // FIND ONE
  ////////////////////////////////////////////////////////////

  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: {
        id,
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return cliente;
  }

  ////////////////////////////////////////////////////////////
  // HISTÓRICO COMPLETO
  ////////////////////////////////////////////////////////////

  async historicoCompleto(clienteId: string): Promise<{
    cliente: Cliente;

    compras: Compra[];

    vendas: Venda[];

    transacoes: Transacao[];

    pagamentos: (PagamentoTransacao & {
      transacao: Transacao & {
        cliente: Cliente | null;
        compra: Compra | null;
        venda: Venda | null;
      };
    })[];

    resumo: {
      totalRecebido: number;
      totalAReceber: number;
      totalVencido: number;
      quantidadeOperacoes: number;
      ultimaVenda: Date | null;
      ultimoPagamento: Date | null;
      ////////////////////////////////////////////////////////
      // FINANCEIRO
      ////////////////////////////////////////////////////////

      totalCompras: number;

      totalVendas: number;

      saldo: number;

      totalPago: number;

      totalPendente: number;

      totalParcial: number;

      ////////////////////////////////////////////////////////
      // ESTOQUE
      ////////////////////////////////////////////////////////

      totalKgComprado: number;

      totalKgVendido: number;

      estoqueMovimentado: number;

      ////////////////////////////////////////////////////////
      // FRUTAS
      ////////////////////////////////////////////////////////

      totalFrutasCompradas: number;

      totalFrutasVendidas: number;
    };
  }> {
    //////////////////////////////////////////////////////////
    // CLIENTE
    //////////////////////////////////////////////////////////

    const cliente = await this.prisma.cliente.findUnique({
      where: {
        id: clienteId,
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    //////////////////////////////////////////////////////////
    // DADOS
    //////////////////////////////////////////////////////////

    const [compras, vendas, transacoes, pagamentos] = await Promise.all([
      //////////////////////////////////////////////////////
      // COMPRAS
      //////////////////////////////////////////////////////

      this.prisma.compra.findMany({
        where: {
          clienteId,
          status: { not: 'CANCELADA' },
        },

        orderBy: {
          dataCompra: 'desc',
        },
      }),

      //////////////////////////////////////////////////////
      // VENDAS
      //////////////////////////////////////////////////////

      this.prisma.venda.findMany({
        where: {
          clienteId,
          status: { not: 'CANCELADA' },
        },

        orderBy: {
          dataVenda: 'desc',
        },
      }),

      //////////////////////////////////////////////////////
      // TRANSAÇÕES
      //////////////////////////////////////////////////////

      this.prisma.transacao.findMany({
        where: {
          clienteId,
        },

        include: {
          pagamentos: { orderBy: [{ pagoEm: 'desc' }, { id: 'desc' }] },
          ////////////////////////////////////////////////////
          // CLIENTE
          ////////////////////////////////////////////////////

          cliente: true,

          ////////////////////////////////////////////////////
          // COMPRA
          ////////////////////////////////////////////////////

          compra: true,

          ////////////////////////////////////////////////////
          // VENDA
          ////////////////////////////////////////////////////

          venda: true,
        },

        orderBy: {
          createdAt: 'desc',
        },
      }),

      ////////////////////////////////////////////////////
      // PAGAMENTOS GRANULARES
      ////////////////////////////////////////////////////

      this.prisma.pagamentoTransacao.findMany({
        where: {
          transacao: { clienteId, tipo: TipoTransacao.ENTRADA },
        },

        include: {
          //////////////////////////////////////////////////
          // TRANSAÇÃO
          //////////////////////////////////////////////////

          transacao: {
            include: {
              cliente: true,

              compra: true,

              venda: true,
            },
          },
        },

        orderBy: {
          pagoEm: 'desc',
        },
      }),
    ]);

    //////////////////////////////////////////////////////////
    // FINANCEIRO
    //////////////////////////////////////////////////////////

    const financial = summarizeTitles(transacoes, TipoTransacao.ENTRADA);
    const totalCompras = compras
      .reduce((sum, item) => sum.add(item.valorTotal), new Prisma.Decimal(0))
      .toNumber();
    const totalVendas = vendas
      .reduce((sum, item) => sum.add(item.valorTotal), new Prisma.Decimal(0))
      .toNumber();
    const totalPago = financial.realizado;
    const totalPendente = financial.aberto;
    const totalParcial = financial.parcial;
    const extra = {
      totalRecebido: financial.realizado,
      totalAReceber: financial.aberto,
      totalVencido: financial.vencido,
      quantidadeOperacoes: vendas.length,
      ultimaVenda: vendas[0]?.dataVenda ?? null,
      ultimoPagamento: financial.ultimoPagamento,
    };

    //////////////////////////////////////////////////////////
    // KG COMPRADO
    //////////////////////////////////////////////////////////

    const totalKgComprado = compras.reduce((acc, compra) => {
      return acc + Number(compra.kgBruto ?? 0);
    }, 0);

    //////////////////////////////////////////////////////////
    // KG VENDIDO
    //////////////////////////////////////////////////////////

    const totalKgVendido = vendas.reduce((acc, venda) => {
      return acc + Number(venda.pesoLiquido ?? 0);
    }, 0);

    //////////////////////////////////////////////////////////
    // FRUTAS COMPRADAS
    //////////////////////////////////////////////////////////

    const totalFrutasCompradas = compras.reduce((acc, compra) => {
      return acc + Number(compra.quantidadeFrutas ?? 0);
    }, 0);

    //////////////////////////////////////////////////////////
    // FRUTAS VENDIDAS
    //////////////////////////////////////////////////////////

    const totalFrutasVendidas = vendas.reduce((acc, venda) => {
      return acc + Number(venda.quantidadeFrutas ?? 0);
    }, 0);

    //////////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////////

    return {
      cliente,

      compras,

      vendas,

      transacoes,

      pagamentos,

      resumo: {
        //////////////////////////////////////////////////////
        // FINANCEIRO
        //////////////////////////////////////////////////////

        totalCompras,

        totalVendas,

        saldo: totalPendente,
        ...extra,

        totalPago,

        totalPendente,

        totalParcial,

        //////////////////////////////////////////////////////
        // ESTOQUE
        //////////////////////////////////////////////////////

        totalKgComprado,

        totalKgVendido,

        estoqueMovimentado: totalKgComprado - totalKgVendido,

        //////////////////////////////////////////////////////
        // FRUTAS
        //////////////////////////////////////////////////////

        totalFrutasCompradas,

        totalFrutasVendidas,
      },
    };
  }

  ////////////////////////////////////////////////////////////
  // RESUMO COMPLETO
  ////////////////////////////////////////////////////////////

  async resumoCompleto(clienteId: string): Promise<{
    cliente: Cliente;

    resumo: {
      totalRecebido: number;
      totalAReceber: number;
      totalVencido: number;
      quantidadeOperacoes: number;
      ultimaVenda: Date | null;
      ultimoPagamento: Date | null;
      totalCompras: number;

      totalVendas: number;

      saldo: number;

      totalPago: number;

      totalPendente: number;

      totalParcial: number;

      totalKgComprado: number;

      totalKgVendido: number;

      estoqueMovimentado: number;
    };

    compras: Compra[];

    vendas: Venda[];

    transacoes: (Transacao & {
      cliente: Cliente | null;
    })[];
  }> {
    //////////////////////////////////////////////////////////
    // CLIENTE
    //////////////////////////////////////////////////////////

    const cliente = await this.prisma.cliente.findUnique({
      where: {
        id: clienteId,
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    //////////////////////////////////////////////////////////
    // DADOS
    //////////////////////////////////////////////////////////

    const [compras, vendas, transacoes] = await Promise.all([
      //////////////////////////////////////////////////////
      // COMPRAS
      //////////////////////////////////////////////////////

      this.prisma.compra.findMany({
        where: {
          clienteId,
          status: { not: 'CANCELADA' },
        },

        orderBy: {
          dataCompra: 'desc',
        },
      }),

      //////////////////////////////////////////////////////
      // VENDAS
      //////////////////////////////////////////////////////

      this.prisma.venda.findMany({
        where: {
          clienteId,
          status: { not: 'CANCELADA' },
        },

        orderBy: {
          dataVenda: 'desc',
        },
      }),

      //////////////////////////////////////////////////////
      // TRANSAÇÕES
      //////////////////////////////////////////////////////

      this.prisma.transacao.findMany({
        where: {
          clienteId,
        },

        include: {
          pagamentos: { orderBy: [{ pagoEm: 'desc' }, { id: 'desc' }] },
          ////////////////////////////////////////////////////
          // CLIENTE
          ////////////////////////////////////////////////////

          cliente: true,

          ////////////////////////////////////////////////////
          // COMPRA
          ////////////////////////////////////////////////////

          compra: true,

          ////////////////////////////////////////////////////
          // VENDA
          ////////////////////////////////////////////////////

          venda: true,
        },

        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    //////////////////////////////////////////////////////////
    // FINANCEIRO
    //////////////////////////////////////////////////////////

    const financial = summarizeTitles(transacoes, TipoTransacao.ENTRADA);
    const totalCompras = compras
      .reduce((sum, item) => sum.add(item.valorTotal), new Prisma.Decimal(0))
      .toNumber();
    const totalVendas = vendas
      .reduce((sum, item) => sum.add(item.valorTotal), new Prisma.Decimal(0))
      .toNumber();
    const totalPago = financial.realizado;
    const totalPendente = financial.aberto;
    const totalParcial = financial.parcial;
    const extra = {
      totalRecebido: financial.realizado,
      totalAReceber: financial.aberto,
      totalVencido: financial.vencido,
      quantidadeOperacoes: vendas.length,
      ultimaVenda: vendas[0]?.dataVenda ?? null,
      ultimoPagamento: financial.ultimoPagamento,
    };

    //////////////////////////////////////////////////////////
    // KG COMPRADO
    //////////////////////////////////////////////////////////

    const totalKgComprado = compras.reduce((acc, compra) => {
      return acc + Number(compra.kgBruto ?? 0);
    }, 0);

    //////////////////////////////////////////////////////////
    // KG VENDIDO
    //////////////////////////////////////////////////////////

    const totalKgVendido = vendas.reduce((acc, venda) => {
      return acc + Number(venda.pesoLiquido ?? 0);
    }, 0);

    //////////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////////

    return {
      cliente,

      resumo: {
        totalCompras,

        totalVendas,

        saldo: totalPendente,
        ...extra,

        totalPago,

        totalPendente,

        totalParcial,

        totalKgComprado,

        totalKgVendido,

        estoqueMovimentado: totalKgComprado - totalKgVendido,
      },

      compras,

      vendas,

      transacoes,
    };
  }

  ////////////////////////////////////////////////////////////
  // RESUMO LISTA
  ////////////////////////////////////////////////////////////

  async resumoLista() {
    const clientes = await this.prisma.cliente.findMany({
      include: {
        vendas: {
          where: { status: { not: 'CANCELADA' } },
          orderBy: [{ dataVenda: 'desc' }, { id: 'desc' }],
        },
        compras: { where: { status: { not: 'CANCELADA' } } },
        transacoes: { include: { pagamentos: true } },
      },
    });
    return clientes.map((cliente) => {
      const financial = summarizeTitles(
        cliente.transacoes,
        TipoTransacao.ENTRADA,
      );
      return {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone ?? '',
        proprietarioNome: cliente.proprietarioNome ?? '',
        nomeFantasia: cliente.nomeFantasia ?? '',
        totalCompras: cliente.compras
          .reduce(
            (sum, item) => sum.add(item.valorTotal),
            new Prisma.Decimal(0),
          )
          .toNumber(),
        totalVendas: cliente.vendas
          .reduce(
            (sum, item) => sum.add(item.valorTotal),
            new Prisma.Decimal(0),
          )
          .toNumber(),
        saldo: financial.aberto,
        totalPago: financial.realizado,
        totalPendente: financial.aberto,
        totalParcial: financial.parcial,
        totalRecebido: financial.realizado,
        totalAReceber: financial.aberto,
        totalVencido: financial.vencido,
        totalKgComprado: cliente.compras.reduce(
          (sum, item) => sum + item.kgBruto,
          0,
        ),
        totalKgVendido: cliente.vendas.reduce(
          (sum, item) => sum + item.pesoLiquido,
          0,
        ),
        quantidadeOperacoes: cliente.vendas.length,
        ultimaVenda: cliente.vendas[0]?.dataVenda ?? null,
        ultimoPagamento: financial.ultimoPagamento,
      };
    });
  }
}
