import { Test } from '@nestjs/testing';
import { Prisma, StatusCompra } from '@prisma/client';
import { ComprasService } from './compras.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ComprasService.search official report', () => {
  const metrics = [
    {
      kgLiquido: 10,
      precoKg: new Prisma.Decimal(2),
      valorTotal: new Prisma.Decimal(15),
    },
    {
      kgLiquido: 30,
      precoKg: new Prisma.Decimal(4),
      valorTotal: new Prisma.Decimal(90),
    },
  ];
  const findMany = jest.fn((args: Prisma.CompraFindManyArgs) =>
    Promise.resolve(args.select ? metrics : [{ id: 'one-visible-row' }]),
  );
  const prisma = {
    compra: { findMany },
    $transaction: jest.fn(
      (
        run: (tx: {
          compra: { findMany: typeof findMany };
        }) => Promise<unknown>,
      ) => run({ compra: { findMany } }),
    ),
  };
  let service: ComprasService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ComprasService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ComprasService);
  });

  it('prioritizes IDs and combines all filters with a civil-date range', async () => {
    await service.search({
      fornecedorId: 'supplier-id',
      fornecedor: 'Ignored',
      fazendaId: 'farm-id',
      fazenda: 'Ignored',
      placa: 'ABC',
      numeroFolha: '12',
      status: StatusCompra.FECHADA,
      dataInicio: '2026-10-01',
      dataFim: '2026-10-01',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fornecedorId: 'supplier-id',
          fazendaFornecedorId: 'farm-id',
          placa: { contains: 'ABC' },
          numeroFolha: { contains: '12' },
          status: 'FECHADA',
          dataCompra: {
            gte: new Date('2026-10-01T00:00:00Z'),
            lt: new Date('2026-10-02T00:00:00Z'),
          },
        },
        orderBy: [{ dataCompra: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('supports supplier/farm names independently and excludes cancelled by default', async () => {
    await service.search({ fornecedor: 'Produtor', fazenda: 'Sítio' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fornecedor: { nome: { contains: 'Produtor' } },
          fazendaFornecedor: { nome: { contains: 'Sítio' } },
          status: { not: StatusCompra.CANCELADA },
        },
      }),
    );
    await service.search({ fazendaId: 'farm-only' });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          fazendaFornecedorId: 'farm-only',
          status: { not: StatusCompra.CANCELADA },
        },
      }),
    );
  });

  it.each([StatusCompra.CANCELADA, StatusCompra.ABERTA, StatusCompra.FECHADA])(
    'respects explicit status %s',
    async (status) => {
      await service.search({ status });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status } }),
      );
    },
  );

  it('summarizes every matching operation, not the visible page or net price/kg', async () => {
    const report = await service.search({ page: 2, pageSize: 1 });
    if (Array.isArray(report)) throw new Error('Expected paginated report');
    expect(report.items).toHaveLength(1);
    expect(report.summary).toEqual({
      operacoes: 2,
      kgLiquido: 40,
      valorLiquido: 105,
      precoComercialMedioKg: 3.5,
      ticketMedioLiquido: 52.5,
    });
    expect(report.pagination).toEqual({
      total: 2,
      page: 2,
      pageSize: 1,
      totalPages: 2,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, take: 1 }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  it('preserves the legacy array response and rejects inverted dates before querying', async () => {
    expect(Array.isArray(await service.search({}))).toBe(true);
    findMany.mockClear();
    await expect(
      service.search({ dataInicio: '2026-10-02', dataFim: '2026-10-01' }),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
});
