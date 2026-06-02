import { Controller, Get, Param, Patch, Query } from '@nestjs/common';

import { AlertasService } from './alertas.service';

@Controller('alertas')
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  findAll(
    @Query('resolvido')
    resolvido?: string,

    @Query('lido')
    lido?: string,
  ) {
    return this.alertasService.findAll({
      resolvido: resolvido === undefined ? undefined : resolvido === 'true',

      lido: lido === undefined ? undefined : lido === 'true',
    });
  }

  @Patch(':id/lido')
  marcarComoLido(
    @Param('id')
    id: string,
  ) {
    return this.alertasService.marcarComoLido(id);
  }

  @Patch(':id/resolver')
  resolver(
    @Param('id')
    id: string,
  ) {
    return this.alertasService.resolver(id);
  }
}
