import {
    CacheTTL,
    Controller,
    Get,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    Param
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import Source from '../entity/source.entity';
import DatabaseService from '../database/database.service';
import ScraperService from '../scraper/scraper.service';
import SocketService from '../socket/socket.service';
import { NoCache } from '../cache/no-cache.decorator';

@Controller("/source")
export default class SourceController {
    constructor(private readonly databaseService: DatabaseService, private readonly scraperService: ScraperService, private readonly socketService: SocketService) {
    }

    @NoCache()
    @Get("server-id")
    async serverId() {
        return this.socketService.serverId;
    }

    @Get(":id")
    @CacheTTL(1000 * 60 * 60 * 4)
    @ApiOperation({ operationId: "Get source", summary: "Get a source object with provided ID" })
    @ApiResponse({
        status: 200,
        description: "The found source object with the ID provided",
        type: Source
    })
    @ApiResponse({
        status: 404,
        description: "The source cannot be found within the database for given ID"
    })
    async source(@Param("id") id: string): Promise<Source> {
        const source = await this.databaseService.source.findUnique({
            where: {
                id: id
            },
            include: {
                website: true
            }
        });

        if (!source) throw new NotFoundException("The source does not exist.");

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
                    ...(this.socketService.serverId && {
                        serverId: this.socketService.serverId
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