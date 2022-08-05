import { SkipThrottle } from '@nestjs/throttler';
import { CacheTTL, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Episode from '../entity/episode.entity';
import EpisodeService from '../episode/episode.service';

@SkipThrottle()
@Controller("/view")
@ApiTags("view")
export default class ViewController {
    constructor(private readonly episodeService: EpisodeService) {
    }

    @Get(":animeIdentifier/:episodeNumber")
    @ApiOperation({ operationId: "Get episode with anime ID/slug and episode number", summary: "Get an episode object with provided anime ID/slug and episode number" })
    @ApiResponse({
        status: 200,
        description: "The found episode object with the ID provided",
        type: Episode
    })
    @ApiResponse({
        status: 404,
        description: "The episode cannot be found within the database for given ID"
    })
    @CacheTTL(300)
    async getEpisode(@Param("animeIdentifier") animeIdentifier: string, @Param("episodeNumber") episodeNumber: number) {
        return this.episodeService.getEpisodeByAnimeIdentifier(animeIdentifier, episodeNumber);
    }
}