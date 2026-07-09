import {
  BadRequestException,
  ConflictException,
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

import { UpdateCompraDto } from './dto/update-compra.dto';

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
      const numeroFolhaManual = this.normalizarNumeroFolha(data.numeroFolha);

      const numeroFolha =
        numeroFolhaManual ?? (await this.gerarProximoNumeroFolha(tx));

      await this.validarNumeroFolhaDisponivel(tx, numeroFolha);

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
          // CONTROLE INTERNO HMN
          ////////////////////////////////////////////////

          controleInterno: data.controleInterno ?? false,

          qualidadeFruta: data.qualidadeFruta ?? null,

          cargueiro: data.cargueiro?.trim() || null,

          motoristaNome: data.motoristaNome?.trim() || null,

          motoristaTelefone: data.motoristaTelefone?.trim() || null,

          icmsOutros:
            data.icmsOutros !== undefined
              ? new Prisma.Decimal(data.icmsOutros)
              : null,

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
      }).catch((error: unknown): never => {
        this.lancarErroNumeroFolhaDuplicadoSeNecessario(error);

        throw error;
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

  async update(id: string, data: UpdateCompraDto): Promise<Compra> {
    return this.prisma.$transaction(async (tx): Promise<Compra> => {
      const compra = await tx.compra.findUnique({
        where: {
          id,
        },

        include: {
          transacoes: {
            include: {
              pagamentos: true,
            },
          },
        },
      });

      if (!compra) {
        throw new NotFoundException('Compra não encontrada');
      }

      if (compra.transacoes.length !== 1) {
        throw new BadRequestException(
          'Estrutura financeira da compra inválida',
        );
      }

      const transacao = compra.transacoes[0];

      if (!transacao) {
        throw new BadRequestException(
          'Transação financeira da compra não encontrada',
        );
      }

      if (compra.status !== 'FECHADA') {
        throw new BadRequestException(
          'Somente compras fechadas podem ser editadas',
        );
      }

      if (
        Number(transacao.valorPago ?? 0) > 0 ||
        transacao.pagamentos.length > 0
      ) {
        throw new BadRequestException(
          'Esta compra possui pagamentos registrados e não pode ser editada',
        );
      }

      const fornecedorId =
        data.fornecedorId ?? compra.fornecedorId ?? undefined;

      if (!fornecedorId) {
        throw new BadRequestException('Fornecedor é obrigatório');
      }

      const fornecedor = await tx.fornecedor.findUnique({
        where: {
          id: fornecedorId,
        },
      });

      if (!fornecedor) {
        throw new NotFoundException('Fornecedor não encontrado');
      }

      const fazendaFornecedorId =
        data.fazendaFornecedorId ?? compra.fazendaFornecedorId ?? undefined;

      if (!fazendaFornecedorId) {
        throw new BadRequestException('Fazenda é obrigatória');
      }

      const fazendaFornecedor = await tx.fazendaFornecedor.findUnique({
        where: {
          id: fazendaFornecedorId,
        },
      });

      if (!fazendaFornecedor) {
        throw new NotFoundException('Fazenda não encontrada');
      }

      if (fazendaFornecedor.fornecedorId !== fornecedor.id) {
        throw new BadRequestException(
          'A fazenda não pertence ao fornecedor informado',
        );
      }

      const kgBruto = data.kgBruto ?? compra.kgBruto;

      const quantidadeFrutas = data.quantidadeFrutas ?? compra.quantidadeFrutas;

      const modeloCaminhao = data.modeloCaminhao ?? compra.modeloCaminhao;

      const tipoDesconto = data.tipoDesconto ?? compra.tipoDesconto;

      const descontoPercentualAplicado =
        data.descontoPercentualAplicado ??
        compra.descontoPercentualAplicado ??
        undefined;

      const descontoKgManual =
        data.descontoKgManual ?? compra.descontoKgManual ?? undefined;

      const precoKg = new Prisma.Decimal(
        data.precoKg ?? Number(compra.precoKg),
      );

      const despesas = new Prisma.Decimal(
        data.despesas ?? Number(compra.despesas),
      );

      if (
        tipoDesconto === TipoDescontoCompra.PERCENTUAL &&
        (descontoPercentualAplicado === undefined ||
          descontoPercentualAplicado < 0 ||
          descontoPercentualAplicado > 100)
      ) {
        throw new BadRequestException('Percentual de desconto inválido');
      }

      if (
        tipoDesconto === TipoDescontoCompra.MANUAL_KG &&
        (descontoKgManual === undefined || descontoKgManual <= 0)
      ) {
        throw new BadRequestException('Desconto manual inválido');
      }

      if (kgBruto <= 0) {
        throw new BadRequestException('KG bruto inválido');
      }

      if (quantidadeFrutas <= 0) {
        throw new BadRequestException('Quantidade de frutas inválida');
      }

      if (precoKg.lte(0)) {
        throw new BadRequestException('Preço por KG inválido');
      }

      if (despesas.lt(0)) {
        throw new BadRequestException('Despesas inválidas');
      }

      const mediaFruta = this.calcularMediaFruta(kgBruto, quantidadeFrutas);

      const descontoKgCalculado = this.calcularDescontoKg({
        tipoDesconto,
        modeloCaminhao,
        kgBruto,
        descontoPercentual: descontoPercentualAplicado,
        descontoKgManual,
      });

      const kgLiquido = this.calcularPesoLiquido(kgBruto, descontoKgCalculado);

      const totalBruto = this.calcularTotalBruto(kgLiquido, precoKg);

      const valorTotal = this.calcularValorTotal(totalBruto, despesas);

      const numeroFolha =
        data.numeroFolha !== undefined
          ? this.normalizarNumeroFolha(data.numeroFolha)
          : compra.numeroFolha;

      if (numeroFolha) {
        await this.validarNumeroFolhaDisponivel(tx, numeroFolha, compra.id);
      }

      const numeroFolhaAlterado =
        data.numeroFolha !== undefined && numeroFolha !== compra.numeroFolha;

      const compraAtualizada = await tx.compra.update({
        where: {
          id,
        },

        data: {
          clienteId: data.clienteId ?? compra.clienteId,

          fornecedorId,

          fazendaFornecedorId,

          clienteNomeSnapshot: fornecedor.nome,

          clienteTelefoneSnapshot: fornecedor.telefone ?? null,

          safra: data.safra ?? compra.safra,

          dataCompra: data.dataCompra
            ? new Date(data.dataCompra)
            : compra.dataCompra,

          modeloCaminhao,

          placa: data.placa?.trim().toUpperCase() ?? compra.placa,

          numeroFolha,

          ////////////////////////////////////////////////
          // CONTROLE INTERNO HMN
          ////////////////////////////////////////////////

          controleInterno: data.controleInterno ?? compra.controleInterno,

          qualidadeFruta: data.qualidadeFruta ?? compra.qualidadeFruta,

          cargueiro: data.cargueiro ?? compra.cargueiro,

          motoristaNome: data.motoristaNome ?? compra.motoristaNome,

          motoristaTelefone: data.motoristaTelefone ?? compra.motoristaTelefone,

          icmsOutros:
            data.icmsOutros !== undefined
              ? new Prisma.Decimal(data.icmsOutros)
              : compra.icmsOutros,

          kgBruto,

          quantidadeFrutas,

          mediaFruta,

          tipoDesconto,

          descontoPercentualAplicado,

          descontoKgManual,

          descontoKgCalculado,

          kgDescontado: descontoKgCalculado,

          kgLiquido,

          precoKg,

          totalBruto,

          despesas,

          valorTotal,

          caminhoes: data.caminhoes ?? compra.caminhoes,

          descontoKg: descontoKgManual,

          descontoValor: Number(despesas),

          observacoes: data.observacoes ?? compra.observacoes,
        },
      }).catch((error: unknown): never => {
        this.lancarErroNumeroFolhaDuplicadoSeNecessario(error);

        throw error;
      });

      await tx.transacao.update({
        where: {
          id: transacao.id,
        },

        data: {
          valor: valorTotal,

          valorRestante: valorTotal,

          fornecedorId,

          clienteId: data.clienteId ?? compra.clienteId,

          vencimento: data.dataCompra
            ? new Date(data.dataCompra)
            : compra.dataCompra,

          descricao: numeroFolhaAlterado
            ? `Compra Nº ${numeroFolha}`
            : transacao.descricao,
        },
      });

      return compraAtualizada;
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
  // ORIGEM VENDA POR PLACA
  //////////////////////////////////////////////////

  async buscarOrigemPorPlaca(placa: string) {
    const placaNormalizada = placa
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    if (placaNormalizada.length < 3) {
      return [];
    }

    return this.prisma.compra.findMany({
      where: {
        status: 'FECHADA',

        placa: {
          contains: placaNormalizada,
          mode: 'insensitive',
        },
      },

      select: {
        id: true,

        numeroFolha: true,

        placa: true,

        modeloCaminhao: true,

        motoristaNome: true,

        motoristaTelefone: true,

        kgBruto: true,

        descontoKgCalculado: true,

        quantidadeFrutas: true,

        mediaFruta: true,

        dataCompra: true,

        status: true,
      },

      orderBy: {
        dataCompra: 'desc',
      },

      take: 10,
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

    let maiorNumero = 0n;

    for (const compra of compras) {
      const numeroFolha = compra.numeroFolha?.trim();

      if (!numeroFolha || !/^\d+$/.test(numeroFolha)) {
        continue;
      }

      const numero = BigInt(numeroFolha);

      if (numero > maiorNumero) {
        maiorNumero = numero;
      }
    }

    return (maiorNumero + 1n).toString().padStart(6, '0');
  }

  private normalizarNumeroFolha(numeroFolha?: string | null): string | null {
    if (numeroFolha === undefined) {
      return null;
    }

    if (numeroFolha === null) {
      throw new BadRequestException('Número da folha inválido');
    }

    const numeroNormalizado = numeroFolha.trim();

    if (!numeroNormalizado) {
      throw new BadRequestException('Número da folha inválido');
    }

    if (!/^\d+$/.test(numeroNormalizado)) {
      throw new BadRequestException(
        'Número da folha deve conter somente números',
      );
    }

    return numeroNormalizado;
  }

  private async validarNumeroFolhaDisponivel(
    tx: Prisma.TransactionClient,
    numeroFolha: string,
    compraIdIgnorado?: string,
  ): Promise<void> {
    const where: Prisma.CompraWhereInput = {
      numeroFolha,
    };

    if (compraIdIgnorado) {
      where.id = {
        not: compraIdIgnorado,
      };
    }

    const compraExistente = await tx.compra.findFirst({
      where,

      select: {
        id: true,
      },
    });

    if (compraExistente) {
      throw new ConflictException('Número da folha já existe');
    }
  }

  private lancarErroNumeroFolhaDuplicadoSeNecessario(error: unknown): void {
    if (!this.isErroUnicoNumeroFolha(error)) {
      return;
    }

    throw new ConflictException('Número da folha já existe');
  }

  private isErroUnicoNumeroFolha(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;

    if (typeof target === 'string') {
      return target.includes('numeroFolha');
    }

    if (Array.isArray(target)) {
      return target.some((field: unknown): boolean => field === 'numeroFolha');
    }

    return false;
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
