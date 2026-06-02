import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface WhatsappResumoResponse {
  cliente: {
    id: string;
    nome: string;
    telefone: string;
  };

  resumo: {
    totalComprado: number;

    totalVendas: number;

    saldoDevedor: number;

    totalOperacoes: number;

    ultimaCompraEm: Date | null;
  };

  mensagem: string;

  whatsappUrl: string;
}

@Injectable()
export class WhatsappService {
  constructor(private prisma: PrismaService) {}

  // ======================================================
  // SANITIZAR TELEFONE
  // ======================================================

  private sanitizePhone(phone: string): string {
    // ====================================================
    // REMOVE TUDO QUE NÃO FOR NÚMERO
    // ====================================================

    let sanitized = phone.replace(/\D/g, '');

    // ====================================================
    // REMOVE DDI DUPLICADO
    // ====================================================

    if (sanitized.startsWith('55')) {
      sanitized = sanitized.slice(2);
    }

    // ====================================================
    // REMOVE ZERO INICIAL
    // ====================================================

    if (sanitized.startsWith('0')) {
      sanitized = sanitized.slice(1);
    }

    // ====================================================
    // REMOVE TELEFONES INVÁLIDOS
    // ====================================================

    if (sanitized.length < 10) {
      throw new NotFoundException('Telefone do cliente inválido');
    }

    return sanitized;
  }

  // ======================================================
  // FORMATAR MOEDA
  // ======================================================

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  // ======================================================
  // FORMATAR DATA
  // ======================================================

  private formatDate(date: Date | null): string {
    if (!date) {
      return 'Não disponível';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  // ======================================================
  // GERAR RESUMO DO CLIENTE
  // ======================================================

  async gerarResumoCliente(clienteId: string): Promise<WhatsappResumoResponse> {
    // ====================================================
    // CLIENTE
    // ====================================================

    const cliente = await this.prisma.cliente.findUnique({
      where: {
        id: clienteId,
      },

      include: {
        compras: {
          orderBy: {
            createdAt: 'desc',
          },
        },

        vendas: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }

    if (!cliente.telefone) {
      throw new NotFoundException('Cliente não possui telefone cadastrado');
    }

    // ====================================================
    // TOTAL COMPRAS
    // ====================================================

    const totalComprado = cliente.compras.reduce(
      (acc, compra) => acc + Number(compra.valorTotal),
      0,
    );

    // ====================================================
    // TOTAL VENDAS
    // ====================================================

    const totalVendas = cliente.vendas.reduce(
      (acc, venda) => acc + Number(venda.valorTotal),
      0,
    );

    // ====================================================
    // SALDO
    // ====================================================

    const saldoDevedor = totalVendas - totalComprado;

    // ====================================================
    // ÚLTIMA OPERAÇÃO
    // ====================================================

    const ultimaCompra = cliente.compras.length > 0 ? cliente.compras[0] : null;

    // ====================================================
    // TOTAL OPERAÇÕES
    // ====================================================

    const totalOperacoes = cliente.compras.length + cliente.vendas.length;

    // ====================================================
    // MENSAGEM
    // ====================================================

    const mensagem = `
Olá ${cliente.nome}, tudo bem?

Segue seu resumo operacional atualizado:

📦 Total movimentado em compras:
${this.formatCurrency(totalComprado)}

💰 Total movimentado em vendas:
${this.formatCurrency(totalVendas)}

📊 Saldo atual:
${this.formatCurrency(saldoDevedor)}

🧾 Total de operações:
${totalOperacoes}

🕒 Última operação:
${this.formatDate(ultimaCompra?.createdAt ?? null)}

Atenciosamente,
Controle de Melancias
`.trim();

    // ====================================================
    // URL WHATSAPP
    // ====================================================

    const telefone = this.sanitizePhone(cliente.telefone);

    const whatsappUrl =
      `https://wa.me/55${telefone}` + `?text=${encodeURIComponent(mensagem)}`;

    // ====================================================
    // DEBUG
    // ====================================================

    console.log('📲 WhatsApp URL:', whatsappUrl);

    // ====================================================
    // RESPONSE
    // ====================================================

    return {
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        telefone,
      },

      resumo: {
        totalComprado,

        totalVendas,

        saldoDevedor,

        totalOperacoes,

        ultimaCompraEm: ultimaCompra?.createdAt ?? null,
      },

      mensagem,

      whatsappUrl,
    };
  }
}
