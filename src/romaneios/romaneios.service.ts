import { Injectable, NotFoundException } from '@nestjs/common';

import PdfPrinter from 'pdfmake';

import type { TDocumentDefinitions } from 'pdfmake/interfaces';

import { PrismaService } from '../prisma/prisma.service';

import {
  buildCompraRomaneioTemplate,
  type CompraRomaneioData,
} from './templates/compra-romaneio.template';

import { buildVendaRomaneioTemplate } from './templates/venda-romaneio.template';

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
export class RomaneiosService {
  constructor(private readonly prisma: PrismaService) {}

  ////////////////////////////////////////////////////////////
  // PDF VENDA
  ////////////////////////////////////////////////////////////

  async gerarPdfVenda(vendaId: string): Promise<Buffer> {
    ////////////////////////////////////////////////////////
    // VENDA
    ////////////////////////////////////////////////////////

    const venda = await this.prisma.venda.findUnique({
      where: {
        id: vendaId,
      },

      include: {
        ////////////////////////////////////////////////////
        // CLIENTE
        ////////////////////////////////////////////////////

        cliente: true,

        ////////////////////////////////////////////////////
        // FINANCEIRO
        ////////////////////////////////////////////////////

        transacoes: true,
      },
    });

    if (!venda) {
      throw new NotFoundException('Venda não encontrada');
    }

    ////////////////////////////////////////////////////////
    // FONTS
    ////////////////////////////////////////////////////////

    const fonts = {
      Roboto: {
        normal: 'Helvetica',

        bold: 'Helvetica-Bold',

        italics: 'Helvetica-Oblique',

        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    ////////////////////////////////////////////////////////
    // PRINTER
    ////////////////////////////////////////////////////////

    const printer = new PdfPrinterClass(fonts);

    ////////////////////////////////////////////////////////
    // TEMPLATE
    ////////////////////////////////////////////////////////

    let docDefinition: TDocumentDefinitions;

    try {
      //////////////////////////////////////////////////////
      // TEMPLATE
      //////////////////////////////////////////////////////

      docDefinition = buildVendaRomaneioTemplate({
        empresa: {
          nome: 'HMN FRUTAS',

          telefone:
            'Hugo: (11) 96900-5002 | Miron: (62) 99909-8205 | Netinho: (62) 99962-5436',

          endereco:
            'Rua Henrique Tito, 459 - St. Centro - CEP 76335-000 - Uruana/GO',

          email: 'hmnfrutas@gmail.com',

          responsaveis: 'Hugo • Miron • Netinho',
        },

        venda,
      });

      //////////////////////////////////////////////////////
      // DEBUG TEMPLATE OK
      //////////////////////////////////////////////////////

      console.log('PDF TEMPLATE OK');
    } catch (error: unknown) {
      //////////////////////////////////////////////////////
      // DEBUG TEMPLATE ERROR
      //////////////////////////////////////////////////////

      console.error('ERRO TEMPLATE PDF:', error);

      //////////////////////////////////////////////////////
      // DEBUG VENDA
      //////////////////////////////////////////////////////

      console.log('VENDA PDF:', venda);

      //////////////////////////////////////////////////////
      // THROW
      //////////////////////////////////////////////////////

      throw error;
    }

    ////////////////////////////////////////////////////////
    // MARCA PDF GERADO
    ////////////////////////////////////////////////////////

    await this.prisma.venda.update({
      where: {
        id: venda.id,
      },

      data: {
        pdfGeradoEm: new Date(),
      },
    });

    ////////////////////////////////////////////////////////
    // PDF DOC
    ////////////////////////////////////////////////////////

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    ////////////////////////////////////////////////////////
    // BUFFER
    ////////////////////////////////////////////////////////

    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
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
  // PDF COMPRA
  ////////////////////////////////////////////////////////////

  async gerarPdfCompra(compraId: string): Promise<Buffer> {
    ////////////////////////////////////////////////////////
    // COMPRA
    ////////////////////////////////////////////////////////

    const compra = await this.prisma.compra.findUnique({
      where: {
        id: compraId,
      },

      include: {
        ////////////////////////////////////////////////////
        // CLIENTE
        ////////////////////////////////////////////////////

        cliente: true,

        ////////////////////////////////////////////////////
        // FINANCEIRO
        ////////////////////////////////////////////////////

        transacoes: true,
      },
    });

    if (!compra) {
      throw new NotFoundException('Compra não encontrada');
    }

    ////////////////////////////////////////////////////////
    // TEMPLATE
    ////////////////////////////////////////////////////////

    const compraRomaneioData: CompraRomaneioData = {
      empresa: {
        nome: 'HMN FRUTAS',

        telefone:
          'Hugo: (11) 96900-5002 | Miron: (62) 99909-8205 | Netinho: (62) 99962-5436',

        endereco:
          'Rua Henrique Tito, 459 - St. Centro - CEP 76335-000 - Uruana/GO',

        email: 'hmnfrutas@gmail.com',

        responsaveis: 'Hugo • Miron • Netinho',
      },

      compra: {
        id: compra.id,

        numeroFolha: compra.numeroFolha,

        createdAt: compra.createdAt,

        dataCompra: compra.dataCompra,

        safra: compra.safra,

        controleInterno: compra.controleInterno,

        fornecedor: {
          nome: compra.clienteNomeSnapshot,

          telefone: compra.clienteTelefoneSnapshot,

          documento: compra.clienteDocumentoSnapshot,

          endereco: compra.clienteEnderecoSnapshot,
        },

        cliente: compra.cliente
          ? {
              id: compra.cliente.id,

              nome: compra.cliente.nome,

              telefone: compra.cliente.telefone,

              documento: compra.cliente.cpf ?? compra.cliente.cnpj,

              endereco: compra.cliente.endereco,

              cidade: compra.cliente.cidade,

              estado: compra.cliente.estado,
            }
          : null,

        qualidadeFruta: compra.qualidadeFruta,

        modeloCaminhao: compra.modeloCaminhao,

        placa: compra.placa,

        cargueiro: compra.cargueiro,

        motoristaNome: compra.motoristaNome,

        motoristaTelefone: compra.motoristaTelefone,

        kgBruto: compra.kgBruto,

        quantidadeFrutas: compra.quantidadeFrutas,

        mediaFruta: compra.mediaFruta,

        tipoDesconto: compra.tipoDesconto,

        descontoPercentualAplicado: compra.descontoPercentualAplicado,

        descontoKgManual: compra.descontoKgManual,

        descontoKgCalculado: compra.descontoKgCalculado,

        kgDescontado: compra.kgDescontado,

        kgLiquido: compra.kgLiquido,

        precoKg: compra.precoKg,

        totalBruto: compra.totalBruto,

        despesas: compra.despesas,

        icmsOutros: compra.icmsOutros,

        valorTotal: compra.valorTotal,

        transacoes: compra.transacoes.map((transacao) => ({
          id: transacao.id,

          valor: transacao.valor,

          valorPago: transacao.valorPago,

          valorRestante: transacao.valorRestante,

          statusFinanceiro: transacao.statusFinanceiro,

          formaPagamento: transacao.formaPagamento,

          vencimento: transacao.vencimento,

          descricao: transacao.descricao,
        })),

        usuarioResponsavelNome: compra.usuarioResponsavelNome,

        observacoes: compra.observacoes,
      },
    };

    const docDefinition = buildCompraRomaneioTemplate(compraRomaneioData);

    ////////////////////////////////////////////////////////
    // FONTS
    ////////////////////////////////////////////////////////

    const fonts = {
      Roboto: {
        normal: 'Helvetica',

        bold: 'Helvetica-Bold',

        italics: 'Helvetica-Oblique',

        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    ////////////////////////////////////////////////////////
    // PRINTER
    ////////////////////////////////////////////////////////

    const printer = new PdfPrinterClass(fonts);

    ////////////////////////////////////////////////////////
    // PDF DOC
    ////////////////////////////////////////////////////////

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    ////////////////////////////////////////////////////////
    // BUFFER
    ////////////////////////////////////////////////////////

    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
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
}
