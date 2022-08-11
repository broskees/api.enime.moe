import { CACHE_MANAGER, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Socks5Agent from 'axios-socks5-agent';
import axios from 'axios';
import { Cache } from 'cache-manager';

@Injectable()
export default class ProxyService {
    private readonly listProxiesEndpoint = "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt";

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    }

    private async getAvailableProxy() {
        let proxyList = JSON.parse(await this.cacheManager.get("proxies"));

        if (!proxyList) {
            proxyList = (await axios.get(this.listProxiesEndpoint)).data.split("\n");
            await this.cacheManager.set("proxies", JSON.stringify(proxyList), {
                ttl: 1000 * 60 * 60 * 2
            });
        }

        let random = proxyList[Math.floor(Math.random() * proxyList.length)];

        return random;
    }

    public async getProxyAgent() {
        const proxy = await this.getAvailableProxy();

        if (!proxy) return undefined;

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
