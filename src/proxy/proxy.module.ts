import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import ProxyService from './proxy.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import CacheModule from '../cache/cache.module';

@Module({
    imports: [CacheModule],
    providers: [ProxyService],
    controllers: [],
    exports: [ProxyService]
})
export default class ProxyModule {
    constructor() {
    }
}