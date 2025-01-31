import { CACHE_MANAGER, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import DatabaseService from '../../database/database.service';
import { Cache } from 'cache-manager';
import MetaProvider from './meta.provider';
import TvdbProvider from './impl/tvdb';
import AnidbProvider from './impl/anidb';
import TmdbProvider from './impl/tmdb';
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
        // this.providers.push(new TmdbProvider());
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

    async synchronize(anime, useBackup = true, force = false) {
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

        const episodeInfos = {};
        let excludedEpisodes = force ? [] : anime.episodes.filter(e => e.titleVariations && e.title && e.description && e.airedAt && e.image).map(e => e.number);

        const load = async (provider, anime, excluded = undefined) => {
            const animeMeta = await this.piscina.run({ name: provider.name, anime: anime, excluded: excluded, mapping: parsedMapping, force: force }, { name: "loadMeta" });
            if (!animeMeta) return [];

            for (let episodeMeta of animeMeta.episodes) {
                if (!episodeMeta || Number.isNaN(episodeMeta.number) || episodeMeta.number > anime.currentEpisode) continue;
                let episodeDb = await this.databaseService.episode.findUnique({
                    where: {
                        animeId_number: {
                            animeId: anime.id,
                            number: episodeMeta.number
                        }
                    }
                });

                if (!episodeDb) continue;

                const validMeta = Object.fromEntries(Object.entries(episodeMeta).filter(([_, v]) => !!v));

                episodeInfos[episodeMeta.number] = {
                    ...(episodeInfos[episodeMeta.number] || {}),
                    ...validMeta
                }
            }
        }

        let res = false;

        for (let provider of this.providers) {
            if (!provider.enabled) continue;

            await load(provider, anime, excludedEpisodes);
        }

        if (useBackup) {
            // @ts-ignore
            let excludedEpisodesBackup = Object.values(episodeInfos).filter(e => e.titleVariations && e.title && e.description && e.airedAt).map(e => e.number);

            if (anime.episodes.length && (!res || ((excludedEpisodes.length + excludedEpisodesBackup.length) !== anime.episodes.length))) { // Anidb does not provide episode image, we should not bother it for this
                for (let provider of this.backupProviders) {
                    if (!provider.enabled) continue;

                    await load(provider, anime, [...excludedEpisodesBackup, ...excludedEpisodes]);
                }
            }
        }

        await this.databaseService.$transaction(Object.values(episodeInfos).map(episodeInfo => this.databaseService.episode.update({
            where: {
                animeId_number: {
                    animeId: anime.id,
                    // @ts-ignore
                    number: episodeInfo.number
                }
            },
            data: {
                // @ts-ignore
                ...episodeInfo
            }
        })))
    }

    async onModuleInit() {
    }
}