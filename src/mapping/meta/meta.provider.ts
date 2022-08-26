import Prisma from '@prisma/client';
import { AnimeMeta } from '../../types/global';
import { Cache } from 'cache-manager';

export default abstract class MetaProvider {
    public enabled = false;
    public abstract name;

    protected readonly cacheManager: Cache;

    protected constructor(cacheManager: Cache) {
        this.cacheManager = cacheManager;
    }

    abstract loadMeta(anime: Prisma.Anime & { episodes: Prisma.Episode[] }, excludedEpisodes?: number[]): Promise<AnimeMeta>;
}