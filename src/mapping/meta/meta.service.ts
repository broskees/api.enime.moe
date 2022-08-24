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

    async synchronize(anime) {
        if (!anime.episodes?.length) anime = await this.databaseService.anime.findUnique({
            where: {
                id: anime.id
            },
            include: {
                episodes: true
            }
        });

        const updatedEpisodeInfo = [];

        const load = async (provider, anime) => {
            const animeMeta = await provider.loadMeta(anime);
            if (!animeMeta) return false;

            for (let episode of anime.episodes) {
                const episodeMeta = animeMeta.episodes.find(e => e.number === episode.number);
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

            res = await load(provider, anime);
        }

        if (anime.episodes.length && (!res || updatedEpisodeInfo.some(e => !e.titleVariations || !e.title || !e.description || !e.airedAt))) { // Anidb does not provide episode image, we should not bother it for this
            for (let provider of this.backupProviders) {
                if (!provider.enabled) continue;

                await load(provider, anime);
            }
        }
    }

    async onModuleInit() {
    }
}