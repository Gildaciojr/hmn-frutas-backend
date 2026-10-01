import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchCompraDto } from './search-compra.dto';

describe('SearchCompraDto report filters', () => {
  it('accepts UUIDs with combined filters and numeric pagination', async () => {
    const dto = plainToInstance(SearchCompraDto, {
      fornecedorId: '123e4567-e89b-42d3-a456-426614174000',
      fazendaId: '123e4567-e89b-42d3-a456-426614174001',
      fornecedor: 'Fornecedor',
      fazenda: 'Fazenda',
      placa: 'ABC1D23',
      numeroFolha: '123',
      status: 'FECHADA',
      dataInicio: '2026-10-01',
      dataFim: '2026-10-31',
      page: '2',
      pageSize: '25',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    expect(dto.page).toBe(2);
  });

  it.each(['fornecedorId', 'fazendaId'])(
    'rejects invalid %s',
    async (field) => {
      const errors = await validate(
        plainToInstance(SearchCompraDto, { [field]: 'invalid' }),
      );
      expect(errors.map((error) => error.property)).toContain(field);
    },
  );

  it.each([
    { page: 0 },
    { pageSize: 101 },
    { page: 1.5 },
    { status: 'INVALID' },
  ])('rejects invalid pagination/status %j', async (filters) => {
    expect(
      (await validate(plainToInstance(SearchCompraDto, filters))).length,
    ).toBeGreaterThan(0);
  });
});
