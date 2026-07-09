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
// INTERFACES
//////////////////////////////////////////////////////////////

export interface CompraRomaneioEmpresa {
  nome: string;

  telefone: string;

  endereco: string;

  email: string;

  responsaveis?: string;
}

export interface CompraRomaneioPessoa {
  id?: string;

  nome: string;

  telefone?: string | null;

  documento?: string | null;

  endereco?: string | null;

  cidade?: string | null;

  estado?: string | null;
}

export interface CompraRomaneioFazenda {
  id?: string;

  nome: string;

  cidade?: string | null;

  estado?: string | null;

  observacoes?: string | null;
}

export interface CompraRomaneioTransacao {
  id: string;

  valor: unknown;

  valorPago?: unknown;

  valorRestante?: unknown;

  statusFinanceiro?: string | null;

  formaPagamento?: string | null;

  vencimento?: Date | string | null;

  descricao?: string | null;
}

export interface CompraRomaneioCompra {
  ////////////////////////////////////////////////////////////
  // IDENTIFICAÇÃO
  ////////////////////////////////////////////////////////////

  id: string;

  numeroFolha?: string | null;

  createdAt: Date | string;

  dataCompra: Date | string;

  safra?: string | null;

  controleInterno?: boolean | null;

  ////////////////////////////////////////////////////////////
  // PESSOAS
  ////////////////////////////////////////////////////////////

  fornecedor?: CompraRomaneioPessoa | null;

  fazendaFornecedor?: CompraRomaneioFazenda | null;

  cliente?: CompraRomaneioPessoa | null;

  ////////////////////////////////////////////////////////////
  // PRODUTO
  ////////////////////////////////////////////////////////////

  produto?: string | null;

  categoria?: string | null;

  qualidadeFruta?: string | null;

  ////////////////////////////////////////////////////////////
  // TRANSPORTE
  ////////////////////////////////////////////////////////////

  modeloCaminhao?: string | null;

  placa?: string | null;

  cargueiro?: string | null;

  motoristaNome?: string | null;

  motoristaTelefone?: string | null;

  ////////////////////////////////////////////////////////////
  // PESAGEM
  ////////////////////////////////////////////////////////////

  kgBruto?: number | null;

  quantidadeFrutas?: number | null;

  mediaFruta?: number | null;

  tipoDesconto?: string | null;

  descontoPercentualAplicado?: number | null;

  descontoKgManual?: number | null;

  descontoKgCalculado?: number | null;

  kgDescontado?: number | null;

  kgLiquido?: number | null;

  ////////////////////////////////////////////////////////////
  // VALORES
  ////////////////////////////////////////////////////////////

  precoKg?: unknown;

  totalBruto?: unknown;

  despesas?: unknown;

  icmsOutros?: unknown;

  valorTotal?: unknown;

  ////////////////////////////////////////////////////////////
  // FINANCEIRO
  ////////////////////////////////////////////////////////////

  transacoes?: CompraRomaneioTransacao[];

  ////////////////////////////////////////////////////////////
  // AUDITORIA / OBSERVAÇÕES
  ////////////////////////////////////////////////////////////

  usuarioResponsavelNome?: string | null;

  observacoes?: string | null;
}

export interface CompraRomaneioData {
  empresa: CompraRomaneioEmpresa;

  compra: CompraRomaneioCompra;
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

function numberBRInteger(value: unknown): string {
  return Math.trunc(toNumber(value)).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,

    maximumFractionDigits: 0,
  });
}

function formatOnlyDate(date?: Date | string | null): string {
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(new Date(date));
}

function formatDateTime(date?: Date | string | null): string {
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',

    timeStyle: 'short',

    timeZone: 'America/Sao_Paulo',
  }).format(new Date(date));
}

function emptyValue(value?: string | null): string {
  return value?.trim() || '-';
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function numberValue(value: unknown, unit?: string): string {
  if (!hasValue(value)) {
    return '-';
  }

  const formattedValue = numberBR(value);

  return unit ? `${formattedValue} ${unit}` : formattedValue;
}

function integerValue(value: unknown, unit?: string): string {
  if (!hasValue(value)) {
    return '-';
  }

  const formattedValue = numberBRInteger(value);

  return unit ? `${formattedValue} ${unit}` : formattedValue;
}

function moneyValue(value: unknown): string {
  if (!hasValue(value)) {
    return '-';
  }

  return money(value);
}

function loadLogoBase64(): string | null {
  const logoPath = path.resolve(
    process.cwd(),
    'uploads',
    'empresa',
    'logo-hmn.png',
  );

  return fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath).toString('base64')
    : null;
}

