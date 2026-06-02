import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { FornecedoresService } from './fornecedores.service';

import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';

import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';

@UseGuards(JwtAuthGuard)
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly service: FornecedoresService) {}

  ////////////////////////////////////////////////////////////
  // CREATE FORNECEDOR
  ////////////////////////////////////////////////////////////

  @Post()
  create(
    @Body()
    body: CreateFornecedorDto,
  ) {
    return this.service.create(body);
  }

  ////////////////////////////////////////////////////////////
  // UPDATE FORNECEDOR
  ////////////////////////////////////////////////////////////

  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    body: UpdateFornecedorDto,
  ) {
    return this.service.update(id, body);
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  @Get()
  findAll() {
    return this.service.findAll();
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
  // HISTÓRICO COMPLETO
  ////////////////////////////////////////////////////////////

  @Get(':id/historico')
  historicoCompleto(
    @Param('id')
    id: string,
  ) {
    return this.service.historicoCompleto(id);
  }

  ////////////////////////////////////////////////////////////
  // PDF FORNECEDOR
  ////////////////////////////////////////////////////////////

  @Get(':id/relatorio-pdf')
  async gerarPdfFornecedor(
    @Param('id')
    id: string,

    @Res()
    response: Response,
  ): Promise<void> {
    const pdfBuffer = await this.service.gerarPdfFornecedor(id);

    response.set({
      'Content-Type': 'application/pdf',

      'Content-Disposition': `inline; filename=HMN-FORNECEDOR-${id}.pdf`,

      'Content-Length': pdfBuffer.length,
    });

    response.end(pdfBuffer);
  }

  ////////////////////////////////////////////////////////////
  // CREATE FAZENDA
  ////////////////////////////////////////////////////////////

  @Post(':id/fazendas')
  createFazenda(
    @Param('id')
    fornecedorId: string,

    @Body()
    body: CreateFazendaDto,
  ) {
    return this.service.createFazenda(fornecedorId, body);
  }

  ////////////////////////////////////////////////////////////
  // LIST FAZENDAS
  ////////////////////////////////////////////////////////////

  @Get(':id/fazendas')
  fazendasFornecedor(
    @Param('id')
    fornecedorId: string,
  ) {
    return this.service.fazendasFornecedor(fornecedorId);
  }

  ////////////////////////////////////////////////////////////
  // UPDATE FAZENDA
  ////////////////////////////////////////////////////////////

  @Patch('fazendas/:id')
  updateFazenda(
    @Param('id')
    id: string,

    @Body()
    body: UpdateFazendaDto,
  ) {
    return this.service.updateFazenda(id, body);
  }
}
