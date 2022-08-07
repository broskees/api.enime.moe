import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import fetch from 'node-fetch';
import { Cache } from 'cache-manager';

@Injectable()
export default class MappingService {
    private readonly animeListMappingEndpoint = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";

    constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    }

    async getMappings() {
        let cachedMapping = await this.cacheManager.get("anime-list-mapping");
        if (!cachedMapping) cachedMapping = await (await fetch(this.animeListMappingEndpoint)).json();
        else if (typeof cachedMapping === "string") {
            cachedMapping = JSON.parse(cachedMapping);
        }

        return cachedMapping;
    }

    @Cron(CronExpression.EVERY_12_HOURS)
    private async reloadMapping() {
        const mapping = await (await fetch(this.animeListMappingEndpoint)).json();
        await this.cacheManager.set("anime-list-mapping", JSON.stringify(mapping), 1000 * 60 * 60 * 12);
    }
}