function cardTitle(text: string): Content {
  return {
    text,

    fontSize: 10,

    bold: true,

    characterSpacing: 2.2,

    color: COLORS.primary,

    margin: [0, 0, 0, 10],
  };
}

function tableHeader(text: string): Content {
  return {
    text,

    noWrap: true,

    bold: true,

    color: COLORS.primary,

    fillColor: COLORS.header,

    fontSize: 9,

    margin: [6, 6, 6, 6],

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

    margin: [6, 6, 6, 6],

    color: COLORS.text,

    fontSize: 9,
  };
}

function infoRow(label: string, value?: string | null): Content {
  return {
    columns: [
      {
        width: 82,

        text: `${label}:`,

        fontSize: 8.5,

        color: COLORS.muted,

        bold: true,
      },

      {
        width: '*',

        text: emptyValue(value),

        fontSize: 9.5,

        color: COLORS.text,

        lineHeight: 1.15,

        noWrap: false,
      },
    ],

    columnGap: 8,

    margin: [0, 0, 0, 6],
  };
}

//////////////////////////////////////////////////////////////
// TEMPLATE
//////////////////////////////////////////////////////////////

export function buildCompraRomaneioTemplate(
  data: CompraRomaneioData,
): TDocumentDefinitions {
  const logoBase64 = loadLogoBase64();

  const dataCompra = formatOnlyDate(data.compra.dataCompra);

  const dataEmissao = formatDateTime(new Date());

  const styles: StyleDictionary = {
    footer: {
      fontSize: 8,

      color: COLORS.muted,
    },
  };

  const fornecedor = data.compra.fornecedor;

  const controleInterno = data.compra.controleInterno ? 'Sim' : 'Não';

  const observacoes =
    data.compra.observacoes?.trim() || 'Sem observações registradas.';

  const usuarioResponsavel = emptyValue(data.compra.usuarioResponsavelNome);

  const content: Content[] = [
    //////////////////////////////////////////////////////////
    // HEADER
    //////////////////////////////////////////////////////////

    {
      margin: [0, 0, 0, 16],

      table: {
        widths: [130, '*', 165],

        body: [
          [
            //////////////////////////////////////////////////
            // LOGO
            //////////////////////////////////////////////////

            {
              border: [false, false, false, false],

              margin: [0, 6, 12, 0],

              stack: logoBase64
                ? [
                    {
                      image: `data:image/png;base64,${logoBase64}`,

                      width: 120,

                      alignment: 'center',
                    },
                  ]
                : [
                    {
                      text: 'HMN FRUTAS',

                      fontSize: 22,

                      bold: true,

                      color: COLORS.primary,

                      alignment: 'center',

                      margin: [0, 16, 0, 0],
                    },
                  ],
            },

            //////////////////////////////////////////////////
            // TITULO
            //////////////////////////////////////////////////

            {
              border: [false, false, false, false],

              margin: [12, 8, 12, 0],

              stack: [
                {
                  text: 'RELATÓRIO DE COMPRA',

                  alignment: 'center',

                  bold: true,

                  fontSize: 18,

                  color: COLORS.primary,

                  margin: [0, 0, 0, 10],
                },

                {
                  text: data.empresa.nome,

                  alignment: 'center',

                  bold: true,

                  fontSize: 12,

                  color: COLORS.text,

                  lineHeight: 1.15,

                  noWrap: false,

                  margin: [0, 0, 0, 4],
                },

                {
                  text: 'Documento operacional de compra',

                  alignment: 'center',

                  fontSize: 9,

                  color: COLORS.muted,
                },
              ],
            },

            //////////////////////////////////////////////////
            // EMISSAO
            //////////////////////////////////////////////////

            {
              margin: [8, 4, 0, 0],

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

                      fontSize: 9,

                      margin: [0, 8, 0, 8],
                    },
                  ],

                  [
                    {
                      text: dataEmissao,

                      alignment: 'center',

                      color: COLORS.text,

                      fontSize: 9.5,

                      margin: [0, 12, 0, 12],
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
          ],
        ],
      },

      layout: {
        defaultBorder: false,
      },
    },

    //////////////////////////////////////////////////////////
    // EMPRESA / COMPRA
    //////////////////////////////////////////////////////////

    {
      table: {
        widths: ['50%', '50%'],

        body: [
          [
            {
              fillColor: COLORS.primarySoft,

              border: [true, true, true, true],

              borderColor: [
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
              ],

              stack: [
                cardTitle('DADOS DA EMPRESA'),

                infoRow('Nome', data.empresa.nome),

                infoRow('Telefone', data.empresa.telefone),

                infoRow('Email', data.empresa.email),

                infoRow('Endereço', data.empresa.endereco),
              ],

              margin: [14, 14, 14, 12],
            },

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
                cardTitle('DADOS DA COMPRA'),

                infoRow('Nº Folha', data.compra.numeroFolha),

                infoRow('Data', dataCompra),

                infoRow('Safra', data.compra.safra),

                infoRow('Controle Interno', controleInterno),

                infoRow('Qualidade', data.compra.qualidadeFruta),
              ],

              margin: [14, 14, 14, 12],
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

      margin: [0, 0, 0, 14],
    },

    //////////////////////////////////////////////////////////
    // FORNECEDOR
    //////////////////////////////////////////////////////////

    {
      table: {
        widths: ['*'],

        body: [
          [
            {
              fillColor: COLORS.header,

              border: [true, true, true, true],

              borderColor: [
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
              ],

              stack: [
                cardTitle('DADOS DO FORNECEDOR'),

                infoRow('Nome', fornecedor?.nome),

                infoRow('Documento', fornecedor?.documento),

                infoRow('Telefone', fornecedor?.telefone),

                infoRow('Endereço', fornecedor?.endereco),
              ],

              margin: [14, 14, 14, 12],
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

      margin: [0, 0, 0, 14],
    },

    //////////////////////////////////////////////////////////
    // VEICULO / MOTORISTA
    //////////////////////////////////////////////////////////

    {
      table: {
        widths: ['50%', '50%'],

        body: [
          [
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
                cardTitle('DADOS DO VEÍCULO'),

                infoRow('Modelo', data.compra.modeloCaminhao),

                infoRow('Placa', data.compra.placa),

                infoRow('Cargueiro', data.compra.cargueiro),
              ],

              margin: [14, 14, 14, 12],
            },

            {
              fillColor: COLORS.primarySoft,

              border: [true, true, true, true],

              borderColor: [
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
              ],

              stack: [
                cardTitle('MOTORISTA'),

                infoRow('Nome', data.compra.motoristaNome),

                infoRow('Telefone', data.compra.motoristaTelefone),
              ],

              margin: [14, 14, 14, 12],
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

      margin: [0, 0, 0, 14],
    },

    //////////////////////////////////////////////////////////
    // OPERACIONAL / CLASSIFICACAO
    //////////////////////////////////////////////////////////

    {
      table: {
        widths: ['50%', '50%'],

        body: [
          [
            {
              fillColor: COLORS.header,

              border: [true, true, true, true],

              borderColor: [
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
              ],

              stack: [
                cardTitle('DADOS OPERACIONAIS'),

                infoRow('KG Bruto', numberValue(data.compra.kgBruto, 'kg')),

                infoRow(
                  'Desconto',
                  numberValue(data.compra.descontoKgCalculado, 'kg'),
                ),

                infoRow('KG Líquido', numberValue(data.compra.kgLiquido, 'kg')),

                infoRow(
                  'Quantidade',
                  integerValue(data.compra.quantidadeFrutas, 'frutas'),
                ),

                infoRow('Média', numberValue(data.compra.mediaFruta, 'kg')),
              ],

              margin: [14, 14, 14, 12],
            },

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
                cardTitle('CLASSIFICAÇÃO'),

                infoRow('Safra', data.compra.safra),

                infoRow('Qualidade', data.compra.qualidadeFruta),

                infoRow('Tipo Desconto', data.compra.tipoDesconto),

                ...(hasValue(data.compra.descontoPercentualAplicado)
                  ? [
                      infoRow(
                        'Percentual',
                        `${numberBR(data.compra.descontoPercentualAplicado)}%`,
                      ),
                    ]
                  : []),
              ],

              margin: [14, 14, 14, 12],
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

      margin: [0, 0, 0, 14],
    },

    //////////////////////////////////////////////////////////
    // RESUMO DA COMPRA
    //////////////////////////////////////////////////////////

    {
      table: {
        widths: ['18%', '20%', '17%', '19%', '26%'],

        body: [
          [
            {
              stack: [
                cardTitle('PREÇO POR KG'),

                {
                  text: moneyValue(data.compra.precoKg),

                  bold: true,

                  fontSize: 12,

                  color: COLORS.primary,

                  alignment: 'center',
                },
              ],

              fillColor: COLORS.primarySoft,

              margin: [10, 10, 10, 10],
            },

            {
              stack: [
                cardTitle('TOTAL BRUTO'),

                {
                  text: moneyValue(data.compra.totalBruto),

                  bold: true,

                  fontSize: 12,

                  color: COLORS.primary,

                  alignment: 'center',
                },
              ],

              fillColor: COLORS.primarySoft,

              margin: [10, 10, 10, 10],
            },

            {
              stack: [
                cardTitle('DESPESAS'),

                {
                  text: moneyValue(data.compra.despesas),

                  bold: true,

                  fontSize: 12,

                  color: COLORS.text,

                  alignment: 'center',
                },
              ],

              fillColor: COLORS.header,

              margin: [10, 10, 10, 10],
            },

            {
              stack: [
                cardTitle('ICMS / OUTROS'),

                {
                  text: moneyValue(data.compra.icmsOutros),

                  bold: true,

                  fontSize: 12,

                  color: COLORS.text,

                  alignment: 'center',
                },
              ],

              fillColor: COLORS.header,

              margin: [10, 10, 10, 10],
            },

            {
              stack: [
                cardTitle('VALOR TOTAL'),

                {
                  text: moneyValue(data.compra.valorTotal),

                  bold: true,

                  fontSize: 13,

                  color: COLORS.danger,

                  alignment: 'center',
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

        hLineWidth: () => 0.5,

        vLineWidth: () => 0.5,
      },

      margin: [0, 0, 0, 14],
    },

    //////////////////////////////////////////////////////////
    // OBSERVAÇÕES / RESPONSÁVEL
    //////////////////////////////////////////////////////////

    {
      unbreakable: true,

      table: {
        widths: ['65%', '35%'],

        body: [
          [
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
                cardTitle('OBSERVAÇÕES'),

                {
                  text: observacoes,

                  fontSize: 9.5,

                  color: COLORS.text,

                  lineHeight: 1.25,

                  noWrap: false,
                },
              ],

              margin: [14, 14, 14, 12],
            },

            {
              fillColor: COLORS.header,

              border: [true, true, true, true],

              borderColor: [
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
                COLORS.primaryBorder,
              ],

              stack: [
                cardTitle('RESPONSÁVEL'),

                infoRow('Usuário', usuarioResponsavel),
              ],

              margin: [14, 14, 14, 12],
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

      margin: [0, 0, 0, 18],
    },

    //////////////////////////////////////////////////////////
    // ASSINATURAS
    //////////////////////////////////////////////////////////

    {
      unbreakable: true,

      table: {
        widths: ['50%', '50%'],

        body: [
          [
            {
              border: [false, false, false, false],

              stack: [
                {
                  text: '________________________________________',

                  alignment: 'center',

                  color: COLORS.text,

                  margin: [0, 22, 0, 6],
                },

                {
                  text: 'Fornecedor',

                  alignment: 'center',

                  bold: true,

                  fontSize: 9,

                  color: COLORS.primary,
                },
              ],
            },

            {
              border: [false, false, false, false],

              stack: [
                {
                  text: '________________________________________',

                  alignment: 'center',

                  color: COLORS.text,

                  margin: [0, 22, 0, 6],
                },

                {
                  text: 'Responsável pela Compra',

                  alignment: 'center',

                  bold: true,

                  fontSize: 9,

                  color: COLORS.primary,
                },
              ],
            },
          ],
        ],
      },

      layout: {
        defaultBorder: false,
      },

      margin: [0, 0, 0, 18],
    },

    //////////////////////////////////////////////////////////
    // RODAPÉ
    //////////////////////////////////////////////////////////

    {
      unbreakable: true,

      table: {
        widths: [90, '*', 160],

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
                  text: 'RELATÓRIO OFICIAL DE COMPRA',

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
                  text: 'USUÁRIO EMISSOR',

                  alignment: 'right',

                  bold: true,

                  color: COLORS.primary,

                  fontSize: 8,

                  margin: [0, 8, 0, 0],
                },

                {
                  text: usuarioResponsavel,

                  alignment: 'right',

                  color: COLORS.text,

                  fontSize: 8,

                  lineHeight: 1.15,

                  noWrap: false,
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