import fs from 'node:fs';
import path from 'node:path';

import PdfPrinter from 'pdfmake';

import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';

const PdfPrinterClass = PdfPrinter as unknown as {
  new (fonts: Record<string, unknown>): {
    createPdfKitDocument: (
      docDefinition: TDocumentDefinitions,
    ) => NodeJS.ReadableStream & {
      end(): void;
    };
  };
};

const COLORS = {
  primary: '#166534',
  primarySoft: '#EEF6EF',
  primaryBorder: '#CFE3D2',
  text: '#111827',
  muted: '#6B7280',
  border: '#D1D5DB',
  white: '#FFFFFF',
  danger: '#DC2626',
  header: '#F8FAF8',
  success: '#047857',
};

//////////////////////////////////////////////////////////////
// INTERFACES
//////////////////////////////////////////////////////////////

interface RelatorioProducaoFiltro {
  dataInicio?: string;
  dataInicial?: string;
  dataFinal?: string;
  usuarioId?: string;
  tipo?: 'COMPRAS' | 'VENDAS' | 'AMBOS' | string;
}

interface RelatorioProducaoUsuario {
  usuarioId: string | null;
  usuarioNome: string;
  quantidadeCompras: number;
  quantidadeVendas: number;
  kgComprado: number;
  kgVendido: number;
  valorComprado: number;
  valorVendido: number;
}

interface RelatorioProducaoCompra {
  id: string;
  numeroFolha?: string | null;
  dataCompra: Date | string;
  placa?: string | null;
  clienteNomeSnapshot?: string | null;
  usuarioResponsavelNome?: string | null;
  kgLiquido: number;
  valorTotal: unknown;
  fornecedor?: {
    nome?: string | null;
  } | null;
}

interface RelatorioProducaoVenda {
  id: string;
  numeroPedido?: string | null;
  numeroRomaneio?: string | null;
  dataVenda: Date | string;
  placa?: string | null;
  clienteNomeSnapshot?: string | null;
  usuarioResponsavelNome?: string | null;
  pesoLiquido: number;
  valorTotal: unknown;
  cliente?: {
    nome?: string | null;
  } | null;
}

interface RelatorioProducaoData {
  periodo: {
    dataInicio: Date | string;
    dataFim: Date | string;
  };

  filtros: RelatorioProducaoFiltro;

  totais: {
    compras: number;
    vendas: number;
    valorComprado: number;
    valorVendido: number;
    kgComprado: number;
    kgVendido: number;
  };

  producaoPorUsuario: RelatorioProducaoUsuario[];

  compras: RelatorioProducaoCompra[];

  vendas: RelatorioProducaoVenda[];
}

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

