import { Injectable, UnauthorizedException } from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';

import { Role } from '@prisma/client';

import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;

  email: string;

  role: Role;

  nome: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,

    private jwtService: JwtService,
  ) {}

  ////////////////////////////////////////////////////////////
  // LOGIN
  ////////////////////////////////////////////////////////////

  async login(login: string, senha: string) {
    //////////////////////////////////////////////////////////
    // USER
    //////////////////////////////////////////////////////////

    const user = await this.usersService.findByLogin(login);

    //////////////////////////////////////////////////////////
    // SECURITY
    //////////////////////////////////////////////////////////

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);

    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    //////////////////////////////////////////////////////////
    // PAYLOAD
    //////////////////////////////////////////////////////////

    const payload: JwtPayload = {
      sub: user.id,

      email: user.email,

      role: user.role,

      nome: user.nome,
    };

    //////////////////////////////////////////////////////////
    // TOKEN
    //////////////////////////////////////////////////////////

    const accessToken = this.jwtService.sign(payload);

    //////////////////////////////////////////////////////////
    // RESPONSE
    //////////////////////////////////////////////////////////

    return {
      access_token: accessToken,

      user: {
        id: user.id,

        nome: user.nome,

        sobrenome: user.sobrenome,

        email: user.email,

        telefone: user.telefone,

        endereco: user.endereco,

        role: user.role,
      },
    };
  }
}
