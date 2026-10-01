import {
  getBusinessTodayYmd,
  getOperationalDateRange,
  parseOperationalDate,
} from './report-period';

describe('operational civil dates', () => {
  it('preserves 01/10 without shifting it to September', () => {
    expect(parseOperationalDate('2026-10-01').toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it.each([
    ['2026-10-01', '2026-10-02'],
    ['2026-10-31', '2026-11-01'],
    ['2026-12-31', '2027-01-01'],
    ['2028-02-29', '2028-03-01'],
  ])('uses the exclusive next day for %s', (day, next) => {
    const range = getOperationalDateRange(day, day);
    expect(range.gte?.toISOString()).toBe(`${day}T00:00:00.000Z`);
    expect(range.lt?.toISOString()).toBe(`${next}T00:00:00.000Z`);
    const lastMillisecond = new Date(`${day}T23:59:59.999Z`);
    expect(lastMillisecond.getTime()).toBeLessThan(range.lt!.getTime());
    expect(new Date(`${next}T00:00:00.000Z`).getTime()).toBe(
      range.lt!.getTime(),
    );
  });

  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '01/10/2026', ''])(
    'rejects invalid civil date %s',
    (date) => expect(() => parseOperationalDate(date)).toThrow(),
  );

  it('rejects an inverted interval and accepts open boundaries', () => {
    expect(() => getOperationalDateRange('2026-10-02', '2026-10-01')).toThrow();
    expect(
      getOperationalDateRange(undefined, '2026-10-01').gte,
    ).toBeUndefined();
    expect(getOperationalDateRange('2026-10-01').lt).toBeUndefined();
  });

  it('finds today in São Paulo independently of UTC date', () => {
    expect(getBusinessTodayYmd(new Date('2026-10-02T01:00:00Z'))).toBe(
      '2026-10-01',
    );
    expect(getBusinessTodayYmd(new Date('2027-01-01T02:00:00Z'))).toBe(
      '2026-12-31',
    );
  });
});
