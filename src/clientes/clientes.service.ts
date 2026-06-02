import { Injectable, NotFoundException } from '@nestjs/common';

import {
  Cliente,
  Compra,
  PagamentoTransacao,
  Transacao,
  Venda,
} from '@prisma/client';

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
          clienteId,
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
          createdAt: 'desc',
        },
      }),
    ]);

    //////////////////////////////////////////////////////////
    // FINANCEIRO
    //////////////////////////////////////////////////////////

    let totalCompras = 0;

    let totalVendas = 0;

    let totalPago = 0;

    let totalPendente = 0;

    let totalParcial = 0;

    //////////////////////////////////////////////////////////
    // TRANSAÇÕES
    //////////////////////////////////////////////////////////

    for (const transacao of transacoes) {
      ////////////////////////////////////////////////////////
      // VALORES
      ////////////////////////////////////////////////////////

      const valor = Number(transacao.valor ?? 0);

      const valorPago = Number(transacao.valorPago ?? 0);

      const valorRestante = Number(transacao.valorRestante ?? 0);

      ////////////////////////////////////////////////////////
      // SAÍDA
      ////////////////////////////////////////////////////////

      if (transacao.tipo === 'SAIDA') {
        totalCompras += valor;
      }

      ////////////////////////////////////////////////////////
      // ENTRADA
      ////////////////////////////////////////////////////////

      if (transacao.tipo === 'ENTRADA') {
        totalVendas += valor;
      }

      ////////////////////////////////////////////////////////
      // TOTAL PAGO
      ////////////////////////////////////////////////////////

      totalPago += valorPago;

      ////////////////////////////////////////////////////////
      // TOTAL PENDENTE
      ////////////////////////////////////////////////////////

      totalPendente += valorRestante;

      ////////////////////////////////////////////////////////
      // PARCIAL
      ////////////////////////////////////////////////////////

      if (valorPago > 0 && valorRestante > 0) {
        totalParcial += valorRestante;
      }
    }

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
      return acc + Number(venda.pesoBruto ?? 0);
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

        saldo: totalVendas - totalCompras,

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

    let totalCompras = 0;

    let totalVendas = 0;

    let totalPago = 0;

    let totalPendente = 0;

    let totalParcial = 0;

    //////////////////////////////////////////////////////////
    // TRANSAÇÕES
    //////////////////////////////////////////////////////////

    for (const transacao of transacoes) {
      ////////////////////////////////////////////////////////
      // VALORES
      ////////////////////////////////////////////////////////

      const valor = Number(transacao.valor ?? 0);

      const valorPago = Number(transacao.valorPago ?? 0);

      const valorRestante = Number(transacao.valorRestante ?? 0);

      ////////////////////////////////////////////////////////
      // SAÍDA
      ////////////////////////////////////////////////////////

      if (transacao.tipo === 'SAIDA') {
        totalCompras += valor;
      }

      ////////////////////////////////////////////////////////
      // ENTRADA
      ////////////////////////////////////////////////////////

      if (transacao.tipo === 'ENTRADA') {
        totalVendas += valor;
      }

      ////////////////////////////////////////////////////////
      // TOTAL PAGO
      ////////////////////////////////////////////////////////

      totalPago += valorPago;

      ////////////////////////////////////////////////////////
      // TOTAL PENDENTE
      ////////////////////////////////////////////////////////

      totalPendente += valorRestante;

      ////////////////////////////////////////////////////////
      // PARCIAL
      ////////////////////////////////////////////////////////

      if (valorPago > 0 && valorRestante > 0) {
        totalParcial += valorRestante;
      }
    }

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
      return acc + Number(venda.pesoBruto ?? 0);
    }, 0);

    //////////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////////

    return {
      cliente,

      resumo: {
        totalCompras,

        totalVendas,

        saldo: totalVendas - totalCompras,

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

  async resumoLista(): Promise<
    {
      id: string;

      nome: string;

      proprietarioNome: string;

      nomeFantasia: string;

      telefone: string;

      totalCompras: number;

      totalVendas: number;

      saldo: number;

      totalPago: number;

      totalPendente: number;

      totalParcial: number;

      totalKgComprado: number;

      totalKgVendido: number;
    }[]
  > {
    //////////////////////////////////////////////////////////
    // CLIENTES
    //////////////////////////////////////////////////////////

    const clientes = await this.prisma.cliente.findMany({
      select: {
        id: true,

        nome: true,

        telefone: true,

        proprietarioNome: true,

        nomeFantasia: true,
      },
    });

    //////////////////////////////////////////////////////////
    // TRANSAÇÕES
    //////////////////////////////////////////////////////////

    const transacoes = await this.prisma.transacao.findMany({
      select: {
        clienteId: true,

        tipo: true,

        valor: true,

        valorPago: true,

        valorRestante: true,
      },
    });

    //////////////////////////////////////////////////////////
    // COMPRAS
    //////////////////////////////////////////////////////////

    const compras = await this.prisma.compra.groupBy({
      by: ['clienteId'],

      _sum: {
        kgBruto: true,
      },
    });

    //////////////////////////////////////////////////////////
    // VENDAS
    //////////////////////////////////////////////////////////

    const vendas = await this.prisma.venda.groupBy({
      by: ['clienteId'],

      _sum: {
        pesoLiquido: true,
      },
    });

    //////////////////////////////////////////////////////////
    // MAPA FINANCEIRO
    //////////////////////////////////////////////////////////

    const mapaFinanceiro = new Map<
      string,
      {
        entradas: number;

        saidas: number;

        pago: number;

        pendente: number;

        parcial: number;
      }
    >();

    //////////////////////////////////////////////////////////
    // MAPA COMPRAS
    //////////////////////////////////////////////////////////

    const mapaCompras = new Map<string, number>();

    //////////////////////////////////////////////////////////
    // MAPA VENDAS
    //////////////////////////////////////////////////////////

    const mapaVendas = new Map<string, number>();

    //////////////////////////////////////////////////////////
    // TRANSAÇÕES
    //////////////////////////////////////////////////////////

    for (const transacao of transacoes) {
      if (!transacao.clienteId) {
        continue;
      }

      ////////////////////////////////////////////////////////
      // MAPA
      ////////////////////////////////////////////////////////

      const atual = mapaFinanceiro.get(transacao.clienteId) || {
        entradas: 0,

        saidas: 0,

        pago: 0,

        pendente: 0,

        parcial: 0,
      };

      ////////////////////////////////////////////////////////
      // VALORES
      ////////////////////////////////////////////////////////

      const valor = Number(transacao.valor ?? 0);

      const valorPago = Number(transacao.valorPago ?? 0);

      const valorRestante = Number(transacao.valorRestante ?? 0);

      ////////////////////////////////////////////////////////
      // ENTRADAS
      ////////////////////////////////////////////////////////

      if (transacao.tipo === 'ENTRADA') {
        atual.entradas += valor;
      }

      ////////////////////////////////////////////////////////
      // SAÍDAS
      ////////////////////////////////////////////////////////

      if (transacao.tipo === 'SAIDA') {
        atual.saidas += valor;
      }

      ////////////////////////////////////////////////////////
      // PAGO
      ////////////////////////////////////////////////////////

      atual.pago += valorPago;

      ////////////////////////////////////////////////////////
      // PENDENTE
      ////////////////////////////////////////////////////////

      atual.pendente += valorRestante;

      ////////////////////////////////////////////////////////
      // PARCIAL
      ////////////////////////////////////////////////////////

      if (valorPago > 0 && valorRestante > 0) {
        atual.parcial += valorRestante;
      }

      ////////////////////////////////////////////////////////
      // SET MAPA
      ////////////////////////////////////////////////////////

      mapaFinanceiro.set(transacao.clienteId, atual);
    }

    //////////////////////////////////////////////////////////
    // COMPRAS
    //////////////////////////////////////////////////////////

    for (const compra of compras) {
      if (compra.clienteId) {
        mapaCompras.set(compra.clienteId, Number(compra._sum.kgBruto ?? 0));
      }
    }

    //////////////////////////////////////////////////////////
    // VENDAS
    //////////////////////////////////////////////////////////

    for (const venda of vendas) {
      mapaVendas.set(venda.clienteId, Number(venda._sum.pesoLiquido ?? 0));
    }

    //////////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////////

    return clientes.map((cliente) => {
      ////////////////////////////////////////////////////////
      // FINANCEIRO
      ////////////////////////////////////////////////////////

      const financeiro = mapaFinanceiro.get(cliente.id) || {
        entradas: 0,

        saidas: 0,

        pago: 0,

        pendente: 0,

        parcial: 0,
      };

      ////////////////////////////////////////////////////////
      // RESPONSE
      ////////////////////////////////////////////////////////

      return {
        id: cliente.id,

        nome: cliente.nome,

        telefone: cliente.telefone ?? '',

        proprietarioNome: cliente.proprietarioNome ?? '',

        nomeFantasia: cliente.nomeFantasia ?? '',

        //////////////////////////////////////////////////////
        // FINANCEIRO
        //////////////////////////////////////////////////////

        totalCompras: financeiro.saidas,

        totalVendas: financeiro.entradas,

        saldo: financeiro.entradas - financeiro.saidas,

        totalPago: financeiro.pago,

        totalPendente: financeiro.pendente,

        totalParcial: financeiro.parcial,

        //////////////////////////////////////////////////////
        // ESTOQUE
        //////////////////////////////////////////////////////

        totalKgComprado: mapaCompras.get(cliente.id) ?? 0,

        totalKgVendido: mapaVendas.get(cliente.id) ?? 0,
      };
    });
  }
}
