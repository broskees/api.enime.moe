import { CacheTTL, Controller, Get, NotFoundException, Param, Query, UseInterceptors } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import Anime from '../entity/anime.entity';
import Episode from '../entity/episode.entity';
import EpisodeService from '../episode/episode.service';

@SkipThrottle()
@Controller("/anime")
@ApiTags("anime")
export default class AnimeController {
    constructor(private readonly databaseService: DatabaseService) {
    }

    @Get(":id/episodes")
    @ApiOperation({ operationId: "Get anime episodes", summary: "Get an anime object's episodes in the service with ID or slug" })
    @ApiResponse({
        status: 200,
        description: "The found anime object's episodes with the ID or slug provided",
        type: Episode,
        isArray: true
    })
    @ApiResponse({
        status: 404,
        description: "The anime cannot be found within the database for given ID"
    })
    @CacheTTL(300)
    async getEpisodes(@Param("id") id: string): Promise<Episode[]> {
        const anime = await this.databaseService.anime.findFirst({
            where: {
                OR: [
                    {
                        id: id
                    },
                    {
                        slug: id
                    }
                ]
            },
            select: {
                episodes: {
                    select: {
                        id: true,
                        number: true,
                        title: true,
                        titleVariations: true,
                        description: true,
                        image: true,
                        airedAt: true,
                        sources: {
                            select: {
                                id: true,
                                target: true
                            }
                        }
                    }
                }
            }
        });

        if (!anime) throw new NotFoundException(`The anime with ID or slug ${id} does not exist`);

        anime.episodes = anime.episodes.filter(episode => episode.sources?.length).sort((a, b) => a.number - b.number);

        // @ts-ignore
        return anime.episodes;
    }

    @Get(":id")
    @ApiQuery({ name: "omit_episodes", required: false, description: "If episodes from anime object should be omitted. Useful for load times with anime with a lot of episodes"})
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
    async get(@Param("id") id: string, @Query("omit_episodes") omitEpisodes = false): Promise<Anime> {
        const anime = await this.databaseService.anime.findFirst({
            where: {
                OR: [
                    {
                        id: id
                    },
                    {
                        slug: id
                    }
                ]
            },
            include: {
                genre: {
                    select: {
                        name: true
                    }
                },
                ...(!omitEpisodes && {
                    episodes: {
                        select: {
                            id: true,
                            number: true,
                            title: true,
                            titleVariations: true,
                            description: true,
                            image: true,
                            airedAt: true,
                            sources: {
                                select: {
                                    id: true,
                                    target: true
                                }
                            }
                        },
                    }
                }),
                relations: {
                    include: {
                        anime: true
                    }
                }
            }
        });

        if (!anime) throw new NotFoundException(`The anime with ID or slug ${id} does not exist`);

        if (!omitEpisodes) anime.episodes = anime.episodes.filter(episode => episode.sources?.length).sort((a, b) => a.number - b.number);

        // @ts-ignore
        return {
            ...anime,
            genre: anime.genre.map(g => g.name),
            // @ts-ignore
            ...(!omitEpisodes && {
                episodes: anime.episodes
            })
        };
    }
}