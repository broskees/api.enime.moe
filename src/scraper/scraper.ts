import { AxiosRequestConfig } from 'axios';
import { Episode, AnimeWebPage, WebsiteMeta, RawSource } from '../types/global';

import axios, { USER_AGENT } from '../helper/request';

export default abstract class Scraper {
    public infoOnly = false;
    public enabled = false;
    public subtitle = false;
    public consumetServiceUrl = undefined;
    public priority = -1;

    public websiteMeta: WebsiteMeta = undefined;

    async init(): Promise<void> {

    }

    abstract name(): string;

    abstract url(): string;

    locale() {
        return "en_US";
    }

    abstract match(title): AnimeWebPage | Promise<AnimeWebPage>;

    abstract fetch(path: string, number: number, endNumber: number | undefined, excludedNumbers: number[] | undefined): Episode | Promise<Episode> | Promise<Episode[]> | Episode[];

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
            timeout: 2000,
            validateStatus: () => true
        }
        return axios.get(url, requestConfig);
    }

}