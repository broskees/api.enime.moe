import { SkipThrottle } from '@nestjs/throttler';
import { CacheTTL, Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Stats from '../entity/stats.entity';
import DatabaseService from '../database/database.service';
import { NoCache } from '../cache/no-cache.decorator';

@SkipThrottle()
@Controller("/stats")
@ApiTags("stats")
export default class StatsController {
    constructor(private readonly databaseService: DatabaseService) {
    }

    @Get()
    @ApiOperation({ operationId: "Get stats", summary: "Get general stats about the API system" })
    @ApiResponse({
        status: 200,
        description: "The stats object",
        type: Stats
    })
    @NoCache()
    async stats(): Promise<Stats> {
        const stats = await this.databaseService.$transaction([this.databaseService.anime.count(), this.databaseService.episode.count(), this.databaseService.source.count(), this.databaseService.website.count()]);

        const sources = (await this.databaseService.website.findMany({
            include: {
                _count: {
                    select: { sources: true },
                },
            },
        })).map(website => {
            return {
                name: website.name,
                url: website.url,
                count: website._count.sources
            }
        });

        return {
            anime: stats[0],
            sources: {
                total: stats[2],
                individual: sources
            },
            episode: stats[1],
            website: stats[3]
        };
    }
}