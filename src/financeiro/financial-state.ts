import { ConflictException } from '@nestjs/common';
import {
  Prisma,
  StatusFinanceiro,
  StatusPagamento,
  TipoTransacao,
} from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { Transacao } from '@prisma/client';
import {
  getBusinessTodayYmd,
  parseOperationalDate,
} from '../common/utils/report-period';

export const openFinancialStatuses: StatusFinanceiro[] = [
  StatusFinanceiro.PENDENTE,
  StatusFinanceiro.PARCIAL,
];
export const financialDueOrder: Prisma.TransacaoOrderByWithRelationInput[] = [
  { vencimento: { sort: 'asc', nulls: 'last' } },
  { createdAt: 'asc' },
  { id: 'asc' },
];

export function financialProjection(
  valor: Prisma.Decimal,
  pago: Prisma.Decimal,
) {
  return {
    valorPago: pago,
    valorRestante: Prisma.Decimal.max(valor.minus(pago), 0),
    statusFinanceiro: pago.isZero()
      ? StatusFinanceiro.PENDENTE
      : pago.lt(valor)
        ? StatusFinanceiro.PARCIAL
        : StatusFinanceiro.PAGO,
  };
}

export function assertFinancialConsistency(
  transacao: Transacao,
  pago: Prisma.Decimal,
) {
  const expected = financialProjection(transacao.valor, pago);
  if (
    pago.lt(0) ||
    pago.gt(transacao.valor) ||
    !pago.eq(transacao.valorPago ?? 0) ||
    !expected.valorRestante.eq(transacao.valorRestante ?? 0) ||
    expected.statusFinanceiro !== transacao.statusFinanceiro
  ) {
    throw new ConflictException(
      'Inconsistência entre título e eventos de pagamento. Nova mutação bloqueada.',
    );
  }
  return expected;
}

export function paymentStatus(status: StatusFinanceiro): StatusPagamento {
  return status === StatusFinanceiro.PAGO
    ? StatusPagamento.PAGO
    : status === StatusFinanceiro.PARCIAL
      ? StatusPagamento.PARCIAL
      : StatusPagamento.PENDENTE;
}

export async function serializableTransaction<T>(
  prisma: Pick<PrismaService, '$transaction'>,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034'
      )
        throw error;
      if (attempt === 2)
        throw new ConflictException('Conflito concorrente. Tente novamente.');
    }
  }
}

export function isOverdue(vencimento: Date | null, now = new Date()): boolean {
  return (
    vencimento !== null &&
    vencimento.getTime() <
      parseOperationalDate(getBusinessTodayYmd(now)).getTime()
  );
}

export function summarizeTitles(
  titles: (Transacao & {
    pagamentos: { valor: Prisma.Decimal; pagoEm: Date }[];
  })[],
  direction: TipoTransacao,
  now = new Date(),
) {
  let realizado = new Prisma.Decimal(0);
  let aberto = new Prisma.Decimal(0);
  let vencido = new Prisma.Decimal(0);
  let parcial = new Prisma.Decimal(0);
  let ultimoPagamento: Date | null = null;
  for (const title of titles) {
    if (title.tipo !== direction) continue;
    for (const event of title.pagamentos) {
      realizado = realizado.add(event.valor);
      if (!ultimoPagamento || event.pagoEm > ultimoPagamento)
        ultimoPagamento = event.pagoEm;
    }
    if (
      !openFinancialStatuses.includes(title.statusFinanceiro) ||
      !new Prisma.Decimal(title.valorRestante ?? 0).gt(0)
    )
      continue;
    aberto = aberto.add(title.valorRestante ?? 0);
    if (isOverdue(title.vencimento, now))
      vencido = vencido.add(title.valorRestante ?? 0);
    if (title.statusFinanceiro === StatusFinanceiro.PARCIAL)
      parcial = parcial.add(title.valorRestante ?? 0);
  }
  return {
    realizado: realizado.toNumber(),
    aberto: aberto.toNumber(),
    vencido: vencido.toNumber(),
    parcial: parcial.toNumber(),
    ultimoPagamento,
  };
}
