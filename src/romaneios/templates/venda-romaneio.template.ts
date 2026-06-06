import fs from 'node:fs';

import path from 'node:path';

import type {
  Content,
  StyleDictionary,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';

//////////////////////////////////////////////////////////////
// CORES
//////////////////////////////////////////////////////////////

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
// INTERFACE
//////////////////////////////////////////////////////////////

export interface VendaRomaneioData {
  empresa: {
    nome: string;

    telefone: string;

    endereco: string;

    email: string;

    responsaveis: string;
  };

  venda: {
    ////////////////////////////////////////////////////////
    // IDENTIFICAÇÃO
    ////////////////////////////////////////////////////////

    numeroRomaneio?: string | null;

    numeroPedido?: string | null;

    createdAt: Date;

    dataVenda?: Date | null;

    ////////////////////////////////////////////////////////
    // CLIENTE
    ////////////////////////////////////////////////////////

    cliente: {
      nome: string;
    };

    telefone?: string | null;

    cidade?: string | null;

    localEntrega?: string | null;

    ////////////////////////////////////////////////////////
    // PRODUTO
    ////////////////////////////////////////////////////////

    produto?: string | null;

    qualidade?: string | null;

    ////////////////////////////////////////////////////////
    // LOGÍSTICA
    ////////////////////////////////////////////////////////

    destino?: string | null;

    placa?: string | null;

    modeloCaminhao?: string | null;

    ////////////////////////////////////////////////////////
    // MOTORISTA
    ////////////////////////////////////////////////////////

    motoristaNome?: string | null;

    motoristaTelefone?: string | null;

    motoristaCpf?: string | null;

    ////////////////////////////////////////////////////////
    // PESAGEM
    ////////////////////////////////////////////////////////

    pesoBruto?: number | null;

    pesoDesconto?: number | null;

    pesoLiquido?: number | null;

    quantidadeFrutas?: number | null;

    mediaFruta?: number | null;

    ////////////////////////////////////////////////////////
    // ESTOQUE
    ////////////////////////////////////////////////////////

    quantidadeKg: number;

    ////////////////////////////////////////////////////////
    // FINANCEIRO
    ////////////////////////////////////////////////////////

    precoMelancia?: unknown;

    valorPorKg: unknown;

    valorMelancia?: unknown;

    freteTotal?: unknown;

    valorTotal: unknown;

    ////////////////////////////////////////////////////////
    // OBSERVAÇÕES
    ////////////////////////////////////////////////////////

    observacoes?: string | null;
  };
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
    minimumFractionDigits: 0,

    maximumFractionDigits: 2,
  });
}

function formatOnlyDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(new Date(date));
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
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

    color: '#166534',

    margin: [0, 0, 0, 16],
  };
}

function infoRow(label: string, value?: string | null): Content {
  return {
    columns: [
      {
        width: 68,

        text: `${label}:`,

        fontSize: 8.5,

        color: '#6B7280',

        bold: true,
      },

      {
        width: '*',

        text: value?.trim() || '-',

        fontSize: 10.5,

        color: '#0F172A',

        noWrap: false,
      },
    ],

    columnGap: 8,

    margin: [0, 0, 0, 6],
  };
}

function tableHeader(text: string): Content {
  return {
    text,

    noWrap: true,

    bold: true,

    color: COLORS.primary,

    fillColor: COLORS.header,

    fontSize: 10,

    margin: [8, 8, 8, 8],

    alignment: 'center',
  };
}

function tableCell(
  value: string,
  alignment: 'left' | 'center' | 'right' = 'left',
): Content {
  return {
    text: value,

    alignment,

    margin: [6, 7, 6, 7],

    color: COLORS.text,

    fontSize: 9.5,
  };
}

