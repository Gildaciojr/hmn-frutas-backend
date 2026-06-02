import { Controller, Get, UseGuards } from '@nestjs/common';

import { EstoqueService } from './estoque.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly service: EstoqueService) {}

  ////////////////////////////////////////////////////////////
  // RESUMO
  ////////////////////////////////////////////////////////////

  @Get('resumo')
  getResumo() {
    return this.service.getResumoEstoque();
  }

  ////////////////////////////////////////////////////////////
  // MOVIMENTAÇÃO
  ////////////////////////////////////////////////////////////

  @Get('movimentacoes')
  movimentacoes() {
    return this.service.movimentacoes();
  }

  ////////////////////////////////////////////////////////////
  // HISTÓRICO
  ////////////////////////////////////////////////////////////

  @Get('historico')
  historico() {
    return this.service.historicoCompleto();
  }
}
