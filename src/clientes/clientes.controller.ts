import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Param,
  Patch,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';

import type { Request, Response } from 'express';
import type { JwtPayload } from '../auth/auth.service';

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

  @Get(':id/relatorio')
  @Header('Cache-Control', 'private, no-store')
  relatorioCompleto(@Param('id') id: string) {
    return this.service.relatorioCompleto(id);
  }

  @Get(':id/relatorio-pdf')
  async gerarPdfCliente(
    @Param('id') id: string,
    @Req() request: Request & { user: JwtPayload },
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.service.gerarPdfCliente(id, request.user.nome);
    response.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename=HMN-CLIENTE-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    response.end(buffer);
  }

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
