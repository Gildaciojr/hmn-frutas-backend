import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  StatusPagamento,
  StatusVenda,
  TipoTransacao,
  Venda,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateVendaDto } from './dto/create-venda.dto';

import { UpdateVendaDto } from './dto/update-venda.dto';

@Injectable()
export class VendasService {
  constructor(private readonly prisma: PrismaService) {}

  ////////////////////////////////////////////////////////////
  // CREATE
  ////////////////////////////////////////////////////////////

  async create(
    data: CreateVendaDto,
    usuario: {
      id: string;
      nome: string;
    },
  ): Promise<Venda> {
    return this.prisma.$transaction(async (tx) => {
      ////////////////////////////////////////////////////////
      // CLIENTE
      ////////////////////////////////////////////////////////

      const cliente = await tx.cliente.findUnique({
        where: {
          id: data.clienteId,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente não encontrado');
      }

      ////////////////////////////////////////////////////////
      // COMPRA DE ORIGEM
      ////////////////////////////////////////////////////////

      const compraOrigem = data.compraOrigemId
        ? await tx.compra.findUnique({
            where: {
              id: data.compraOrigemId,
            },
          })
        : null;

      if (data.compraOrigemId && !compraOrigem) {
        throw new NotFoundException('Compra de origem não encontrada');
      }

      if (compraOrigem && compraOrigem.status === 'CANCELADA') {
        throw new BadRequestException(
          'Não é possível utilizar uma compra cancelada como origem',
        );
      }

      ////////////////////////////////////////////////////////
      // VALIDAÇÕES
      ////////////////////////////////////////////////////////

      this.validarVenda(data);

      ////////////////////////////////////////////////////////
      // ESTOQUE REAL
      ////////////////////////////////////////////////////////

      const [totalComprado, totalVendido] = await Promise.all([
        //////////////////////////////////////////////////////
        // ENTRADA ESTOQUE
        //////////////////////////////////////////////////////

        tx.compra.aggregate({
          _sum: {
            kgBruto: true,
          },
        }),

        //////////////////////////////////////////////////////
        // SAÍDA ESTOQUE
        //////////////////////////////////////////////////////

        tx.venda.aggregate({
          where: {
            status: {
              not: StatusVenda.CANCELADA,
            },
          },

          _sum: {
            pesoBruto: true,
          },
        }),
      ]);

      ////////////////////////////////////////////////////////
      // ESTOQUE DISPONÍVEL
      ////////////////////////////////////////////////////////

      const estoqueDisponivel =
        Number(totalComprado._sum.kgBruto ?? 0) -
        Number(totalVendido._sum.pesoBruto ?? 0);

      ////////////////////////////////////////////////////////
      // VALIDA ESTOQUE
      ////////////////////////////////////////////////////////

      if (data.pesoBruto > estoqueDisponivel) {
        throw new BadRequestException(
          `Estoque insuficiente. Disponível: ${estoqueDisponivel.toFixed(2)} kg`,
        );
      }

      ////////////////////////////////////////////////////////
      // PESAGEM
      ////////////////////////////////////////////////////////

      const pesoBruto = Number(data.pesoBruto);

      const pesoDesconto = Number(data.pesoDesconto ?? 0);

      ////////////////////////////////////////////////////////
      // PESO LÍQUIDO
      ////////////////////////////////////////////////////////

      const pesoLiquido =
        data.pesoLiquido !== undefined
          ? Number(data.pesoLiquido)
          : pesoBruto - pesoDesconto;

      ////////////////////////////////////////////////////////
      // QUANTIDADE KG (COMPATIBILIDADE)
      ////////////////////////////////////////////////////////

      const quantidadeKg = pesoLiquido;

      ////////////////////////////////////////////////////////
      // MÉDIA
      ////////////////////////////////////////////////////////

      const mediaFruta =
        data.mediaFruta !== undefined
          ? Number(Number(data.mediaFruta).toFixed(1))
          : data.quantidadeFrutas && data.quantidadeFrutas > 0
            ? Number((pesoBruto / data.quantidadeFrutas).toFixed(1))
            : null;

      ////////////////////////////////////////////////////////
      // PREÇO MELANCIA
      ////////////////////////////////////////////////////////

      const precoMelancia = new Prisma.Decimal(data.precoMelancia);

      ////////////////////////////////////////////////////////
      // VALOR MELANCIA
      ////////////////////////////////////////////////////////

      const valorMelancia =
        data.valorMelancia !== undefined
          ? new Prisma.Decimal(data.valorMelancia)
          : new Prisma.Decimal(pesoLiquido).mul(precoMelancia);

      ////////////////////////////////////////////////////////
      // FRETE
      ////////////////////////////////////////////////////////

      const freteTotal =
        data.freteTotal !== undefined
          ? new Prisma.Decimal(data.freteTotal)
          : new Prisma.Decimal(0);

      ////////////////////////////////////////////////////////
      // TOTAL
      ////////////////////////////////////////////////////////

      const valorTotal = valorMelancia.sub(freteTotal);

      ////////////////////////////////////////////////////////
      // COMPATIBILIDADE LEGADA
      ////////////////////////////////////////////////////////

      const precoMercado =
        data.precoMercado !== undefined
          ? new Prisma.Decimal(data.precoMercado)
          : null;

      const precoFrete =
        data.precoFrete !== undefined
          ? new Prisma.Decimal(data.precoFrete)
          : null;

      const valorPorKg = precoMelancia;

      const precoFinal =
        data.precoFinal !== undefined
          ? new Prisma.Decimal(data.precoFinal)
          : null;

      const descontoFruta =
        data.descontoFruta !== undefined
          ? new Prisma.Decimal(data.descontoFruta)
          : null;

      const descontoValor =
        data.descontoValor !== undefined
          ? new Prisma.Decimal(data.descontoValor)
          : null;

      const icmsOutros =
        data.icmsOutros !== undefined
          ? new Prisma.Decimal(data.icmsOutros)
          : null;

      ////////////////////////////////////////////////////////
      // FOLHA DA COMPRA DE ORIGEM
      ////////////////////////////////////////////////////////

      const compraOrigemNumeroFolha = compraOrigem?.numeroFolha ?? null;

      ////////////////////////////////////////////////////////
      // PEDIDO
      ////////////////////////////////////////////////////////

      const numeroPedidoManual = this.normalizarNumeroPedido(
        data.numeroPedido,
      );

      const numeroRomaneioManual = this.normalizarNumeroRomaneio(
        data.numeroRomaneio,
      );

      this.validarNumerosManuaisComCompraOrigem(
        compraOrigemNumeroFolha,
        numeroPedidoManual,
        numeroRomaneioManual,
      );

      const numeroPedido =
        compraOrigemNumeroFolha ??
        numeroPedidoManual ??
        (await this.gerarNumeroPedido(tx));

      ////////////////////////////////////////////////////////
      // ROMANEIO INTERNO
      ////////////////////////////////////////////////////////

      const numeroRomaneio =
        compraOrigemNumeroFolha ??
        numeroRomaneioManual ??
        (await this.gerarNumeroRomaneio(tx));

      await this.validarNumeroPedidoDisponivel(tx, numeroPedido);

      await this.validarNumeroRomaneioDisponivel(tx, numeroRomaneio);

      ////////////////////////////////////////////////////////
      // SNAPSHOTS DA COMPRA DE ORIGEM
      ////////////////////////////////////////////////////////

      const motoristaNome = compraOrigem?.motoristaNome ?? data.motoristaNome;

      const motoristaTelefone =
        compraOrigem?.motoristaTelefone ?? data.motoristaTelefone;

      const qualidade =
        compraOrigem?.qualidadeFruta !== null &&
        compraOrigem?.qualidadeFruta !== undefined
          ? String(compraOrigem.qualidadeFruta)
          : data.qualidade;

      const icmsOutrosOrigem = compraOrigem?.icmsOutros ?? icmsOutros;

      const telefoneVenda = data.telefone?.trim() || cliente.telefone || null;

      const cidadeVenda = data.cidade?.trim() || cliente.cidade || null;

      const localEntregaVenda =
        data.localEntrega?.trim() ||
        [cliente.endereco, cliente.bairro].filter(Boolean).join(' • ') ||
        null;

      ////////////////////////////////////////////////////////
      // VENDA
      ////////////////////////////////////////////////////////

      const venda = await tx.venda.create({
        data: {
          ////////////////////////////////////////////////////
          // CLIENTE
          ////////////////////////////////////////////////////

          clienteId: data.clienteId,

          //////////////////////////////////////////////////
          // COMPRA ORIGEM
          //////////////////////////////////////////////////

          compraOrigemId: compraOrigem?.id ?? null,

          compraOrigemNumeroFolha,

          ////////////////////////////////////////////////////
          // SNAPSHOT CLIENTE
          ////////////////////////////////////////////////////

          clienteNomeSnapshot: cliente.nome,

          clienteTelefoneSnapshot: telefoneVenda,

          clienteDocumentoSnapshot: cliente.cpf ?? cliente.cnpj ?? null,

          clienteEnderecoSnapshot: cliente.endereco,

          ////////////////////////////////////////////////////
          // IDENTIFICAÇÃO
          ////////////////////////////////////////////////////

          dataVenda: data.dataVenda ? new Date(data.dataVenda) : new Date(),

          numeroPedido,

          produto: data.produto ?? 'Melancia',

          qualidade,

          cidade: cidadeVenda,

          telefone: telefoneVenda,

          localEntrega: localEntregaVenda,

          ////////////////////////////////////////////////////
          // ROMANEIO
          ////////////////////////////////////////////////////

          numeroRomaneio,

          destino: data.destino,

          tipoFrete: data.tipoFrete,

          ////////////////////////////////////////////////////
          // CAMINHÃO
          ////////////////////////////////////////////////////

          placa: data.placa?.trim().toUpperCase(),

          modeloCaminhao: data.modeloCaminhao,

          ////////////////////////////////////////////////////
          // MOTORISTA
          ////////////////////////////////////////////////////

          motoristaNome,

          motoristaTelefone,

          motoristaCpf: data.motoristaCpf,

          ////////////////////////////////////////////////////
          // PESAGEM
          ////////////////////////////////////////////////////

          pesoBruto,

          pesoDesconto,

          pesoLiquido,

          quantidadeKg,

          quantidadeFrutas: data.quantidadeFrutas,

          mediaFruta,

          ////////////////////////////////////////////////////
          // FINANCEIRO
          ////////////////////////////////////////////////////

          precoMelancia,

          observacaoPreco: data.observacaoPreco,

          precoMercado,

          precoFrete,

          valorPorKg,

          precoFinal,

          descontoFruta,

          descontoValor,

          icmsOutros: icmsOutrosOrigem,

          valorMelancia,

          freteTotal,

          valorTotal,

          ////////////////////////////////////////////////////
          // STATUS PAGAMENTO
          ////////////////////////////////////////////////////

          statusPagamento: data.statusPagamento ?? StatusPagamento.PENDENTE,

          ////////////////////////////////////////////////////
          // STATUS OPERACIONAL
          ////////////////////////////////////////////////////

          status: StatusVenda.ABERTA,

          ////////////////////////////////////////////////////
          // AUDITORIA
          ////////////////////////////////////////////////////

          usuarioResponsavelId: usuario.id,

          usuarioResponsavelNome: usuario.nome,

          ////////////////////////////////////////////////////
          // OBSERVAÇÕES
          ////////////////////////////////////////////////////

          observacoes: data.observacoes,
        },
      }).catch((error: unknown) => {
        this.lancarErroNumeroOperacionalDuplicadoSeNecessario(error);

        throw error;
      });

      ////////////////////////////////////////////////////////
      // FINANCEIRO
      ////////////////////////////////////////////////////////

      await tx.transacao.create({
        data: {
          //////////////////////////////////////////////////////
          // TIPO
          //////////////////////////////////////////////////////

          tipo: TipoTransacao.ENTRADA,

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

          clienteId: data.clienteId,

          vendaId: venda.id,

          //////////////////////////////////////////////////////
          // DESCRIÇÃO
          //////////////////////////////////////////////////////

          descricao: `Venda pedido ${numeroPedido}`,

          //////////////////////////////////////////////////////
          // VENCIMENTO
          //////////////////////////////////////////////////////

          vencimento: data.dataVenda ? new Date(data.dataVenda) : new Date(),
        },
      });

      return venda;
    });
  }

  ////////////////////////////////////////////////////////////
  // FIND ALL
  ////////////////////////////////////////////////////////////

  async findAll(): Promise<
    Prisma.VendaGetPayload<{
      include: {
        cliente: true;
      };
    }>[]
  > {
    return this.prisma.venda.findMany({
      include: {
        cliente: true,
        compraOrigem: true,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 200,
    });
  }

  ////////////////////////////////////////////////////////////
  // FIND BY CLIENTE
  ////////////////////////////////////////////////////////////

  async findByCliente(clienteId: string): Promise<
    Prisma.VendaGetPayload<{
      include: {
        cliente: true;
      };
    }>[]
  > {
    return this.prisma.venda.findMany({
      where: {
        clienteId,
      },

      include: {
        cliente: true,
        compraOrigem: true,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 100,
    });
  }

  ////////////////////////////////////////////////////////////
  // FIND BY PEDIDO
  ////////////////////////////////////////////////////////////

  async findByPedido(numeroPedido: string): Promise<
    Prisma.VendaGetPayload<{
      include: {
        cliente: true;

        transacoes: {
          include: {
            pagamentos: true;
          };
        };
      };
    }>
  > {
    const venda = await this.prisma.venda.findFirst({
      where: {
        numeroPedido,
      },

      include: {
        cliente: true,
        compraOrigem: true,

        transacoes: {
          include: {
            pagamentos: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
    });

    if (!venda) {
      throw new NotFoundException('Pedido não encontrado');
    }

    return venda;
  }

  ////////////////////////////////////////////////////////////
  // FIND ONE
  ////////////////////////////////////////////////////////////

  async findOne(id: string): Promise<
    Prisma.VendaGetPayload<{
      include: {
        cliente: true;

        transacoes: {
          include: {
            pagamentos: true;
          };
        };
      };
    }>
  > {
    const venda = await this.prisma.venda.findUnique({
      where: {
        id,
      },

      include: {
        cliente: true,
        compraOrigem: true,

        transacoes: {
          include: {
            pagamentos: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
    });

    if (!venda) {
      throw new NotFoundException('Venda não encontrada');
    }

    return venda;
  }

  ////////////////////////////////////////////////////////////
  // FIND BY ROMANEIO
  ////////////////////////////////////////////////////////////

  async findByRomaneio(numeroRomaneio: string): Promise<
    Prisma.VendaGetPayload<{
      include: {
        cliente: true;

        transacoes: true;
      };
    }>
  > {
    const venda = await this.prisma.venda.findFirst({
      where: {
        numeroRomaneio,
      },

      include: {
        cliente: true,

        compraOrigem: true,

        transacoes: true,
      },
    });

    if (!venda) {
      throw new NotFoundException('Romaneio não encontrado');
    }

    return venda;
  }

  ////////////////////////////////////////////////////////////
  // VALIDAR
  ////////////////////////////////////////////////////////////

  private validarVenda(data: CreateVendaDto): void {
    if (!data.pesoBruto || data.pesoBruto <= 0) {
      throw new BadRequestException('Peso bruto inválido');
    }

    if (!data.precoMelancia || data.precoMelancia <= 0) {
      throw new BadRequestException('Preço da melancia inválido');
    }

    if (data.quantidadeFrutas !== undefined && data.quantidadeFrutas <= 0) {
      throw new BadRequestException('Quantidade de frutas inválida');
    }

    if (data.pesoDesconto !== undefined && data.pesoDesconto < 0) {
      throw new BadRequestException('Peso desconto inválido');
    }
  }

  private normalizarNumeroPedido(numeroPedido?: string | null): string | null {
    return this.normalizarNumeroOperacional(numeroPedido, 'pedido');
  }

  private normalizarNumeroRomaneio(
    numeroRomaneio?: string | null,
  ): string | null {
    return this.normalizarNumeroOperacional(numeroRomaneio, 'romaneio');
  }

  private normalizarNumeroOperacional(
    numero: string | null | undefined,
    campo: 'pedido' | 'romaneio',
  ): string | null {
    if (numero === undefined) {
      return null;
    }

    if (numero === null) {
      throw new BadRequestException(this.mensagemNumeroInvalido(campo));
    }

    const numeroNormalizado = numero.trim();

    if (!numeroNormalizado) {
      throw new BadRequestException(this.mensagemNumeroInvalido(campo));
    }

    if (!/^\d+$/.test(numeroNormalizado)) {
      throw new BadRequestException(
        this.mensagemNumeroSomenteNumeros(campo),
      );
    }

    return numeroNormalizado;
  }

  private mensagemNumeroInvalido(campo: 'pedido' | 'romaneio'): string {
    return campo === 'pedido'
      ? 'Número do pedido inválido'
      : 'Número do romaneio inválido';
  }

  private mensagemNumeroSomenteNumeros(campo: 'pedido' | 'romaneio'): string {
    return campo === 'pedido'
      ? 'Número do pedido deve conter somente números'
      : 'Número do romaneio deve conter somente números';
  }

  private validarNumerosManuaisComCompraOrigem(
    compraOrigemNumeroFolha: string | null,
    numeroPedidoManual: string | null,
    numeroRomaneioManual: string | null,
  ): void {
    if (!compraOrigemNumeroFolha) {
      return;
    }

    if (
      numeroPedidoManual !== null &&
      numeroPedidoManual !== compraOrigemNumeroFolha
    ) {
      throw new BadRequestException(
        'Número do pedido deve ser igual à folha da compra de origem',
      );
    }

    if (
      numeroRomaneioManual !== null &&
      numeroRomaneioManual !== compraOrigemNumeroFolha
    ) {
      throw new BadRequestException(
        'Número do romaneio deve ser igual à folha da compra de origem',
      );
    }
  }

  private async validarNumeroPedidoDisponivel(
    tx: Prisma.TransactionClient,
    numeroPedido: string,
    vendaIdIgnorado?: string,
  ): Promise<void> {
    const where: Prisma.VendaWhereInput = {
      numeroPedido,
    };

    if (vendaIdIgnorado) {
      where.id = {
        not: vendaIdIgnorado,
      };
    }

    const vendaExistente = await tx.venda.findFirst({
      where,
      select: {
        id: true,
      },
    });

    if (vendaExistente) {
      throw new ConflictException('Número do pedido já existe');
    }
  }

  private async validarNumeroRomaneioDisponivel(
    tx: Prisma.TransactionClient,
    numeroRomaneio: string,
    vendaIdIgnorado?: string,
  ): Promise<void> {
    const where: Prisma.VendaWhereInput = {
      numeroRomaneio,
    };

    if (vendaIdIgnorado) {
      where.id = {
        not: vendaIdIgnorado,
      };
    }

    const vendaExistente = await tx.venda.findFirst({
      where,
      select: {
        id: true,
      },
    });

    if (vendaExistente) {
      throw new ConflictException('Número do romaneio já existe');
    }
  }

  private lancarErroNumeroOperacionalDuplicadoSeNecessario(
    error: unknown,
  ): void {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return;
    }

    if (this.erroUnicoContemCampo(error, 'numeroPedido')) {
      throw new ConflictException('Número do pedido já existe');
    }

    if (this.erroUnicoContemCampo(error, 'numeroRomaneio')) {
      throw new ConflictException('Número do romaneio já existe');
    }
  }

  private erroUnicoContemCampo(
    error: Prisma.PrismaClientKnownRequestError,
    campo: 'numeroPedido' | 'numeroRomaneio',
  ): boolean {
    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.some(
        (item) => typeof item === 'string' && item.includes(campo),
      );
    }

    return typeof target === 'string' && target.includes(campo);
  }

  ////////////////////////////////////////////////////////////
  // PEDIDO
  ////////////////////////////////////////////////////////////

  private async gerarNumeroPedido(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const vendas = await tx.venda.findMany({
      where: {
        numeroPedido: {
          not: null,
        },
      },

      select: {
        numeroPedido: true,
      },
    });

    let maiorNumero = 0n;

    for (const venda of vendas) {
      const numeroPedido = venda.numeroPedido?.trim();

      if (!numeroPedido || !/^\d+$/.test(numeroPedido)) {
        continue;
      }

      const numero = BigInt(numeroPedido);

      if (numero > maiorNumero) {
        maiorNumero = numero;
      }
    }

    return (maiorNumero + 1n).toString().padStart(6, '0');
  }

  ////////////////////////////////////////////////////////////
  // ROMANEIO
  ////////////////////////////////////////////////////////////

  private async gerarNumeroRomaneio(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const vendas = await tx.venda.findMany({
      where: {
        numeroRomaneio: {
          not: null,
        },
      },

      select: {
        numeroRomaneio: true,
      },
    });

    let maiorNumero = 0n;

    for (const venda of vendas) {
      const numeroRomaneio = venda.numeroRomaneio?.trim();

      if (!numeroRomaneio || !/^\d+$/.test(numeroRomaneio)) {
        continue;
      }

      const numero = BigInt(numeroRomaneio);

      if (numero > maiorNumero) {
        maiorNumero = numero;
      }
    }

    return (maiorNumero + 1n).toString().padStart(6, '0');
  }

  ////////////////////////////////////////////////////////////
  // UPDATE
  ////////////////////////////////////////////////////////////

  async update(id: string, data: UpdateVendaDto): Promise<Venda> {
    return this.prisma.$transaction(async (tx): Promise<Venda> => {
      const venda = await tx.venda.findUnique({
        where: {
          id,
        },

        include: {
          cliente: true,

          compraOrigem: true,

          transacoes: {
            include: {
              pagamentos: true,
            },
          },
        },
      });

      if (!venda) {
        throw new NotFoundException('Venda não encontrada');
      }

      if (venda.status === StatusVenda.CANCELADA) {
        throw new BadRequestException('Venda cancelada não pode ser editada');
      }

      if (venda.transacoes.length !== 1) {
        throw new BadRequestException('Estrutura financeira da venda inválida');
      }

      const transacao = venda.transacoes[0];

      if (!transacao) {
        throw new BadRequestException(
          'Transação financeira da venda não encontrada',
        );
      }

      if (
        Number(transacao.valorPago ?? 0) > 0 ||
        transacao.pagamentos.length > 0
      ) {
        throw new BadRequestException(
          'Esta venda possui pagamentos registrados e não pode ser editada',
        );
      }

      const clienteId = data.clienteId ?? venda.clienteId;

      const cliente = await tx.cliente.findUnique({
        where: {
          id: clienteId,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente não encontrado');
      }

      const pesoBruto = data.pesoBruto ?? venda.pesoBruto;

      const pesoDesconto = data.pesoDesconto ?? venda.pesoDesconto ?? 0;

      if (pesoBruto <= 0) {
        throw new BadRequestException('Peso bruto inválido');
      }

      if (pesoDesconto < 0) {
        throw new BadRequestException('Peso desconto inválido');
      }

      const pesoLiquido =
        data.pesoLiquido !== undefined
          ? Number(data.pesoLiquido)
          : pesoBruto - pesoDesconto;

      if (pesoLiquido <= 0) {
        throw new BadRequestException('Peso líquido inválido');
      }

      const quantidadeFrutas =
        data.quantidadeFrutas ?? venda.quantidadeFrutas ?? undefined;

      if (quantidadeFrutas !== undefined && quantidadeFrutas <= 0) {
        throw new BadRequestException('Quantidade de frutas inválida');
      }

      const mediaFruta =
        data.mediaFruta !== undefined
          ? Number(Number(data.mediaFruta).toFixed(1))
          : quantidadeFrutas && quantidadeFrutas > 0
            ? Number((pesoBruto / quantidadeFrutas).toFixed(1))
            : null;

      const precoMelancia = new Prisma.Decimal(
        data.precoMelancia ?? Number(venda.precoMelancia),
      );

      if (precoMelancia.lte(0)) {
        throw new BadRequestException('Preço da melancia inválido');
      }

      const valorMelancia =
        data.valorMelancia !== undefined
          ? new Prisma.Decimal(data.valorMelancia)
          : new Prisma.Decimal(pesoLiquido).mul(precoMelancia);

      const freteTotal =
        data.freteTotal !== undefined
          ? new Prisma.Decimal(data.freteTotal)
          : new Prisma.Decimal(venda.freteTotal ?? 0);

      if (freteTotal.lt(0)) {
        throw new BadRequestException('Frete inválido');
      }

      const valorTotal =
        data.valorTotal !== undefined
          ? new Prisma.Decimal(data.valorTotal)
          : valorMelancia.sub(freteTotal);

      if (valorTotal.lte(0)) {
        throw new BadRequestException('Valor total inválido');
      }

      const [totalComprado, totalVendido] = await Promise.all([
        tx.compra.aggregate({
          _sum: {
            kgBruto: true,
          },
        }),

        tx.venda.aggregate({
          where: {
            status: {
              not: StatusVenda.CANCELADA,
            },
          },

          _sum: {
            pesoBruto: true,
          },
        }),
      ]);

      const estoqueDisponivel =
        Number(totalComprado._sum.kgBruto ?? 0) -
        Number(totalVendido._sum.pesoBruto ?? 0);

      const estoqueDisponivelReal = estoqueDisponivel + venda.pesoBruto;

      if (pesoBruto > estoqueDisponivelReal) {
        throw new BadRequestException(
          `Estoque insuficiente. Disponível: ${estoqueDisponivelReal.toFixed(
            2,
          )} kg`,
        );
      }

      const telefoneVenda =
        data.telefone?.trim() || cliente.telefone || venda.telefone || null;

      const cidadeVenda =
        data.cidade?.trim() || cliente.cidade || venda.cidade || null;

      const localEntregaVenda =
        data.localEntrega?.trim() ||
        [cliente.endereco, cliente.bairro].filter(Boolean).join(' • ') ||
        venda.localEntrega ||
        null;

      const numeroPedido =
        data.numeroPedido !== undefined
          ? this.normalizarNumeroPedido(data.numeroPedido)
          : venda.numeroPedido;

      const numeroRomaneio =
        data.numeroRomaneio !== undefined
          ? this.normalizarNumeroRomaneio(data.numeroRomaneio)
          : venda.numeroRomaneio;

      if (!numeroPedido) {
        throw new BadRequestException('Número do pedido inválido');
      }

      if (!numeroRomaneio) {
        throw new BadRequestException('Número do romaneio inválido');
      }

      if (venda.compraOrigemId) {
        const compraOrigemNumeroFolha =
          venda.compraOrigem?.numeroFolha ?? venda.compraOrigemNumeroFolha;

        this.validarNumerosManuaisComCompraOrigem(
          compraOrigemNumeroFolha,
          data.numeroPedido !== undefined ? numeroPedido : null,
          data.numeroRomaneio !== undefined ? numeroRomaneio : null,
        );
      }

      await this.validarNumeroPedidoDisponivel(tx, numeroPedido, venda.id);

      await this.validarNumeroRomaneioDisponivel(
        tx,
        numeroRomaneio,
        venda.id,
      );

      const vendaAtualizada = await tx.venda.update({
        where: {
          id,
        },

        data: {
          clienteId,

          clienteNomeSnapshot: cliente.nome,

          clienteTelefoneSnapshot: telefoneVenda,

          clienteDocumentoSnapshot: cliente.cpf ?? cliente.cnpj ?? null,

          clienteEnderecoSnapshot: cliente.endereco,

          dataVenda: data.dataVenda
            ? new Date(data.dataVenda)
            : venda.dataVenda,

          numeroPedido,

          produto: data.produto ?? venda.produto,

          qualidade: data.qualidade ?? venda.qualidade,

          cidade: cidadeVenda,

          telefone: telefoneVenda,

          localEntrega: localEntregaVenda,

          numeroRomaneio,

          destino: data.destino ?? venda.destino,

          tipoFrete: data.tipoFrete ?? venda.tipoFrete,

          placa: data.placa?.trim().toUpperCase() ?? venda.placa,

          modeloCaminhao: data.modeloCaminhao ?? venda.modeloCaminhao,

          motoristaNome: data.motoristaNome ?? venda.motoristaNome,

          motoristaTelefone: data.motoristaTelefone ?? venda.motoristaTelefone,

          motoristaCpf: data.motoristaCpf ?? venda.motoristaCpf,

          pesoBruto,

          pesoDesconto,

          pesoLiquido,

          quantidadeKg: pesoLiquido,

          quantidadeFrutas,

          mediaFruta,

          precoMelancia,

          observacaoPreco: data.observacaoPreco ?? venda.observacaoPreco,

          precoMercado:
            data.precoMercado !== undefined
              ? new Prisma.Decimal(data.precoMercado)
              : venda.precoMercado,

          precoFrete:
            data.precoFrete !== undefined
              ? new Prisma.Decimal(data.precoFrete)
              : venda.precoFrete,

          valorPorKg: precoMelancia,

          precoFinal:
            data.precoFinal !== undefined
              ? new Prisma.Decimal(data.precoFinal)
              : venda.precoFinal,

          descontoFruta:
            data.descontoFruta !== undefined
              ? new Prisma.Decimal(data.descontoFruta)
              : venda.descontoFruta,

          descontoValor:
            data.descontoValor !== undefined
              ? new Prisma.Decimal(data.descontoValor)
              : venda.descontoValor,

          icmsOutros:
            data.icmsOutros !== undefined
              ? new Prisma.Decimal(data.icmsOutros)
              : venda.icmsOutros,

          valorMelancia,

          freteTotal,

          valorTotal,

          statusPagamento: data.statusPagamento ?? venda.statusPagamento,

          observacoes: data.observacoes ?? venda.observacoes,
        },
      }).catch((error: unknown) => {
        this.lancarErroNumeroOperacionalDuplicadoSeNecessario(error);

        throw error;
      });

      await tx.transacao.update({
        where: {
          id: transacao.id,
        },

        data: {
          valor: valorTotal,

          valorRestante: valorTotal,

          clienteId,

          vencimento: data.dataVenda
            ? new Date(data.dataVenda)
            : venda.dataVenda,

          descricao: `Venda pedido ${numeroPedido}`,
        },
      });

      return vendaAtualizada;
    });
  }

  ////////////////////////////////////////////////////////////
  // STATUS PAGAMENTO
  ////////////////////////////////////////////////////////////

  async atualizarPagamento(
    id: string,
    statusPagamento: StatusPagamento,
  ): Promise<Venda> {
    const venda = await this.prisma.venda.findUnique({
      where: {
        id,
      },
    });

    if (!venda) {
      throw new NotFoundException('Venda não encontrada');
    }

    return this.prisma.venda.update({
      where: {
        id,
      },

      data: {
        statusPagamento,
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // STATUS OPERACIONAL
  ////////////////////////////////////////////////////////////

  async atualizarStatus(id: string, status: StatusVenda): Promise<Venda> {
    const venda = await this.prisma.venda.findUnique({
      where: {
        id,
      },
    });

    if (!venda) {
      throw new NotFoundException('Venda não encontrada');
    }

    return this.prisma.venda.update({
      where: {
        id,
      },

      data: {
        status,
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // CANCELAR
  ////////////////////////////////////////////////////////////

  async cancelarVenda(id: string, motivo?: string): Promise<Venda> {
    return this.prisma.$transaction(async (tx) => {
      const venda = await tx.venda.findUnique({
        where: {
          id,
        },
      });

      if (!venda) {
        throw new NotFoundException('Venda não encontrada');
      }

      if (venda.status === StatusVenda.CANCELADA) {
        throw new BadRequestException('Venda já cancelada');
      }

      const vendaCancelada = await tx.venda.update({
        where: {
          id,
        },

        data: {
          status: StatusVenda.CANCELADA,

          canceladoEm: new Date(),

          motivoCancelamento: motivo?.trim() || 'Cancelamento manual',
        },
      });

      await tx.transacao.updateMany({
        where: {
          vendaId: venda.id,
        },

        data: {
          descricao: `CANCELADA - ${venda.numeroPedido}`,
        },
      });

      return vendaCancelada;
    });
  }
}
