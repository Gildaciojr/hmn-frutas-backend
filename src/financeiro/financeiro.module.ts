import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AlertasModule } from '../alertas/alertas.module';

import { FinanceiroController } from './financeiro.controller';

import { FinanceiroService } from './financeiro.service';

@Module({
  imports: [PrismaModule, AlertasModule],

  controllers: [FinanceiroController],

  providers: [FinanceiroService],

  exports: [FinanceiroService],
})
export class FinanceiroModule {}
