import { Module } from '@nestjs/common';
import { VendasService } from './vendas.service';
import { VendasController } from './vendas.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [VendasController],
  providers: [VendasService, PrismaService],
})
export class VendasModule {}