function money(value: unknown): string {
  return toNumber(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberBRInteger(value: unknown): string {
  return Math.trunc(toNumber(value)).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(date?: Date | string | null): string {
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(date));
}

function tipoLabel(tipo?: string): string {
  if (tipo === 'COMPRAS') {
    return 'Compras';
  }

  if (tipo === 'VENDAS') {
    return 'Vendas';
  }

  return 'Compras e Vendas';
}

function shouldShowCompras(tipo?: string): boolean {
  return !tipo || tipo === 'AMBOS' || tipo === 'COMPRAS';
}

function shouldShowVendas(tipo?: string): boolean {
  return !tipo || tipo === 'AMBOS' || tipo === 'VENDAS';
}

//////////////////////////////////////////////////////////////
// COMPONENTES VISUAIS
//////////////////////////////////////////////////////////////

function cardTitle(text: string): Content {
  return {
    text,
    fontSize: 9.5,
    bold: true,
    characterSpacing: 2,
    color: COLORS.primary,
    margin: [0, 0, 0, 8],
  };
}

function tableHeader(text: string): Content {
  return {
    text,
    noWrap: true,
    bold: true,
    color: COLORS.primary,
    fillColor: COLORS.header,
    alignment: 'center',
    fontSize: 7.5,
    margin: [4, 6, 4, 6],
  };
}

function tableCell(
  value: string,
  alignment: 'left' | 'center' | 'right' = 'left',
): Content {
  return {
    text: value,
    alignment,
    fontSize: 8,
    color: COLORS.text,
    margin: [4, 5, 4, 5],
  };
}

function emptyRow(colSpan: number, text: string): TableCell[] {
  const row: TableCell[] = [
    {
      text,
      colSpan,
      alignment: 'center',
      fontSize: 8,
      color: COLORS.muted,
      margin: [4, 8, 4, 8],
    },
  ];

  for (let i = 1; i < colSpan; i++) {
    row.push({
      text: '',
    });
  }

  return row;
}

//////////////////////////////////////////////////////////////
// TEMPLATE
//////////////////////////////////////////////////////////////

function buildProducaoRelatorioTemplate(
  data: RelatorioProducaoData,
): TDocumentDefinitions {
  const tipo = data.filtros.tipo ?? 'AMBOS';

  const mostrarCompras = shouldShowCompras(tipo);

  const mostrarVendas = shouldShowVendas(tipo);

  const totalCompras = mostrarCompras ? data.totais.compras : 0;

  const totalVendas = mostrarVendas ? data.totais.vendas : 0;

  const kgComprado = mostrarCompras ? data.totais.kgComprado : 0;

  const kgVendido = mostrarVendas ? data.totais.kgVendido : 0;

  const valorComprado = mostrarCompras ? data.totais.valorComprado : 0;

  const valorVendido = mostrarVendas ? data.totais.valorVendido : 0;

  ////////////////////////////////////////////////////////////
  // LOGO
  ////////////////////////////////////////////////////////////

  const logoPath = path.resolve(
    process.cwd(),
    'uploads',
    'empresa',
    'logo-hmn.png',
  );

  const logoBase64 = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath).toString('base64')
    : null;

  ////////////////////////////////////////////////////////////
  // DATA EMISSÃO
  ////////////////////////////////////////////////////////////

  const dataEmissao = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  ////////////////////////////////////////////////////////////
  // STYLES
  ////////////////////////////////////////////////////////////

  const styles = {
    footer: {
      fontSize: 8,
      color: COLORS.muted,
    },
  };

  ////////////////////////////////////////////////////////////
  // CONTENT
  ////////////////////////////////////////////////////////////

  const content: Content[] = [
    //////////////////////////////////////////////////////////
    // HEADER
    //////////////////////////////////////////////////////////

    {
      margin: [0, 0, 0, 16],

      table: {
        widths: [140, '*', 180],

        body: [
          [
            {
              border: [false, false, false, false],

              stack: logoBase64
                ? [
                    {
                      image: `data:image/png;base64,${logoBase64}`,
                      width: 120,
                      alignment: 'center',
                      margin: [0, 6, 0, 0],
                    },
                  ]
                : [
                    {
                      text: 'HMN FRUTAS',
                      fontSize: 22,
                      bold: true,
                      color: COLORS.primary,
                      alignment: 'center',
                    },
                  ],
            },

            {
              border: [false, false, false, false],

              margin: [12, 8, 12, 0],

              stack: [
                {
                  text: 'RELATÓRIO DE PRODUÇÃO OPERACIONAL',
                  alignment: 'center',
                  bold: true,
                  fontSize: 17,
                  color: COLORS.primary,
                  margin: [0, 0, 0, 8],
                },

                {
                  text: `Período: ${formatDate(
                    data.periodo.dataInicio,
                  )} até ${formatDate(data.periodo.dataFim)}`,
                  alignment: 'center',
                  fontSize: 10,
                  bold: true,
                  color: COLORS.text,
                  margin: [0, 0, 0, 5],
                },

                {
                  text: `Tipo: ${tipoLabel(tipo)}`,
                  alignment: 'center',
                  fontSize: 9,
                  color: COLORS.text,
                },

                {
                  text: data.filtros.usuarioId
                    ? 'Filtro de usuário aplicado'
                    : 'Todos os usuários',
                  alignment: 'center',
                  fontSize: 8.5,
                  color: COLORS.muted,
                  margin: [0, 4, 0, 0],
                },
              ],
            },

            {
              margin: [10, 10, 0, 0],

              table: {
                widths: ['*'],

                body: [
                  [
                    {
                      text: 'EMISSÃO',
                      fillColor: COLORS.header,
                      color: COLORS.primary,
                      bold: true,
                      alignment: 'center',
                      margin: [0, 8, 0, 8],
                    },
                  ],

                  [
                    {
                      text: dataEmissao,
                      alignment: 'center',
                      margin: [0, 12, 0, 12],
                    },
                  ],
                ],
              },

              layout: {
                hLineColor: () => COLORS.primaryBorder,
                vLineColor: () => COLORS.primaryBorder,
              },
            },
          ],
        ],
      },

      layout: {
        defaultBorder: false,
      },
    },

    //////////////////////////////////////////////////////////
    // RESUMO OPERACIONAL
    //////////////////////////////////////////////////////////

    {
      table: {
        widths: ['25%', '25%', '25%', '25%'],

        body: [
          [
            {
              stack: [
                cardTitle('COMPRAS'),
                {
                  text: String(totalCompras),
                  bold: true,
                  fontSize: 15,
                  color: COLORS.primary,
                },
              ],

              fillColor: COLORS.primarySoft,
              margin: [10, 10, 10, 10],
            },

            {
              stack: [
                cardTitle('VENDAS'),
                {
                  text: String(totalVendas),
                  bold: true,
                  fontSize: 15,
                  color: COLORS.primary,
                },
              ],

              fillColor: COLORS.primarySoft,
              margin: [10, 10, 10, 10],
            },

            {
              stack: [
                cardTitle('KG COMPRADO'),
                {
                  text: numberBRInteger(kgComprado),
                  bold: true,
                  fontSize: 15,
                  color: COLORS.primary,
                },
              ],

              fillColor: COLORS.primarySoft,
              margin: [10, 10, 10, 10],
            },

            {
              stack: [
                cardTitle('KG VENDIDO'),
                {
                  text: numberBRInteger(kgVendido),
                  bold: true,
                  fontSize: 15,
                  color: COLORS.primary,
                },
              ],

              fillColor: COLORS.primarySoft,
              margin: [10, 10, 10, 10],
            },
          ],
        ],
      },

      layout: {
        hLineColor: () => COLORS.primaryBorder,
        vLineColor: () => COLORS.primaryBorder,
      },

      margin: [0, 0, 0, 10],
    },

    {
      table: {
        widths: ['50%', '50%'],

        body: [
          [
            {
              stack: [
                cardTitle('VALOR COMPRADO'),
                {
                  text: money(valorComprado),
                  bold: true,
                  fontSize: 15,
                  color: COLORS.primary,
                },
              ],

              fillColor: COLORS.primarySoft,
              margin: [10, 10, 10, 10],
            },

            {
              stack: [
                cardTitle('VALOR VENDIDO'),
                {
                  text: money(valorVendido),
                  bold: true,
                  fontSize: 15,
                  color: COLORS.success,
                },
              ],

              fillColor: COLORS.primarySoft,
              margin: [10, 10, 10, 10],
            },
          ],
        ],
      },

      layout: {
        hLineColor: () => COLORS.primaryBorder,
        vLineColor: () => COLORS.primaryBorder,
      },

      margin: [0, 0, 0, 16],
    },

    //////////////////////////////////////////////////////////
    // PRODUÇÃO POR USUÁRIO
    //////////////////////////////////////////////////////////

    {
      text: 'PRODUÇÃO POR USUÁRIO',
      fontSize: 14,
      bold: true,
      color: COLORS.primary,
      margin: [0, 8, 0, 10],
    },

    {
      table: {
        headerRows: 1,

        widths: [150, 54, 54, 86, 86, 100, 100],

        body: [
          [
            tableHeader('USUÁRIO'),
            tableHeader('COMPRAS'),
            tableHeader('VENDAS'),
            tableHeader('KG COMP.'),
            tableHeader('KG VEND.'),
            tableHeader('VALOR COMP.'),
            tableHeader('VALOR VEND.'),
          ],

          ...(data.producaoPorUsuario.length > 0
            ? data.producaoPorUsuario.map((item) => [
                tableCell(item.usuarioNome),
                tableCell(String(item.quantidadeCompras), 'center'),
                tableCell(String(item.quantidadeVendas), 'center'),
                tableCell(numberBRInteger(item.kgComprado), 'right'),
                tableCell(numberBRInteger(item.kgVendido), 'right'),
                tableCell(money(item.valorComprado), 'right'),
                tableCell(money(item.valorVendido), 'right'),
              ])
            : [emptyRow(7, 'Nenhuma produção encontrada no período.')]),
        ],
      },

      layout: {
        hLineColor: () => COLORS.primaryBorder,
        vLineColor: () => COLORS.primaryBorder,
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
      },

      margin: [0, 0, 0, 16],
    },
  ];

  //////////////////////////////////////////////////////////
  // COMPRAS
  //////////////////////////////////////////////////////////

  if (mostrarCompras) {
    content.push(
      {
        text: 'COMPRAS DO PERÍODO',
        fontSize: 14,
        bold: true,
        color: COLORS.primary,
        margin: [0, 8, 0, 10],
      },

      {
        table: {
          headerRows: 1,

          widths: [58, 54, 145, 100, 70, 78, 90],

          body: [
            [
              tableHeader('DATA'),
              tableHeader('FOLHA'),
              tableHeader('FORNECEDOR'),
              tableHeader('USUÁRIO'),
              tableHeader('PLACA'),
              tableHeader('KG LÍQ.'),
              tableHeader('VALOR'),
            ],

            ...(data.compras.length > 0
              ? data.compras.map((compra) => [
                  tableCell(formatDate(compra.dataCompra), 'center'),

                  tableCell(compra.numeroFolha ?? '-', 'center'),

                  tableCell(
                    compra.fornecedor?.nome ??
                      compra.clienteNomeSnapshot ??
                      '-',
                  ),

                  tableCell(compra.usuarioResponsavelNome ?? '-'),

                  tableCell(compra.placa ?? '-', 'center'),

                  tableCell(numberBRInteger(compra.kgLiquido), 'right'),

                  tableCell(money(compra.valorTotal), 'right'),
                ])
              : [emptyRow(7, 'Nenhuma compra encontrada no período.')]),
          ],
        },

        layout: {
          hLineColor: () => COLORS.primaryBorder,
          vLineColor: () => COLORS.primaryBorder,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },

        margin: [0, 0, 0, 16],
      },
    );
  }

  //////////////////////////////////////////////////////////
  // VENDAS
  //////////////////////////////////////////////////////////

  if (mostrarVendas) {
    content.push(
      {
        text: 'VENDAS DO PERÍODO',
        fontSize: 14,
        bold: true,
        color: COLORS.primary,
        margin: [0, 8, 0, 10],
      },

      {
        table: {
          headerRows: 1,

          widths: [58, 70, 145, 100, 70, 78, 90],

          body: [
            [
              tableHeader('DATA'),
              tableHeader('DOC.'),
              tableHeader('CLIENTE'),
              tableHeader('USUÁRIO'),
              tableHeader('PLACA'),
              tableHeader('KG LÍQ.'),
              tableHeader('VALOR'),
            ],

            ...(data.vendas.length > 0
              ? data.vendas.map((venda) => [
                  tableCell(formatDate(venda.dataVenda), 'center'),

                  tableCell(
                    venda.numeroRomaneio ?? venda.numeroPedido ?? '-',
                    'center',
                  ),

                  tableCell(
                    venda.cliente?.nome ?? venda.clienteNomeSnapshot ?? '-',
                  ),

                  tableCell(venda.usuarioResponsavelNome ?? '-'),

                  tableCell(venda.placa ?? '-', 'center'),

                  tableCell(numberBRInteger(venda.pesoLiquido), 'right'),

                  tableCell(money(venda.valorTotal), 'right'),
                ])
              : [emptyRow(7, 'Nenhuma venda encontrada no período.')]),
          ],
        },

        layout: {
          hLineColor: () => COLORS.primaryBorder,
          vLineColor: () => COLORS.primaryBorder,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },

        margin: [0, 0, 0, 16],
      },
    );
  }

  //////////////////////////////////////////////////////////
  // FOOTER
  //////////////////////////////////////////////////////////

  content.push({
    margin: [0, 10, 0, 0],

    table: {
      widths: [90, '*', 150],

      body: [
        [
          {
            border: [false, false, false, false],

            stack: [
              {
                text: 'HMN',
                alignment: 'center',
                bold: true,
                color: COLORS.primary,
                fontSize: 18,
              },

              {
                text: 'FRUTAS',
                alignment: 'center',
                bold: true,
                color: COLORS.primary,
                fontSize: 8,
              },
            ],
          },

          {
            border: [false, false, false, false],

            stack: [
              {
                text: 'RELATÓRIO OFICIAL DE PRODUÇÃO',
                alignment: 'center',
                bold: true,
                color: COLORS.primary,
                fontSize: 11,
                margin: [0, 0, 0, 3],
              },

              {
                text: 'HMN Frutas - Sistema de Gestão Comercial',
                alignment: 'center',
                fontSize: 8,
                color: COLORS.text,
              },
            ],
          },

          {
            border: [false, false, false, false],

            stack: [
              {
                text: 'EMITIDO EM',
                alignment: 'right',
                bold: true,
                color: COLORS.primary,
                fontSize: 8,
              },

              {
                text: dataEmissao,
                alignment: 'right',
                color: COLORS.text,
                fontSize: 8,
              },
            ],
          },
        ],
      ],
    },

    layout: {
      hLineColor: () => COLORS.primaryBorder,
      vLineColor: () => COLORS.primaryBorder,
    },
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [20, 18, 20, 22],

    defaultStyle: {
      fontSize: 9,
      color: COLORS.text,
      lineHeight: 1.15,
    },

    styles,

    content,
  };
}

//////////////////////////////////////////////////////////////
// PDF BUFFER
//////////////////////////////////////////////////////////////

export async function gerarRelatorioProducaoPdf(
  data: RelatorioProducaoData,
): Promise<Buffer> {
  const fonts = {
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  };

  const printer = new PdfPrinterClass(fonts);

  const docDefinition = buildProducaoRelatorioTemplate(data);

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
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
