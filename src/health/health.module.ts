import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicator/prisma-health-indicator';
import { HttpModule } from '@nestjs/axios';

@Module({
    controllers: [HealthController],
    imports: [HttpModule, TerminusModule],
    providers: [PrismaHealthIndicator]
})
export default class HealthModule {}