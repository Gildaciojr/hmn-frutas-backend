import {
  IsDateString,
  IsEnum,
  Matches,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { FormaPagamento } from '@prisma/client';

export class CreateDespesaOperacionalDto {
  @IsEnum(FormaPagamento)
  formaPagamento!: FormaPagamento;

  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  pagoEm!: string;

  //////////////////////////////////////////////////
  // DATA
  //////////////////////////////////////////////////

  @IsDateString()
  data!: string;

  //////////////////////////////////////////////////
  // ATIVIDADE
  //////////////////////////////////////////////////

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  atividade!: string;

  //////////////////////////////////////////////////
  // VALOR
  //////////////////////////////////////////////////

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor!: number;

  //////////////////////////////////////////////////
  // OBSERVAÇÕES
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  observacoes?: string;
}
