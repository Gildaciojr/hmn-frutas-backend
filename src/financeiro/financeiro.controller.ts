import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { FinanceiroService } from './financeiro.service';

import { CreateTransacaoDto } from './dto/create-transacao.dto';

import { RegistrarPagamentoDto } from './dto/registrar-pagamento.dto';

@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly financeiroService: FinanceiroService) {}

  ////////////////////////////////////////////////////////////
  // RESUMO
  ////////////////////////////////////////////////////////////

  @Get('resumo')
  resumo() {
    return this.financeiroService.resumoGeral();
  }

  ////////////////////////////////////////////////////////////
  // FLUXO
  ////////////////////////////////////////////////////////////

  @Get('fluxo')
  fluxo() {
    return this.financeiroService.fluxo();
  }

  ////////////////////////////////////////////////////////////
  // CLIENTE
  ////////////////////////////////////////////////////////////

  @Get('cliente/:id')
  porCliente(
    @Param('id')
    id: string,
  ) {
    return this.financeiroService.financeiroPorCliente(id);
  }

  ////////////////////////////////////////////////////////////
  // PAGAMENTOS CLIENTE
  ////////////////////////////////////////////////////////////

  @Get('cliente/:id/pagamentos')
  pagamentosCliente(
    @Param('id')
    id: string,
  ) {
    return this.financeiroService.pagamentosCliente(id);
  }

  ////////////////////////////////////////////////////////////
  // FORNECEDOR
  ////////////////////////////////////////////////////////////

  @Get('fornecedor/:id')
  porFornecedor(
    @Param('id')
    id: string,
  ) {
    return this.financeiroService.financeiroPorFornecedor(id);
  }

  ////////////////////////////////////////////////////////////
  // PAGAMENTOS FORNECEDOR
  ////////////////////////////////////////////////////////////

  @Get('fornecedor/:id/pagamentos')
  pagamentosFornecedor(
    @Param('id')
    id: string,
  ) {
    return this.financeiroService.pagamentosFornecedor(id);
  }

  ////////////////////////////////////////////////////////////
  // PAGAMENTOS TRANSAÇÃO
  ////////////////////////////////////////////////////////////

  @Get('transacao/:id/pagamentos')
  pagamentosTransacao(
    @Param('id')
    id: string,
  ) {
    return this.financeiroService.pagamentosTransacao(id);
  }

  ////////////////////////////////////////////////////////////
  // CONTAS A RECEBER
  ////////////////////////////////////////////////////////////

  @Get('receber')
  contasReceber() {
    return this.financeiroService.contasReceber();
  }

  ////////////////////////////////////////////////////////////
  // CONTAS A PAGAR
  ////////////////////////////////////////////////////////////

  @Get('pagar')
  contasPagar() {
    return this.financeiroService.contasPagar();
  }

  ////////////////////////////////////////////////////////////
  // REGISTRAR PAGAMENTO
  ////////////////////////////////////////////////////////////

  @Post('transacao/:id/pagamento')
  registrarPagamento(
    @Param('id')
    id: string,

    @Body()
    data: RegistrarPagamentoDto,
  ) {
    return this.financeiroService.registrarPagamento(id, data);
  }

  ////////////////////////////////////////////////////////////
  // PAGAMENTO FORNECEDOR (FIFO)
  ////////////////////////////////////////////////////////////

  @Post('fornecedor/:id/pagamento')
  registrarPagamentoFornecedor(
    @Param('id')
    fornecedorId: string,

    @Body()
    data: RegistrarPagamentoDto,
  ) {
    return this.financeiroService.registrarPagamentoFornecedor(
      fornecedorId,
      data,
    );
  }

  ////////////////////////////////////////////////////////////
  // TRANSAÇÃO MANUAL
  ////////////////////////////////////////////////////////////

  @Post()
  create(
    @Body()
    data: CreateTransacaoDto,
  ) {
    return this.financeiroService.createTransacaoManual(data);
  }
}
