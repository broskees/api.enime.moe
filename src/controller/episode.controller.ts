import { SkipThrottle } from '@nestjs/throttler';
import { CacheTTL, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Episode from '../entity/episode.entity';
import Source from '../entity/source.entity';
import EpisodeService from '../episode/episode.service';

@SkipThrottle()
@Controller("/episode")
@ApiTags("episode")
export default class EpisodeController {
    constructor(private readonly episodeService: EpisodeService) {
    }

    @Get(":id")
    @CacheTTL(300)
    @ApiOperation({ operationId: "Get episode", summary: "Get an episode object with provided ID" })
    @ApiResponse({
        status: 200,
        description: "The found episode object with the ID provided",
        type: Episode
    })
    @ApiResponse({
        status: 404,
        description: "The episode cannot be found within the database for given ID"
    })
    @ApiExtraModels(Source)
    async get(@Param("id") id: string) {
        return this.episodeService.getEpisodeById(id);
    }
}