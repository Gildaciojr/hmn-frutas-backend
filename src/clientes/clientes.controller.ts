import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { ClientesService } from './clientes.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateClienteDto } from './dto/create-cliente.dto';

import { UpdateClienteDto } from './dto/update-cliente.dto';

@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  ////////////////////////////////////////////////////////////
  // CREATE
  ////////////////////////////////////////////////////////////

  @Post()
  create(
    @Body()
    body: CreateClienteDto,
  ) {
    return this.service.create(body);
  }

  ////////////////////////////////////////////////////////////
  // UPDATE
  ////////////////////////////////////////////////////////////

  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    body: UpdateClienteDto,
  ) {
    return this.service.update(id, body);
  }

  ////////////////////////////////////////////////////////////
  // RESUMO LISTA
  ////////////////////////////////////////////////////////////

  @Get('resumo')
  resumoLista() {
    return this.service.resumoLista();
  }

  ////////////////////////////////////////////////////////////
  // HISTÓRICO FINANCEIRO
  ////////////////////////////////////////////////////////////

  @Get(':id/historico')
  historicoCompleto(
    @Param('id')
    id: string,
  ) {
    return this.service.historicoCompleto(id);
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  @Get()
  findAll() {
    return this.service.findAll();
  }

  ////////////////////////////////////////////////////////////
  // RESUMO COMPLETO
  ////////////////////////////////////////////////////////////

  @Get(':id/resumo')
  resumoCompleto(
    @Param('id')
    id: string,
  ) {
    return this.service.resumoCompleto(id);
  }

  ////////////////////////////////////////////////////////////
  // FIND ONE
  ////////////////////////////////////////////////////////////

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.service.findOne(id);
  }
}
