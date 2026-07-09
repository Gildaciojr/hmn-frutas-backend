import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ModeloCaminhao,
  StatusPagamento,
  TipoFreteVenda,
} from '@prisma/client';

export class CreateVendaDto {
  //////////////////////////////////////////////////
  // CLIENTE
  //////////////////////////////////////////////////

  @IsString()
  clienteId!: string;

  //////////////////////////////////////////////////
  // COMPRA DE ORIGEM
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  compraOrigemId?: string;

  //////////////////////////////////////////////////
  // IDENTIFICAÇÃO
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numeroPedido?: string;

  @IsOptional()
  @IsString()
  dataVenda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  produto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  qualidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  localEntrega?: string;

  //////////////////////////////////////////////////
  // ROMANEIO
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numeroRomaneio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  destino?: string;

  @IsOptional()
  @IsEnum(TipoFreteVenda)
  tipoFrete?: TipoFreteVenda;

  //////////////////////////////////////////////////
  // CAMINHÃO
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/i, {
    message: 'Placa inválida',
  })
  placa?: string;

  @IsOptional()
  @IsEnum(ModeloCaminhao)
  modeloCaminhao?: ModeloCaminhao;

  //////////////////////////////////////////////////
  // MOTORISTA
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @MaxLength(150)
  motoristaNome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  motoristaTelefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  motoristaCpf?: string;

  //////////////////////////////////////////////////
  // PESAGEM
  //////////////////////////////////////////////////

  // ==============================================
  // ESTOQUE REAL
  // ==============================================

  @IsNumber()
  @Min(0.01)
  pesoBruto!: number;

  // ==============================================
  // DESCONTO OPERACIONAL
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0)
  pesoDesconto?: number;

  // ==============================================
  // FECHAMENTO FINANCEIRO
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  pesoLiquido?: number;

  // ==============================================
  // COMPATIBILIDADE
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantidadeKg?: number;

  // ==============================================
  // FRUTAS
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantidadeFrutas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  mediaFruta?: number;

  //////////////////////////////////////////////////
  // FINANCEIRO
  //////////////////////////////////////////////////

  // ==============================================
  // PREÇO MELANCIA
  // ==============================================

  @IsNumber()
  @Min(0.01)
  precoMelancia!: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  observacaoPreco?: string;

  // ==============================================
  // COMPATIBILIDADE LEGADA
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoMercado?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoFrete?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  valorPorKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoFinal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descontoFruta?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descontoValor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  icmsOutros?: number;

  // ==============================================
  // FECHAMENTO
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorMelancia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freteTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorTotal?: number;

  //////////////////////////////////////////////////
  // PAGAMENTO
  //////////////////////////////////////////////////

  @IsOptional()
  @IsEnum(StatusPagamento)
  statusPagamento?: StatusPagamento;

  //////////////////////////////////////////////////
  // VENCIMENTO
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  vencimento?: string;

  //////////////////////////////////////////////////
  // OBSERVAÇÕES
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  observacoes?: string;
}
