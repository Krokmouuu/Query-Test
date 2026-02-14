import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll() {
    return this.reportsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(Number(id));
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      naturalLanguageQuery?: string;
      sql?: string;
      chartType?: string;
    },
  ) {
    return this.reportsService.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: { name?: string; naturalLanguageQuery?: string; sql?: string; chartType?: string },
  ) {
    return this.reportsService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reportsService.remove(Number(id));
  }
}
