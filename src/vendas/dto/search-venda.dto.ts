import { Type } from 'class-transformer';
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
import { StatusPagamento, StatusVenda } from '@prisma/client';

export class SearchVendaDto {
  @IsOptional()
  @IsString()
  cliente?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsString()
  numeroPedido?: string;

  @IsOptional()
  @IsString()
  numeroRomaneio?: string;

  @IsOptional()
  @IsEnum(StatusVenda)
  status?: StatusVenda;

  @IsOptional()
  @IsEnum(StatusPagamento)
  statusPagamento?: StatusPagamento;

  @IsOptional()
  @IsDateString({ strict: true })
  dataInicio?: string;

  @IsOptional()
  @IsDateString({ strict: true })
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
