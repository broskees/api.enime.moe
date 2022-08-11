import { Injectable, OnModuleInit } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import { Proxy, ProxyCallback, ProxyListResponse } from './proxy.interface';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';
import Socks5Agent from 'axios-socks5-agent';

@Injectable()
export default class ProxyService implements OnModuleInit {
    private readonly listProxiesEndpoint = "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt";

    private proxyList = [];

    constructor() {
    }

    @Cron(CronExpression.EVERY_2_HOURS, {
        name: "Refreshing proxy list"
    })
    async scheduledRefreshProxyList() {
        await this.load();
    }

    async onModuleInit() {
        await this.load();
    }

    private getAvailableProxy() {
        let randomized = undefined;
        while (!randomized) {
            randomized = this.proxyList[Math.floor(Math.random() * this.proxyList.length)];

        }
        return randomized;
    }

    async load() {
        const proxyList = await axios.get(this.listProxiesEndpoint);

        this.proxyList = proxyList.data.split("\n");
    }

    public getProxyAgent() {
        const proxy = this.getAvailableProxy();

        const splitted = proxy.split(":");

        const { httpAgent, httpsAgent } = Socks5Agent({
            agentOptions: {
                keepAlive: true,
            },
            host: splitted[0],
            port: Number.parseInt(splitted[1]),
        })

        return { httpAgent, httpsAgent };
    }
}
