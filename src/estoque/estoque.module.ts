import { Module } from '@nestjs/common';

import { EstoqueService } from './estoque.service';

import { EstoqueController } from './estoque.controller';

import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EstoqueController],

  providers: [EstoqueService, PrismaService],

  exports: [EstoqueService],
})
export class EstoqueModule {}
