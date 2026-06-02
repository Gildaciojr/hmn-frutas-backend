import { Injectable, UnauthorizedException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET não definido no .env');
    }

    super({
      ////////////////////////////////////////////////////////
      // TOKEN
      ////////////////////////////////////////////////////////

      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ////////////////////////////////////////////////////////
      // SECRET
      ////////////////////////////////////////////////////////

      secretOrKey: secret,

      ////////////////////////////////////////////////////////
      // EXPIRAÇÃO
      ////////////////////////////////////////////////////////

      ignoreExpiration: false,
    });
  }

  ////////////////////////////////////////////////////////////
  // VALIDATE
  ////////////////////////////////////////////////////////////

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub) {
      throw new UnauthorizedException('Token inválido');
    }

    return payload;
  }
}
