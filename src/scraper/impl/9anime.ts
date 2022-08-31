import Scraper from '../scraper';
import { AnimeWebPage, Episode } from '../../types/global';
import { load } from 'cheerio';
import { range } from '../../helper/tool';
import { decode, encode } from 'ascii-url-encoder';
import { deepMatch } from '../../helper/match';
import axios from 'axios';

export default class NineAnimeScraper extends Scraper {
    override enabled = false;
    override infoOnly = true;

    private readonly table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    private readonly key = "kMXzgyNzT3k5dYab";
    private cipherKey = "";
    private decipherKey = "";

    async init() {
        const {
            data: { cipher, decipher },
        } = await axios.get("https://raw.githubusercontent.com/chenkaslowankiya/BruvFlow/main/keys.json");
        this.cipherKey = cipher;
        this.decipherKey = decipher;
    }

    async getRawSource(sourceUrl, config) {
        if (!(sourceUrl instanceof URL)) sourceUrl = new URL(sourceUrl);

        const episodeId = sourceUrl.pathname.slice(sourceUrl.pathname.indexOf("/ajax/server/list/"));
        const url = `${sourceUrl}?vrf=${this.ev(episodeId)}`;

        console.log(url)
        return undefined;
    }

    async fetch(path: string, number: number, endNumber: number | undefined): Promise<Episode[]> {
        if (!path.startsWith(this.url().replace('.to', '.id')))
            path = `${path.replace('.to', '.id')}/watch/${path}`;

        try {
            const res = await axios.get(path);

            const $ = load(res.data);

            const id = $('#watch-main').attr('data-id')!;

            const {
                data: { result },
            } = await axios.get(
                `${this.url().replace('.to', '.id')}/ajax/episode/list/${id}?vrf=${encode(this.ev(id))}`
            );

            const $$ = load(result);

            const episodes = [];
            $$('div.episodes > ul > li > a').each((i, el) => {
                    const possibleIds = $$(el).attr('data-ids')?.split(',')!;
                    const id = possibleIds[0] ?? possibleIds[0];
                    const number = parseInt($$(el).attr('data-num')?.toString()!);
                    const title = $$(el).find('span').text().length > 0 ? $$(el).find('span').text() : undefined;
                    episodes.push({
                        number: number,
                        title: title,
                        url: `${this.url().replace('.to', '.id')}/ajax/server/list/${id}`,
                    });
                })

            return episodes;
        } catch (err) {
            throw new Error((err as Error).message);
        }
    }

    async match(t): Promise<AnimeWebPage> {
        const res = await axios.get(
            `${this.url().replace('.to', '.id')}/filter?keyword=${encode(t.current).replace(
                /%20/g,
                '+'
            )}&vrf=${encode(this.ev(t.current))}&page=1`
        );
        console.log(res.data)
        const $ = load(res.data);
        const results = [];

        $('#list-items > div.item').each((i, el) => {
            results.push({
                // id: $(el).find('div > div.ani > a').attr('href')?.split('/')[2]!,
                title: $(el).find('div > div.info > div.b1 > a').text()!,
                path: `${this.url()}${$(el).find('div > div.ani > a').attr('href')}`,
                // image: $(el).find('div > div.ani > a > img').attr('src'),
                // type: $(el).find('div > div.ani > a > div.meta > div > div.right').text()!,
            });
        });

        console.log(results)
        if (!results.length) return undefined;

        // Attempt 1 - Match the first 9anime search element
        const firstResult = results[0];
        for (let alt of [t.english, t.romaji, t.native, ...(t.synonyms || [])]) {
            if (!alt) continue;

            if (deepMatch(alt, firstResult.title, false)) return firstResult;
        }

        for (let alt of [t.english, t.romaji, t.native, ...(t.synonyms || [])]) {
            if (!alt) continue;

            for (let result of results) {
                if (deepMatch(alt, result.title, false)) {
                    return result;
                }
            }
        }

        return undefined;
    }

    name(): string {
        return "9anime";
    }

    url(): string {
        return "https://9anime.id";
    }


    private ev(query: string): string {
        return this.encrypt(this.cipher(encode(query), this.cipherKey), this.table).replace(/[=|$]/gm, '');
    }

    private dv(query: string): string {
        return decode(this.cipher(this.decrypt(query), this.decipherKey));
    }

    private cipher(query: string, key: string): string {
        let u = 0;
        let v = 0;
        const arr = range({ from: 0, to: 256 });

        for (let i = 0; i < arr.length; i++) {
            u = (u + arr[i] + key.charCodeAt(i % key.length)) % 256;
            v = arr[i];
            arr[i] = arr[u];
            arr[u] = v;
        }
        u = 0;
        let j = 0;

        let res = '';
        for (let i = 0; i < query.length; i++) {
            j = (j + 1) % 256;
            u = (u + arr[j]) % 256;
            v = arr[j];
            arr[j] = arr[u];
            arr[u] = v;
            res += String.fromCharCode(query.charCodeAt(i) ^ arr[(arr[j] + arr[u]) % 256]);
        }
        return res;
    }

    private encrypt(query: string, key: string): string {
        query.split('').forEach((char) => {
            if (char.charCodeAt(0) > 255) throw new Error('Invalid character.');
        });

        let res = '';
        for (let i = 0; i < query.length; i += 3) {
            const arr: number[] = Array(4).fill(-1);
            arr[0] = query.charCodeAt(i) >> 2;
            arr[1] = (3 & query.charCodeAt(i)) << 4;

            if (query.length > i + 1) {
                arr[1] = arr[1] | (query.charCodeAt(i + 1) >> 4);
                arr[2] = (15 & query.charCodeAt(i + 1)) << 2;
            }
            if (query.length > i + 2) {
                arr[2] = arr[2] | (query.charCodeAt(i + 2) >> 6);
                arr[3] = 63 & query.charCodeAt(i + 2);
            }

            for (const j of arr) {
                if (j === -1) res += '=';
                else if (range({ from: 0, to: 63 }).includes(j)) res += key.charAt(j);
            }
        }
        return res;
    }

    private decrypt(query: string): string {
        const p = query?.replace(/[\t\n\f\r]/g, '')?.length % 4 === 0 ? query?.replace(/[==|?|$]/g, '') : query;

        if (p?.length % 4 === 1 || /[^+/0-9A-Za-z]/gm.test(p)) throw new Error('Invalid character.');

        let res = '';
        let i = 0;
        let e = 0;
        let n = 0;
        for (let j = 0; j < p?.length; j++) {
            e = e << 6;
            i = this.table.indexOf(p[j]);
            e = e | i;
            n += 6;

            if (n === 24) {
                res += String.fromCharCode((16711680 & e) >> 16);
                res += String.fromCharCode((65280 & e) >> 8);
                res += String.fromCharCode(255 & e);
                n = 0;
                e = 0;
            }
        }

        if (12 === n) return res + String.fromCharCode(e >> 4);
        else if (18 === n) {
            e = e >> 2;
            res += String.fromCharCode((65280 & e) >> 8);
            res += String.fromCharCode(255 & e);
        }
        return res;
    }
}