import {
    CACHE_MANAGER,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import DatabaseService from '../database/database.service';
import ScraperService from '../scraper/scraper.service';
import RapidCloudService from '../rapid-cloud/rapid-cloud.service';
import Source from '../entity/source.entity';

@Injectable()
export default class SourceService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache, private readonly databaseService: DatabaseService, private readonly scraperService: ScraperService, private readonly rapidCloudService: RapidCloudService) {
    }

    async getSource(id): Promise<Source> {
        const cacheKey = `source-${id}`;

        let cachedSource = await this.cacheManager.get(cacheKey);
        if (cachedSource) return JSON.parse(<string>cachedSource);

        const source = await this.databaseService.source.findUnique({
            where: {
                id: id
            },
            include: {
                website: true
            }
        });

        let videoUrl, subtitleUrl, referer, headers, browser = false;

        if (source.type === "DIRECT") { // No need to proxy the request, redirect to raw source directly
            videoUrl = source.url;
        } else {
            const scraper = (await this.scraperService.scrapers()).find(s => s.websiteMeta.id === source.websiteId);
            const url = source.referer ? new URL(source.referer.replaceAll("//", "/")) : undefined;

            let rawSource;
            try {
                rawSource = await scraper.getRawSource(source.url, {
                    referer: url?.href,
                    ...(this.rapidCloudService.serverId && {
                        serverId: this.rapidCloudService.serverId
                    })
                });
            } catch (e) {
                rawSource = scraper.getSourceConsumet(url || source.url);
                Logger.error(`Error occurred while trying to fetch source ID ${source.id}, falling back to Consumet service`, e);

                if (!rawSource) throw new InternalServerErrorException("Cannot obtain the URL for this source, please contact administrators.");
            }

            videoUrl = rawSource.video;
            subtitleUrl = rawSource.subtitle;
            referer = rawSource.referer;
            headers = rawSource.headers;
        }

        return {
            id: source.id,
            url: videoUrl,
            subtitle: subtitleUrl,
            referer: referer,
            headers: headers,
            priority: source.website.priority,
            browser: source.browser,
            website: source.website.url,
        };
    }
}