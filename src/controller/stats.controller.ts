import { SkipThrottle } from '@nestjs/throttler';
import { CacheTTL, Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Stats from '../entity/stats.entity';
import DatabaseService from '../database/database.service';

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
    @CacheTTL(300)
    async stats(): Promise<Stats> {
        const stats = await this.databaseService.$transaction([this.databaseService.anime.count(), this.databaseService.episode.count(), this.databaseService.source.count(), this.databaseService.website.count()]);

        return {
            anime: stats[0],
            episode: stats[1],
            source: stats[2],
            website: stats[3]
        };
    }
}