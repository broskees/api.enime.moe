import { CacheTTL, Controller, Get, NotFoundException, Param, UseInterceptors } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import { SkipThrottle } from '@nestjs/throttler';
import {  ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import Anime from '../entity/anime.entity';
import Episode from '../entity/episode.entity';
import EpisodeService from '../episode/episode.service';

@SkipThrottle()
@Controller("/anime")
@ApiTags("anime")
export default class AnimeController {
    constructor(private readonly databaseService: DatabaseService, private readonly episodeService: EpisodeService) {
    }

    @Get(":id")
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
    async get(@Param("id") id: string): Promise<Anime> {
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
                                id: true
                            }
                        }
                    },
                },
                relations: {
                    include: {
                        anime: true
                    }
                }
            }
        });

        if (!anime) throw new NotFoundException(`The anime with ID or slug ${id} does not exist`);

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