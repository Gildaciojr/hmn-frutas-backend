import { BadRequestException } from '@nestjs/common';

// Only operational civil dates. Never use these helpers for payment/audit instants.
export function parseOperationalDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Informe a data operacional como YYYY-MM-DD');
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1000 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException('Data operacional inválida');
  }
  return date;
}

export function getOperationalDateRange(
  start?: string,
  end?: string,
): { gte?: Date; lt?: Date } {
  const gte = start ? parseOperationalDate(start) : undefined;
  const finalDay = end ? parseOperationalDate(end) : undefined;
  if (gte && finalDay && gte > finalDay) {
    throw new BadRequestException(
      'A data inicial deve ser anterior à data final',
    );
  }
  const lt = finalDay ? new Date(finalDay.getTime()) : undefined;
  if (lt) lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

export function getBusinessTodayYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((item) => item.type === name)?.value;
    if (!value) throw new Error('Calendário de São Paulo indisponível');
    return value;
  };
  return `${part('year')}-${part('month')}-${part('day')}`;
}
