import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Cron, CronExpression } from '@nestjs/schedule';
import DatabaseService from '../database/database.service';

@Injectable()
export default class SearchService implements OnModuleInit {
    animeIndex = "enime-anime";

    constructor(private readonly databaseService: DatabaseService, private readonly elasticSearchService: ElasticsearchService) {
    }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async indexAnime() {
        if (!(await this.elasticSearchService.indices.exists({
            index: this.animeIndex
        }))) {
            await this.elasticSearchService.indices.create({
                index: this.animeIndex
            });
        }

        const animeList = await this.databaseService.anime.findMany({
            include: {
                genre: {
                    select: {
                        name: true
                    }
                }
            }
        });

        for (let anime of animeList) {
            const genre = anime.genre.map(genre => genre.name);

            await this.elasticSearchService.update({
                index: this.animeIndex,
                id: anime.id,
                body: {
                    doc: {
                        ...anime,
                        genre: genre
                    },
                    doc_as_upsert: true
                }
            })
        }

        await this.elasticSearchService.indices.refresh({
            index: this.animeIndex
        });
    }

    async onModuleInit() {
        await this.indexAnime();
    }
}