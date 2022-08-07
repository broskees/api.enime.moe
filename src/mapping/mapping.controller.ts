import { CacheTTL, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import Anime from '../entity/anime.entity';
import { SkipThrottle } from '@nestjs/throttler';
import DatabaseService from '../database/database.service';

@SkipThrottle()
@Controller("/mapping")
@ApiTags("mapping")
export default class MappingController {
    constructor(private readonly databaseService: DatabaseService) {
    }

    @Get(":provider/:id")
    @ApiOperation({ operationId: "Get anime", summary: "Get an anime object in the service with ID from an external provider" })
    @ApiParam({
        name: "provider",
        type: String,
        required: true,
        description: `The name of external provider. You can put any provider allowed in ["mal", "anidb", "kitsu", "anilist", "thetvdb", "anisearch", "livechart", "notify.moe", "anime-planet"]. Reminder: For TheTVDb there might be multiple anime entries with same TheTVDb ID (such as Komi Can't Communicate Season 1/2), in this case Enime will only return the first anime entry that matches the TVDb ID provided`
    })
    @ApiParam({
        name: "id",
        type: String,
        required: true,
        description: "The ID of that external provided specified above"
    })
    @ApiResponse({
        status: 200,
        description: "The found anime object with the ID provided",
        type: Anime
    })
    @ApiResponse({
        status: 404,
        description: "The anime cannot be found within the database for given ID"
    })
    @CacheTTL(300)
    async get(@Param("provider") provider: string, @Param("id") id: string): Promise<Anime> {
        const anime = await this.databaseService.anime.findFirst({
            where: {
                mappings: {
                    path: [provider],
                    equals: id
                }
            },
            include: {
                genre: {
                    select: {
                        name: true
                    }
                },
                episodes: {
                    select: {
                        id: true,
                        number: true,
                        title: true,
                        sources: {
                            select: {
                                id: true
                            }
                        }
                    },
                }
            }
        });

        if (!anime) throw new NotFoundException(`The anime mapped with provider ${provider} under ID ${id} does not exist`);

        return {
            ...anime,
            genre: anime.genre.map(g => g.name),
            // @ts-ignore
            episodes: anime.episodes.filter(episode => episode.sources?.length).map(episode => {
                return {
                    ...episode,
                    sources: episode.sources.map(source => {
                        return source.id
                    })
                }
            })
        };
    }
}