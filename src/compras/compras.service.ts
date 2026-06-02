import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Compra,
  ModeloCaminhao,
  Prisma,
  TipoDescontoCompra,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCompraDto } from './dto/create-compra.dto';

import { SearchCompraDto } from './dto/search-compra.dto';

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  //////////////////////////////////////////////////
  // CREATE
  //////////////////////////////////////////////////

  async create(
    data: CreateCompraDto,
    usuario: {
      id: string;
      nome: string;
    },
  ): Promise<Compra> {
    return this.prisma.$transaction(async (tx): Promise<Compra> => {
      //////////////////////////////////////////////////
      // CLIENTE
      //////////////////////////////////////////////////

      const cliente = data.clienteId
        ? await tx.cliente.findUnique({
            where: {
              id: data.clienteId,
            },
          })
        : null;

      if (data.clienteId && !cliente) {
        throw new NotFoundException('Cliente não encontrado');
      }

      //////////////////////////////////////////////////
      // FORNECEDOR
      //////////////////////////////////////////////////

      const fornecedor = data.fornecedorId
        ? await tx.fornecedor.findUnique({
            where: {
              id: data.fornecedorId,
            },
          })
        : null;

      if (data.fornecedorId && !fornecedor) {
        throw new NotFoundException('Fornecedor não encontrado');
      }

      //////////////////////////////////////////////////
      // REGRA
      //////////////////////////////////////////////////
      if (!fornecedor) {
        throw new BadRequestException('É necessário informar o fornecedor');
      }

      if (!data.fazendaFornecedorId) {
        throw new BadRequestException('Fazenda é obrigatória');
      }

      //////////////////////////////////////////////////
      // FAZENDA
      //////////////////////////////////////////////////

      const fazendaFornecedor = data.fazendaFornecedorId
        ? await tx.fazendaFornecedor.findUnique({
            where: {
              id: data.fazendaFornecedorId,
            },
          })
        : null;

      if (data.fazendaFornecedorId && !fazendaFornecedor) {
        throw new NotFoundException('Fazenda do fornecedor não encontrada');
      }

      if (
        fornecedor &&
        fazendaFornecedor &&
        fazendaFornecedor.fornecedorId !== fornecedor.id
      ) {
        throw new BadRequestException(
          'A fazenda informada não pertence ao fornecedor selecionado',
        );
      }

      //////////////////////////////////////////////////
      // VALIDAÇÕES
      //////////////////////////////////////////////////

      this.validarCompra(data);

      //////////////////////////////////////////////////
      // MÉDIA
      //////////////////////////////////////////////////

      const mediaFruta =
        data.mediaFruta !== undefined
          ? Number(Number(data.mediaFruta).toFixed(1))
          : this.calcularMediaFruta(data.kgBruto, data.quantidadeFrutas);

      //////////////////////////////////////////////////
      // DESCONTO
      //////////////////////////////////////////////////

      const descontoKgCalculado =
        data.descontoKgCalculado !== undefined
          ? Number(Number(data.descontoKgCalculado).toFixed(2))
          : this.calcularDescontoKg({
              tipoDesconto: data.tipoDesconto,

              modeloCaminhao: data.modeloCaminhao,

              kgBruto: data.kgBruto,

              descontoPercentual: data.descontoPercentualAplicado,

              descontoKgManual: data.descontoKgManual,
            });

      //////////////////////////////////////////////////
      // PESO LÍQUIDO
      //////////////////////////////////////////////////

      const kgLiquido =
        data.kgLiquido !== undefined
          ? Number(Number(data.kgLiquido).toFixed(2))
          : this.calcularPesoLiquido(data.kgBruto, descontoKgCalculado);

      //////////////////////////////////////////////////
      // PREÇO KG
      //////////////////////////////////////////////////

      const precoKg = new Prisma.Decimal(data.precoKg);

      //////////////////////////////////////////////////
      // TOTAL BRUTO
      //////////////////////////////////////////////////

      const totalBruto =
        data.totalBruto !== undefined
          ? new Prisma.Decimal(data.totalBruto)
          : this.calcularTotalBruto(kgLiquido, precoKg);

      //////////////////////////////////////////////////
      // DESPESAS
      //////////////////////////////////////////////////

      const despesas = new Prisma.Decimal(data.despesas ?? 0);

      //////////////////////////////////////////////////
      // VALOR TOTAL
      //////////////////////////////////////////////////

      const valorTotal =
        data.valorTotal !== undefined
          ? new Prisma.Decimal(data.valorTotal)
          : this.calcularValorTotal(totalBruto, despesas);

      //////////////////////////////////////////////////
      // COMPRA
      //////////////////////////////////////////////////
      const numeroFolha = await this.gerarProximoNumeroFolha(tx);

      const compra = await tx.compra.create({
        data: {
          ////////////////////////////////////////////////
          // RELAÇÃO
          ////////////////////////////////////////////////

          clienteId: data.clienteId ?? null,

          fornecedorId: data.fornecedorId ?? null,

          fazendaFornecedorId: data.fazendaFornecedorId ?? null,

          ////////////////////////////////////////////////
          // SNAPSHOT PRODUTOR
          ////////////////////////////////////////////////

          clienteNomeSnapshot: fornecedor.nome,

          clienteTelefoneSnapshot: fornecedor.telefone ?? null,

          clienteDocumentoSnapshot: null,

          clienteEnderecoSnapshot: null,

          ////////////////////////////////////////////////
          // STATUS
          ////////////////////////////////////////////////

          status: 'FECHADA',

          ////////////////////////////////////////////////
          // IDENTIFICAÇÃO
          ////////////////////////////////////////////////

          safra: data.safra,

          dataCompra: new Date(data.dataCompra),

          modeloCaminhao: data.modeloCaminhao,

          placa: data.placa.trim().toUpperCase(),

          numeroFolha,

          ////////////////////////////////////////////////
          // PESAGEM
          ////////////////////////////////////////////////

          // ============================================
          // ESTOQUE REAL
          // ============================================

          kgBruto: data.kgBruto,

          // ============================================
          // FRUTAS
          // ============================================

          quantidadeFrutas: data.quantidadeFrutas,

          mediaFruta,

          ////////////////////////////////////////////////
          // DESCONTO
          ////////////////////////////////////////////////

          tipoDesconto: data.tipoDesconto,

          descontoPercentualAplicado: data.descontoPercentualAplicado,

          descontoKgManual: data.descontoKgManual,

          descontoKgCalculado,

          ////////////////////////////////////////////////
          // COMPATIBILIDADE
          ////////////////////////////////////////////////

          kgDescontado: descontoKgCalculado,

          kgLiquido,

          ////////////////////////////////////////////////
          // FINANCEIRO
          ////////////////////////////////////////////////

          precoKg,

          totalBruto,

          despesas,

          valorTotal,

          ////////////////////////////////////////////////
          // LEGADO
          ////////////////////////////////////////////////

          caminhoes: data.caminhoes ?? 1,

          descontoKg: data.descontoKgManual,

          descontoValor: data.despesas,

          ////////////////////////////////////////////////
          // AUDITORIA
          ///////////////////////////////////////////////

          usuarioResponsavelId: usuario.id,

          usuarioResponsavelNome: usuario.nome,

          ////////////////////////////////////////////////
          // OBSERVAÇÕES
          ////////////////////////////////////////////////

          observacoes: data.observacoes,
        },
      });

      //////////////////////////////////////////////////
      // TRANSAÇÃO FINANCEIRA
      //////////////////////////////////////////////////

      await tx.transacao.create({
        data: {
          //////////////////////////////////////////////////////
          // TIPO
          //////////////////////////////////////////////////////

          tipo: 'SAIDA',

          //////////////////////////////////////////////////////
          // VALORES
          //////////////////////////////////////////////////////

          valor: valorTotal,

          valorPago: new Prisma.Decimal(0),

          valorRestante: valorTotal,

          //////////////////////////////////////////////////////
          // STATUS
          //////////////////////////////////////////////////////

          statusFinanceiro: 'PENDENTE',

          //////////////////////////////////////////////////////
          // RELAÇÕES
          //////////////////////////////////////////////////////

          clienteId: data.clienteId ?? null,

          fornecedorId: data.fornecedorId ?? null,

          compraId: compra.id,

          //////////////////////////////////////////////////////
          // DESCRIÇÃO
          //////////////////////////////////////////////////////

          descricao: `Compra Nº ${numeroFolha}`,

          //////////////////////////////////////////////////////
          // VENCIMENTO
          //////////////////////////////////////////////////////

          vencimento: new Date(data.dataCompra),
        },
      });

      return compra;
    });
  }

  //////////////////////////////////////////////////
  // FIND ALL
  //////////////////////////////////////////////////

  findAll(): Promise<
    Prisma.CompraGetPayload<{
      include: {
        cliente: true;

        fornecedor: true;

        fazendaFornecedor: true;

        transacoes: true;
      };
    }>[]
  > {
    return this.prisma.compra.findMany({
      include: {
        cliente: true,

        fornecedor: true,

        fazendaFornecedor: true,

        transacoes: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  //////////////////////////////////////////////////
  // FIND ONE
  //////////////////////////////////////////////////

  async findOne(id: string): Promise<
    Prisma.CompraGetPayload<{
      include: {
        cliente: true;

        fornecedor: true;

        fazendaFornecedor: true;

        transacoes: true;
      };
    }>
  > {
    const compra = await this.prisma.compra.findUnique({
      where: {
        id,
      },

      include: {
        cliente: true,

        fornecedor: true,

        fazendaFornecedor: true,

        transacoes: true,
      },
    });

    if (!compra) {
      throw new NotFoundException('Compra não encontrada');
    }

    return compra;
  }

  //////////////////////////////////////////////////
  // FIND CLIENTE
  //////////////////////////////////////////////////

  findByCliente(clienteId: string): Promise<
    Prisma.CompraGetPayload<{
      include: {
        cliente: true;

        fornecedor: true;

        fazendaFornecedor: true;

        transacoes: true;
      };
    }>[]
  > {
    return this.prisma.compra.findMany({
      where: {
        clienteId,
      },

      include: {
        cliente: true,

        fornecedor: true,

        fazendaFornecedor: true,

        transacoes: true,
      },

      orderBy: {
        dataCompra: 'desc',
      },
    });
  }

  //////////////////////////////////////////////////
  // FIND FORNECEDOR
  //////////////////////////////////////////////////

  findByFornecedor(fornecedorId: string): Promise<
    Prisma.CompraGetPayload<{
      include: {
        cliente: true;

        fornecedor: true;

        fazendaFornecedor: true;

        transacoes: true;
      };
    }>[]
  > {
    return this.prisma.compra.findMany({
      where: {
        fornecedorId,
      },

      include: {
        cliente: true,

        fornecedor: true,

        fazendaFornecedor: true,

        transacoes: true,
      },

      orderBy: {
        dataCompra: 'desc',
      },
    });
  }

  //////////////////////////////////////////////////
  // SEARCH
  //////////////////////////////////////////////////

  async search(filters: SearchCompraDto): Promise<
    Prisma.CompraGetPayload<{
      include: {
        cliente: true;

        fornecedor: true;

        fazendaFornecedor: true;

        transacoes: true;
      };
    }>[]
  > {
    const where: Prisma.CompraWhereInput = {};

    //////////////////////////////////////////////////
    // FORNECEDOR
    //////////////////////////////////////////////////

    if (filters.fornecedor?.trim()) {
      where.fornecedor = {
        nome: {
          contains: filters.fornecedor.trim(),
        },
      };
    }

    //////////////////////////////////////////////////
    // FAZENDA
    //////////////////////////////////////////////////

    if (filters.fazenda?.trim()) {
      where.fazendaFornecedor = {
        nome: {
          contains: filters.fazenda.trim(),
        },
      };
    }

    //////////////////////////////////////////////////
    // PLACA
    //////////////////////////////////////////////////

    if (filters.placa?.trim()) {
      where.placa = {
        contains: filters.placa.trim(),
      };
    }

    //////////////////////////////////////////////////
    // NÚMERO FOLHA
    //////////////////////////////////////////////////

    if (filters.numeroFolha?.trim()) {
      where.numeroFolha = {
        contains: filters.numeroFolha.trim(),
      };
    }

    //////////////////////////////////////////////////
    // STATUS
    //////////////////////////////////////////////////

    if (filters.status) {
      where.status = filters.status;
    }

    //////////////////////////////////////////////////
    // PERÍODO
    //////////////////////////////////////////////////

    if (filters.dataInicio || filters.dataFim) {
      where.dataCompra = {};

      if (filters.dataInicio) {
        where.dataCompra.gte = new Date(filters.dataInicio);
      }

      if (filters.dataFim) {
        const dataFim = new Date(filters.dataFim);

        dataFim.setHours(23, 59, 59, 999);

        where.dataCompra.lte = dataFim;
      }
    }

    return this.prisma.compra.findMany({
      where,

      include: {
        cliente: true,

        fornecedor: true,

        fazendaFornecedor: true,

        transacoes: true,
      },

      orderBy: {
        dataCompra: 'desc',
      },
    });
  }

  //////////////////////////////////////////////////
  // VALIDAR
  //////////////////////////////////////////////////
  private async gerarProximoNumeroFolha(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const compras = await tx.compra.findMany({
      select: {
        numeroFolha: true,
      },
    });

    let maiorNumero = 0;

    for (const compra of compras) {
      const numero = Number(compra.numeroFolha);

      if (!Number.isNaN(numero)) {
        maiorNumero = Math.max(maiorNumero, numero);
      }
    }

    return String(maiorNumero + 1).padStart(6, '0');
  }

  private validarCompra(data: CreateCompraDto): void {
    if (data.kgBruto <= 0) {
      throw new BadRequestException('KG bruto inválido');
    }

    if (data.quantidadeFrutas <= 0) {
      throw new BadRequestException('Quantidade de frutas inválida');
    }

    if (data.precoKg <= 0) {
      throw new BadRequestException('Preço por KG inválido');
    }

    if ((data.despesas ?? 0) < 0) {
      throw new BadRequestException('Despesas inválidas');
    }

    if (!data.placa || data.placa.trim().length < 7) {
      throw new BadRequestException('Placa inválida');
    }

    //////////////////////////////////////////////////
    // PERCENTUAL
    //////////////////////////////////////////////////

    if (
      data.tipoDesconto === TipoDescontoCompra.PERCENTUAL &&
      (data.descontoPercentualAplicado === undefined ||
        data.descontoPercentualAplicado < 0 ||
        data.descontoPercentualAplicado > 100)
    ) {
      throw new BadRequestException('Percentual de desconto inválido');
    }

    //////////////////////////////////////////////////
    // MANUAL
    //////////////////////////////////////////////////

    if (
      data.tipoDesconto === TipoDescontoCompra.MANUAL_KG &&
      (data.descontoKgManual === undefined || data.descontoKgManual <= 0)
    ) {
      throw new BadRequestException('Desconto manual inválido');
    }
  }

  //////////////////////////////////////////////////
  // MÉDIA
  //////////////////////////////////////////////////

  private calcularMediaFruta(
    kgBruto: number,
    quantidadeFrutas: number,
  ): number {
    const media = kgBruto / quantidadeFrutas;

    return Math.floor(media * 10) / 10;
  }

  //////////////////////////////////////////////////
  // DESCONTO
  //////////////////////////////////////////////////

  private calcularDescontoKg(params: {
    tipoDesconto: TipoDescontoCompra;

    modeloCaminhao: ModeloCaminhao;

    kgBruto: number;

    descontoPercentual?: number;

    descontoKgManual?: number;
  }): number {
    //////////////////////////////////////////////////
    // MANUAL KG
    //////////////////////////////////////////////////

    if (params.tipoDesconto === TipoDescontoCompra.MANUAL_KG) {
      return Number((params.descontoKgManual ?? 0).toFixed(2));
    }

    //////////////////////////////////////////////////
    // PERCENTUAL
    //////////////////////////////////////////////////

    if (params.tipoDesconto === TipoDescontoCompra.PERCENTUAL) {
      const percentual = params.descontoPercentual ?? 0;

      return Number((params.kgBruto * (percentual / 100)).toFixed(2));
    }

    //////////////////////////////////////////////////
    // AUTOMÁTICO
    //////////////////////////////////////////////////

    const percentualAutomatico = params.kgBruto * 0.02;

    let adicionalKg = 0;

    switch (params.modeloCaminhao) {
      //////////////////////////////////////////////////
      // TRUCK
      //////////////////////////////////////////////////

      case ModeloCaminhao.TRUCK:
        adicionalKg = 1000;
        break;

      //////////////////////////////////////////////////
      // BITRUCK
      //////////////////////////////////////////////////

      case ModeloCaminhao.BITRUCK:
        adicionalKg = 1500;
        break;

      //////////////////////////////////////////////////
      // CARRETA
      //////////////////////////////////////////////////

      case ModeloCaminhao.CARRETA:
        adicionalKg = 2000;
        break;
    }

    return Number((percentualAutomatico + adicionalKg).toFixed(2));
  }

  //////////////////////////////////////////////////
  // PESO LÍQUIDO
  //////////////////////////////////////////////////

  private calcularPesoLiquido(kgBruto: number, descontoKg: number): number {
    const pesoLiquido = kgBruto - descontoKg;

    if (pesoLiquido <= 0) {
      throw new BadRequestException('Peso líquido inválido');
    }

    return Number(pesoLiquido.toFixed(2));
  }

  //////////////////////////////////////////////////
  // TOTAL BRUTO
  //////////////////////////////////////////////////

  private calcularTotalBruto(
    kgLiquido: number,
    precoKg: Prisma.Decimal,
  ): Prisma.Decimal {
    return new Prisma.Decimal(kgLiquido).mul(precoKg);
  }

  //////////////////////////////////////////////////
  // VALOR FINAL
  //////////////////////////////////////////////////

  private calcularValorTotal(
    totalBruto: Prisma.Decimal,
    despesas: Prisma.Decimal,
  ): Prisma.Decimal {
    const valorFinal = totalBruto.sub(despesas);

    if (valorFinal.lte(0)) {
      throw new BadRequestException('Valor final inválido');
    }

    return valorFinal;
  }
}
