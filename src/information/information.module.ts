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
import MappingModule from '../mapping/mapping.module';
import DatabaseModule from '../database/database.module';
import slugify from 'slugify';
import { chunkArray, sleep } from '../helper/tool';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
    imports: [EventEmitterModule.forRoot({ global: false }), BullModule.registerQueue({
        name: "scrape"
    }), MappingModule, DatabaseModule],
    providers: [InformationService, ScraperService, DatabaseService],
    exports: [InformationService]
})
export default class InformationModule implements OnApplicationBootstrap {
    private readonly seasons: string[];

    constructor(private readonly databaseService: DatabaseService, private readonly informationService: InformationService, private readonly scraperService: ScraperService) {
        if (!process.env.TESTING) dayjs.extend(utc);
        this.seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async updateAnime() {
        Logger.debug("Now we start refetching currently releasing anime from Anilist");
        performance.mark("information-fetch-start");

        this.informationService.refetchAnime().then(() => {
            performance.mark("information-fetch-end");

            Logger.debug(`Scheduled refetch finished, spent ${performance.measure("information-fetch", "information-fetch-start", "information-fetch-end").duration.toFixed(2)}ms`)
        }).catch(error => {
            Logger.error(`Scheduled refetch resulted in an error: ${error}`);
        });
    }

    @Cron(CronExpression.EVERY_6_HOURS)
    async updateReleasingAnime() {
        Logger.debug("Now we start synchronizing non-finished anime from database to make them up-to-date with Anilist");
        performance.mark("information-non-finished-info-update-start");

        this.informationService.updateAnime({
            status: {
                in: ["RELEASING", "CANCELLED", "HIATUS"]
            }
        }).then(() => {
            performance.mark("information-non-finished-info-update-end");

            Logger.debug(`Scheduled synchronizing non-finished anime info with anilist finished, spent ${performance.measure("information-non-finished-info-update", "information-non-finished-info-update-start", "information-non-finished-info-update-end").duration.toFixed(2)}ms`)
        }).catch(error => {
            Logger.error(`Scheduled synchronizing non-finished anime info with anilist resulted in an error: ${error}`);
        });
    }

    @Cron(CronExpression.EVERY_12_HOURS)
    async resyncAnime() {
        Logger.debug("Now we start scheduled resync for all anime");
        performance.mark("resync-start");

        this.informationService.resyncAnime().then(() => {
            performance.mark("resync-end");

            Logger.debug(`Scheduled resync for all anime finished, spent ${performance.measure("resync", "resync-start", "resync-end").duration.toFixed(2)}ms`);
        }).catch(error => {
            Logger.error(`Scheduled resync for all anime resulted in an error: ${error}`);
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

            Logger.debug(`Scheduled resync for releasing anime finished, spent ${performance.measure("resync-releasing", "resync-start-releasing", "resync-end-releasing").duration.toFixed(2)}ms`);
        }).catch(error => {
            Logger.error(`Scheduled resync for releasing anime resulted in an error: ${error}`);
        });
    }

    // Every 20 minutes, we check anime that have don't have "enough episode" stored in the database (mostly the anime source sites update slower than Anilist because subs stuff) so we sync that part more frequently
    @Cron("*/20 * * * *")
    async checkForUpdatedEpisodes() {
        this.updateOnCondition({
            status: {
                in: ["RELEASING"]
            }
        }, 2).then(() => {
            Logger.debug("Finished checking updated episodes for releasing anime");
        });
    }

    @Cron(CronExpression.EVERY_2_HOURS)
    async checkForUpdatedEpisodesForAnimeJustFinished() {
        let currentYear = new Date().getFullYear();
        const currentSeason = Math.floor((new Date().getMonth() / 12 * 4)) % 4;

        const season = this.seasons[currentSeason];
        const previousSeason = currentSeason === 0 ? this.seasons[3] : this.seasons[currentSeason - 1];
        const previousYear = currentSeason === 0 ? currentYear - 1 : currentYear;

        this.updateOnCondition({
            OR: [
                {
                    status: {
                        in: ["FINISHED"]
                    },
                    year: currentYear,
                    season: season
                },
                {
                    status: {
                        in: ["FINISHED"]
                    },
                    year: previousYear,
                    season: previousSeason
                }
            ]
        }, 2).then(() => {
            Logger.debug("Finished checking updated episodes for releasing anime that just finished");
        });
    }

    // Give a higher priority to anime that are either releasing or finished but there's no episode available
    @Cron(CronExpression.EVERY_2_HOURS)
    async checkForUpdatedEpisodesForAnimeWithoutEpisodes() {
        this.updateOnCondition({
            status: {
                in: ["FINISHED"]
            },
            lastEpisodeUpdate: null
        }, 5).then(() => {
            Logger.debug("Finished checking updated episodes for anime without episodes");
        });
    }

    @Cron(CronExpression.EVERY_WEEK)
    async checkForUpdatedEpisodesForFinishedAnime() {
        this.updateOnCondition({
            status: {
                in: ["FINISHED"]
            }
        }).then(() => {
            Logger.debug("Finished checking updated episodes for finished anime");
        });
    }

    async updateOnCondition(condition, priority = 6) {
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

        animeList = animeList.filter(anime => {
            return anime.currentEpisode !== anime.episodes.filter(episode => episode.sources.length === scrapers.filter(scraper => !scraper.infoOnly && scraper.enabled).length).length
        });

        await this.informationService.addToScrapeQueue(animeList.map(anime => anime.id), priority);
    }

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

        Promise.all(ids.map(id => this.informationService.fetchRelations(id.id))).then(() => {
            Logger.debug("Finished updating relations");
        }).catch(e => {
            Logger.error(`Error happened while trying to update relations`, e, e.stack);
        });
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

        await this.informationService.addToScrapeQueue(eligibleToScrape.map(anime => anime.id), 5);
    }

    async onApplicationBootstrap() {
    }
}