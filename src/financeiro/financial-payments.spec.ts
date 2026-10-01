import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  FormaPagamento,
  Prisma,
  StatusFinanceiro,
  TipoTransacao,
} from '@prisma/client';
import type { PagamentoTransacao, Transacao } from '@prisma/client';
import { FinanceiroService } from './financeiro.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { VendasService } from '../vendas/vendas.service';
import {
  financialProjection,
  isOverdue,
  openFinancialStatuses,
  summarizeTitles,
} from './financial-state';

const decimal = (value: number) => new Prisma.Decimal(value);
function title(id = 't1', overrides: Partial<Transacao> = {}): Transacao {
  return {
    id,
    clienteId: 'client',
    fornecedorId: null,
    tipo: TipoTransacao.ENTRADA,
    valor: decimal(100),
    valorPago: decimal(0),
    valorRestante: decimal(100),
    formaPagamento: null,
    statusFinanceiro: StatusFinanceiro.PENDENTE,
    vencimento: new Date('2026-10-01T00:00:00Z'),
    pagoEm: null,
    referencia: null,
    descricao: null,
    observacoes: null,
    compraId: null,
    vendaId: 'sale',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    ...overrides,
  };
}
function event(
  transacaoId: string,
  amount: number,
  paidAt = '2026-10-02T12:00:00Z',
): PagamentoTransacao {
  return {
    id: 'e-' + transacaoId,
    transacaoId,
    clienteId: 'client',
    fornecedorId: null,
    valor: decimal(amount),
    valorRestanteApos: decimal(100 - amount),
    formaPagamento: FormaPagamento.PIX,
    pagoEm: new Date(paidAt),
    vencimento: null,
    observacoes: null,
    createdAt: new Date(paidAt),
    updatedAt: new Date(paidAt),
  };
}
type State = {
  titles: Transacao[];
  events: PagamentoTransacao[];
  sale: {
    id: string;
    status: 'ABERTA' | 'CANCELADA';
    statusPagamento: 'PENDENTE' | 'PARCIAL' | 'PAGO';
    clienteId: string;
    numeroPedido: string;
  };
};
function transactionClient(state: State) {
  return {
    fornecedor: {
      findUnique: jest.fn(() => Promise.resolve({ id: 'supplier' })),
    },
    transacao: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          state.titles.find((item) => item.id === where.id) ?? null,
        ),
      ),
      findMany: jest.fn(({ where, orderBy }: Prisma.TransacaoFindManyArgs) => {
        let rows = state.titles.filter(
          (item) => !where?.vendaId || item.vendaId === where.vendaId,
        );
        if (where?.fornecedorId)
          rows = rows.filter(
            (item) =>
              item.fornecedorId === where.fornecedorId &&
              item.tipo === TipoTransacao.SAIDA &&
              openFinancialStatuses.includes(item.statusFinanceiro) &&
              decimal(Number(item.valorRestante ?? 0)).gt(0),
          );
        if (orderBy)
          rows.sort(
            (a, b) =>
              (a.vencimento?.getTime() ?? Infinity) -
                (b.vencimento?.getTime() ?? Infinity) ||
              a.createdAt.getTime() - b.createdAt.getTime() ||
              a.id.localeCompare(b.id),
          );
        return Promise.resolve(
          rows.map((item) => ({
            ...item,
            pagamentos: state.events.filter(
              (payment) => payment.transacaoId === item.id,
            ),
          })),
        );
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Transacao>;
        }) => {
          const item = state.titles.find((row) => row.id === where.id);
          if (!item) throw new Error('Fixture title missing');
          Object.assign(item, data);
          return Promise.resolve({
            ...item,
            pagamentos: state.events.filter(
              (payment) => payment.transacaoId === item.id,
            ),
          });
        },
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { vendaId: string };
          data: Partial<Transacao>;
        }) => {
          for (const item of state.titles.filter(
            (row) => row.vendaId === where.vendaId,
          ))
            Object.assign(item, data);
          return Promise.resolve({ count: state.titles.length });
        },
      ),
    },
    pagamentoTransacao: {
      aggregate: jest.fn(({ where }: { where: { transacaoId: string } }) =>
        Promise.resolve({
          _sum: {
            valor: state.events
              .filter((payment) => payment.transacaoId === where.transacaoId)
              .reduce((sum, payment) => sum.add(payment.valor), decimal(0)),
          },
        }),
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: Omit<PagamentoTransacao, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const payment = {
            ...data,
            id: 'e' + (state.events.length + 1),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          state.events.push(payment);
          return Promise.resolve(payment);
        },
      ),
      findFirst: jest.fn(({ where }: { where: { transacaoId: string } }) =>
        Promise.resolve(
          state.events
            .filter((payment) => payment.transacaoId === where.transacaoId)
            .sort((a, b) => b.pagoEm.getTime() - a.pagoEm.getTime())[0] ?? null,
        ),
      ),
    },
    venda: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          ...state.sale,
          transacoes: state.titles.map((item) => ({
            ...item,
            pagamentos: state.events.filter(
              (payment) => payment.transacaoId === item.id,
            ),
          })),
        }),
      ),
      update: jest.fn(({ data }: { data: Partial<State['sale']> }) => {
        Object.assign(state.sale, data);
        return Promise.resolve({ ...state.sale });
      }),
    },
  };
}
const serializationError = () =>
  new Prisma.PrismaClientKnownRequestError('conflict', {
    code: 'P2034',
    clientVersion: '7.8.0',
  });
