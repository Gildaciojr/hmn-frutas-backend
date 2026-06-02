import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';

import { AuthController } from './auth.controller';

import { JwtStrategy } from './jwt.strategy';

import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    //////////////////////////////////////////////////////////
    // CONFIG
    //////////////////////////////////////////////////////////

    ConfigModule,

    //////////////////////////////////////////////////////////
    // USERS
    //////////////////////////////////////////////////////////

    UsersModule,

    //////////////////////////////////////////////////////////
    // JWT
    //////////////////////////////////////////////////////////

    JwtModule.registerAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET não definido no .env');
        }

        return {
          secret,

          signOptions: {
            expiresIn: '12h',
          },
        };
      },
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService, JwtStrategy],

  exports: [AuthService],
})
export class AuthModule {}
