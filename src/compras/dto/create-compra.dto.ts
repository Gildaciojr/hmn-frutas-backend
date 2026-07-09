import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import {
  ModeloCaminhao,
  QualidadeFrutaCompra,
  TipoDescontoCompra,
} from '@prisma/client';

import { IsBoolean } from 'class-validator';

export class CreateCompraDto {
  //////////////////////////////////////////////////
  // PRODUTOR / CLIENTE
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  clienteId?: string;

  //////////////////////////////////////////////////
  // FORNECEDOR
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  fornecedorId?: string;

  //////////////////////////////////////////////////
  // FAZENDA
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  fazendaFornecedorId?: string;

  //////////////////////////////////////////////////
  // IDENTIFICAÇÃO
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @MaxLength(100)
  safra?: string;

  @IsDateString()
  dataCompra!: string;

  //////////////////////////////////////////////////
  // TRANSPORTE
  //////////////////////////////////////////////////

  @IsEnum(ModeloCaminhao)
  modeloCaminhao!: ModeloCaminhao;

  /**
   * Aceita:
   * ABC-1234
   * ABC1D23
   */

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/i, {
    message: 'Placa inválida',
  })
  placa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  motoristaNome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  motoristaTelefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  motoristaCpf?: string;

  //////////////////////////////////////////////////
  // DESTINO / LOGÍSTICA
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @MaxLength(200)
  destino?: string;

  //////////////////////////////////////////////////
  // PESAGEM
  //////////////////////////////////////////////////

  // ==============================================
  // ESTOQUE REAL
  // ==============================================

  @IsNumber()
  @Min(0.01)
  kgBruto!: number;

  // ==============================================
  // FRUTAS
  // ==============================================

  @IsNumber()
  @Min(1)
  quantidadeFrutas!: number;

  // ==============================================
  // MÉDIA
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  mediaFruta?: number;

  //////////////////////////////////////////////////
  // DESCONTO
  //////////////////////////////////////////////////

  @IsEnum(TipoDescontoCompra)
  tipoDesconto!: TipoDescontoCompra;

  /**
   * PERCENTUAL
   */

  @ValidateIf(
    (object: CreateCompraDto): boolean =>
      object.tipoDesconto === TipoDescontoCompra.PERCENTUAL,
  )
  @IsNumber()
  @Min(0)
  @Max(100)
  descontoPercentualAplicado?: number;

  /**
   * MANUAL KG
   */

  @ValidateIf(
    (object: CreateCompraDto): boolean =>
      object.tipoDesconto === TipoDescontoCompra.MANUAL_KG,
  )
  @IsNumber()
  @Min(0.01)
  descontoKgManual?: number;

  // ==============================================
  // DESCONTO FINAL
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0)
  descontoKgCalculado?: number;

  // ==============================================
  // FECHAMENTO
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  kgLiquido?: number;

  //////////////////////////////////////////////////
  // FINANCEIRO
  //////////////////////////////////////////////////

  // ==============================================
  // PREÇO
  // ==============================================

  @IsNumber()
  @Min(0.01)
  precoKg!: number;

  // ==============================================
  // TOTAL BRUTO
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalBruto?: number;

  // ==============================================
  // DESPESAS
  // ==============================================

  @IsOptional()
  @IsNumber()
  @Min(0)
  despesas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freteTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  icmsOutros?: number;

  // ==============================================
  // TOTAL FINAL
  // ==============================================

  @IsOptional()
  @IsNumber()
  valorTotal?: number;

  //////////////////////////////////////////////////
  // CONTROLE
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numeroFolha?: string;

  //////////////////////////////////////////////////
  // CONTROLE INTERNO HMN
  //////////////////////////////////////////////////

  @IsOptional()
  @IsBoolean()
  controleInterno?: boolean;

  @IsOptional()
  @IsEnum(QualidadeFrutaCompra)
  qualidadeFruta?: QualidadeFrutaCompra;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  cargueiro?: string;

  //////////////////////////////////////////////////
  // LEGADO / COMPATIBILIDADE
  //////////////////////////////////////////////////

  @IsOptional()
  @IsNumber()
  @Min(1)
  caminhoes?: number;

  //////////////////////////////////////////////////
  // OBSERVAÇÕES
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  observacoes?: string;
}
