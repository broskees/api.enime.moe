import { CACHE_MANAGER, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import DatabaseService from '../../database/database.service';
import { Cache } from 'cache-manager';
import MetaProvider from './meta.provider';
import TvdbProvider from './impl/tvdb';
import AnidbProvider from './impl/anidb';

@Injectable()
export default class MetaService implements OnModuleInit {
    private providers: MetaProvider[] = [];
    private backupProviders: MetaProvider[] = [];

    constructor(@Inject("DATABASE") private readonly databaseService: DatabaseService, @Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
        this.providers.push(new TvdbProvider(this.cacheManager));
        this.backupProviders.push(new AnidbProvider(this.cacheManager));
    }

    async synchronize(anime, useBackup = true) {
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
        let excludedEpisodes = anime.episodes.filter(e => e.titleVariations && e.title && e.description && e.airedAt).map(e => e.number);

        const load = async (provider, anime, excluded = undefined) => {
            const animeMeta = await provider.loadMeta(anime, excluded);

            if (!animeMeta) return false;

            for (let episodeMeta of animeMeta.episodes) {
                const episode = anime.episodes.find(e => e.number === episodeMeta.number);
                if (!episodeMeta) continue;

                const updatingObject = {};
                if (!episode.titleVariations && episodeMeta.titleVariations) updatingObject["titleVariations"] = episodeMeta.titleVariations;
                if (!episode.title && episodeMeta.title) updatingObject["title"] = episodeMeta.title;
                if (!episode.image && episodeMeta.image) updatingObject["image"] = episodeMeta.image;
                if (!episode.description && episodeMeta.description) updatingObject["description"] = episodeMeta.description;
                if (!episode.airedAt && episodeMeta.airedAt) updatingObject["airedAt"] = episodeMeta.airedAt;

                updatedEpisodeInfo.push(await this.databaseService.episode.update({
                    where: {
                        animeId_number: {
                            animeId: anime.id,
                            number: episodeMeta.number
                        }
                    },
                    data: {
                        ...updatingObject
                    }
                }));
            }

            return true;
        }

        let res = false;

        for (let provider of this.providers) {
            if (!provider.enabled) continue;

            res = await load(provider, anime, excludedEpisodes);
        }

        if (useBackup) {
            excludedEpisodes = updatedEpisodeInfo.filter(e => e.titleVariations && e.title && e.description && e.airedAt).map(e => e.number);

            if (anime.episodes.length && (!res || (excludedEpisodes.length !== updatedEpisodeInfo.length))) { // Anidb does not provide episode image, we should not bother it for this
                for (let provider of this.backupProviders) {
                    if (!provider.enabled) continue;

                    await load(provider, anime, excludedEpisodes);
                }
            }
        }
    }

    async onModuleInit() {
    }
}