import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Prisma, StatusCompra, StatusVenda } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroController } from './financeiro.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { gerarRelatorioProducaoPdf } from './templates/producao-relatorio.template';

jest.mock('./templates/producao-relatorio.template', () => ({
  gerarRelatorioProducaoPdf: jest.fn(() =>
    Promise.resolve(Buffer.from('%PDF-local-test')),
  ),
}));

describe('production report JSON/PDF single source', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000';
  const otherId = '123e4567-e89b-42d3-a456-426614174001';
  const date = new Date('2026-10-01T00:00:00Z');
  const compras = [
    {
      id: 'c1',
      dataCompra: date,
      kgLiquido: 100.125,
      valorTotal: new Prisma.Decimal('150.10'),
      status: StatusCompra.FECHADA,
      usuarioResponsavelId: userId,
      usuarioResponsavelNome: 'Ana',
      fornecedor: { nome: 'Produtor' },
    },
    {
      id: 'cancelled-buy',
      dataCompra: date,
      kgLiquido: 999,
      valorTotal: new Prisma.Decimal(999),
      status: StatusCompra.CANCELADA,
      usuarioResponsavelId: userId,
      usuarioResponsavelNome: 'Ana',
      fornecedor: null,
    },
  ];
  const vendas = Array.from({ length: 206 }, (_, i) => ({
    id: `v${i}`,
    dataVenda: date,
    pesoLiquido: 1.25,
    valorTotal: new Prisma.Decimal('0.10'),
    status: i === 205 ? StatusVenda.CANCELADA : StatusVenda.ABERTA,
    usuarioResponsavelId: i === 204 ? otherId : userId,
    usuarioResponsavelNome: i === 204 ? 'Bia' : 'Ana',
    cliente: { nome: 'Cliente' },
  }));
  const compraFind = jest.fn((args: Prisma.CompraFindManyArgs) =>
    Promise.resolve(
      compras.filter(
        (item) =>
          item.status !== StatusCompra.CANCELADA &&
          (!args.where?.usuarioResponsavelId ||
            item.usuarioResponsavelId === args.where.usuarioResponsavelId),
      ),
    ),
  );
  const vendaFind = jest.fn((args: Prisma.VendaFindManyArgs) =>
    Promise.resolve(
      vendas.filter(
        (item) =>
          item.status !== StatusVenda.CANCELADA &&
          (!args.where?.usuarioResponsavelId ||
            item.usuarioResponsavelId === args.where.usuarioResponsavelId),
      ),
    ),
  );
  const options = [
    { usuarioResponsavelId: userId, usuarioResponsavelNome: 'Ana' },
    { usuarioResponsavelId: otherId, usuarioResponsavelNome: 'Bia' },
  ];
  const prisma = {
    compra: {
      findMany: compraFind,
      groupBy: jest.fn(() => Promise.resolve(options)),
    },
    venda: {
      findMany: vendaFind,
      groupBy: jest.fn(() => Promise.resolve(options)),
    },
  };
  let service: FinanceiroService;
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceiroController],
      providers: [
        FinanceiroService,
        { provide: PrismaService, useValue: prisma },
        { provide: AlertasService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    service = module.get(FinanceiroService);
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    app.setGlobalPrefix('api');
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { sub: userId, nome: 'Emissor de teste' };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns all 205 sales, excludes cancelled, and keeps separate exact totals', async () => {
    const data = await service.obterDadosRelatorioProducao({
      dataInicial: '2026-10-01',
      dataFinal: '2026-10-01',
      tipo: 'AMBOS',
    });
    expect(data.vendas).toHaveLength(205);
    expect(data.compras).toHaveLength(1);
    expect(data.totais).toEqual({
      compras: 1,
      vendas: 205,
      kgComprado: 100.125,
      kgVendido: 256.25,
      valorComprado: 150.1,
      valorVendido: 20.5,
    });
    expect(compraFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dataCompra: { gte: date, lt: new Date('2026-10-02T00:00:00Z') },
          status: { not: 'CANCELADA' },
        },
      }),
    );
    expect(vendaFind.mock.calls[0]?.[0].take).toBeUndefined();
    expect(
      data.producaoPorUsuario.reduce((n, row) => n + row.quantidadeVendas, 0),
    ).toBe(205);
  });

  it('filters by UUID without removing other available user options', async () => {
    const data = await service.obterDadosRelatorioProducao({
      dataInicial: '2026-10-01',
      dataFinal: '2026-10-01',
      usuarioId: otherId,
    });
    expect(data.totais.vendas).toBe(1);
    expect(data.totais.compras).toBe(0);
    expect(data.usuariosDisponiveis).toEqual([
      { id: userId, nome: 'Ana' },
      { id: otherId, nome: 'Bia' },
    ]);
  });

  it.each(['COMPRAS', 'VENDAS', 'AMBOS'] as const)(
    'JSON and PDF apply identical %s filters and totals',
    async (tipo) => {
      const params = {
        dataInicial: '2026-10-01',
        dataFinal: '2026-10-01',
        tipo,
        usuarioId: userId,
      };
      const json = await request(app.getHttpServer())
        .get('/api/financeiro/producao')
        .query(params)
        .expect(200);
      const pdf = await request(app.getHttpServer())
        .get('/api/financeiro/producao/pdf')
        .query(params)
        .expect(200);
      expect(pdf.headers['cache-control']).toBe('private, no-store');
      const passedToPdf = jest.mocked(gerarRelatorioProducaoPdf).mock
        .calls[0]?.[0];
      const comparable: unknown = JSON.parse(JSON.stringify(passedToPdf));
      expect(json.body.data).toEqual(comparable);
      if (tipo === 'COMPRAS') expect(json.body.data.vendas).toHaveLength(0);
      if (tipo === 'VENDAS') expect(json.body.data.compras).toHaveLength(0);
    },
  );

  it('rejects invalid type/UUID/inverted dates before querying', async () => {
    const base = { dataInicial: '2026-10-01', dataFinal: '2026-10-01' };
    await request(app.getHttpServer())
      .get('/api/financeiro/producao')
      .query({ ...base, tipo: 'OTHER' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/financeiro/producao')
      .query({ ...base, usuarioId: 'Ana' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/financeiro/producao')
      .query({ ...base, dataFinal: '2026-09-30' })
      .expect(400);
    expect(compraFind).not.toHaveBeenCalled();
    expect(vendaFind).not.toHaveBeenCalled();
  });
});
