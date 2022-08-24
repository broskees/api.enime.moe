import MetaProvider from '../meta.provider';
import Prisma from '@prisma/client';
import { AnimeMeta, EpisodeMeta } from '../../../types/global';
import { Cache } from 'cache-manager';
import { XMLParser } from 'fast-xml-parser';
import axios from '../../../helper/request';
import dayjs from 'dayjs';

export default class AnidbProvider extends MetaProvider {
    public override enabled = true;
    public override name = "AniDB";
    private readonly parser: XMLParser;

    private readonly animeUrl = "http://api.anidb.net:9001/httpapi?request=anime&client={client}&clientver={clientVer}&protover=1&aid={anidbId}";

    constructor(cacheManager: Cache) {
        super(cacheManager);
        this.parser = new XMLParser({
            ignoreAttributes: false
        });
    }

    async loadMeta(anime: Prisma.Anime): Promise<AnimeMeta> {
        // @ts-ignore
        const aniDbId = anime?.mappings?.anidb;
        if (!aniDbId) return undefined;

        const url = this.animeUrl
            .replace("{client}", process.env.ANIDB_CLIENT_ID)
            .replace("{clientVer}", process.env.ANIDB_CLIENT_VER)
            // @ts-ignore
            .replace("{anidbId}", aniDbId);

        const { data: rawAnimeData, status } = await axios.get(url, { validateStatus: () => true });
        if (status === 404) return undefined;

        const animeData = this.parser.parse(rawAnimeData)["anime"];

        const episodes = animeData.episodes.episode;

        const episodeMetas: EpisodeMeta[] = [];

        for (let episode of episodes) {
            let { title, summary, airdate, epno } = episode;

            if (!Number.isInteger(epno["#text"])) continue;

            epno = Number.parseInt(epno["#text"]);

            let japaneseTitle;
            let englishTitle;

            if (Array.isArray(title)) {
                japaneseTitle = title.find(t => t["@_xml:lang"] === "ja");
                if (japaneseTitle) japaneseTitle = japaneseTitle["#text"];

                englishTitle = title.find(t => t["@_xml:lang"] === "en");
                if (englishTitle) englishTitle = englishTitle["#text"];
            }

            if (!summary?.length) summary = undefined;

            episodeMetas.push({
                title: englishTitle,
                titleVariations: {
                    japanese: japaneseTitle,
                    english: englishTitle
                },
                image: undefined,
                description: summary,
                airedAt: dayjs(airdate).toDate(),
                number: epno
            });
        }

        return {
            episodes: episodeMetas
        }
    }
}