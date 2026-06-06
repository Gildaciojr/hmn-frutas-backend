import fs from 'node:fs';
import path from 'node:path';

import type {
  Content,
  StyleDictionary,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';

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
};

//////////////////////////////////////////////////////////////
// INTERFACES
//////////////////////////////////////////////////////////////

export interface FornecedorRelatorioPagamento {
  id: string;

  valor: number;

  formaPagamento: string;

  pagoEm: Date | string | null;

  createdAt: Date | string;

  observacoes: string | null;
}

export interface FornecedorRelatorioItem {
  compraId: string;

  numeroFolha: string | null;

  statusCompra: string;

  dataCompra: Date | string;

  fazenda: string | null;

  modeloCaminhao: string | null;

  placa: string | null;

  kgBruto: number;

  quantidadeFrutas: number;

  mediaFruta: number;

  descontoKgCalculado: number;

  kgLiquido: number;

  precoKg: number;

  totalBruto: number;

  despesas: number;

  valorTotal: number;

  statusFinanceiro: string;

  valorPago: number;

  valorRestante: number;

  pagamentos: FornecedorRelatorioPagamento[];
}

export interface FornecedorRelatorioData {
  fornecedor: {
    id: string;

    nome: string;

    sobrenome?: string | null;

    telefone?: string | null;

    estado?: string | null;
  };

  resumo: {
    totalComprado: number;

    totalPago: number;

    saldoDevedor: number;

    limiteFinanceiro: number;

    percentualLimite: number;

    quantidadeCompras: number;

    quantidadePagamentos: number;

    alertasAtivos: number;

    limiteFinanceiroDias: number;
  };

