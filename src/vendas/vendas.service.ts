import {
  BadRequestException,
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
      // PEDIDO
      ////////////////////////////////////////////////////////

      const numeroPedido = await this.gerarNumeroPedido(tx);

      ////////////////////////////////////////////////////////
      // ROMANEIO INTERNO
      ////////////////////////////////////////////////////////

      const numeroRomaneio = await this.gerarNumeroRomaneio(tx);

      ////////////////////////////////////////////////////////
      // VENDA
      ////////////////////////////////////////////////////////

      const venda = await tx.venda.create({
        data: {
          ////////////////////////////////////////////////////
          // CLIENTE
          ////////////////////////////////////////////////////

          clienteId: data.clienteId,

          ////////////////////////////////////////////////////
          // SNAPSHOT CLIENTE
          ////////////////////////////////////////////////////

          clienteNomeSnapshot: cliente.nome,

          clienteTelefoneSnapshot: data.telefone ?? cliente.telefone,

          clienteDocumentoSnapshot: cliente.cpf ?? cliente.cnpj ?? null,

          clienteEnderecoSnapshot: cliente.endereco,

          ////////////////////////////////////////////////////
          // IDENTIFICAÇÃO
          ////////////////////////////////////////////////////

          dataVenda: data.dataVenda ? new Date(data.dataVenda) : new Date(),

          numeroPedido,

          produto: data.produto ?? 'Melancia',

          qualidade: data.qualidade,

          cidade: data.cidade,

          telefone: data.telefone,

          localEntrega: data.localEntrega,

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

          motoristaNome: data.motoristaNome,

          motoristaTelefone: data.motoristaTelefone,

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

          icmsOutros,

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

  ////////////////////////////////////////////////////////////
  // PEDIDO
  ////////////////////////////////////////////////////////////

  private async gerarNumeroPedido(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const ultimoPedido = await tx.venda.findFirst({
      where: {
        numeroPedido: {
          not: null,
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!ultimoPedido?.numeroPedido) {
      return '000001';
    }

    const numeroAtual = Number(ultimoPedido.numeroPedido);

    const proximoNumero = numeroAtual + 1;

    return String(proximoNumero).padStart(6, '0');
  }

  ////////////////////////////////////////////////////////////
  // ROMANEIO
  ////////////////////////////////////////////////////////////

  private async gerarNumeroRomaneio(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const ultimoRomaneio = await tx.venda.findFirst({
      where: {
        numeroRomaneio: {
          not: null,
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!ultimoRomaneio?.numeroRomaneio) {
      return '000001';
    }

    const numeroAtual = Number(ultimoRomaneio.numeroRomaneio);

    const proximoNumero = numeroAtual + 1;

    return String(proximoNumero).padStart(6, '0');
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
