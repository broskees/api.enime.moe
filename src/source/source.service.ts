import {
    CACHE_MANAGER,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException
} from '@nestjs/common';
import DatabaseService from '../database/database.service';
import ScraperService from '../scraper/scraper.service';
import Source from '../entity/source.entity';
import RapidCloudService from '../tool/rapid-cloud/rapid-cloud.service';
import axios from '../helper/request';
import { Cache } from 'cache-manager';

@Injectable()
export default class SourceService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache, @Inject("DATABASE") private readonly databaseService: DatabaseService, private readonly scraperService: ScraperService, private readonly rapidCloudService: RapidCloudService) {
    }

    async getSource(id): Promise<Source> {
        const cacheKey = `source-${id}`;

        let cachedSource;

        if (process.env.PRODUCTION) {
            cachedSource = await this.cacheManager.get(cacheKey);
            if (cachedSource) {
                let cachedSourceValue = JSON.parse(<string>cachedSource);

                try {
                    const response = await axios.head(cachedSourceValue.url, {
                        timeout: 1000,
                        validateStatus: () => true
                    });
                    if (response.status === 200) return cachedSourceValue;
                    else await this.cacheManager.del(cacheKey);
                } catch (e) {
                    await this.cacheManager.del(cacheKey);
                }
            }
        }

        const source = await this.databaseService.source.findUnique({
            where: {
                id: id
            },
            include: {
                website: true
            }
        });

        if (!source) throw new NotFoundException("Cannot find the source with given ID");

        let videoUrl, subtitleUrl, referer, headers, browser = false;

        if (source.type === "DIRECT") { // No need to proxy the request, redirect to raw source directly
            videoUrl = source.target;
        } else {
            const scraper = (await this.scraperService.scrapers()).find(s => s.websiteMeta.id === source.websiteId);

            let rawSource;
            try {
                rawSource = await scraper.getRawSource(source.target, {
                    referer: source?.referer,
                    ...(this.rapidCloudService && {
                        decryptionKey: this.rapidCloudService.decryptionKey
                    })
                });
            } catch (e) {
                rawSource = await scraper.getSourceConsumet(source.target);
                Logger.error(`Error occurred while trying to fetch source ID ${source.id}, falling back to Consumet service`, e);

                if (!rawSource) throw new InternalServerErrorException("Cannot obtain the URL for this source, please contact administrators.");
            }

            videoUrl = rawSource.video;
            subtitleUrl = rawSource.subtitle?.find(subtitle => subtitle.lang?.toLowerCase() === "english")?.url;
            referer = rawSource.referer;
            headers = rawSource.headers;
            browser = rawSource.browser;
        }

        const sourceObject = {
            id: source.id,
            url: videoUrl,
            subtitle: subtitleUrl,
            referer: referer,
            headers: headers,
            priority: source.website.priority,
            browser: browser,
            website: source.website.url
        };

        if (process.env.PRODUCTION) await this.cacheManager.set(cacheKey, JSON.stringify(sourceObject), { ttl: 60 * 60 * 5 }); // 4 hour cache (actual expiry time is ~6 hours but just in case)

        // @ts-ignore
        return sourceObject;
    }
}