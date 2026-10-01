// src/dashboard/dashboard.controller.ts

import { Controller, Get, UseGuards } from '@nestjs/common';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  ////////////////////////////////////////////////////////////
  // ADMIN
  ////////////////////////////////////////////////////////////

  @Get('admin')
  getAdmin() {
    return this.dashboardService.getAdminDashboard();
  }

  ////////////////////////////////////////////////////////////
  // COMPRAS
  ////////////////////////////////////////////////////////////

  @Get('compras')
  getCompras() {
    return this.dashboardService.getComprasDashboard();
  }

  ////////////////////////////////////////////////////////////
  // VENDAS
  ////////////////////////////////////////////////////////////

  @Get('vendas')
  getVendas() {
    return this.dashboardService.getVendasDashboard();
  }

  ////////////////////////////////////////////////////////////
  // ESTOQUE
  ////////////////////////////////////////////////////////////

  @Get('estoque')
  getEstoque() {
    return this.dashboardService.getEstoqueDashboard();
  }

  ////////////////////////////////////////////////////////////
  // FINANCEIRO
  ////////////////////////////////////////////////////////////

  @Get('financeiro')
  getFinanceiro() {
    return this.dashboardService.getFinanceiroDashboard();
  }
}
