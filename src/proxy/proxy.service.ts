import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { Cache } from 'cache-manager';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export default class ProxyService {
    private readonly listProxiesEndpointHttp = "https://raw.githubusercontent.com/Enime-Project/proxy-list/master/proxies/http.txt";
    private readonly listProxiesEndpointSocks4 = "https://raw.githubusercontent.com/Enime-Project/proxy-list/master/proxies/socks4.txt";
    private readonly listProxiesEndpointSocks5 = "https://raw.githubusercontent.com/Enime-Project/proxy-list/master/proxies/socks5.txt";

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    }

    private async getAvailableProxy() {
        let proxyList = JSON.parse(await this.cacheManager.get("proxies"));

        if (!proxyList) {
            let proxyListHttp = (await axios.get(this.listProxiesEndpointHttp)).data.split("\n").map(proxy => {
                return {
                    address: proxy,
                    type: "http"
                }
            });
            let proxyListSocks4 = (await axios.get(this.listProxiesEndpointSocks4)).data.split("\n").map(proxy => {
                return {
                    address: proxy,
                    type: "socks4"
                }
            });
            let proxyListSocks5 = (await axios.get(this.listProxiesEndpointSocks5)).data.split("\n").map(proxy => {
                return {
                    address: proxy,
                    type: "socks5"
                }
            });

            proxyList = [...proxyListHttp, ...proxyListSocks4, ...proxyListSocks5];
            await this.cacheManager.set("proxies", JSON.stringify(proxyList), {
                ttl: 1000 * 60 * 15
            });
        }

        return proxyList[Math.floor(Math.random() * proxyList.length)];
    }

    public async getProxyAgent() {
        const proxy = await this.getAvailableProxy();

        if (!proxy) return undefined;

        const type = proxy.type;
        const splitted = proxy.address.split(":");

        const host = splitted[0], port = splitted[1];
        let httpsAgent;

        if (type === "socks5") {
            httpsAgent = new SocksProxyAgent(`socks5://${host}:${port}`);
        } else if (type === "socks4") {
            httpsAgent = new SocksProxyAgent(`socks4://${host}:${port}`);
        } else if (type === "http") {
            httpsAgent = new HttpsProxyAgent(`https://${host}:${port}`);
        }

        return httpsAgent;
    }
}