async function fixture(titles = [title()], events: PagamentoTransacao[] = []) {
  let state: State = {
    titles,
    events,
    sale: {
      id: 'sale',
      status: 'ABERTA',
      statusPagamento: 'PENDENTE',
      clienteId: 'client',
      numeroPedido: '1',
    },
  };
  let version = 0;
  let forceConflicts = 0;
  const transactions: ReturnType<typeof transactionClient>[] = [];
  const prisma = {
    $transaction: jest.fn(
      async (
        work: (tx: ReturnType<typeof transactionClient>) => Promise<unknown>,
        options: { isolationLevel: string },
      ) => {
        expect(options.isolationLevel).toBe('Serializable');
        const startVersion = version;
        const snapshot: State = {
          titles: state.titles.map((item) => ({ ...item })),
          events: state.events.map((item) => ({ ...item })),
          sale: { ...state.sale },
        };
        const tx = transactionClient(snapshot);
        transactions.push(tx);
        const result = await work(tx);
        if (forceConflicts-- > 0 || startVersion !== version)
          throw serializationError();
        state = snapshot;
        version++;
        return result;
      },
    ),
  };
  const module = await Test.createTestingModule({
    providers: [
      FinanceiroService,
      VendasService,
      { provide: PrismaService, useValue: prisma },
      { provide: AlertasService, useValue: {} },
    ],
  }).compile();
  return {
    service: module.get(FinanceiroService),
    vendas: module.get(VendasService),
    prisma,
    transactions,
    get state() {
      return state;
    },
    conflict(times: number) {
      forceConflicts = times;
    },
  };
}

