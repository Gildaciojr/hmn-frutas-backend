import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { Query } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateDespesaOperacionalDto } from './dto/create-despesa-operacional.dto';

import { DespesasOperacionaisService } from './despesas-operacionais.service';

import { SearchDespesaOperacionalDto } from './dto/search-despesa-operacional.dto';

@UseGuards(JwtAuthGuard)
@Controller('despesas-operacionais')
export class DespesasOperacionaisController {
  constructor(private readonly service: DespesasOperacionaisService) {}

  ////////////////////////////////////////////////////////////
  // CREATE
  ////////////////////////////////////////////////////////////

  @Post()
  create(
    @Body()
    body: CreateDespesaOperacionalDto,
  ) {
    return this.service.create(body);
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  @Get()
  findAll() {
    return this.service.findAll();
  }

  ////////////////////////////////////////////////////////////
  // RESUMO
  ////////////////////////////////////////////////////////////

  @Get('resumo')
  resumo() {
    return this.service.resumo();
  }

  ////////////////////////////////////////////////////////////
  // SEARCH
  ////////////////////////////////////////////////////////////

  @Get('search')
  search(
    @Query()
    query: SearchDespesaOperacionalDto,
  ) {
    return this.service.search(query);
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
