import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { BadRequestException } from '@nestjs/common';
import { Prisma, StatusPagamento, StatusVenda } from '@prisma/client';
import { VendasService } from './vendas.service';
import { VendasController } from './vendas.controller';
import { SearchVendaDto } from './dto/search-venda.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const rows = [
  {
    id: 'newer',
    pesoLiquido: 10,
    valorPorKg: new Prisma.Decimal(2),
    valorMelancia: new Prisma.Decimal(20),
    valorTotal: new Prisma.Decimal(15),
  },
  {
    id: 'older',
    pesoLiquido: 30,
    valorPorKg: new Prisma.Decimal(4),
    valorMelancia: new Prisma.Decimal(120),
    valorTotal: new Prisma.Decimal(90),
  },
];
const totals = {
  _count: { _all: 2 },
  _sum: {
    pesoLiquido: 40,
    valorMelancia: new Prisma.Decimal(900),
    valorTotal: new Prisma.Decimal(105),
  },
};
describe('VendasService.search analytical report', () => {
  const findMany = jest.fn((args: Prisma.VendaFindManyArgs) =>
    Promise.resolve(
      rows.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.length)),
    ),
  );
  const aggregate = jest.fn((args: Prisma.VendaAggregateArgs) => {
    expect(args).not.toHaveProperty('include');
    return Promise.resolve(totals);
  });
  const groupBy = jest.fn((args: Prisma.VendaGroupByArgs) => {
    expect(args.by).toEqual(['valorPorKg']);
    return Promise.resolve([
      { valorPorKg: new Prisma.Decimal(2), _sum: { pesoLiquido: 10 } },
      { valorPorKg: new Prisma.Decimal(4), _sum: { pesoLiquido: 30 } },
    ]);
  });
  const tx = { venda: { findMany, aggregate, groupBy } };
  const transaction = jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
    run(tx),
  );
  let service: VendasService;
  beforeEach(async () => {
    jest.clearAllMocks();
    aggregate.mockResolvedValue(totals);
    const module = await Test.createTestingModule({
      providers: [
        VendasService,
        { provide: PrismaService, useValue: { $transaction: transaction } },
      ],
    }).compile();
    service = module.get(VendasService);
  });
  it('prioritizes client ID and combines identification, payment status and operational period', async () => {
    await service.search({
      clienteId: 'client-id',
      cliente: 'Ignored',
      placa: ' ABC ',
      numeroPedido: ' 12 ',
      numeroRomaneio: ' 34 ',
      status: StatusVenda.ENTREGUE,
      statusPagamento: StatusPagamento.PARCIAL,
      dataInicio: '2026-10-01',
      dataFim: '2026-10-02',
    });
    expect(findMany.mock.calls[0][0].where).toEqual({
      clienteId: 'client-id',
      placa: { contains: 'ABC', mode: 'insensitive' },
      numeroPedido: { contains: '12', mode: 'insensitive' },
      numeroRomaneio: { contains: '34', mode: 'insensitive' },
      status: 'ENTREGUE',
      statusPagamento: 'PARCIAL',
      dataVenda: {
        gte: new Date('2026-10-01T00:00:00Z'),
        lt: new Date('2026-10-03T00:00:00Z'),
      },
    });
    expect(aggregate.mock.calls[0][0].where).toBe(
      findMany.mock.calls[0][0].where,
    );
  });
  it('matches registered names and snapshots without substituting client history', async () => {
    await service.search({ cliente: ' Cliente ' });
    expect(findMany.mock.calls[0][0].where).toEqual({
      status: { not: 'CANCELADA' },
      OR: [
        { cliente: { nome: { contains: 'Cliente', mode: 'insensitive' } } },
        { clienteNomeSnapshot: { contains: 'Cliente', mode: 'insensitive' } },
      ],
    });
  });
  it.each(Object.values(StatusVenda))(
    'uses explicit operational status %s for items and summary',
    async (status) => {
      await service.search({ status });
      expect(findMany.mock.calls[0][0].where).toEqual({ status });
      expect(aggregate.mock.calls[0][0].where).toEqual({ status });
    },
  );
  it.each(Object.values(StatusPagamento))(
    'supports payment status %s',
    async (statusPagamento) => {
      await service.search({ statusPagamento });
      expect(findMany.mock.calls[0][0].where).toEqual({
        status: { not: 'CANCELADA' },
        statusPagamento,
      });
    },
  );
  it('returns the official complete summary independently of the current page', async () => {
    const result = await service.search({ page: 2, pageSize: 1 });
    expect(result.items.map((row) => row.id)).toEqual(['older']);
    expect(result.summary).toEqual({
      operacoes: 2,
      kgLiquidoVendido: 40,
      valorLiquidoVendido: 105,
      precoComercialMedioKg: 3.5,
      ticketMedioLiquido: 52.5,
    });
    expect(result.pagination).toEqual({
      total: 2,
      page: 2,
      pageSize: 1,
      totalPages: 2,
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0]).toMatchObject({
      skip: 1,
      take: 1,
      orderBy: [{ dataVenda: 'desc' }, { id: 'desc' }],
    });
    expect(aggregate.mock.calls[0][0]).toEqual({
      where: { status: { not: 'CANCELADA' } },
      _count: { _all: true },
      _sum: { pesoLiquido: true, valorTotal: true },
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });
  it('defaults to paginated data and never fetches every detailed row for summary', async () => {
    const result = await service.search({});
    expect(result.pagination).toEqual({
      total: 2,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    expect(findMany.mock.calls[0][0]).toMatchObject({
      take: 25,
      skip: 0,
      select: {
        pesoLiquido: true,
        valorMelancia: true,
        valorTotal: true,
        cliente: { select: { id: true, nome: true } },
      },
    });
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('include');
  });
  it('handles empty and zero-weight results without NaN', async () => {
    aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: {
        pesoLiquido: 0,
        valorMelancia: new Prisma.Decimal(0),
        valorTotal: new Prisma.Decimal(0),
      },
    });
    expect((await service.search({})).summary).toEqual({
      operacoes: 0,
      kgLiquidoVendido: 0,
      valorLiquidoVendido: 0,
      precoComercialMedioKg: 0,
      ticketMedioLiquido: 0,
    });
  });
  it.each([
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { pageSize: 0 },
    { pageSize: 101 },
    { pageSize: 1.5 },
    { page: Number.MAX_SAFE_INTEGER, pageSize: 100 },
    { dataInicio: '2026-10-02', dataFim: '2026-10-01' },
    { dataInicio: '2026-02-30' },
  ])(
    'rejects invalid pagination or periods before querying: %j',
    async (filters) => {
      await expect(service.search(filters)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});
describe('SearchVendaDto and route', () => {
  it.each([
    { page: '0' },
    { page: '1.5' },
    { page: 'bad' },
    { pageSize: '101' },
    { pageSize: '0' },
    { clienteId: 'invalid' },
    { status: 'invalid' },
    { statusPagamento: 'invalid' },
    { dataInicio: '2026-02-30' },
  ])('rejects invalid HTTP filters: %j', async (filters) => {
    expect(
      (await validate(plainToInstance(SearchVendaDto, filters))).length,
    ).toBeGreaterThan(0);
  });
  it('transforms valid query strings and accepts existing enums', async () => {
    const dto = plainToInstance(SearchVendaDto, {
      page: '2',
      pageSize: '100',
      status: 'CANCELADA',
      statusPagamento: 'PAGO',
      clienteId: '11111111-1111-4111-8111-111111111111',
      dataInicio: '2026-10-01',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(100);
  });
  it('registers search before the ID route and inherits the JWT guard', () => {
    const methods = Object.getOwnPropertyNames(VendasController.prototype);
    expect(methods.indexOf('search')).toBeLessThan(methods.indexOf('findOne'));
    const handler: unknown = Object.getOwnPropertyDescriptor(
      VendasController.prototype,
      'search',
    )?.value;
    if (typeof handler !== 'function')
      throw new Error('Search handler missing');
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('search');
    expect(Reflect.getMetadata(GUARDS_METADATA, VendasController)).toEqual([
      JwtAuthGuard,
    ]);
  });
});
