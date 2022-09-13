import Prisma from '@prisma/client';
import { AnimeMeta } from '../../types/global';

export default abstract class MetaProvider {
    public enabled = false;
    public abstract name;

    async loadMeta(anime: Prisma.Anime & { episodes: Prisma.Episode[] }, excludedEpisodes?: number[], parsedMapping?: object, force: boolean = false): Promise<AnimeMeta> {
        return undefined;
    }
}