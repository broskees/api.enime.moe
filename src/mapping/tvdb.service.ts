import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import axios from '../helper/request';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';

@Injectable()
export default class TvdbService implements OnModuleInit {
    private readonly tvdbMappingEndpoint = "https://raw.githubusercontent.com/Anime-Lists/anime-lists/master/anime-list-full.xml";
    private readonly parser: XMLParser;
    private readonly tvdbBaseUrl = "https://thetvdb.com";
    private readonly tvdbSeriesUrl = this.tvdbBaseUrl + "/dereferrer/series/";
    private readonly imdbBaseUrl = "https://www.imdb.com";
    private readonly imdbSeriesUrl = this.imdbBaseUrl + "/title/";
    private parsedMapping: Map<string, any>;

    constructor(@Inject("DATABASE") private readonly databaseService: DatabaseService) {
        this.parser = new XMLParser({
            ignoreAttributes: false
        });
    }

    async loadMapping() {
        if (this.parsedMapping) return this.parsedMapping;

        const { data: rawMappings } = await axios.get(this.tvdbMappingEndpoint);
        const mappings = this.parser.parse(rawMappings)["anime-list"]["anime"];

        const parsedMapping = new Map();
        for (let mapping of mappings) {
            const aniDbId = mapping["@_anidbid"], tvdbId = mapping["@_tvdbid"], tvdbSeason = mapping["@_defaulttvdbseason"], episodeOffset = mapping["@_episodeoffset"], imdbId = mapping["@_imdbid"];

            if (!aniDbId || !tvdbId || !tvdbSeason || tvdbId === "unknown" || tvdbId === "hentai" || tvdbId === "OVA") continue;

            parsedMapping.set(aniDbId, {
                id: tvdbId,
                season: tvdbSeason,
                offset: episodeOffset ? Number.parseInt(episodeOffset) : 0,
                imdb: imdbId
            });
        }

        this.parsedMapping = parsedMapping;

        return this.parsedMapping;
    }

    async synchronize(anime) {
        const parsedMapping = await this.loadMapping();

        const aniDbId = anime?.mappings?.anidb;
        if (!aniDbId) return;

        const tvdb = parsedMapping.get(String(aniDbId));
        if (!tvdb) return;
        const transactions = [];

        if (tvdb.id === "movie" && tvdb.imdb) { // Don't include information for movies for now (anilist already has them but I might include photos provided by IMDB?? I'm not sure
            // const { data: seriesEntryHtml } = await axios.get(this.imdbSeriesUrl + tvdb.imdb);
            // let $ = cheerio.load(seriesEntryHtml);

        } else {
            const { data: seriesEntryHtml, status } = await axios.get(this.tvdbSeriesUrl + tvdb.id, { validateStatus: () => true });
            if (status === 404) return;

            let $ = cheerio.load(seriesEntryHtml);

            let absolute = tvdb.season === "a";
            const seasonElement = $(`${absolute ? "#tab-absolute" : "#tab-official"} > ul > .list-group-item[data-number="${absolute ? 1 : tvdb.season}"]`);
            const url = seasonElement.find("a").first().attr("href");

            if (!url) return;

            const { data: seasonEntryHtml, status: seasonEntryStatus } = await axios.get(url, { validateStatus: () => true });
            if (seasonEntryStatus === 404) return;

            $ = cheerio.load(seasonEntryHtml);

            const episodes = [];
            $("tbody > tr").each((i, element) => {
                const rows = $(element).find("td");
                const number = $(rows[0]).text().match(/S(\d)+E(\d+)/).slice(1).map(x => +x)[1];

                if (number <= tvdb.offset) return;

                const url = $(rows[1]).find("a").first().attr("href");

                episodes.push({
                    number,
                    url
                });
            });


            for (let episodeDb of anime.episodes) {
                if (episodeDb.image && episodeDb.title && episodeDb.titleVariations && episodeDb.airedAt) continue;

                const episode = episodes.find(e => e.number - tvdb.offset === episodeDb.number);
                if (!episode) continue;

                const { data: episodeHtml, status } = await axios.get(this.tvdbBaseUrl + episode.url, { validateStatus: () => true });
                if (status === 404) continue;

                let $$ = cheerio.load(episodeHtml);

                const translation = (lang) => {
                    const element = $$(`#translations > .change_translation_text[data-language="${lang}"]`).first();
                    if (!element) return undefined;

                    return {
                        title: element.data("title"),
                        description: element.find("p").first().text()?.replaceAll("\n\n", "\n")
                    }
                };

                const japaneseTranslation = translation("jpn");
                const englishTranslation = translation("eng");
                const thumbnail = $$(".thumbnail > img")?.first()?.attr("src");
                const airingTime = $$('a[href^="/on-today/"]')?.first()?.text();

                const updatingObject = {};
                if (!episodeDb.title && englishTranslation) updatingObject["title"] = englishTranslation.title;
                if (!episodeDb.airedAt && airingTime) updatingObject["airedAt"] = dayjs(airingTime).toDate();

                updatingObject["image"] = thumbnail;
                updatingObject["titleVariations"] = {
                    native: japaneseTranslation.title,
                    english: englishTranslation.title
                }

                updatingObject["description"] = englishTranslation.description;


                transactions.push(this.databaseService.episode.update({
                    where: {
                        id: episodeDb.id
                    },
                    data: {
                        ...updatingObject
                    }
                }));
            }
        }

        await this.databaseService.$transaction(transactions);
    }

    async onModuleInit() {
    }
}