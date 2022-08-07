import { Logger, Module, NotFoundException, OnModuleInit } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import ScraperService from '../scraper/scraper.service';

import path from 'path';
import utc from 'dayjs/plugin/utc';
import dayjs from 'dayjs';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { fork } from 'child_process';
import InformationService from './information.service';
import { Queue } from 'bull';
import ProxyService from '../proxy/proxy.service';
import DatabaseModule from '../database/database.module';
import ScraperModule from '../scraper/scraper.module';
import MappingModule from '../mapping/mapping.module';

@Module({
    imports: [BullModule.registerQueue({
        name: "scrape"
    }), DatabaseModule, MappingModule],
    providers: [InformationService, ProxyService, ScraperService],
    exports: [InformationService]
})
export default class InformationModule implements OnModuleInit {
    constructor(@InjectQueue("scrape") private readonly queue: Queue, private readonly databaseService: DatabaseService, private readonly informationService: InformationService, private readonly scraperService: ScraperService) {
        if (!process.env.TESTING) dayjs.extend(utc);
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async updateAnime() {
        Logger.debug("Now we start refetching currently releasing anime from Anilist");
        performance.mark("information-fetch-start");

        await this.informationService.initializeWorker();

        await this.informationService.executeWorker("refetch");
    }

    @Cron(CronExpression.EVERY_12_HOURS)
    async resyncAnime() {
        await this.informationService.executeWorker("resync");
    }

    // Every 10 minutes, we check anime that have don't have "enough episode" stored in the database (mostly the anime source sites update slower than Anilist because subs stuff) so we sync that part more frequently
    @Cron(CronExpression.EVERY_10_MINUTES)
    async checkForUpdatedEpisodes() {
        const animeList = await this.databaseService.anime.findMany({
            where: {
                status: {
                    in: ["RELEASING", "FINISHED"]
                }
            },
            select: {
                id: true,
                currentEpisode: true,
                episodes: {
                    include: {
                        sources: true
                    }
                }
            }
        });

        const scrapers = await this.scraperService.scrapers();

        await this.queue.add( { // Episode number are unique values, we can safely assume "if the current episode progress count is not even equal to the amount of episodes we have in database, the anime entry should be outdated"
            animeIds: animeList.filter(anime => anime.currentEpisode !== anime.episodes.filter(episode => episode.sources.length < scrapers.filter(scraper => !scraper.infoOnly && scraper.enabled).length).length).map(anime => anime.id),
            infoOnly: false
        }, {
            priority: 6,
            removeOnComplete: true
        });
    }

    @Cron(CronExpression.EVERY_HOUR)
    async refreshAnimeInfo() {
        const animeList = await this.databaseService.anime.findMany({
            where: {
                episodes: {
                    some: {
                        title: null
                    }
                }
            },
            select: {
                id: true
            }
        });

        await this.queue.add( {
            animeIds: animeList.map(anime => anime.id),
            infoOnly: true
        }, {
            priority: 6,
            removeOnComplete: true
        });
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async pushToScrapeQueue() {
        const eligibleToScrape = await this.databaseService.anime.findMany({
            where: {
                status: {
                    in: ["RELEASING"]
                }
            },
            select: {
                id: true
            }
        });

        await this.queue.add({
            animeIds: eligibleToScrape.map(anime => anime.id),
            infoOnly: false
        }, {
            priority: 5,
            removeOnComplete: true
        });
    }

    async onModuleInit() {

    }
}