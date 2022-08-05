import { CacheTTL, Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Anime from '../entity/anime.entity';
import { clearAnimeField } from '../helper/model';
import { SkipThrottle } from '@nestjs/throttler';
import DatabaseService from '../database/database.service';

@SkipThrottle()
@ApiExcludeController()
@Controller("/mapping")
export default class MappingController {
    constructor(private readonly databaseService: DatabaseService) {
    }

    @Get(":provider/:id")
    @ApiOperation({ operationId: "Get anime", summary: "Get an anime object in the service with ID or slug" })
    @ApiResponse({
        status: 200,
        description: "The found anime object with the ID or slug provided",
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

        clearAnimeField(anime);

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