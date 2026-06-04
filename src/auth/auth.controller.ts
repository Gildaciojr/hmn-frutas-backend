import { Body, Controller, Post } from '@nestjs/common';

import { AuthService } from './auth.service';

import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  ////////////////////////////////////////////////////////////
  // LOGIN
  ////////////////////////////////////////////////////////////

  @Post('login')
  login(
    @Body()
    body: LoginDto,
  ) {
    return this.authService.login(body.login, body.senha);
  }
}
