import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ComprasService } from './compras.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import type { JwtPayload } from '../auth/auth.service';

import type { Request } from 'express';

import { CreateCompraDto } from './dto/create-compra.dto';

import { SearchCompraDto } from './dto/search-compra.dto';

import { UpdateCompraDto } from './dto/update-compra.dto';

@UseGuards(JwtAuthGuard)
@Controller('compras')
export class ComprasController {
  constructor(private readonly service: ComprasService) {}

  ////////////////////////////////////////////////////////////
  // CREATE
  ////////////////////////////////////////////////////////////

  @Post()
  create(
    @Body()
    body: CreateCompraDto,

    @Req()
    req: Request,
  ) {
    const usuario = req.user as JwtPayload;

    return this.service.create(body, {
      id: usuario.sub,
      nome: usuario.nome,
    });
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  @Get()
  findAll() {
    return this.service.findAll();
  }

  ////////////////////////////////////////////////////////////
  // SEARCH
  ////////////////////////////////////////////////////////////

  @Get('search')
  search(
    @Query()
    query: SearchCompraDto,
  ) {
    return this.service.search(query);
  }

  ////////////////////////////////////////////////////////////
  // FIND CLIENTE
  ////////////////////////////////////////////////////////////

  @Get('cliente/:id')
  findByCliente(
    @Param('id')
    id: string,
  ) {
    return this.service.findByCliente(id);
  }

  ////////////////////////////////////////////////////////////
  // FIND FORNECEDOR
  ////////////////////////////////////////////////////////////

  @Get('fornecedor/:id')
  findByFornecedor(
    @Param('id')
    id: string,
  ) {
    return this.service.findByFornecedor(id);
  }

  ////////////////////////////////////////////////////////////
  // ORIGEM VENDA POR PLACA
  ////////////////////////////////////////////////////////////

  @Get('origem')
  buscarOrigemPorPlaca(
    @Query('placa')
    placa: string,
  ) {
    return this.service.buscarOrigemPorPlaca(placa);
  }

  ////////////////////////////////////////////////////////////
  // UPDATE
  ////////////////////////////////////////////////////////////

  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    body: UpdateCompraDto,
  ) {
    return this.service.update(id, body);
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
