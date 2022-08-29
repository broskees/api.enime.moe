import { CACHE_MANAGER, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import DatabaseService from '../../database/database.service';
import { Cache } from 'cache-manager';
import MetaProvider from './meta.provider';
import TvdbProvider from './impl/tvdb';
import AnidbProvider from './impl/anidb';
import Piscina from 'piscina';
import { resolve } from 'path';
import axios from '../../helper/request';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export default class MetaService implements OnModuleInit {
    private providers: MetaProvider[] = [];
    private backupProviders: MetaProvider[] = [];
    private readonly piscina: Piscina;
    private readonly parser: XMLParser;
    private readonly tvdbMappingEndpoint = "https://raw.githubusercontent.com/Anime-Lists/anime-lists/master/anime-list-full.xml";

    constructor(@Inject("DATABASE") private readonly databaseService: DatabaseService, @Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
        this.providers.push(new TvdbProvider());
        this.backupProviders.push(new AnidbProvider());

        this.parser = new XMLParser({
            ignoreAttributes: false
        });

        this.piscina = new Piscina({
            filename: resolve(__dirname, "meta.worker.js")
        });
    }

    private async loadMapping(): Promise<object> {
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

    async synchronize(anime, useBackup = true) {
        const parsedMapping = await this.loadMapping();

        if (!anime.episodes) anime = await this.databaseService.anime.findUnique({
            where: {
                id: anime.id
            },
            include: {
                episodes: true
            }
        });

        if (anime.format === "MOVIE") return;

        const updatedEpisodeInfo = [];
        let excludedEpisodes = anime.episodes.filter(e => e.titleVariations && e.title && e.description && e.airedAt && e.image).map(e => e.number);

        const load = async (provider, anime, excluded = undefined) => {
            const updatedEpisodeInfo = [];

            const animeMeta = await this.piscina.run({ name: provider.name, anime: anime, excluded: excluded, mapping: parsedMapping }, { name: "loadMeta" });
            if (!animeMeta) return [];

            for (let episodeMeta of animeMeta.episodes) {
                if (!episodeMeta) continue;

                const validMeta = Object.fromEntries(Object.entries(episodeMeta).filter(([_, v]) => !!v));

                updatedEpisodeInfo.push(this.databaseService.episode.update({
                    where: {
                        animeId_number: {
                            animeId: anime.id,
                            number: episodeMeta.number
                        }
                    },
                    data: {
                        ...validMeta
                    }
                }))
            }

            return updatedEpisodeInfo;
        }

        let res = false;

        for (let provider of this.providers) {
            if (!provider.enabled) continue;

            await this.databaseService.$transaction(await load(provider, anime, excludedEpisodes));
        }

        if (useBackup) {
            excludedEpisodes = updatedEpisodeInfo.filter(e => e.titleVariations && e.title && e.description && e.airedAt).map(e => e.number);

            if (anime.episodes.length && (!res || (excludedEpisodes.length !== anime.episodes.length))) { // Anidb does not provide episode image, we should not bother it for this
                for (let provider of this.backupProviders) {
                    if (!provider.enabled) continue;

                    await this.databaseService.$transaction(await load(provider, anime, excludedEpisodes));
                }
            }
        }
    }

    async onModuleInit() {
    }
}