describe('atomic payment events and financial projections', () => {
  it('partial, final and one-shot payments create events and synchronize sale', async () => {
    const f = await fixture();
    await f.service.registrarPagamento('t1', {
      valor: 40,
      formaPagamento: FormaPagamento.PIX,
      pagoEm: '2026-10-02T12:34:56Z',
      observacoes: 'parcial',
    });
    expect(f.state.titles[0].statusFinanceiro).toBe('PARCIAL');
    expect(Number(f.state.titles[0].valorPago)).toBe(40);
    expect(Number(f.state.titles[0].valorRestante)).toBe(60);
    expect(f.state.sale.statusPagamento).toBe('PARCIAL');
    expect(f.state.events[0].pagoEm.toISOString()).toBe(
      '2026-10-02T12:34:56.000Z',
    );
    expect(f.state.events[0].observacoes).toBe('parcial');
    await f.service.registrarPagamento('t1', {
      valor: 60,
      formaPagamento: FormaPagamento.DINHEIRO,
      pagoEm: '2026-10-03T12:00:00Z',
    });
    expect(f.state.events).toHaveLength(2);
    expect(f.state.sale.statusPagamento).toBe('PAGO');
    expect(Number(f.state.titles[0].valorPago)).toBe(100);
    expect(Number(f.state.titles[0].valorRestante)).toBe(0);
    expect(f.state.titles[0].formaPagamento).toBe('DINHEIRO');
    expect(f.state.titles[0].pagoEm).toEqual(new Date('2026-10-03T12:00:00Z'));
    const single = await fixture();
    await single.service.registrarPagamento('t1', {
      valor: 100,
      formaPagamento: FormaPagamento.PIX,
    });
    expect(single.state.sale.statusPagamento).toBe('PAGO');
    expect(single.state.events).toHaveLength(1);
  });
  it.each([0, -1, 101, 0.001, NaN, Infinity])(
    'rejects invalid/overpaid amount %s without committing',
    async (valor) => {
      const f = await fixture();
      await expect(
        f.service.registrarPagamento('t1', {
          valor,
          formaPagamento: FormaPagamento.PIX,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(f.state.events).toHaveLength(0);
      expect(Number(f.state.titles[0].valorPago)).toBe(0);
    },
  );
  it('rejects cancelled titles and inconsistent caches/events', async () => {
    const cancelled = await fixture([
      title('t1', { statusFinanceiro: 'CANCELADO', valorRestante: decimal(0) }),
    ]);
    await expect(
      cancelled.service.registrarPagamento('t1', {
        valor: 10,
        formaPagamento: FormaPagamento.PIX,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    for (const overrides of [
      { valorPago: decimal(1) },
      { valorRestante: decimal(10) },
      { statusFinanceiro: StatusFinanceiro.PAGO },
    ]) {
      const f = await fixture([title('t1', overrides)]);
      await expect(
        f.service.registrarPagamento('t1', {
          valor: 10,
          formaPagamento: FormaPagamento.PIX,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(f.state.events).toHaveLength(0);
    }
    const missingCache = await fixture([title()], [event('t1', 10)]);
    await expect(
      missingCache.service.registrarPagamento('t1', {
        valor: 1,
        formaPagamento: FormaPagamento.PIX,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('backdated payment keeps latest instant/method projection', async () => {
    const f = await fixture();
    await f.service.registrarPagamento('t1', {
      valor: 10,
      formaPagamento: FormaPagamento.PIX,
      pagoEm: '2026-10-03T10:00:00Z',
    });
    await f.service.registrarPagamento('t1', {
      valor: 10,
      formaPagamento: FormaPagamento.DINHEIRO,
      pagoEm: '2026-10-02T10:00:00Z',
    });
    expect(f.state.titles[0].pagoEm).toEqual(new Date('2026-10-03T10:00:00Z'));
    expect(f.state.titles[0].formaPagamento).toBe('PIX');
  });
  it('retries P2034 twice, never indefinitely', async () => {
    const f = await fixture();
    f.conflict(2);
    await f.service.registrarPagamento('t1', {
      valor: 10,
      formaPagamento: FormaPagamento.PIX,
    });
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(f.state.events).toHaveLength(1);
    const failed = await fixture();
    failed.conflict(10);
    await expect(
      failed.service.registrarPagamento('t1', {
        valor: 10,
        formaPagamento: FormaPagamento.PIX,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(failed.prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(failed.state.events).toHaveLength(0);
  });
  it('two concurrent payments cannot commit beyond balance', async () => {
    const f = await fixture();
    const results = await Promise.allSettled(
      [70, 70].map((valor) =>
        f.service.registrarPagamento('t1', {
          valor,
          formaPagamento: FormaPagamento.PIX,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(Number(f.state.titles[0].valorPago)).toBe(70);
    expect(f.state.events).toHaveLength(1);
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(3);
  });
  it('FIFO follows due date, ignores wrong direction/cancelled/paid, creates one event per title', async () => {
    const f = await fixture([
      title('later', {
        fornecedorId: 'supplier',
        tipo: 'SAIDA',
        vendaId: null,
        vencimento: new Date('2026-10-03Z'),
      }),
      title('earlier', {
        fornecedorId: 'supplier',
        tipo: 'SAIDA',
        vendaId: null,
        vencimento: new Date('2026-10-01Z'),
      }),
      title('cancelled', {
        fornecedorId: 'supplier',
        tipo: 'SAIDA',
        statusFinanceiro: 'CANCELADO',
        valorRestante: decimal(0),
      }),
      title('paid', {
        fornecedorId: 'supplier',
        tipo: 'SAIDA',
        statusFinanceiro: 'PAGO',
        valorPago: decimal(100),
        valorRestante: decimal(0),
      }),
      title('wrong-direction', { fornecedorId: 'supplier' }),
    ]);
    const result = await f.service.registrarPagamentoFornecedor('supplier', {
      valor: 150,
      formaPagamento: FormaPagamento.PIX,
    });
    expect(result.transacoesAtualizadas).toEqual(['earlier', 'later']);
    expect(result.valorNaoUtilizado).toBe(0);
    expect(f.state.events.map((payment) => Number(payment.valor))).toEqual([
      100, 50,
    ]);
    expect(
      f.state.titles.find((item) => item.id === 'later')?.statusFinanceiro,
    ).toBe('PARCIAL');
    expect(
      f.state.titles.find((item) => item.id === 'earlier')?.statusFinanceiro,
    ).toBe('PAGO');
    const overpaid = await fixture([
      title('t1', { fornecedorId: 'supplier', tipo: 'SAIDA', vendaId: null }),
    ]);
    await expect(
      overpaid.service.registrarPagamentoFornecedor('supplier', {
        valor: 101,
        formaPagamento: FormaPagamento.PIX,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(overpaid.state.events).toHaveLength(0);
  });
});

describe('conservative sale cancellation and legacy statuses', () => {
  it('concurrent cancellation/payment commit only one consistent outcome', async () => {
    const f = await fixture();
    const outcomes = await Promise.allSettled([
      f.service.registrarPagamento('t1', {
        valor: 40,
        formaPagamento: FormaPagamento.PIX,
      }),
      f.vendas.cancelarVenda('sale'),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    if (f.state.sale.status === 'CANCELADA') {
      expect(f.state.events).toHaveLength(0);
      expect(f.state.titles[0].statusFinanceiro).toBe('CANCELADO');
    } else {
      expect(f.state.events).toHaveLength(1);
      expect(f.state.sale.statusPagamento).toBe('PARCIAL');
      expect(Number(f.state.titles[0].valorPago)).toBe(40);
    }
  });
  it('unpaid cancellation cancels title without creating/deleting events', async () => {
    const f = await fixture();
    await f.vendas.cancelarVenda('sale', 'teste');
    expect(f.state.sale.status).toBe('CANCELADA');
    expect(f.state.titles[0].statusFinanceiro).toBe('CANCELADO');
    expect(Number(f.state.titles[0].valorRestante)).toBe(0);
    expect(f.state.events).toHaveLength(0);
  });
  it.each([10, 100])('blocks cancellation with payment %s', async (amount) => {
    const f = await fixture(
      [title('t1', financialProjection(decimal(100), decimal(amount)))],
      [event('t1', amount)],
    );
    await expect(f.vendas.cancelarVenda('sale')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(f.state.sale.status).toBe('ABERTA');
    expect(f.state.events).toHaveLength(1);
  });
  it('generic cancelled status cannot bypass cancellation', async () => {
    const f = await fixture();
    await expect(
      f.vendas.atualizarStatus('sale', 'CANCELADA'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.state.sale.status).toBe('ABERTA');
  });
  it('isolated financial status is only an already-consistent no-op', async () => {
    const f = await fixture();
    await f.vendas.atualizarPagamento('sale', 'PENDENTE');
    await expect(
      f.vendas.atualizarPagamento('sale', 'PAGO'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.state.sale.statusPagamento).toBe('PENDENTE');
    expect(f.state.events).toHaveLength(0);
  });
});

describe('cash direction, open titles and civil due dates', () => {
  const now = new Date('2026-10-02T03:01:00Z');
  it.each([
    ['2026-10-02T00:00:00Z', false],
    ['2026-10-01T00:00:00Z', true],
    [null, false],
  ])('civil due %s overdue=%s', (date, expected) => {
    expect(isOverdue(date ? new Date(date) : null, now)).toBe(expected);
  });
  it('events determine realized, only correct-direction active remaining determines open/overdue', () => {
    const rows = [
      {
        ...title('partial', {
          ...financialProjection(decimal(100), decimal(40)),
        }),
        pagamentos: [event('partial', 40)],
      },
      {
        ...title('today', { vencimento: new Date('2026-10-02T00:00:00Z') }),
        pagamentos: [],
      },
      { ...title('undated', { vencimento: null }), pagamentos: [] },
      {
        ...title('cancelled', {
          statusFinanceiro: 'CANCELADO',
          valorRestante: decimal(0),
        }),
        pagamentos: [],
      },
      {
        ...title('outgoing', {
          tipo: 'SAIDA',
          ...financialProjection(decimal(100), decimal(100)),
        }),
        pagamentos: [event('outgoing', 100)],
      },
    ];
    expect(summarizeTitles(rows, 'ENTRADA', now)).toEqual({
      realizado: 40,
      aberto: 260,
      vencido: 60,
      parcial: 60,
      ultimoPagamento: new Date('2026-10-02T12:00:00Z'),
    });
    expect(summarizeTitles(rows, 'SAIDA', now).realizado).toBe(100);
  });
});
