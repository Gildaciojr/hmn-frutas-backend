import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { StatusCompra } from '@prisma/client';

export class SearchCompraDto {
  //////////////////////////////////////////////////
  // FORNECEDOR
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  fornecedor?: string;

  @IsOptional()
  @IsUUID()
  fornecedorId?: string;

  //////////////////////////////////////////////////
  // FAZENDA
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  fazenda?: string;

  @IsOptional()
  @IsUUID()
  fazendaId?: string;

  //////////////////////////////////////////////////
  // PLACA
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  placa?: string;

  //////////////////////////////////////////////////
  // ROMANEIO / FOLHA
  //////////////////////////////////////////////////

  @IsOptional()
  @IsString()
  numeroFolha?: string;

  //////////////////////////////////////////////////
  // STATUS
  //////////////////////////////////////////////////

  @IsOptional()
  @IsEnum(StatusCompra)
  status?: StatusCompra;

  //////////////////////////////////////////////////
  // PERÍODO
  //////////////////////////////////////////////////

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
