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
export default class ProxyModule implements OnModuleInit {
    constructor(private readonly proxyService: ProxyService) {
    }

    @Cron(CronExpression.EVERY_2_HOURS, {
        name: "Refreshing proxy list"
    })
    async scheduledRefreshProxyList() {
        await this.proxyService.load();
    }

    async onModuleInit() {
        await this.proxyService.load();
    }
}