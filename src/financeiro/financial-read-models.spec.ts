import fs from 'node:fs';
import path from 'node:path';
import { buildClienteRelatorioTemplate } from '../clientes/templates/cliente-relatorio.template';

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma, TipoTransacao } from '@prisma/client';
import type { Transacao } from '@prisma/client';
import { ClientesService } from '../clientes/clientes.service';
import { FornecedoresService } from '../fornecedores/fornecedores.service';
import { FinanceiroService } from './financeiro.service';
import { CreateTransacaoDto } from './dto/create-transacao.dto';
import { RegistrarPagamentoDto } from './dto/registrar-pagamento.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { buildFornecedorRelatorioTemplate } from '../fornecedores/templates/fornecedor-relatorio.template';

const d = (amount: number) => new Prisma.Decimal(amount);
const older = new Date('2026-10-01T00:00:00Z');
const newer = new Date('2026-10-02T00:00:00Z');
const purchases = [
  {
    id: 'purchase-new',
    status: 'FECHADA',
    dataCompra: newer,
    valorTotal: d(50),
    kgBruto: 60,
    kgLiquido: 50,
    quantidadeFrutas: 10,
    fazendaFornecedor: null,
  },
  {
    id: 'purchase-old',
    status: 'FECHADA',
    dataCompra: older,
    valorTotal: d(100),
    kgBruto: 110,
    kgLiquido: 100,
    quantidadeFrutas: 20,
    fazendaFornecedor: null,
  },
  {
    id: 'purchase-cancelled',
    status: 'CANCELADA',
    dataCompra: newer,
    valorTotal: d(999),
    kgBruto: 999,
    kgLiquido: 999,
    quantidadeFrutas: 99,
    fazendaFornecedor: null,
  },
];
const sales = [
  {
    id: 'sale-new',
    numeroPedido: '001',
    numeroRomaneio: '001',
    placa: 'ABC1D23',
    valorPorKg: d(2),
    statusPagamento: 'PARCIAL',
    status: 'ABERTA',
    dataVenda: newer,
    valorTotal: d(120),
    pesoBruto: 200,
    pesoLiquido: 100,
    quantidadeFrutas: 10,
  },
  {
    id: 'sale-old',
    numeroPedido: '002',
    numeroRomaneio: '002',
    placa: 'ABC1D23',
    valorPorKg: d(2),
    statusPagamento: 'PARCIAL',
    status: 'ABERTA',
    dataVenda: older,
    valorTotal: d(80),
    pesoBruto: 100,
    pesoLiquido: 50,
    quantidadeFrutas: 5,
  },
  {
    id: 'sale-cancelled',
    status: 'CANCELADA',
    dataVenda: newer,
    valorTotal: d(999),
    pesoBruto: 999,
    pesoLiquido: 999,
    quantidadeFrutas: 99,
  },
];
function payment(id: string, amount: number, pagoEm: Date) {
  return {
    id,
    valor: d(amount),
    pagoEm,
    createdAt: older,
    formaPagamento: 'PIX',
    observacoes: null,
  };
}
function title(
  id: string,
  tipo: TipoTransacao,
  amount: number,
  received: number,
  purchaseId: string | null,
  paymentDate: Date,
): Transacao & { pagamentos: ReturnType<typeof payment>[] } {
  return {
    id,
    tipo,
    valor: d(amount),
    valorPago: d(received),
    valorRestante: d(amount - received),
    statusFinanceiro:
      received === amount ? 'PAGO' : received ? 'PARCIAL' : 'PENDENTE',
    clienteId: 'client',
    fornecedorId: 'supplier',
    compraId: purchaseId,
    vendaId: null,
    vencimento: older,
    pagoEm: received ? paymentDate : null,
    formaPagamento: received ? 'PIX' : null,
    referencia: null,
    descricao: null,
    observacoes: null,
    createdAt: older,
    updatedAt: older,
    pagamentos: received ? [payment('e-' + id, received, paymentDate)] : [],
  };
}
const titles = [
  title(
    'out-new',
    'SAIDA',
    50,
    20,
    'purchase-new',
    new Date('2026-10-03T10:00:00Z'),
  ),
  title(
    'out-old-1',
    'SAIDA',
    50,
    10,
    'purchase-old',
    new Date('2026-10-04T10:00:00Z'),
  ),
  title(
    'out-old-2',
    'SAIDA',
    50,
    15,
    'purchase-old',
    new Date('2026-10-02T10:00:00Z'),
  ),
  title('in', 'ENTRADA', 200, 70, null, new Date('2026-10-03T11:00:00Z')),
  {
    ...title('cancelled', 'ENTRADA', 999, 0, null, newer),
    statusFinanceiro: 'CANCELADO',
    valorRestante: d(0),
  },
];

