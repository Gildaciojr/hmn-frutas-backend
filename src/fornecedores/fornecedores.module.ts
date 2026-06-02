import { Module } from '@nestjs/common';

import { FornecedoresController } from './fornecedores.controller';

import { FornecedoresService } from './fornecedores.service';

import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [FornecedoresController],

  providers: [FornecedoresService, PrismaService],

  exports: [FornecedoresService],
})
export class FornecedoresModule {}
