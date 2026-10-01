import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';

export interface ClienteRelatorioData {
  cliente: { id: string; nome: string; telefone?: string | null };
  resumo: {
    quantidadeVendas: number;
    kgLiquidoVendido: number;
    totalVendido: number;
    totalRecebido: number;
    totalAReceber: number;
    totalVencido: number;
    ultimaVenda: Date | null;
    ultimoPagamento: Date | null;
  };
  operacoes: {
    id: string;
    dataVenda: Date;
    numeroPedido: string | null;
    numeroRomaneio: string | null;
    placa: string | null;
    pesoLiquido: number;
    valorPorKg: number;
    valorTotal: number;
    status: string;
    statusPagamento: string;
  }[];
  financeiro: {
    titulos: {
      id: string;
      descricao: string | null;
      referencia: string | null;
      valor: number;
      valorPago: number;
      valorRestante: number;
      statusFinanceiro: string;
      vencimento: Date | null;
      pagamentos: {
        id: string;
        valor: number;
        pagoEm: Date;
        formaPagamento: string;
        observacoes: string | null;
      }[];
    }[];
  };
}
const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const civil = (date: Date | null) => {
  if (!date) return '-';
  const ymd = date.toISOString().slice(0, 10);
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
};
const instant = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(date)
    : '-';
function table(
  headers: string[],
  widths: (number | '*')[],
  rows: TableCell[][],
): Content {
  return {
    margin: [0, 6, 0, 14],
    table: {
      headerRows: 1,
      widths,
      body: [
        headers.map((text) => ({
          text,
          bold: true,
          fillColor: '#EEF6EF',
          color: '#166534',
        })),
        ...(rows.length
          ? rows
          : [
              [
                { text: 'Sem registros.', colSpan: headers.length },
                ...headers.slice(1).map(() => ''),
              ],
            ]),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#D1D5DB',
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
  };
}
export function buildClienteRelatorioTemplate(
  data: ClienteRelatorioData,
  usuarioNome: string,
): TDocumentDefinitions {
  const r = data.resumo;
  const pagamentos = data.financeiro.titulos
    .flatMap((title) =>
      title.pagamentos.map((event) => ({
        ...event,
        referencia: title.referencia || title.descricao || title.id,
      })),
    )
    .sort((a, b) => b.pagoEm.getTime() - a.pagoEm.getTime());
  return {
    pageBreakBefore: (node, following: unknown) =>
      node.headlineLevel === 1 &&
      Array.isArray(following) &&
      following.length === 0,
    pageSize: 'A4',
    pageMargins: [32, 30, 32, 36],
    defaultStyle: { fontSize: 9, color: '#111827' },
    footer: (page, pages) => ({
      text: `HMN Frutas | ${usuarioNome} | Página ${page} de ${pages}`,
      fontSize: 8,
      color: '#6B7280',
      margin: [32, 10, 32, 0],
    }),
    content: [
      { text: 'HMN FRUTAS', fontSize: 20, bold: true, color: '#166534' },
      {
        text: 'RELATÓRIO / EXTRATO DO CLIENTE',
        fontSize: 14,
        bold: true,
        margin: [0, 5, 0, 12],
      },
      { text: data.cliente.nome, fontSize: 13, bold: true },
      {
        text: `Telefone: ${data.cliente.telefone || '-'} | Emissão: ${instant(new Date())}`,
        color: '#6B7280',
        margin: [0, 4, 0, 12],
      },
      table(
        ['Total vendido', 'Recebido', 'A receber'],
        ['*', '*', '*'],
        [
          [
            money(r.totalVendido),
            money(r.totalRecebido),
            money(r.totalAReceber),
          ],
        ],
      ),
      {
        text: `Vencido: ${money(r.totalVencido)} | Vendas: ${r.quantidadeVendas} | Kg líquido vendido: ${r.kgLiquidoVendido.toLocaleString('pt-BR')}`,
        bold: true,
        color: '#166534',
      },
      {
        text: `Última venda: ${civil(r.ultimaVenda)} | Último pagamento: ${instant(r.ultimoPagamento)}`,
        margin: [0, 5, 0, 12],
      },
      {
        text: 'OPERAÇÕES - VENDAS VÁLIDAS',
        headlineLevel: 1,
        bold: true,
        fontSize: 11,
        color: '#166534',
      },
      table(
        ['Data', 'Pedido / romaneio', 'Placa', 'Kg líquido', 'Valor total'],
        [60, '*', 57, 60, 80],
        data.operacoes.map((venda) => [
          civil(venda.dataVenda),
          `${venda.numeroPedido || '-'} / ${venda.numeroRomaneio || '-'}`,
          venda.placa || '-',
          venda.pesoLiquido.toLocaleString('pt-BR'),
          money(venda.valorTotal),
        ]),
      ),
      {
        text: 'FINANCEIRO - TÍTULOS DE ENTRADA',
        headlineLevel: 1,
        bold: true,
        fontSize: 11,
        color: '#166534',
      },
      table(
        [
          'Referência',
          'Vencimento',
          'Nominal',
          'Recebido',
          'Restante',
          'Status',
        ],
        ['*', 60, 65, 65, 65, 63],
        data.financeiro.titulos.map((title) => [
          title.referencia || title.descricao || '-',
          civil(title.vencimento),
          money(title.valor),
          money(title.valorPago),
          money(title.valorRestante),
          title.statusFinanceiro,
        ]),
      ),
      {
        text: 'RECEBIMENTOS REALIZADOS',
        headlineLevel: 1,
        bold: true,
        fontSize: 11,
        color: '#166534',
      },
      table(
        ['Data/hora (SP)', 'Referência', 'Forma', 'Valor'],
        [92, '*', 85, 75],
        pagamentos.map((event) => [
          instant(event.pagoEm),
          event.referencia,
          event.formaPagamento,
          money(event.valor),
        ]),
      ),
      {
        text: 'Histórico completo. Valores operacionais, títulos e recebimentos têm fontes distintas. Títulos cancelados não compõem o aberto.',
        fontSize: 8,
        color: '#6B7280',
      },
    ],
  };
}
