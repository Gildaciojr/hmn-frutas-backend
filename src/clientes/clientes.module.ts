import { Module } from '@nestjs/common';

import { ClientesService } from './clientes.service';

import { ClientesController } from './clientes.controller';

import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ClientesController],

  providers: [ClientesService, PrismaService],

  exports: [ClientesService],
})
export class ClientesModule {}