export function buildVendaRomaneioTemplate(
  data: VendaRomaneioData,
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
  // DATAS
  ////////////////////////////////////////////////////////////

  const dataVenda = data.venda.dataVenda
    ? formatOnlyDate(new Date(data.venda.dataVenda))
    : formatOnlyDate(new Date(data.venda.createdAt));

  const dataEmissao = formatDateTime(new Date(data.venda.createdAt));

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
        widths: [120, '*', 170],

        body: [
          [
            //////////////////////////////////////////////////
            // LOGO
            //////////////////////////////////////////////////

            {
              border: [false, false, false, false],

              borderColor: [
                COLORS.border,
                COLORS.border,
                COLORS.border,
                COLORS.border,
              ],

              margin: [0, 0, 10, 0],

              stack: logoBase64
                ? [
                    {
                      image: `data:image/png;base64,${logoBase64}`,

                      width: 128,

                      alignment: 'center',

                      margin: [0, 8, 0, 0],
                    },
                  ]
                : [
                    {
                      text: 'HMN FRUTAS',

                      fontSize: 22,

                      bold: true,

                      color: COLORS.primary,

                      alignment: 'center',

                      margin: [0, 20, 0, 0],
                    },
                  ],
            },

            //////////////////////////////////////////////////
            // EMPRESA
            //////////////////////////////////////////////////

            {
              border: [false, false, false, false],

              borderColor: [
                COLORS.border,
                COLORS.border,
                COLORS.border,
                COLORS.border,
              ],

              margin: [14, 8, 14, 0],

              stack: [
                {
                  text: data.empresa.nome,

                  fontSize: 22,

                  alignment: 'center',

                  bold: true,

                  color: COLORS.primary,

                  margin: [0, 2, 0, 4],
                },

                {
                  text: 'Produção, compra e venda de melancias',

                  fontSize: 9.5,

                  color: COLORS.text,

                  alignment: 'center',

                  margin: [0, 0, 0, 10],
                },

                {
                  text: `E-mail: ${data.empresa.email}`,

                  fontSize: 9.2,

                  color: COLORS.text,

                  alignment: 'center',

                  margin: [0, 0, 0, 8],
                },

                {
                  stack: [
                    {
                      text: '| Hugo: (11) 96900-5002',

                      fontSize: 9.2,

                      bold: true,

                      color: COLORS.primary,

                      alignment: 'center',

                      margin: [0, 0, 0, 2],
                    },

                    {
                      text: '| Miron: (62) 99909-8205',

                      fontSize: 9.2,

                      bold: true,

                      color: COLORS.primary,

                      alignment: 'center',

                      margin: [0, 0, 0, 2],
                    },

                    {
                      text: '| Netinho: (62) 99962-5436',

                      fontSize: 9.2,

                      bold: true,

                      color: COLORS.primary,

                      alignment: 'center',

                      margin: [0, 0, 0, 8],
                    },
                  ],
                },

                {
                  text: 'Rua Henrique Tito, 459 - St. Centro\nCEP 76335-000 - Uruana/GO',

                  fontSize: 8.8,

                  color: COLORS.text,

                  alignment: 'center',

                  lineHeight: 1.3,
                },
              ],
            },

            //////////////////////////////////////////////////
            // ROMANEIO
            //////////////////////////////////////////////////

            {
              margin: [12, 0, 0, 0],

              table: {
                widths: ['*'],

                body: [
                  [
                    {
                      text: 'ROMANEIO DE VENDAS',

                      fillColor: '#F5F8F5',

                      color: COLORS.primary,

                      alignment: 'center',

                      bold: true,

                      fontSize: 12,

                      margin: [0, 12, 0, 12],

                      border: [false, false, false, false],
                    },
                  ],

                  [
                    {
                      border: [false, false, false, false],

                      margin: [14, 14, 14, 14],

                      stack: [
                        {
                          text:
                            data.venda.numeroPedido ??
                            data.venda.numeroRomaneio ??
                            '-',

                          color: COLORS.danger,

                          bold: true,

                          fontSize: 24,

                          alignment: 'center',

                          margin: [0, 0, 0, 14],
                        },

                        {
                          columns: [
                            {
                              width: '*',

                              stack: [
                                {
                                  text: 'DATA',

                                  bold: true,

                                  fontSize: 8,

                                  color: COLORS.muted,

                                  alignment: 'center',

                                  margin: [0, 0, 0, 3],
                                },

                                {
                                  text: dataVenda,

                                  fontSize: 9.5,

                                  color: COLORS.text,

                                  alignment: 'center',
                                },
                              ],
                            },

                            {
                              width: '*',

                              stack: [
                                {
                                  text: 'EMISSÃO',

                                  bold: true,

                                  fontSize: 8.5,

                                  color: COLORS.muted,

                                  alignment: 'center',

                                  margin: [0, 0, 0, 3],
                                },

                                {
                                  text: dataEmissao,

                                  fontSize: 9.5,

                                  color: COLORS.text,

                                  alignment: 'center',
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                ],
              },

              layout: {
                hLineColor: () => COLORS.primaryBorder,

                vLineColor: () => COLORS.primaryBorder,

                hLineWidth: () => 1,

                vLineWidth: () => 1,
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
    // SPACE
    //////////////////////////////////////////////////////////

    {
      text: '',

      margin: [0, 8, 0, 0],
    },

    //////////////////////////////////////////////////////////
    // GRID INFO
    //////////////////////////////////////////////////////////

    {
      table: {
        widths: ['33%', '33%', '34%'],

        body: [
          [
            //////////////////////////////////////////////////
            // CLIENTE
            //////////////////////////////////////////////////

            {
              fillColor: '#F8FCF9',

              border: [true, true, true, true],

              borderColor: ['#E4ECE7', '#E4ECE7', '#E4ECE7', '#E4ECE7'],

              stack: [
                cardTitle('CLIENTE'),

                infoRow('Nome', data.venda.cliente.nome),

                infoRow('Telefone', data.venda.telefone ?? '-'),

                infoRow('Cidade', data.venda.cidade ?? '-'),
              ],

              margin: [18, 18, 18, 18],
            },

            //////////////////////////////////////////////////
            // ENTREGA
            //////////////////////////////////////////////////

            {
              fillColor: '#FCFFFD',

              border: [true, true, true, true],

              borderColor: ['#E7EFE9', '#E7EFE9', '#E7EFE9', '#E7EFE9'],

              stack: [
                cardTitle('ENTREGA'),

                infoRow(
                  'Local',
                  data.venda.localEntrega ?? data.venda.destino ?? '-',
                ),

                infoRow('Produto', data.venda.produto ?? 'MELANCIA'),

                infoRow('Qualidade', data.venda.qualidade ?? '-'),
              ],

              margin: [16, 16, 16, 16],
            },

            //////////////////////////////////////////////////
            // TRANSPORTE
            //////////////////////////////////////////////////

            {
              fillColor: '#FCFFFD',

              border: [true, true, true, true],

              borderColor: ['#E7EFE9', '#E7EFE9', '#E7EFE9', '#E7EFE9'],

              stack: [
                cardTitle('TRANSPORTE'),

                infoRow('Placa', data.venda.placa ?? '-'),

                infoRow('Veículo', data.venda.modeloCaminhao ?? '-'),

                infoRow('Motorista', data.venda.motoristaNome ?? '-'),

                infoRow('Telefone', data.venda.motoristaTelefone ?? '-'),
              ],

              margin: [16, 16, 16, 16],
            },
          ],
        ],
      },

      layout: {
        hLineWidth: () => 0,

        vLineWidth: () => 0,

        paddingLeft: () => 8,

        paddingRight: () => 8,

        paddingTop: () => 4,

        paddingBottom: () => 4,
      },

      margin: [0, 10, 0, 0],
    },

    //////////////////////////////////////////////////////////
    // SPACE
    //////////////////////////////////////////////////////////

    {
      text: '',

      margin: [0, 10, 0, 0],
    },

    //////////////////////////////////////////////////////////
    // TABLES
    //////////////////////////////////////////////////////////

    {
      columns: [
        //////////////////////////////////////////////////////
        // PESAGEM
        //////////////////////////////////////////////////////

        {
          width: '44%',

          table: {
            widths: ['*', 68, 38],

            body: [
              [
                {
                  text: 'PESAGEM OPERACIONAL',

                  colSpan: 3,

                  fillColor: '#F3F7F3',

                  bold: true,

                  color: COLORS.primary,

                  fontSize: 11,

                  alignment: 'center',

                  margin: [4, 6, 4, 6],
                },
                {},
                {},
              ],

              [
                tableHeader('DESCRIÇÃO'),

                tableHeader('VALOR'),

                tableHeader('UN.'),
              ],

              [
                tableCell('Peso Bruto'),

                tableCell(numberBR(data.venda.pesoBruto), 'center'),

                tableCell('kg', 'center'),
              ],

              [
                tableCell('Peso Desconto'),

                tableCell(numberBR(data.venda.pesoDesconto), 'center'),

                tableCell('kg', 'center'),
              ],

              [
                tableCell('Peso Líquido'),

                tableCell(numberBR(data.venda.pesoLiquido), 'center'),

                tableCell('kg', 'center'),
              ],

              [
                tableCell('Quantidade de Frutas'),

                tableCell(numberBR(data.venda.quantidadeFrutas), 'center'),

                tableCell('un', 'center'),
              ],

              [
                tableCell('Média da Fruta'),

                tableCell(numberBR(data.venda.mediaFruta), 'center'),

                tableCell('kg', 'center'),
              ],

              [
                {
                  text: 'PESO OPERACIONAL',

                  bold: true,

                  color: COLORS.primary,

                  fillColor: COLORS.primarySoft,

                  fontSize: 9,

                  margin: [4, 6, 4, 6],
                },

                {
                  text: numberBR(data.venda.quantidadeKg),

                  bold: true,

                  fontSize: 12.5,

                  alignment: 'center',

                  color: COLORS.primary,

                  fillColor: COLORS.primarySoft,

                  margin: [4, 6, 4, 6],
                },

                {
                  text: 'kg',

                  bold: true,

                  fontSize: 9,

                  alignment: 'center',

                  color: COLORS.primary,

                  fillColor: COLORS.primarySoft,

                  margin: [8, 10, 8, 10],
                },
              ],
            ],
          },

          layout: {
            hLineColor: () => COLORS.primaryBorder,

            vLineColor: () => COLORS.primaryBorder,

            hLineWidth: () => 0.7,

            vLineWidth: () => 0.7,
          },
        },

        //////////////////////////////////////////////////////
        // FINANCEIRO
        //////////////////////////////////////////////////////

        {
          width: '52%',

          margin: [10, 0, 0, 0],

          table: {
            widths: [140, 90, '*'],

            body: [
              [
                {
                  text: 'FINANCEIRO',

                  colSpan: 3,

                  fillColor: '#F3F7F3',

                  bold: true,

                  color: COLORS.primary,

                  fontSize: 12,

                  alignment: 'center',

                  margin: [8, 8, 8, 8],
                },
                {},
                {},
              ],

              [
                tableHeader('DESCRIÇÃO'),

                tableHeader('UNIT.'),

                tableHeader('TOTAL'),
              ],

              [
                tableCell('Preço da Melancia'),

                tableCell(
                  money(data.venda.precoMelancia ?? data.venda.valorPorKg),
                  'center',
                ),

                tableCell(
                  money(
                    data.venda.valorMelancia ??
                      Number(data.venda.valorPorKg) *
                        Number(data.venda.quantidadeKg),
                  ),
                  'center',
                ),
              ],

              [
                tableCell('Valor do Frete'),

                tableCell(money(data.venda.freteTotal), 'center'),

                tableCell(money(data.venda.freteTotal), 'center'),
              ],

              //////////////////////////////////////////////////
              // LINHAS TÉCNICAS DE ALINHAMENTO
              //////////////////////////////////////////////////

              [tableCell(''), tableCell('', 'center'), tableCell('', 'center')],

              //////////////////////////////////////////////////
              // TOTAL FINAL
              //////////////////////////////////////////////////

              [
                {
                  text: 'TOTAL FINAL',

                  bold: true,

                  color: COLORS.primary,

                  fillColor: COLORS.primary,

                  fontSize: 10,

                  alignment: 'center',

                  margin: [6, 10, 6, 10],
                },

                {
                  text: '',

                  fillColor: COLORS.primary,
                },

                {
                  text: money(data.venda.valorTotal),

                  bold: true,

                  fontSize: 14,

                  alignment: 'center',

                  noWrap: true,

                  color: COLORS.white,

                  fillColor: COLORS.primary,

                  margin: [4, 12, 4, 12],
                },
              ],
            ],
          },

          layout: {
            hLineColor: () => COLORS.primaryBorder,

            vLineColor: () => COLORS.primaryBorder,

            hLineWidth: () => 0.7,

            vLineWidth: () => 0.7,
          },
        },
      ],
    },

    //////////////////////////////////////////////////////////
    // SPACE
    //////////////////////////////////////////////////////////

    {
      text: '',

      margin: [0, 10, 0, 0],
    },

    //////////////////////////////////////////////////////////
    // OBS + ASSINATURA
    //////////////////////////////////////////////////////////

    {
      table: {
        widths: ['60%', '40%'],

        body: [
          [
            //////////////////////////////////////////////////
            // OBSERVAÇÕES
            //////////////////////////////////////////////////

            {
              fillColor: COLORS.white,

              border: [true, true, true, true],

              borderColor: [
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
              ],

              stack: [
                {
                  text: 'OBSERVAÇÕES OPERACIONAIS',

                  bold: true,

                  color: COLORS.primary,

                  fontSize: 10,

                  margin: [0, 0, 0, 8],
                },

                {
                  text:
                    data.venda.observacoes?.trim() ||
                    'Mercadoria conferida no ato do carregamento.',

                  fontSize: 9,

                  color: COLORS.text,

                  lineHeight: 1.3,
                },
              ],

              margin: [10, 10, 10, 10],
            },

            //////////////////////////////////////////////////
            // ASSINATURA
            //////////////////////////////////////////////////

            {
              fillColor: COLORS.white,

              border: [true, true, true, true],

              borderColor: [
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
              ],

              stack: [
                {
                  text: 'RESPONSÁVEL',

                  bold: true,

                  color: COLORS.primary,

                  fontSize: 10,

                  alignment: 'center',

                  margin: [0, 0, 0, 34],
                },

                {
                  canvas: [
                    {
                      type: 'line',

                      x1: 0,

                      y1: 0,

                      x2: 160,

                      y2: 0,

                      lineWidth: 0.8,

                      lineColor: COLORS.border,
                    },
                  ],

                  alignment: 'center',
                },

                {
                  text: 'Assinatura / Carimbo',

                  alignment: 'center',

                  fontSize: 8.5,

                  color: COLORS.muted,

                  margin: [0, 6, 0, 0],
                },

                {
                  text: `Emitido em ${dataEmissao}`,

                  alignment: 'center',

                  fontSize: 7.5,

                  color: COLORS.muted,

                  margin: [0, 10, 0, 0],
                },
              ],

              margin: [10, 10, 10, 10],
            },
          ],
        ],
      },

      layout: {
        hLineColor: () => COLORS.primaryBorder,

        vLineColor: () => COLORS.primaryBorder,

        hLineWidth: () => 0.6,

        vLineWidth: () => 0.6,
      },
    },
    //////////////////////////////////////////////////////////
    // FOOTER
    //////////////////////////////////////////////////////////

    {
      margin: [0, 4, 0, 0],

      table: {
        widths: [72, '*', 130],

        body: [
          [
            //////////////////////////////////////////////////
            // BRAND
            //////////////////////////////////////////////////

            {
              border: [false, false, false, false],

              borderColor: [
                COLORS.border,
                COLORS.border,
                COLORS.border,
                COLORS.border,
              ],

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

                  fontSize: 8.5,

                  margin: [0, 1, 0, 0],
                },
              ],

              margin: [0, 4, 0, 4],
            },

            //////////////////////////////////////////////////
            // TEXTO CENTRAL
            //////////////////////////////////////////////////

            {
              border: [false, false, false, false],

              borderColor: [
                COLORS.border,
                COLORS.border,
                COLORS.border,
                COLORS.border,
              ],

              margin: [10, 4, 10, 4],

              stack: [
                {
                  text: 'HMN FRUTAS AGRADECE SUA PREFERÊNCIA',

                  bold: true,

                  color: COLORS.primary,

                  fontSize: 10.5,

                  alignment: 'center',

                  margin: [0, 0, 0, 3],
                },

                {
                  text: 'hmnfrutas@gmail.com',

                  fontSize: 7.8,

                  color: COLORS.text,

                  alignment: 'center',
                },
              ],
            },

            //////////////////////////////////////////////////
            // IDENTIFICAÇÃO
            //////////////////////////////////////////////////

            {
              margin: [0, 4, 0, 0],

              stack: [
                {
                  text: 'ROMANEIO OFICIAL',

                  alignment: 'right',

                  bold: true,

                  color: COLORS.primary,

                  fontSize: 8.5,

                  margin: [0, 0, 0, 3],
                },

                {
                  text: data.empresa.nome,

                  alignment: 'right',

                  bold: true,

                  color: COLORS.danger,

                  fontSize: 11,

                  margin: [0, 0, 0, 4],
                },

                {
                  text: dataEmissao,

                  alignment: 'right',

                  fontSize: 7,

                  color: COLORS.muted,
                },
              ],
            },
          ],
        ],
      },

      layout: {
        hLineColor: () => COLORS.primaryBorder,

        vLineColor: () => COLORS.primaryBorder,

        hLineWidth: () => 0.5,

        vLineWidth: () => 0.5,
      },
    },
  ];
  return {
    pageSize: 'A4',

    pageMargins: [18, 14, 18, 14],

    defaultStyle: {
      fontSize: 10,

      color: COLORS.text,

      lineHeight: 1.2,
    },

    styles,

    content,
  };
}
