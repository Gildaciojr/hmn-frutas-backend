import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  FormaPagamento,
  Prisma,
  StatusFinanceiro,
  TipoTransacao,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DespesasOperacionaisService } from './despesas-operacionais.service';
import { CreateDespesaOperacionalDto } from './dto/create-despesa-operacional.dto';

const payload: CreateDespesaOperacionalDto = {
  data: '2026-10-01',
  atividade: 'Combustível',
  valor: 123.45,
  observacoes: 'Recibo 42',
  formaPagamento: FormaPagamento.CHEQUE,
  pagoEm: '2026-10-02T15:34:56-03:00',
};

async function setup(failAt?: 'payment' | 'expense') {
  const committed: string[] = [];
  const staged: string[] = [];
  const tx = {
    transacao: {
      create: jest.fn(
        ({ data }: { data: Prisma.TransacaoUncheckedCreateInput }) => {
          staged.push('title');
          return Promise.resolve({ id: 'title', ...data });
        },
      ),
    },
    pagamentoTransacao: {
      create: jest.fn(
        ({ data }: { data: Prisma.PagamentoTransacaoUncheckedCreateInput }) => {
          if (failAt === 'payment') throw new Error('payment failed');
          staged.push('payment');
          return Promise.resolve({ id: 'payment', ...data });
        },
      ),
    },
    despesaOperacional: {
      create: jest.fn(
        ({ data }: { data: Prisma.DespesaOperacionalUncheckedCreateInput }) => {
          if (failAt === 'expense') throw new Error('expense failed');
          staged.push('expense');
          return Promise.resolve({ id: 'expense', ...data });
        },
      ),
    },
  };
  const transaction = jest.fn(
    async (work: (tx: typeof tx) => Promise<unknown>) => {
      staged.length = 0;
      const result = await work(tx);
      committed.push(...staged);
      return result;
    },
  );
  // Explicit transaction argument shape; all writes are staged until its callback resolves.
  const module = await Test.createTestingModule({
    providers: [
      DespesasOperacionaisService,
      { provide: PrismaService, useValue: { $transaction: transaction } },
    ],
  }).compile();
  return {
    service: module.get(DespesasOperacionaisService),
    transaction,
    committed,
    tx,
  };
}

function expectAmount(value: unknown, expected: string) {
  if (!(value instanceof Prisma.Decimal)) throw new Error('Expected Decimal');
  expect(value.toFixed(2)).toBe(expected);
}

describe('Paid operational expense', () => {
  it('atomically creates one paid title, one event and the linked expense', async () => {
    const { service, transaction, committed, tx } = await setup();
    const result = await service.create(payload);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(committed).toEqual(['title', 'payment', 'expense']);
    expect(result).toMatchObject({
      id: 'expense',
      transacaoId: 'title',
      atividade: payload.atividade,
      observacoes: payload.observacoes,
    });
    const title = tx.transacao.create.mock.calls[0][0].data;
    const event = tx.pagamentoTransacao.create.mock.calls[0][0].data;
    const expense = tx.despesaOperacional.create.mock.calls[0][0].data;
    expect(tx.pagamentoTransacao.create).toHaveBeenCalledTimes(1);
    expect(title).toMatchObject({
      tipo: TipoTransacao.SAIDA,
      statusFinanceiro: StatusFinanceiro.PAGO,
      formaPagamento: payload.formaPagamento,
      observacoes: payload.observacoes,
    });
    for (const value of [
      title.valor,
      title.valorPago,
      event.valor,
      expense.valor,
    ])
      expectAmount(value, '123.45');
    expectAmount(title.valorRestante, '0.00');
    expectAmount(event.valorRestanteApos, '0.00');
    expect(event.transacaoId).toBe('title');
    expect(event.formaPagamento).toBe(title.formaPagamento);
    expect(event.pagoEm).toEqual(title.pagoEm);
    expect(new Date(event.pagoEm).toISOString()).toBe(
      '2026-10-02T18:34:56.000Z',
    );
    expect(event.observacoes).toBe(payload.observacoes);
    expect(expense.data).toEqual(new Date(payload.data));
    expect(title.vencimento).toEqual(expense.data);
  });
  it.each(['payment', 'expense'] as const)(
    'rolls back every staged write when %s fails',
    async (failAt) => {
      const { service, committed } = await setup(failAt);
      await expect(service.create(payload)).rejects.toThrow(`${failAt} failed`);
      expect(committed).toEqual([]);
    },
  );
  it.each([
    { formaPagamento: 'INVALID' },
    { formaPagamento: undefined },
    { pagoEm: 'invalid' },
    { pagoEm: '2026-10-02' },
    { pagoEm: '2026-10-02T12:30:00' },
    { pagoEm: undefined },
    { pagoEm: '2026-02-30T12:30:00Z' },
    { valor: 1.001 },
  ])('rejects invalid required financial data: %j', async (invalid) => {
    const errors = await validate(
      plainToInstance(CreateDespesaOperacionalDto, { ...payload, ...invalid }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
  it.each(Object.values(FormaPagamento))(
    'accepts enum %s and an explicit payment instant',
    async (formaPagamento) => {
      expect(
        await validate(
          plainToInstance(CreateDespesaOperacionalDto, {
            ...payload,
            formaPagamento,
          }),
        ),
      ).toEqual([]);
    },
  );
});
