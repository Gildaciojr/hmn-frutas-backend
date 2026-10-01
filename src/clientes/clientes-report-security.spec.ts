import { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import type {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import request from 'supertest';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { FornecedoresController } from '../fornecedores/fornecedores.controller';
import { FornecedoresService } from '../fornecedores/fornecedores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class LocalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.headers.authorization !== 'Bearer local-test') return false;
    Object.assign(req, { user: { sub: 'tester', nome: 'Auditor' } });
    return true;
  }
}
describe('Consolidated PDF security', () => {
  let app: INestApplication;
  const buffer = Buffer.from('%PDF-local-test');
  const clientePdf = jest.fn(() => Promise.resolve(buffer));
  const fornecedorPdf = jest.fn(() => Promise.resolve(buffer));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ClientesController, FornecedoresController],
      providers: [
        { provide: ClientesService, useValue: { gerarPdfCliente: clientePdf } },
        {
          provide: FornecedoresService,
          useValue: { gerarPdfFornecedor: fornecedorPdf },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(LocalAuthGuard)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('both PDF controllers retain JwtAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ClientesController)).toEqual([
      JwtAuthGuard,
    ]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, FornecedoresController),
    ).toEqual([JwtAuthGuard]);
  });
  it.each(['clientes', 'fornecedores'])(
    '%s denies unauthenticated PDF requests and marks authenticated responses private/no-store',
    async (route) => {
      const server: unknown = app.getHttpServer();
      if (!(server instanceof Server))
        throw new Error('Expected local HTTP server');
      await request(server).get(`/${route}/party/relatorio-pdf`).expect(403);
      const response = await request(server)
        .get(`/${route}/party/relatorio-pdf`)
        .set('Authorization', 'Bearer local-test')
        .expect(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-length']).toBe(String(buffer.length));
      expect(
        route === 'clientes' ? clientePdf : fornecedorPdf,
      ).toHaveBeenCalledWith('party', 'Auditor');
    },
  );
});
