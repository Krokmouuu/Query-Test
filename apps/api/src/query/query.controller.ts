import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ExecuteSqlDto,
  NaturalLanguageQueryDto,
  MAX_NL_QUERY_LENGTH,
  MAX_SQL_LENGTH,
} from './dto/query.dto';
import { QueryService } from './query.service';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post('nl-to-sql')
  @HttpCode(HttpStatus.OK)
  async naturalLanguageToSql(@Body() dto: NaturalLanguageQueryDto) {
    const query = dto?.query;
    if (query === undefined || query === null) {
      throw new BadRequestException('Body must include "query" (string).');
    }
    if (typeof query !== 'string') {
      throw new BadRequestException('"query" must be a string.');
    }
    const trimmed = query.trim();
    if (!trimmed) {
      throw new BadRequestException('"query" cannot be empty.');
    }
    if (trimmed.length > MAX_NL_QUERY_LENGTH) {
      throw new BadRequestException(
        `"query" must be at most ${MAX_NL_QUERY_LENGTH} characters.`,
      );
    }
    return this.queryService.naturalLanguageToSql(trimmed);
  }

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeSql(@Body() dto: ExecuteSqlDto) {
    const sql = dto?.sql;
    if (sql === undefined || sql === null) {
      throw new BadRequestException('Body must include "sql" (string).');
    }
    if (typeof sql !== 'string') {
      throw new BadRequestException('"sql" must be a string.');
    }
    const trimmed = sql.trim();
    if (!trimmed) {
      throw new BadRequestException('"sql" cannot be empty.');
    }
    if (trimmed.length > MAX_SQL_LENGTH) {
      throw new BadRequestException(
        `"sql" must be at most ${MAX_SQL_LENGTH} characters.`,
      );
    }
    return this.queryService.executeSql(trimmed);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runNaturalLanguage(@Body() dto: NaturalLanguageQueryDto) {
    const query = dto?.query;
    if (query === undefined || query === null) {
      throw new BadRequestException('Body must include "query" (string).');
    }
    if (typeof query !== 'string') {
      throw new BadRequestException('"query" must be a string.');
    }
    const trimmed = query.trim();
    if (!trimmed) {
      throw new BadRequestException('"query" cannot be empty.');
    }
    if (trimmed.length > MAX_NL_QUERY_LENGTH) {
      throw new BadRequestException(
        `"query" must be at most ${MAX_NL_QUERY_LENGTH} characters.`,
      );
    }
    return this.queryService.queryFromNaturalLanguage(trimmed);
  }
}
