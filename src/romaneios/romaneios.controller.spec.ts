import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtStrategy } from '../auth/jwt.strategy';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { RomaneiosController } from './romaneios.controller';
import { RomaneiosService } from './romaneios.service';

describe('RomaneiosController HTTP authentication and PDF responses', () => {
  const secret = 'romaneios-controller-test-secret';
  const jwt = new JwtService({ secret });
  const pdf = Buffer.from('%PDF-1.4\n%%EOF');
  const vendaPdf = jest.fn<Promise<Buffer>, [string]>(() =>
    Promise.resolve(pdf),
  );
  const compraPdf = jest.fn<Promise<Buffer>, [string]>(() =>
    Promise.resolve(pdf),
  );
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [RomaneiosController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: secret }),
        },
        {
          provide: RomaneiosService,
          useValue: { gerarPdfVenda: vendaPdf, gerarPdfCompra: compraPdf },
        },
      ],
    }).compile();

    app = module.createNestApplication<INestApplication<App>>();
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(['venda', 'compra'])(
    'rejects anonymous access to %s without generating a PDF',
    async (contexto) => {
      await request(app.getHttpServer())
        .get(`/api/romaneios/${contexto}/operation-id/pdf`)
        .expect(401);
      expect(vendaPdf).not.toHaveBeenCalled();
      expect(compraPdf).not.toHaveBeenCalled();
    },
  );

  it.each(['venda', 'compra'])(
    'rejects invalid and expired JWTs for %s',
    async (contexto) => {
      for (const token of [
        'invalid-token',
        jwt.sign({ sub: 'operator-id' }, { expiresIn: -1 }),
      ]) {
        await request(app.getHttpServer())
          .get(`/api/romaneios/${contexto}/operation-id/pdf`)
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }
      expect(vendaPdf).not.toHaveBeenCalled();
      expect(compraPdf).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['venda', 'HMN-PEDIDO-VENDA-operation-id.pdf'],
    ['compra', 'HMN-ROMANEIO-COMPRA-operation-id.pdf'],
  ])(
    'preserves binary PDF, filename and route for authenticated %s',
    async (contexto, filename) => {
      const token = jwt.sign({ sub: 'operator-id', nome: 'Operador' });
      const response = await request(app.getHttpServer())
        .get(`/api/romaneios/${contexto}/operation-id/pdf`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .expect('Cache-Control', 'private, no-store')
        .expect('Content-Disposition', `inline; filename=${filename}`)
        .expect('Content-Length', String(pdf.length));

      const body: unknown = response.body;
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(body).toEqual(pdf);
      expect(contexto === 'venda' ? vendaPdf : compraPdf).toHaveBeenCalledWith(
        'operation-id',
      );
      expect(
        contexto === 'venda' ? compraPdf : vendaPdf,
      ).not.toHaveBeenCalled();
    },
  );
});
