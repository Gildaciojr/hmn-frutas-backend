import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  // ======================================================
  // RESUMO FINANCEIRO / OPERACIONAL
  // ======================================================

  @Get('cliente/:id/resumo')
  async gerarResumoCliente(@Param('id') clienteId: string) {
    const data = await this.whatsappService.gerarResumoCliente(clienteId);

    return {
      success: true,

      data,
    };
  }
}
