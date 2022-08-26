import MetaProvider from '../meta.provider';
import Prisma from '@prisma/client';
import { AnimeMeta, EpisodeMeta } from '../../../types/global';
import { Cache } from 'cache-manager';
import { XMLParser } from 'fast-xml-parser';
import axios, { proxiedGet, USER_AGENT } from '../../../helper/request';
import dayjs from 'dayjs';
import * as cheerio from 'cheerio';
import { isNumeric } from '../../../helper/tool';

export default class AnidbProvider extends MetaProvider {
    public override enabled = true;
    public override name = "AniDB";
    private readonly parser: XMLParser;
    private readonly baseUrl = "https://anidb.net";

    private readonly animeUrl = this.baseUrl + "/anime/{anidbId}";

    constructor(cacheManager: Cache) {
        super(cacheManager);
        this.parser = new XMLParser({
            ignoreAttributes: false
        });
    }

    async loadMeta(anime, excludedEpisodes): Promise<AnimeMeta> {
        // @ts-ignore
        const aniDbId = anime?.mappings?.anidb;
        if (!aniDbId) return undefined;

        const url = this.animeUrl
            .replace("{anidbId}", aniDbId);

        const { data: rawAnimeData, status } = await proxiedGet(url, {
            validateStatus: () => true,
            headers: {
                referer: this.baseUrl,
                origin: "https://anidb.net"
            }
        });

        if (status === 404) return undefined;

        let $ = cheerio.load(rawAnimeData);
        let episodeElements = $("#eplist > tbody > tr");

        if (!episodeElements?.length) return undefined;

        const episodeMetas: EpisodeMeta[] = [];

        const episodePromises = [];

        episodeElements.each((_, episode) => {
            const episodeIdElement = $(episode).find(".eid > a").first();
            const episodeUrl = episodeIdElement.prop("href");
            const episodeNumber = episodeIdElement.find("abbr")?.first()?.text()?.trim();
            if (episodeNumber && isNumeric(episodeNumber)) {
                const episodeNumberParsed = Number.parseInt(episodeNumber);
                if (excludedEpisodes?.length && !excludedEpisodes.includes(episodeNumberParsed)) {
                    episodePromises.push([proxiedGet(this.baseUrl + episodeUrl, {
                        headers: {
                            referer: url,
                            origin: "https://anidb.net"
                        }
                    }), Number.parseInt(episodeNumber)]);
                }
            }
        });

        for (let [episodeDataPromise, episodeNumber] of episodePromises) {
            const episodeData = await episodeDataPromise;
            const { data: episode, status } = episodeData;

            const $$ = cheerio.load(episode);

            let airedAtRaw = $$("[itemprop='datePublished']")?.prop("content");
            let airedAt = undefined;
            if (airedAtRaw) airedAt = dayjs(airedAtRaw).toDate();

            const englishTitle = $$("#tab_2_pane > div > table > tbody > tr.g_odd.romaji > td > span")?.text();
            const japaneseTitle = $$("#tab_2_pane > div > table > tbody > tr.g_odd.official.verified.no > td > label")?.text();

            let description = $$("[itemprop='description']")?.text()?.replace(/(S|s)ource: (.*)/igm, "")?.replaceAll("\n", "")?.replaceAll("\t", "");

            if (!description?.length) description = undefined;

            episodeMetas.push({
                title: englishTitle,
                titleVariations: {
                    japanese: japaneseTitle,
                    english: englishTitle
                },
                image: undefined,
                description: description,
                airedAt: airedAt,
                number: episodeNumber
            })
        }

        return {
            episodes: episodeMetas
        }
    }
}