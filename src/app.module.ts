import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ClientesModule } from './clientes/clientes.module';
import { ComprasModule } from './compras/compras.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { VendasModule } from './vendas/vendas.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { EstoqueModule } from './estoque/estoque.module';
import { RomaneiosModule } from './romaneios/romaneios.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { DespesasOperacionaisModule } from './despesas-operacionais/despesas-operacionais.module';
import { AlertasModule } from './alertas/alertas.module';

// ======================================================
// WHATSAPP
// ======================================================

import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    // ==================================================
    // CONFIG
    // ==================================================

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // ==================================================
    // CORE
    // ==================================================

    PrismaModule,

    // ==================================================
    // AUTH
    // ==================================================

    AuthModule,
    UsersModule,

    // ==================================================
    // BUSINESS
    // ==================================================

    ClientesModule,
    ComprasModule,
    DashboardModule,
    VendasModule,
    FinanceiroModule,
    AlertasModule,
    EstoqueModule,
    RomaneiosModule,
    FornecedoresModule,
    DespesasOperacionaisModule,

    // ==================================================
    // COMMUNICATION
    // ==================================================

    WhatsappModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}
