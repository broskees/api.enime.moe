import axios from 'axios';
import { Episode, AnimeWebPage, WebsiteMeta, RawSource } from '../types/global';
export const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

import axiosRetry from 'axios-retry';
import ProxyService from '../proxy/proxy.service';


export default abstract class Scraper {
    public infoOnly = false;
    public enabled = false;
    public subtitle = false;
    public consumetServiceUrl = undefined;
    public priority = -1;

    public websiteMeta: WebsiteMeta = undefined;

    constructor(private readonly proxyService: ProxyService) {
        axiosRetry(axios, {
            retries: 10,
            shouldResetTimeout: true,
            retryCondition: (_error) => true,
            retryDelay: () => 6000,
            onRetry: (_, __, requestConfig) => {
                const { httpAgent, httpsAgent } = this.proxyService.getProxyAgent();

                requestConfig.httpsAgent = httpsAgent;
                requestConfig.httpAgent = httpAgent;
            }
        });
    }

    abstract name(): string;

    abstract url(): string;

    locale() {
        return "en_US";
    }

    abstract match(title): AnimeWebPage | Promise<AnimeWebPage>;

    abstract fetch(path: string, number: number, endNumber: number | undefined): Episode | Promise<Episode> | Promise<Episode[]> | Episode[];

    async getSourceConsumet(sourceUrl: string | URL): Promise<RawSource> {
        return undefined;
    }

    async getRawSource(sourceUrl: string | URL, config: object | undefined): Promise<RawSource> {
        return undefined;
    }

    async get(url, headers = {}, proxy = false) {
        let agent = this.proxyService.getProxyAgent();

        return axios.get(url, {
            ...(proxy && {
                ...agent
            }),
            headers: {
                ...headers,
                "User-Agent": USER_AGENT
            },
            timeout: 2000
        });
    }

}