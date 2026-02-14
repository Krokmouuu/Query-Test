import { Module } from '@nestjs/common';
import { QueryModule } from './query/query.module';
import { ReportsModule } from './reports/reports.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [QueryModule, ReportsModule, StatsModule],
})
export class AppModule {}
