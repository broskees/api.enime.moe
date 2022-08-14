import { SkipThrottle } from '@nestjs/throttler';
import { Body, Controller, Get, Inject, Param, ParseArrayPipe, Put, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import InformationService from '../information/information.service';
import { NoCache } from '../decorator/no-cache.decorator';
import DatabaseService from '../database/database.service';
import ScraperService from '../scraper/scraper.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { isNumeric } from '../helper/tool';

@SkipThrottle()
@Controller("/admin")
@ApiExcludeController()
@UseGuards(AdminGuard)
export default class AdminController {
    constructor(private readonly informationService: InformationService, private readonly scraperService: ScraperService, @Inject("DATABASE") private readonly databaseService: DatabaseService, @InjectQueue("scrape") private readonly queue: Queue) {
    }

    @Put("/anime/batch")
    @NoCache()
    async fetchAnimeBatch(@Body(new ParseArrayPipe({ items: Number })) animeIds: number[]) {
        await this.informationService.executeWorker("fetch-specific-batch", animeIds);

        return "Done";
    }

    @Get("/anime/:id")
    @NoCache()
    async fetchAnime(@Param("id") animeId: number | string) {
        if (isNumeric(animeId)) if (typeof animeId === "string") {
            animeId = parseInt(animeId);
        }

        await this.informationService.executeWorker("fetch-specific", animeId);

        return "Done";
    }

    @Get("/fetch-relation/:id")
    @NoCache()
    async fetchRelation(@Param("id") id: string) {
        const callback = await this.informationService.fetchRelations(id);

        return callback;
    }

    @Get("/fetch-relation")
    @NoCache()
    async fetchRelationAll(@Param("id") id: string) {
        await this.informationService.executeWorker("fetch-relation", (await this.databaseService.anime.findMany({
            select: {
                id: true
            }
        })).map(a => a.id));

        return "Done";
    }

    @Get("/check-mapping")
    @NoCache()
    async checkPotentialWrongMapping() {
        const episodes = await this.wrongMappedEpisodes();

        return {
            total: episodes.length,
            episode: episodes.map(episode => {
                return {
                    id: episode.id,
                    animeId: episode.animeId,
                    number: episode.number
                }
            })
        };
    }

    @Get("/resync-anilist-information")
    @NoCache()
    async resyncAnilistInformation() {
        const animeList = await this.databaseService.anime.findMany();
        for (let anime of animeList) {
            if (Object.values(anime).some(value => value === null || value === undefined)) {
                await this.informationService.fetchAnimeByAnilistID(anime.anilistId);
            }
        }

        return "Done";
    }

    @Get("/fix-mapping")
    @NoCache()
    async fixMapping() {
        const episodes = await this.wrongMappedEpisodes();

        await this.databaseService.$transaction(episodes.map(episode => this.databaseService.episode.delete({
            where: {
                id: episode.id
            }
        })));

        const animeIds = new Set();
        episodes.forEach(episode => animeIds.add(episode.animeId));

        await this.queue.add( { // Always the highest priority
            animeIds: animeIds,
            infoOnly: false
        }, {
            priority: 1,
            removeOnComplete: true
        });

        return "Done";
    }

    async wrongMappedEpisodes() {
        const scraperCount = (await this.scraperService.scrapers()).filter(scraper => scraper.enabled && !scraper.infoOnly).length;

        let episodes = await this.databaseService.episode.findMany({
            select: {
                id: true,
                animeId: true,
                number: true,
                _count: {
                    select: {
                        sources: true
                    },
                },
            }
        });

        episodes = episodes.filter(episode => episode._count.sources > scraperCount);

        return episodes;
    }

    @Get("/refetch-all-anime")
    @NoCache()
    async refetchAllAnime() {
        const animeIds = await this.databaseService.anime.findMany({
            where: {
                status: {
                    not: "NOT_YET_RELEASED"
                }
            },
            select: {
                id: true
            }
        });

        await this.queue.add({
            animeIds: animeIds.map(anime => anime.id),
            infoOnly: false
        }, {
            priority: 5,
            removeOnComplete: true
        });

        return "Done";
    }
}