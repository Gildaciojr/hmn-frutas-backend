import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { DespesasOperacionaisService } from './despesas-operacionais.service';

import { DespesasOperacionaisController } from './despesas-operacionais.controller';

@Module({
  controllers: [DespesasOperacionaisController],

  providers: [DespesasOperacionaisService, PrismaService],

  exports: [DespesasOperacionaisService],
})
export class DespesasOperacionaisModule {}
