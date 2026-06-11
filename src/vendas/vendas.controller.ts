import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import type { JwtPayload } from '../auth/auth.service';

import type { Request } from 'express';

import { VendasService } from './vendas.service';

import { CreateVendaDto } from './dto/create-venda.dto';

import { UpdateVendaDto } from './dto/update-venda.dto';

@UseGuards(JwtAuthGuard)
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  ////////////////////////////////////////////////////////////
  // CREATE
  ////////////////////////////////////////////////////////////

  @Post()
  create(
    @Body()
    data: CreateVendaDto,

    @Req()
    req: Request,
  ) {
    const usuario = req.user as JwtPayload;

    return this.vendasService.create(data, {
      id: usuario.sub,
      nome: usuario.nome,
    });
  }

  ////////////////////////////////////////////////////////////
  // LIST
  ////////////////////////////////////////////////////////////

  @Get()
  findAll() {
    return this.vendasService.findAll();
  }

  ////////////////////////////////////////////////////////////
  // FIND BY CLIENTE
  ////////////////////////////////////////////////////////////

  @Get('cliente/:id')
  findByCliente(
    @Param('id')
    id: string,
  ) {
    return this.vendasService.findByCliente(id);
  }

  ////////////////////////////////////////////////////////////
  // FIND PEDIDO
  ////////////////////////////////////////////////////////////

  @Get('pedido/:numero')
  findByPedido(
    @Param('numero')
    numero: string,
  ) {
    return this.vendasService.findByPedido(numero);
  }

  ////////////////////////////////////////////////////////////
  // FIND ROMANEIO
  ////////////////////////////////////////////////////////////

  @Get('romaneio/:numero')
  findByRomaneio(
    @Param('numero')
    numero: string,
  ) {
    return this.vendasService.findByRomaneio(numero);
  }

  ////////////////////////////////////////////////////////////
  // UPDATE
  ////////////////////////////////////////////////////////////

  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    body: UpdateVendaDto,
  ) {
    return this.vendasService.update(id, body);
  }

  ////////////////////////////////////////////////////////////
  // FIND ONE
  ////////////////////////////////////////////////////////////

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.vendasService.findOne(id);
  }

  ////////////////////////////////////////////////////////////
  // STATUS PAGAMENTO
  ////////////////////////////////////////////////////////////

  @Patch(':id/pagamento')
  atualizarPagamento(
    @Param('id')
    id: string,

    @Body()
    body: {
      statusPagamento: 'PAGO' | 'PENDENTE' | 'PARCIAL';
    },
  ) {
    return this.vendasService.atualizarPagamento(id, body.statusPagamento);
  }

  ////////////////////////////////////////////////////////////
  // STATUS OPERACIONAL
  ////////////////////////////////////////////////////////////

  @Patch(':id/status')
  atualizarStatus(
    @Param('id')
    id: string,

    @Body()
    body: {
      status: 'ABERTA' | 'FATURADA' | 'ENTREGUE' | 'CANCELADA';
    },
  ) {
    return this.vendasService.atualizarStatus(id, body.status);
  }

  ////////////////////////////////////////////////////////////
  // CANCELAMENTO
  ////////////////////////////////////////////////////////////

  @Patch(':id/cancelar')
  cancelarVenda(
    @Param('id')
    id: string,

    @Body()
    body: {
      motivo?: string;
    },
  ) {
    return this.vendasService.cancelarVenda(id, body.motivo);
  }
}
