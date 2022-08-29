import { Inject, Logger, Module, NotFoundException, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
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
import MappingModule from '../mapping/mapping.module';
import ProxyModule from '../proxy/proxy.module';
import DatabaseModule from '../database/database.module';
import slugify from 'slugify';
import { sleep } from '../helper/tool';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
    imports: [EventEmitterModule.forRoot({ global: false }), ProxyModule, BullModule.registerQueue({
        name: "scrape"
    }), MappingModule, DatabaseModule],
    providers: [InformationService, ProxyService, ScraperService, DatabaseService],
    exports: [InformationService]
})
export default class InformationModule implements OnApplicationBootstrap {
    constructor(@InjectQueue("scrape") private readonly queue: Queue, private readonly databaseService: DatabaseService, private readonly informationService: InformationService, private readonly scraperService: ScraperService) {
        if (!process.env.TESTING) dayjs.extend(utc);
    }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async updateAnime() {
        Logger.debug("Now we start refetching currently releasing anime from Anilist");
        performance.mark("information-fetch-start");

        this.informationService.refetchAnime().then(() => {
            performance.mark("information-fetch-end");

            Logger.debug(`Scheduled refetch finished, spent ${performance.measure("information-fetch", "information-fetch-start", "information-fetch-end").duration.toFixed(2)}ms`)
        });
    }

    @Cron(CronExpression.EVERY_12_HOURS)
    async resyncAnime() {
        Logger.debug("Now we start scheduled resync for all anime");
        performance.mark("resync-start");

        this.informationService.resyncAnime().then(() => {
            performance.mark("resync-end");

            Logger.debug(`Scheduled resync finished, spent ${performance.measure("resync", "resync-start", "resync-end").duration.toFixed(2)}ms`);
        });
    }

    @Cron(CronExpression.EVERY_HOUR)
    async resyncAnimeReleasing() {
        Logger.debug("Now we start scheduled resync for releasing anime");
        performance.mark("resync-start-releasing");

        const releasingAnime = await this.databaseService.anime.findMany({
            where: {
                status: "RELEASING"
            }
        });

        this.informationService.resyncAnime(releasingAnime.map(anime => anime.id)).then(() => {
            performance.mark("resync-end-releasing");

            Logger.debug(`Scheduled resync finished, spent ${performance.measure("resync-releasing", "resync-start-releasing", "resync-end-releasing").duration.toFixed(2)}ms`);
        });
    }

    // Every 10 minutes, we check anime that have don't have "enough episode" stored in the database (mostly the anime source sites update slower than Anilist because subs stuff) so we sync that part more frequently
    @Cron(CronExpression.EVERY_10_MINUTES)
    async checkForUpdatedEpisodes() {
        await this.updateOnCondition({
            status: {
                in: ["RELEASING"]
            }
        })
    }

    // Give a higher priority to anime that are either releasing or finished but there's no episode available
    @Cron(CronExpression.EVERY_30_MINUTES)
    async checkForUpdatedEpisodesForAnimeWithoutEpisodes() {
        await this.updateOnCondition({
            status: {
                in: ["FINISHED"]
            },
            lastEpisodeUpdate: null
        })
    }

    @Cron(CronExpression.EVERY_WEEK)
    async checkForUpdatedEpisodesForFinishedAnime() {
        await this.updateOnCondition({
            status: {
                in: ["FINISHED"]
            }
        })
    }

    async updateOnCondition(condition) {
        let animeList = await this.databaseService.anime.findMany({
            where: {
                ...condition
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

        let batch = [];
        let count = 0;
        animeList = animeList.filter(anime => anime.currentEpisode !== anime.episodes.filter(episode => episode.sources.length < scrapers.filter(scraper => !scraper.infoOnly && scraper.enabled).length).length);

        for (let i = 0; i < animeList.length; i++) { // Due to large volume of anime in the database, it's better if we batch the anime to multiple jobs
            let anime = animeList[i];
            if (count > 50 || i >= animeList.length - 1) {
                await this.queue.add( { // Episode number are unique values, we can safely assume "if the current episode progress count is not even equal to the amount of episodes we have in database, the anime entry should be outdated"
                    animeIds: batch,
                    infoOnly: false
                }, {
                    priority: 6,
                    removeOnComplete: true
                });

                batch = [];
                count = 0;
            } else {
                batch.push(anime.id)
            }
        }
    }

    /*
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
     */

    @Cron(CronExpression.EVERY_12_HOURS)
    async updateRelations() {
        const ids = await this.databaseService.anime.findMany({
            where: {
                OR: [
                    {
                        relations: {
                            none: {}
                        }
                    },
                    {
                        NOT: {
                            relations: {
                                some: {
                                    type: "PREQUEL"
                                }
                            }
                        }
                    },
                    {
                        NOT: {
                            relations: {
                                some: {
                                    type: "SEQUEL"
                                }
                            }
                        }
                    }
                ]

            },
            select: {
                id: true
            }
        });

        await Promise.all(ids.map(id => this.informationService.fetchRelations(id.id)));
    }

    @Cron(CronExpression.EVERY_WEEK)
    async pushToScrapeQueue() {
        const eligibleToScrape = await this.databaseService.anime.findMany({
            where: {
                status: {
                    in: ["RELEASING", "FINISHED"]
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

    async onApplicationBootstrap() {
        this.resyncAnimeReleasing()
    }
}