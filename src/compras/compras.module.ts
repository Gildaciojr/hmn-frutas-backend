import { Module } from '@nestjs/common';

import { ComprasService } from './compras.service';

import { ComprasController } from './compras.controller';

import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ComprasController],

  providers: [ComprasService, PrismaService],

  exports: [ComprasService],
})
export class ComprasModule {}
