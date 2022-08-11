import { CacheModule, Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import ProxyService from './proxy.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Module({
    imports: [],
    providers: [ProxyService],
    controllers: [],
    exports: [ProxyService]
})
@Global()
export default class ProxyModule {
    constructor(private readonly proxyService: ProxyService) {
    }
}