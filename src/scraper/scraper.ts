import axios, { AxiosRequestConfig } from 'axios';
import { Episode, AnimeWebPage, WebsiteMeta, RawSource } from '../types/global';
export const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

import axiosRetry from '@enime-project/axios-retry';
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
            retryDelay: () => 500,
            onRetry: async (number, __, requestConfig) => {
                console.log(requestConfig)
                if (number < 9) {
                    const { http, agent } = await this.proxyService.getProxyAgent();

                    if (http) requestConfig.httpAgent = agent;
                    else requestConfig.httpsAgent = agent;
                } else {
                    delete requestConfig["httpAgent"];
                    delete requestConfig["httpsAgent"];
                }
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

    async get(url, headers = {}) {
        const requestConfig: AxiosRequestConfig<any> = {
            headers: {
                ...headers,
                "User-Agent": USER_AGENT
            },
            timeout: 2000
        }
        return axios.get(url, requestConfig);
    }

}