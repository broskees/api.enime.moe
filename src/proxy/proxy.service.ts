import { Injectable, Logger } from '@nestjs/common';
import Socks5Agent from 'axios-socks5-agent';
import axios from 'axios';

@Injectable()
export default class ProxyService {
    private proxyList = [];
    private readonly listProxiesEndpoint = "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt";

    constructor() {
    }

    async load() {
        const proxyList = await axios.get(this.listProxiesEndpoint);

        this.proxyList = proxyList.data.split("\n");
    }

    private getAvailableProxy() {
        if (!this.proxyList.length) return undefined;

        return this.proxyList[Math.floor(Math.random() * this.proxyList.length)];
    }

    public getProxyAgent() {
        const proxy = this.getAvailableProxy();

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
