import { Module } from '@nestjs/common';

import { UsersService } from './users.service';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    // 🔥 Prisma necessário para UsersService
    PrismaModule,
  ],

  providers: [UsersService],

  // 🔥 AuthModule consome UsersService
  exports: [UsersService],
})
export class UsersModule {}
