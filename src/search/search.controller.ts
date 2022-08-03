import { CacheTTL, Controller, Get, Param, Query } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { createPaginator } from 'prisma-pagination';
import { PaginateFunction } from 'prisma-pagination/src';
import Prisma from '@prisma/client';
import { clearAnimeField } from '../helper/model';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import Search from '../entity/search.entity';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import Anime from '../entity/anime.entity';

@Controller("/search")
@ApiTags("search")
export default class SearchController {
    searchPaginator: PaginateFunction = undefined;

    constructor(private readonly databaseService: DatabaseService, private readonly elasticsearchService: ElasticsearchService) {
        this.searchPaginator = createPaginator({ })
    }

    @Get(":query")
    @CacheTTL(300)
    @Throttle(90, 60)
    @ApiOperation({ operationId: "Search Anime", summary: "Search anime based on query" })
    @ApiResponse({
        status: 200,
        description: "The list of anime matched from search query",
        type: Anime,
        isArray: true
    })
    @ApiResponse({
        status: 429,
        description: "The API throttling has been reached, check response headers for more information"
    })
    @ApiQuery({
        type: Number,
        name: "page",
        required: false,
        description: "The page number of search list, default to 1"
    })
    @ApiQuery({
        type: Number,
        name: "perPage",
        required: false,
        description: "How many elements per page should this response have? Minimum: 1, maximum: 100"
    })
    async search(@Param("query") query: string, @Query("page") page: number, @Query("perPage") perPage: number) {
        if (!page || page <= 0) page = 1;
        if (!perPage || perPage <= 0) perPage = 20;
        perPage = Math.min(100, perPage);

        /*
        if (!process.env.ELASTICSEARCH_HOST) {
            // @ts-ignore
            const results = await this.searchPaginator<Prisma.Anime, Prisma.AnimeFindManyArgs>(this.databaseService.anime, {
                orderBy: {
                    updatedAt: "desc"
                },
                include: {
                    genre: {
                        select: {
                            name: true
                        }
                    }
                },
                where: {
                    OR: [
                        {
                            AND: query.split(" ").map(q => {
                                return {
                                    title_english: {
                                        contains: q,
                                        mode: "insensitive"
                                    }
                                }
                            })
                        },
                        {
                            AND: query.split(" ").map(q => {
                                return {
                                    title_romaji: {
                                        contains: q,
                                        mode: "insensitive"
                                    }
                                }
                            })
                        }
                    ]
                }
            }, { page: page, perPage: perPage })

            results.data = results.data.map(anime => {
                clearAnimeField(anime);

                return {
                    ...anime,
                    // @ts-ignore
                    genre: anime.genre.map(g => g.name)
                }
            })

            return results;
        } else {

        }

         */

        const searchResult = await this.elasticsearchService.search({
            from: (page - 1) * perPage,
            size: perPage,
            query: {
                query_string: {
                    query: decodeURIComponent(query),
                }
            }
        });

        return searchResult.hits.hits.map(hit => hit._source);
    }
}
