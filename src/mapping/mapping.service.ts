import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { Cache } from 'cache-manager';

@Injectable()
export default class MappingService {
    private readonly animeListMappingEndpoint = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";

    constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    }

    async getMappings() {
        let cachedMapping = await this.cacheManager.get("anime-list-mapping");
        if (!cachedMapping) {
            cachedMapping = await (await fetch(this.animeListMappingEndpoint)).json();
            await this.cacheManager.set("anime-list-mapping", JSON.stringify(cachedMapping), 1000 * 60 * 60 * 12);
        }
        else if (typeof cachedMapping === "string") {
            cachedMapping = JSON.parse(cachedMapping);
        }

        return cachedMapping;
    }
}