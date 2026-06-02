import { Module } from '@nestjs/common';

import { RomaneiosController } from './romaneios.controller';

import { RomaneiosService } from './romaneios.service';

import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [RomaneiosController],

  providers: [RomaneiosService, PrismaService],

  exports: [RomaneiosService],
})
export class RomaneiosModule {}