describe('customer, supplier and financial read models', () => {
  const writes = jest.fn();
  const prisma = {
    cliente: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: 'client',
          nome: 'Cliente',
          telefone: null,
          cpf: null,
          cnpj: null,
        }),
      ),
      findMany: jest.fn(() =>
        Promise.resolve([
          {
            id: 'client',
            nome: 'Cliente',
            telefone: null,
            proprietarioNome: null,
            nomeFantasia: null,
            vendas: sales.filter((item) => item.status !== 'CANCELADA'),
            compras: purchases.filter((item) => item.status !== 'CANCELADA'),
            transacoes: titles,
          },
        ]),
      ),
    },
    fornecedor: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: 'supplier',
          nome: 'Fornecedor',
          fazendas: [],
          alertas: [],
          limiteFinanceiroValor: d(1000),
          limiteFinanceiroDias: 0,
        }),
      ),
    },
    alertaFornecedor: {
      findMany: jest.fn(() => Promise.resolve([])),
      create: writes,
      updateMany: writes,
    },
    compra: {
      findMany: jest.fn((args: Prisma.CompraFindManyArgs) =>
        Promise.resolve(
          args.where?.status
            ? purchases.filter((item) => item.status !== 'CANCELADA')
            : purchases,
        ),
      ),
    },
    venda: {
      findMany: jest.fn((args: Prisma.VendaFindManyArgs) =>
        Promise.resolve(
          args.where?.status
            ? sales.filter((item) => item.status !== 'CANCELADA')
            : sales,
        ),
      ),
    },
    transacao: {
      findMany: jest.fn((args: Prisma.TransacaoFindManyArgs) => {
        const direction =
          typeof args.where?.tipo === 'string' ? args.where.tipo : null;
        return Promise.resolve(
          titles.filter((item) => !direction || item.tipo === direction),
        );
      }),
    },
    pagamentoTransacao: {
      findMany: jest.fn(() =>
        Promise.resolve(
          titles
            .filter((item) => item.tipo === 'ENTRADA')
            .flatMap((item) =>
              item.pagamentos.map((event) => ({
                ...event,
                transacaoId: item.id,
                transacao: item,
              })),
            ),
        ),
      ),
    },
  };
  let clientes: ClientesService;
  let fornecedores: FornecedoresService;
  let financeiro: FinanceiroService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ClientesService,
        FornecedoresService,
        FinanceiroService,
        { provide: PrismaService, useValue: prisma },
        { provide: AlertasService, useValue: { criarOuAtualizar: writes } },
      ],
    }).compile();
    clientes = module.get(ClientesService);
    fornecedores = module.get(FornecedoresService);
    financeiro = module.get(FinanceiroService);
  });
  beforeEach(() => jest.clearAllMocks());
  it('customer history excludes cancelled sales, outgoing cash and uses net sale kilograms', async () => {
    const result = await clientes.historicoCompleto('client');
    expect(result.resumo.totalVendas).toBe(200);
    expect(result.resumo.totalRecebido).toBe(70);
    expect(result.resumo.totalAReceber).toBe(130);
    expect(result.resumo.totalKgVendido).toBe(150);
    expect(result.resumo.quantidadeOperacoes).toBe(2);
    expect(result.resumo.ultimaVenda).toEqual(newer);
    expect(result.resumo.ultimoPagamento).toEqual(
      new Date('2026-10-03T11:00:00Z'),
    );
    expect(prisma.pagamentoTransacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { transacao: { clienteId: 'client', tipo: 'ENTRADA' } },
      }),
    );
  });
  it('client JSON and PDF reuse the canonical history and only expose incoming titles/events', async () => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout'],
    });
    jest.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    try {
      const report = await clientes.relatorioCompleto('client');
      expect(report.resumo).toMatchObject({
        quantidadeVendas: 2,
        kgLiquidoVendido: 150,
        totalVendido: 200,
        totalRecebido: 70,
        totalAReceber: 130,
        totalVencido: 130,
        ultimaVenda: newer,
        ultimoPagamento: new Date('2026-10-03T11:00:00Z'),
      });
      expect(report.operacoes.map((item) => item.id)).toEqual([
        'sale-new',
        'sale-old',
      ]);
      expect(
        report.financeiro.titulos.every((item) => !item.id.startsWith('out-')),
      ).toBe(true);
      expect(
        report.financeiro.titulos
          .flatMap((item) => item.pagamentos)
          .reduce((sum, event) => sum + event.valor, 0),
      ).toBe(70);
      const definition = buildClienteRelatorioTemplate(report, 'Emissor');
      expect(JSON.stringify(definition)).toContain('130,00');
      const source = jest.spyOn(clientes, 'relatorioCompleto');
      const buffer = await clientes.gerarPdfCliente('client', 'Emissor');
      expect(source).toHaveBeenCalledWith('client');
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      source.mockRestore();
      if (process.env.PATCH4B_PDF_DIR) {
        fs.mkdirSync(process.env.PATCH4B_PDF_DIR, { recursive: true });
        fs.writeFileSync(
          path.join(process.env.PATCH4B_PDF_DIR, 'cliente.pdf'),
          buffer,
        );
      }
      expect(writes).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
  it('supplier JSON and PDF use all outgoing titles/payments and official dates/weight', async () => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout'],
    });
    jest.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    try {
      const report = await fornecedores.historicoCompleto('supplier');
      expect(report.resumo).toMatchObject({
        quantidadeCompras: 2,
        kgComprado: 150,
        totalComprado: 150,
        totalPago: 45,
        totalAPagar: 105,
        totalVencido: 105,
      });
      expect(report.resumo.ultimaCompra?.dataCompra).toEqual(newer);
      expect(report.resumo.ultimoPagamento?.pagoEm).toEqual(
        new Date('2026-10-04T10:00:00Z'),
      );
      expect(
        report.financeiro.titulos.every((title) => title.tipo === 'SAIDA'),
      ).toBe(true);
      expect(
        report.pagamentos.reduce((sum, event) => sum + Number(event.valor), 0),
      ).toBe(45);
      const source = jest.spyOn(fornecedores, 'historicoCompleto');
      const buffer = await fornecedores.gerarPdfFornecedor(
        'supplier',
        'Emissor',
      );
      expect(source).toHaveBeenCalledWith('supplier');
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      source.mockRestore();
      if (process.env.PATCH4B_PDF_DIR) {
        fs.mkdirSync(process.env.PATCH4B_PDF_DIR, { recursive: true });
        fs.writeFileSync(
          path.join(process.env.PATCH4B_PDF_DIR, 'fornecedor.pdf'),
          buffer,
        );
      }
      expect(writes).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
  it('customer complete/list summaries keep the same financial source', async () => {
    const complete = await clientes.resumoCompleto('client');
    const list = await clientes.resumoLista();
    expect(complete.resumo.totalRecebido).toBe(70);
    expect(complete.resumo.totalAReceber).toBe(130);
    expect(list[0].totalVendas).toBe(200);
    expect(list[0].totalRecebido).toBe(70);
    expect(list[0].totalKgVendido).toBe(150);
    expect(list[0].saldo).toBe(130);
  });
  it('supplier history excludes cancelled purchases and incoming cash; latest dates are global', async () => {
    const history = await fornecedores.historicoCompleto('supplier');
    expect(history.resumo.totalComprado).toBe(150);
    expect(history.resumo.totalPago).toBe(45);
    expect(history.resumo.totalAPagar).toBe(105);
    expect(history.resumo.ultimaCompra?.id).toBe('purchase-new');
    expect(history.resumo.ultimoPagamento?.id).toBe('e-out-old-1');
    const old = history.historicoOperacional.find(
      (item) => item.compraId === 'purchase-old',
    );
    expect(old?.valorPago).toBe(25);
    expect(old?.valorRestante).toBe(75);
    expect(old?.pagamentos).toHaveLength(2);
    const pdf = buildFornecedorRelatorioTemplate(history, 'Emissor');
    expect(JSON.stringify(pdf)).toContain('150,00');
    expect(JSON.stringify(pdf)).toContain('105,00');
    expect(writes).not.toHaveBeenCalled();
  });
  it('supplier PDF includes outgoing payments without a valid linked purchase', async () => {
    prisma.transacao.findMany.mockResolvedValueOnce([
      ...titles,
      title(
        'out-manual',
        'SAIDA',
        20,
        5,
        null,
        new Date('2026-10-05T10:00:00Z'),
      ),
    ]);
    const report = await fornecedores.historicoCompleto('supplier');
    expect(report.resumo.totalPago).toBe(50);
    expect(report.resumo.totalAPagar).toBe(120);
    expect(report.resumo.totalComprado).toBe(150);
    expect(report.pagamentos.some((event) => event.id === 'e-out-manual')).toBe(
      true,
    );
    const definition = buildFornecedorRelatorioTemplate(report, 'Emissor');
    expect(JSON.stringify(definition)).toContain('5,00');
    expect(JSON.stringify(definition)).toContain('120,00');
  });
  it('supplier summary and finance GET are read-only and use events/open titles', async () => {
    const summary = await fornecedores.resumoCompleto('supplier');
    const financial = await financeiro.financeiroPorFornecedor('supplier');
    expect(summary.resumo.totalPago).toBe(45);
    expect(summary.resumo.totalAPagar).toBe(105);
    expect(financial.resumo.totalComprado).toBe(150);
    expect(financial.resumo.totalPago).toBe(45);
    expect(financial.resumo.totalAPagar).toBe(105);
    expect(writes).not.toHaveBeenCalled();
  });
});

