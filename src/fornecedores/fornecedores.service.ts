import { Injectable, NotFoundException } from '@nestjs/common';

import {
  FazendaFornecedor,
  Fornecedor,
  TipoAlertaFornecedor,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

import { buildFornecedorRelatorioTemplate } from './templates/fornecedor-relatorio.template';

import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';

import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';

const PdfPrinterClass = PdfPrinter as unknown as {
  new (fonts: Record<string, unknown>): {
    createPdfKitDocument: (
      docDefinition: TDocumentDefinitions,
    ) => NodeJS.ReadableStream & {
      end(): void;
    };
  };
};

@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  ////////////////////////////////////////////////////////////
  // CREATE FORNECEDOR
  ////////////////////////////////////////////////////////////

  create(data: CreateFornecedorDto): Promise<Fornecedor> {
    return this.prisma.fornecedor.create({
      data: {
        nome: data.nome.trim(),

        sobrenome: data.sobrenome?.trim() ?? null,

        telefone: data.telefone?.trim() ?? null,

        estado: data.estado?.trim().toUpperCase() ?? null,

        limiteFinanceiroValor: data.limiteFinanceiroValor ?? null,

        limiteFinanceiroDias: data.limiteFinanceiroDias ?? null,

        observacoes: data.observacoes?.trim() ?? null,
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // UPDATE FORNECEDOR
  ////////////////////////////////////////////////////////////

  async update(id: string, data: UpdateFornecedorDto): Promise<Fornecedor> {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return this.prisma.fornecedor.update({
      where: {
        id,
      },

      data: {
        ...(data.nome !== undefined && {
          nome: data.nome.trim(),
        }),

        ...(data.sobrenome !== undefined && {
          sobrenome: data.sobrenome?.trim() ?? null,
        }),

        ...(data.telefone !== undefined && {
          telefone: data.telefone?.trim() ?? null,
        }),

        ...(data.estado !== undefined && {
          estado: data.estado?.trim().toUpperCase() ?? null,
        }),

        ...(data.limiteFinanceiroValor !== undefined && {
          limiteFinanceiroValor: data.limiteFinanceiroValor,
        }),

        ...(data.limiteFinanceiroDias !== undefined && {
          limiteFinanceiroDias: data.limiteFinanceiroDias,
        }),

        ...(data.observacoes !== undefined && {
          observacoes: data.observacoes?.trim() ?? null,
        }),
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  findAll() {
    return this.prisma.fornecedor.findMany({
      include: {
        _count: {
          select: {
            fazendas: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // FIND ONE
  ////////////////////////////////////////////////////////////

  async findOne(id: string): Promise<Fornecedor> {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return fornecedor;
  }

  ////////////////////////////////////////////////////////////
  // CREATE FAZENDA
  ////////////////////////////////////////////////////////////

  async createFazenda(
    fornecedorId: string,
    data: CreateFazendaDto,
  ): Promise<FazendaFornecedor> {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id: fornecedorId,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return this.prisma.fazendaFornecedor.create({
      data: {
        fornecedorId,

        nome: data.nome.trim(),

        cidade: data.cidade?.trim() ?? null,

        estado: data.estado?.trim().toUpperCase() ?? null,

        observacoes: data.observacoes?.trim() ?? null,
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // UPDATE FAZENDA
  ////////////////////////////////////////////////////////////

  async updateFazenda(
    id: string,
    data: UpdateFazendaDto,
  ): Promise<FazendaFornecedor> {
    const fazenda = await this.prisma.fazendaFornecedor.findUnique({
      where: {
        id,
      },
    });

    if (!fazenda) {
      throw new NotFoundException('Fazenda não encontrada');
    }

    return this.prisma.fazendaFornecedor.update({
      where: {
        id,
      },

      data: {
        ...(data.nome !== undefined && {
          nome: data.nome.trim(),
        }),

        ...(data.cidade !== undefined && {
          cidade: data.cidade?.trim() ?? null,
        }),

        ...(data.estado !== undefined && {
          estado: data.estado?.trim().toUpperCase() ?? null,
        }),

        ...(data.observacoes !== undefined && {
          observacoes: data.observacoes?.trim() ?? null,
        }),
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // LIST FAZENDAS
  ////////////////////////////////////////////////////////////

  async fazendasFornecedor(fornecedorId: string): Promise<FazendaFornecedor[]> {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id: fornecedorId,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return this.prisma.fazendaFornecedor.findMany({
      where: {
        fornecedorId,
      },

      orderBy: {
        nome: 'asc',
      },
    });
  }

  ////////////////////////////////////////////////////////////
  // RESUMO FORNECEDOR
  ////////////////////////////////////////////////////////////

  async resumoCompleto(fornecedorId: string) {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id: fornecedorId,
      },

      include: {
        fazendas: true,

        alertas: true,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    await this.verificarAlertasFornecedor(fornecedorId);

    const alertasAtualizados = await this.prisma.alertaFornecedor.findMany({
      where: {
        fornecedorId,
      },
    });

    const compras = await this.prisma.compra.findMany({
      where: {
        fornecedorId,
      },

      orderBy: {
        dataCompra: 'desc',
      },
    });

    const totalComprado = compras.reduce((acc, compra) => {
      return acc + Number(compra.valorTotal ?? 0);
    }, 0);

    const totalKg = compras.reduce((acc, compra) => {
      return acc + Number(compra.kgBruto ?? 0);
    }, 0);

    const totalFrutas = compras.reduce((acc, compra) => {
      return acc + Number(compra.quantidadeFrutas ?? 0);
    }, 0);

    const ultimaCompra = compras.length > 0 ? compras[0] : null;

    return {
      fornecedor,

      resumo: {
        totalCompras: compras.length,

        totalComprado,

        totalKg,

        totalFrutas,

        ultimaCompra,

        quantidadeFazendas: fornecedor.fazendas.length,

        limiteFinanceiroValor: Number(fornecedor.limiteFinanceiroValor ?? 0),

        limiteFinanceiroDias: fornecedor.limiteFinanceiroDias ?? 0,

        alertasAtivos: alertasAtualizados.filter((alerta) => !alerta.resolvido)
          .length,
      },

      compras,
    };
  }

  ////////////////////////////////////////////////////////////
  // HISTÓRICO COMPLETO
  ////////////////////////////////////////////////////////////

  async historicoCompleto(fornecedorId: string) {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id: fornecedorId,
      },

      include: {
        fazendas: true,
        alertas: true,
      },
    });

    if (!fornecedor) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    await this.verificarAlertasFornecedor(fornecedorId);

    const alertasAtualizados = await this.prisma.alertaFornecedor.findMany({
      where: {
        fornecedorId,
      },
    });

    const compras = await this.prisma.compra.findMany({
      where: {
        fornecedorId,
      },

      include: {
        fazendaFornecedor: true,
      },

      orderBy: {
        dataCompra: 'desc',
      },
    });

    const transacoes = await this.prisma.transacao.findMany({
      where: {
        fornecedorId,
      },

      include: {
        //////////////////////////////////////////////////////
        // PAGAMENTOS
        //////////////////////////////////////////////////////

        pagamentos: {
          orderBy: {
            createdAt: 'desc',
          },
        },

        //////////////////////////////////////////////////////
        // COMPRA
        //////////////////////////////////////////////////////

        compra: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    ////////////////////////////////////////////////////////////
    // TOTAL COMPRADO
    ////////////////////////////////////////////////////////////

    const totalComprado = compras.reduce(
      (acc, compra) => acc + Number(compra.valorTotal ?? 0),
      0,
    );

    ////////////////////////////////////////////////////////////
    // TOTAL PAGO
    ////////////////////////////////////////////////////////////

    const totalPago = transacoes.reduce(
      (acc, transacao) => acc + Number(transacao.valorPago ?? 0),
      0,
    );

    ////////////////////////////////////////////////////////////
    // SALDO DEVEDOR
    ////////////////////////////////////////////////////////////

    const saldoDevedor = totalComprado - totalPago;

    ////////////////////////////////////////////////////////////
    // LIMITE FINANCEIRO
    ////////////////////////////////////////////////////////////

    const limiteFinanceiro = Number(fornecedor.limiteFinanceiroValor ?? 0);

    ////////////////////////////////////////////////////////////
    // UTILIZAÇÃO DO LIMITE
    ////////////////////////////////////////////////////////////

    const percentualLimite =
      limiteFinanceiro > 0 ? (saldoDevedor / limiteFinanceiro) * 100 : 0;

    ////////////////////////////////////////////////////////////
    // PAGAMENTOS
    ////////////////////////////////////////////////////////////

    const pagamentos = transacoes.flatMap((transacao) => transacao.pagamentos);

    ////////////////////////////////////////////////////////////
    // HISTÓRICO OPERACIONAL CONSOLIDADO
    ////////////////////////////////////////////////////////////

    const historicoOperacional = compras.map((compra) => {
      //////////////////////////////////////////////////////////
      // TRANSAÇÃO VINCULADA
      //////////////////////////////////////////////////////////

      const transacao = transacoes.find((item) => item.compraId === compra.id);

      //////////////////////////////////////////////////////////
      // PAGAMENTOS
      //////////////////////////////////////////////////////////

      const pagamentos =
        transacao?.pagamentos.map((pagamento) => ({
          id: pagamento.id,

          valor: Number(pagamento.valor ?? 0),

          formaPagamento: pagamento.formaPagamento,

          pagoEm: pagamento.pagoEm,

          createdAt: pagamento.createdAt,

          observacoes: pagamento.observacoes ?? null,
        })) ?? [];

      //////////////////////////////////////////////////////////
      // RETURN
      //////////////////////////////////////////////////////////

      return {
        ////////////////////////////////////////////////////////
        // IDENTIFICAÇÃO
        ////////////////////////////////////////////////////////

        compraId: compra.id,

        numeroFolha: compra.numeroFolha ?? null,

        statusCompra: compra.status,

        dataCompra: compra.dataCompra,

        ////////////////////////////////////////////////////////
        // FAZENDA
        ////////////////////////////////////////////////////////

        fazenda: compra.fazendaFornecedor?.nome ?? null,

        ////////////////////////////////////////////////////////
        // CAMINHÃO
        ////////////////////////////////////////////////////////

        modeloCaminhao: compra.modeloCaminhao,

        placa: compra.placa,

        ////////////////////////////////////////////////////////
        // PESAGEM
        ////////////////////////////////////////////////////////

        kgBruto: Number(compra.kgBruto ?? 0),

        quantidadeFrutas: Number(compra.quantidadeFrutas ?? 0),

        mediaFruta: Number(compra.mediaFruta ?? 0),

        descontoKgCalculado: Number(compra.descontoKgCalculado ?? 0),

        kgLiquido: Number(compra.kgLiquido ?? 0),

        ////////////////////////////////////////////////////////
        // FINANCEIRO
        ////////////////////////////////////////////////////////

        precoKg: Number(compra.precoKg ?? 0),

        totalBruto: Number(compra.totalBruto ?? 0),

        despesas: Number(compra.despesas ?? 0),

        valorTotal: Number(compra.valorTotal ?? 0),

        ////////////////////////////////////////////////////////
        // STATUS FINANCEIRO
        ////////////////////////////////////////////////////////

        statusFinanceiro: transacao?.statusFinanceiro ?? 'PENDENTE',

        valorPago: Number(transacao?.valorPago ?? 0),

        valorRestante: Number(
          transacao?.valorRestante ?? compra.valorTotal ?? 0,
        ),

        ////////////////////////////////////////////////////////
        // PAGAMENTOS
        ////////////////////////////////////////////////////////

        pagamentos,
      };
    });

    ////////////////////////////////////////////////////////////
    // ÚLTIMO PAGAMENTO
    ////////////////////////////////////////////////////////////

    const ultimoPagamento = pagamentos.length > 0 ? pagamentos[0] : null;

    ////////////////////////////////////////////////////////////
    // ÚLTIMA COMPRA
    ////////////////////////////////////////////////////////////

    const ultimaCompra = compras.length > 0 ? compras[0] : null;

    ////////////////////////////////////////////////////////////
    // ALERTAS ATIVOS
    ////////////////////////////////////////////////////////////

    const alertasAtivos = alertasAtualizados.filter(
      (alerta) => !alerta.resolvido,
    );

    return {
      fornecedor,

      resumo: {
        totalComprado,

        totalPago,

        saldoDevedor,

        limiteFinanceiro,

        percentualLimite,

        quantidadeCompras: compras.length,

        quantidadePagamentos: pagamentos.length,

        ultimaCompra,

        ultimoPagamento,

        alertasAtivos: alertasAtivos.length,

        limiteFinanceiroDias: fornecedor.limiteFinanceiroDias ?? 0,
      },

      compras,

      transacoes,

      historicoOperacional,
    };
  }

  ////////////////////////////////////////////////////////////
  // PDF FORNECEDOR
  ////////////////////////////////////////////////////////////

  async gerarPdfFornecedor(fornecedorId: string): Promise<Buffer> {
    const historico = await this.historicoCompleto(fornecedorId);

    const docDefinition: TDocumentDefinitions =
      buildFornecedorRelatorioTemplate(historico);

    const fonts = {
      Roboto: {
        normal: 'Helvetica',

        bold: 'Helvetica-Bold',

        italics: 'Helvetica-Oblique',

        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    const printer = new PdfPrinterClass(fonts);

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      pdfDoc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      pdfDoc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      pdfDoc.on('error', reject);

      pdfDoc.end();
    });
  }

  ////////////////////////////////////////////////////////////
  // RESOLVER ALERTA
  ////////////////////////////////////////////////////////////

  private async resolverAlertaFornecedor(
    fornecedorId: string,
    tipo: TipoAlertaFornecedor,
  ): Promise<void> {
    await this.prisma.alertaFornecedor.updateMany({
      where: {
        fornecedorId,

        tipo,

        resolvido: false,
      },

      data: {
        resolvido: true,
      },
    });
  }
  ////////////////////////////////////////////////////////////
  // VERIFICAR ALERTAS FORNECEDOR
  ////////////////////////////////////////////////////////////

  private async verificarAlertasFornecedor(
    fornecedorId: string,
  ): Promise<void> {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: {
        id: fornecedorId,
      },
    });

    if (!fornecedor) {
      return;
    }

    const transacoes = await this.prisma.transacao.findMany({
      where: {
        fornecedorId,

        statusFinanceiro: {
          not: 'PAGO',
        },
      },

      orderBy: {
        vencimento: 'asc',
      },
    });

    const saldoDevedor = transacoes.reduce((acc, transacao) => {
      return acc + Number(transacao.valorRestante ?? 0);
    }, 0);

    const limiteFinanceiro = Number(fornecedor.limiteFinanceiroValor ?? 0);

    if (limiteFinanceiro > 0) {
      const percentualLimite = (saldoDevedor / limiteFinanceiro) * 100;

      if (saldoDevedor > limiteFinanceiro) {
        await this.criarAlertaFornecedor(
          fornecedorId,
          TipoAlertaFornecedor.LIMITE_ULTRAPASSADO,
          `Fornecedor ultrapassou o limite financeiro. Limite: R$ ${limiteFinanceiro.toFixed(
            2,
          )}. Saldo atual: R$ ${saldoDevedor.toFixed(2)}.`,
        );
      } else if (percentualLimite >= 80) {
        await this.criarAlertaFornecedor(
          fornecedorId,
          TipoAlertaFornecedor.LIMITE_PROXIMO,
          `Fornecedor atingiu ${percentualLimite.toFixed(
            1,
          )}% do limite financeiro.`,
        );
      }
    }

    const hoje = new Date();

    hoje.setHours(0, 0, 0, 0);

    for (const transacao of transacoes) {
      if (!transacao.vencimento) {
        continue;
      }

      const vencimento = new Date(transacao.vencimento);

      vencimento.setHours(0, 0, 0, 0);

      const diferencaDias = Math.ceil(
        (vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diferencaDias < 0) {
        await this.criarAlertaFornecedor(
          fornecedorId,
          TipoAlertaFornecedor.VENCIDO,
          `Existe pagamento vencido para este fornecedor desde ${vencimento.toLocaleDateString(
            'pt-BR',
          )}.`,
        );
      } else if (diferencaDias <= 7) {
        await this.criarAlertaFornecedor(
          fornecedorId,
          TipoAlertaFornecedor.VENCIMENTO_PROXIMO,
          `Existe pagamento próximo do vencimento em ${diferencaDias} dia(s).`,
        );
      }
    }
  }

  ////////////////////////////////////////////////////////////
  // CRIAR ALERTA FORNECEDOR
  ////////////////////////////////////////////////////////////

  private async criarAlertaFornecedor(
    fornecedorId: string,
    tipo: TipoAlertaFornecedor,
    mensagem: string,
  ): Promise<void> {
    const alertaExistente = await this.prisma.alertaFornecedor.findFirst({
      where: {
        fornecedorId,

        tipo,

        resolvido: false,
      },
    });

    if (alertaExistente) {
      return;
    }

    await this.prisma.alertaFornecedor.create({
      data: {
        fornecedorId,

        tipo,

        mensagem,
      },
    });
  }
}
