import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';

import type { Response } from 'express';

import { RomaneiosService } from './romaneios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('romaneios')
export class RomaneiosController {
  constructor(private readonly romaneiosService: RomaneiosService) {}

  ////////////////////////////////////////////////////////////
  // PDF VENDA
  ////////////////////////////////////////////////////////////

  @Get('venda/:id/pdf')
  async gerarPdfVenda(
    @Param('id')
    id: string,

    @Res()
    response: Response,
  ): Promise<void> {
    const pdfBuffer = await this.romaneiosService.gerarPdfVenda(id);

    response.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',

      //////////////////////////////////////////////////////////
      // NOME ARQUIVO
      //////////////////////////////////////////////////////////

      'Content-Disposition': `inline; filename=HMN-PEDIDO-VENDA-${id}.pdf`,

      //////////////////////////////////////////////////////////
      // TAMANHO
      //////////////////////////////////////////////////////////

      'Content-Length': pdfBuffer.length,
    });

    response.end(pdfBuffer);
  }

  ////////////////////////////////////////////////////////////
  // PDF COMPRA
  ////////////////////////////////////////////////////////////

  @Get('compra/:id/pdf')
  async gerarPdfCompra(
    @Param('id')
    id: string,

    @Res()
    response: Response,
  ): Promise<void> {
    const pdfBuffer = await this.romaneiosService.gerarPdfCompra(id);

    response.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',

      'Content-Disposition': `inline; filename=HMN-ROMANEIO-COMPRA-${id}.pdf`,

      'Content-Length': pdfBuffer.length,
    });

    response.end(pdfBuffer);
  }
}