  historicoOperacional: FornecedorRelatorioItem[];
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

function numberBR(value: unknown): string {
  return toNumber(value).toLocaleString('pt-BR', {
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
  }).format(new Date(date));
}

//////////////////////////////////////////////////////////////
// COMPONENTES VISUAIS
//////////////////////////////////////////////////////////////

function cardTitle(text: string): Content {
  return {
    text,

    fontSize: 10.5,

    bold: true,

    characterSpacing: 2.2,

    color: COLORS.primary,

    margin: [0, 0, 0, 12],
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

    fontSize: 8.5,

    color: COLORS.text,

    margin: [4, 6, 4, 6],
  };
}

//////////////////////////////////////////////////////////////
// TEMPLATE
//////////////////////////////////////////////////////////////

export function buildFornecedorRelatorioTemplate(
  data: FornecedorRelatorioData,
  usuarioNome: string,
): TDocumentDefinitions {
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

  const styles: StyleDictionary = {
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
            //////////////////////////////////////////////////
            // LOGO
            //////////////////////////////////////////////////

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

            //////////////////////////////////////////////////
            // CENTRO
            //////////////////////////////////////////////////

            {
              border: [false, false, false, false],

              margin: [12, 10, 12, 0],

              stack: [
                {
                  text: 'RELATÓRIO COMPLETO DE FORNECEDOR',

                  alignment: 'center',

                  bold: true,

                  fontSize: 18,

                  color: COLORS.primary,

                  margin: [0, 0, 0, 10],
                },

                {
                  text: `${data.fornecedor.nome} ${
                    data.fornecedor.sobrenome ?? ''
                  }`.trim(),

                  alignment: 'center',

                  fontSize: 14,

                  bold: true,

                  color: COLORS.text,

                  margin: [0, 0, 0, 6],
                },

                {
                  text: `Telefone: ${data.fornecedor.telefone ?? '-'}`,

                  alignment: 'center',

                  fontSize: 9,

                  color: COLORS.text,
                },

                {
                  text: `Estado: ${data.fornecedor.estado ?? '-'}`,

                  alignment: 'center',

                  fontSize: 9,

                  color: COLORS.text,
                },
              ],
            },

            //////////////////////////////////////////////////
            // DATA
            //////////////////////////////////////////////////

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

    ////////////////////////////////////////////////////////////
    // RESUMO FINANCEIRO
    ////////////////////////////////////////////////////////////

    {
      table: {
        widths: ['33.3%', '33.3%', '33.3%'],

        body: [
          [
            {
              stack: [
                cardTitle('TOTAL COMPRADO'),

                {
                  text: money(data.resumo.totalComprado),

                  bold: true,

                  fontSize: 16,

                  color: COLORS.primary,
                },
              ],

              fillColor: COLORS.primarySoft,

              margin: [12, 12, 12, 12],
            },

            {
              stack: [
                cardTitle('TOTAL PAGO'),

                {
                  text: money(data.resumo.totalPago),

                  bold: true,

                  fontSize: 16,

                  color: COLORS.primary,
                },
              ],

              fillColor: COLORS.primarySoft,

              margin: [12, 12, 12, 12],
            },

            {
              stack: [
                cardTitle('SALDO'),

                {
                  text: money(data.resumo.saldoDevedor),

                  bold: true,

                  fontSize: 16,

                  color: COLORS.danger,
                },
              ],

              fillColor: COLORS.primarySoft,

              margin: [12, 12, 12, 12],
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
    // HISTÓRICO OPERACIONAL
    //////////////////////////////////////////////////////////

    {
      text: 'EXTRATO OPERACIONAL',

      fontSize: 14,

      bold: true,

      color: COLORS.primary,

      margin: [0, 8, 0, 10],
    },

    {
      table: {
        headerRows: 1,

        widths: [
          54, // Data
          44, // Folha
          52, // Modelo
          52, // Placa
          52, // Kg Bruto
          42, // Qtd
          38, // Média
          42, // Desc
          56, // Kg Líq
          48, // Preço
          62, // Total
          62, // Pago
          62, // Restante
        ],

        body: [
          [
            tableHeader('DATA'),
            tableHeader('FOLHA'),
            tableHeader('MODELO'),
            tableHeader('PLACA'),
            tableHeader('KG BRUTO'),
            tableHeader('QTD'),
            tableHeader('MÉDIA'),
            tableHeader('DESC'),
            tableHeader('KG LÍQ'),
            tableHeader('PREÇO'),
            tableHeader('TOTAL'),
            tableHeader('PAGO'),
            tableHeader('RESTANTE'),
          ],

          ...data.historicoOperacional.map((item) => [
            tableCell(formatDate(item.dataCompra), 'center'),

            tableCell(item.numeroFolha ?? '-', 'center'),

            tableCell(item.modeloCaminhao ?? '-', 'center'),

            tableCell(item.placa ?? '-', 'center'),

            tableCell(numberBRInteger(item.kgBruto), 'right'),

            tableCell(numberBRInteger(item.quantidadeFrutas), 'right'),

            tableCell(numberBR(item.mediaFruta), 'right'),

            tableCell(numberBRInteger(item.descontoKgCalculado), 'right'),

            tableCell(numberBRInteger(item.kgLiquido), 'right'),

            tableCell(money(item.precoKg), 'right'),

            tableCell(money(item.valorTotal), 'right'),

            tableCell(money(item.valorPago), 'right'),

            tableCell(money(item.valorRestante), 'right'),
          ]),
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

    //////////////////////////////////////////////////////////
    // PAGAMENTOS CONSOLIDADOS
    //////////////////////////////////////////////////////////

    {
      text: 'PAGAMENTOS CONSOLIDADOS',

      fontSize: 14,

      bold: true,

      color: COLORS.primary,

      margin: [0, 8, 0, 10],
    },

    {
      table: {
        headerRows: 1,

        widths: [70, 80, 90, '*'],

        body: [
          [
            tableHeader('DATA'),

            tableHeader('FORMA'),

            tableHeader('VALOR'),

            tableHeader('OBSERVAÇÃO'),
          ],

          ...data.historicoOperacional.flatMap((item) =>
            item.pagamentos.map((pagamento) => [
              tableCell(
                formatDate(pagamento.pagoEm ?? pagamento.createdAt),
                'center',
              ),

              tableCell(pagamento.formaPagamento ?? '-', 'center'),

              tableCell(money(pagamento.valor), 'right'),

              tableCell(pagamento.observacoes ?? '-'),
            ]),
          ),
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

    //////////////////////////////////////////////////////////
    // FOOTER
    //////////////////////////////////////////////////////////

    {
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
                  text: 'RELATÓRIO OFICIAL DE FORNECEDOR',

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
                {
                  text: 'USUÁRIO',

                  alignment: 'right',

                  bold: true,

                  color: COLORS.primary,

                  fontSize: 8,

                  margin: [0, 8, 0, 0],
                },

                {
                  text: usuarioNome,

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
    },
  ];

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
