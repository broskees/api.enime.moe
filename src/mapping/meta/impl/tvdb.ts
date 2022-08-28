import MetaProvider from '../meta.provider';
import Prisma from '@prisma/client';
import { AnimeMeta, EpisodeMeta } from '../../../types/global';
import axios, { proxiedGet, USER_AGENT } from '../../../helper/request';
import { Cache } from 'cache-manager';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';

export default class TvdbProvider extends MetaProvider {
    public override enabled = true;
    public override name = "TvDB";

    private readonly tvdbMappingEndpoint = "https://raw.githubusercontent.com/Anime-Lists/anime-lists/master/anime-list-full.xml";
    private readonly parser: XMLParser;
    private readonly tvdbBaseUrl = "https://thetvdb.com";
    private readonly tvdbSeriesUrl = this.tvdbBaseUrl + "/dereferrer/series/";
    private readonly imdbBaseUrl = "https://www.imdb.com";
    private readonly imdbSeriesUrl = this.imdbBaseUrl + "/title/";

    constructor(cacheManager: Cache) {
        super(cacheManager);
        this.parser = new XMLParser({
            ignoreAttributes: false
        });
    }

    async loadMapping(): Promise<object> {
        let cachedMapping = await this.cacheManager.get<string>("tvdb-mapping");
        if (cachedMapping) return JSON.parse(cachedMapping);
        else {
            const { data: rawMappings } = await axios.get(this.tvdbMappingEndpoint);
            const mappings = this.parser.parse(rawMappings)["anime-list"]["anime"];

            const parsedMapping = {};
            for (let mapping of mappings) {
                const aniDbId = mapping["@_anidbid"], tvdbId = mapping["@_tvdbid"], tvdbSeason = mapping["@_defaulttvdbseason"], episodeOffset = mapping["@_episodeoffset"], imdbId = mapping["@_imdbid"];

                if (!aniDbId || !tvdbId || !tvdbSeason || tvdbId === "unknown" || tvdbId === "hentai" || tvdbId === "OVA") continue;

                parsedMapping[aniDbId] = {
                    id: tvdbId,
                    season: tvdbSeason,
                    offset: episodeOffset ? Number.parseInt(episodeOffset) : 0,
                    imdb: imdbId
                };
            }

            await this.cacheManager.set<string>("tvdb-mapping", JSON.stringify(parsedMapping), { ttl: 60 * 60 * 5 });
            return parsedMapping;
        }
    }

    async loadMeta(anime, excludedEpisodes): Promise<AnimeMeta> {
        const parsedMapping = await this.loadMapping();

        // @ts-ignore
        const aniDbId = anime?.mappings?.anidb;

        if (!aniDbId) return undefined;

        const tvdb = parsedMapping[String(aniDbId)];
        if (!tvdb) return undefined;

        const episodeMetas: EpisodeMeta[] = [];

        if (tvdb.id === "movie" && tvdb.imdb) { // Don't include information for movies for now (anilist already has them but I might include photos provided by IMDB?? I'm not sure
            // const { data: seriesEntryHtml } = await axios.get(this.imdbSeriesUrl + tvdb.imdb);
            // let $ = cheerio.load(seriesEntryHtml);
            return undefined;
        } else {
            const { data: seriesEntryHtml, status } = await axios.get(this.tvdbSeriesUrl + tvdb.id, { validateStatus: () => true });
            if (status === 404) return;

            let $ = cheerio.load(seriesEntryHtml);

            let absolute = tvdb.season === "a";
            const seasonElement = $(`${absolute ? "#tab-absolute" : "#tab-official"} > ul > .list-group-item[data-number="${absolute ? 1 : tvdb.season}"]`);
            const url = seasonElement.find("a").first().attr("href");

            if (!url) return;

            const { data: seasonEntryHtml, status: seasonEntryStatus } = await axios.get(url, {
                validateStatus: () => true,
                headers: {
                    "user-agent": USER_AGENT
                }
            });
            if (seasonEntryStatus === 404) return;

            $ = cheerio.load(seasonEntryHtml);

            const episodes = [];
            $("tbody > tr").each((i, element) => {
                const rows = $(element).find("td");
                const number = $(rows[0]).text().match(/S(\d)+E(\d+)/).slice(1).map(x => +x)[1];

                if (excludedEpisodes.includes(number)) return;

                if (number <= tvdb.offset) return;

                const url = $(rows[1]).find("a").first().attr("href");

                episodes.push({
                    number,
                    url
                });
            });


            for (let episodeDb of anime.episodes) {
                if (excludedEpisodes.includes(episodeDb.number)) continue;

                if (episodeDb.image && episodeDb.title && episodeDb.description && episodeDb.titleVariations && episodeDb.airedAt) {
                    episodeMetas.push({
                        image: episodeDb.image,
                        // @ts-ignore
                        titleVariations: episodeDb.titleVariations,
                        description: episodeDb.description,
                        airedAt: episodeDb.airedAt,
                        title: episodeDb.title,
                        number: episodeDb.number
                    });

                    continue;
                }

                const episode = episodes.find(e => e.number - tvdb.offset === episodeDb.number);
                if (!episode) continue;

                const { data: episodeHtml, status } = await proxiedGet(this.tvdbBaseUrl + episode.url, {
                    validateStatus: () => true,
                    headers: {
                        "user-agent": USER_AGENT
                    }
                });
                if (status === 404) continue;

                let $$ = cheerio.load(episodeHtml);

                console.log(episodeHtml)
                const translation = (lang) => {
                    const element = $$(`#translations > .change_translation_text[data-language="${lang}"]`).first();
                    if (!element) return undefined;

                    let title = element.data("title") as string | undefined;

                    if (title) {
                        if (title === "TBA" || title === "TBD" || title.startsWith("Episode")) title = undefined;
                    }

                    let description = element.find("p").first().text()?.replaceAll("\n\n", "\n");

                    if (!description?.length) description = undefined;

                    return {
                        title: title,
                        description: description
                    }
                };

                const japaneseTranslation = translation("jpn");
                const englishTranslation = translation("eng");
                const thumbnail = $$(".thumbnail > img")?.first()?.attr("src");
                let airingTime = $$('a[href^="/on-today/"]')?.first()?.text();

                if (!airingTime?.length) airingTime = undefined;

                episodeMetas.push({
                    image: thumbnail,
                    titleVariations: {
                        native: japaneseTranslation.title,
                        english: englishTranslation.title
                    },
                    description: englishTranslation.description,
                    airedAt: airingTime ? dayjs(airingTime).toDate() : undefined,
                    title: englishTranslation.title as string,
                    number: episodeDb.number
                })
            }
        }

        return {
            episodes: episodeMetas
        };
    }
}