describe('general summary, accounts and realized cash flow', () => {
  let service: FinanceiroService;
  const aggregate = jest.fn((args: Prisma.TransacaoAggregateArgs) =>
    Promise.resolve({
      _sum: {
        valor: d(args.where?.tipo === 'ENTRADA' ? 200 : 150),
        valorRestante: d(args.where?.tipo === 'ENTRADA' ? 130 : 105),
      },
      _count: 2,
    }),
  );
  const cash = jest.fn((args: Prisma.PagamentoTransacaoAggregateArgs) =>
    Promise.resolve({
      _sum: {
        valor: d(
          args.where?.transacao &&
            'tipo' in args.where.transacao &&
            args.where.transacao.tipo === 'ENTRADA'
            ? 70
            : 45,
        ),
      },
    }),
  );
  const accounts = jest.fn(() => Promise.resolve([]));
  const paymentEvents = jest.fn(() =>
    Promise.resolve([
      {
        id: 'payment',
        transacaoId: 'title',
        valor: d(70),
        pagoEm: new Date('2026-10-03T10:00:00Z'),
        formaPagamento: 'PIX',
        observacoes: null,
        transacao: {
          id: 'title',
          tipo: 'ENTRADA',
          valor: d(200),
          createdAt: older,
        },
      },
    ]),
  );
  const prisma = {
    transacao: {
      aggregate,
      findMany: accounts,
      create: jest.fn((args: Prisma.TransacaoCreateArgs) =>
        Promise.resolve(args.data),
      ),
    },
    pagamentoTransacao: { aggregate: cash, findMany: paymentEvents },
    compra: {
      aggregate: jest.fn(() =>
        Promise.resolve({ _sum: { valorTotal: d(150) }, _count: 2 }),
      ),
    },
    venda: {
      aggregate: jest.fn(() =>
        Promise.resolve({ _sum: { valorTotal: d(200) }, _count: 2 }),
      ),
    },
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FinanceiroService,
        { provide: PrismaService, useValue: prisma },
        { provide: AlertasService, useValue: {} },
      ],
    }).compile();
    service = module.get(FinanceiroService);
  });
  beforeEach(() => jest.clearAllMocks());
  it('distinguishes nominal, realized and open amounts', async () => {
    const result = await service.resumoGeral();
    expect(result.titulosEntrada).toBe(200);
    expect(result.titulosSaida).toBe(150);
    expect(result.totalRecebido).toBe(70);
    expect(result.totalPago).toBe(45);
    expect(result.totalAReceber).toBe(130);
    expect(result.totalAPagar).toBe(105);
    expect(result.resultadoCaixa).toBe(25);
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tipo: 'ENTRADA',
          statusFinanceiro: { in: ['PENDENTE', 'PARCIAL'] },
          valorRestante: { gt: 0 },
        },
      }),
    );
  });
  it('manual titles always start pending with zero paid and full remaining', async () => {
    await service.createTransacaoManual({ tipo: 'ENTRADA', valor: 100 });
    expect(prisma.transacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          valor: d(100),
          valorPago: d(0),
          valorRestante: d(100),
          statusFinanceiro: 'PENDENTE',
        }),
      }),
    );
    for (const input of [
      { valorPago: 20 },
      { valorRestante: 20 },
      { statusFinanceiro: 'PAGO' as const },
      { pagoEm: '2026-10-02T12:00:00Z' },
    ]) {
      await expect(
        service.createTransacaoManual({
          tipo: 'ENTRADA',
          valor: 100,
          ...input,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.transacao.create).toHaveBeenCalledTimes(1);
  });
  it('HTTP DTO rejects arbitrary projections and payment dates without time/zone', async () => {
    const manual = plainToInstance(CreateTransacaoDto, {
      tipo: 'ENTRADA',
      valor: 100,
      valorPago: 20,
      valorRestante: 80,
    });
    const errors = await validate(manual, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property).sort()).toEqual([
      'valorPago',
      'valorRestante',
    ]);
    const invalid = plainToInstance(RegistrarPagamentoDto, {
      valor: 10,
      formaPagamento: 'PIX',
      pagoEm: '2026-10-02',
    });
    expect(
      (await validate(invalid)).some((error) => error.property === 'pagoEm'),
    ).toBe(true);
    const valid = plainToInstance(RegistrarPagamentoDto, {
      valor: 10,
      formaPagamento: 'PIX',
      pagoEm: '2026-10-02T12:00:00-03:00',
      observacoes: 'parcial',
    });
    expect(await validate(valid)).toHaveLength(0);
  });
  it.each(['contasReceber', 'contasPagar'] as const)(
    '%s queries only active remaining and stable due order',
    async (method) => {
      await service[method]();
      expect(accounts).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tipo: method === 'contasReceber' ? 'ENTRADA' : 'SAIDA',
            statusFinanceiro: { in: ['PENDENTE', 'PARCIAL'] },
            valorRestante: { gt: 0 },
          },
          orderBy: [
            { vencimento: { sort: 'asc', nulls: 'last' } },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        }),
      );
    },
  );
  it('cash flow returns event amounts and payment instants without a hidden cap', async () => {
    const result = await service.fluxo();
    expect(Number(result[0].valor)).toBe(70);
    expect(result[0].pagoEm).toEqual(new Date('2026-10-03T10:00:00Z'));
    expect(result[0].transacaoId).toBe('title');
    const args = paymentEvents.mock.calls[0];
    expect(args).toEqual([
      expect.objectContaining({
        orderBy: [{ pagoEm: 'desc' }, { id: 'desc' }],
      }),
    ]);
    expect(accounts).not.toHaveBeenCalled();
  });
});
