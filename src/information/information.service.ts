import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { GraphQLClient } from 'graphql-request';
import utc from 'dayjs/plugin/utc';
import dayjs from 'dayjs';
import { AIRING_ANIME, SPECIFIC_ANIME } from './anilist-queries';
import DatabaseService from '../database/database.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import slugify from 'slugify';
import fetch from 'node-fetch';
import cuid from 'cuid';
import { fork } from 'child_process';
import path from 'path';

@Injectable()
export default class InformationService implements OnModuleInit {
    private readonly client: GraphQLClient;
    private readonly anilistBaseEndpoint = "https://graphql.anilist.co";
    private readonly seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
    private readonly animeListMappingEndpoint = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
    private informationWorker;

    constructor(private readonly databaseService: DatabaseService, @InjectQueue("scrape") private readonly queue: Queue) {
        this.client = new GraphQLClient(this.anilistBaseEndpoint, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });

        if (!process.env.TESTING) dayjs.extend(utc);
    }

    async onModuleInit() {
        await this.initializeWorker();
    }

    async executeWorker(event, data = undefined) {
        if (!this.informationWorker) throw new NotFoundException("Information worker not available, please wait for it to initialize");

        await this.informationWorker.send({
            event: event,
            data: data
        });
    }

    async initializeWorker() {
        if (!this.informationWorker) {
            this.informationWorker = fork(path.resolve(__dirname, "./information-worker"));

            this.informationWorker.on("message", async ({ event, data }) => {
                if (event === "refetch") {
                    const { created, updated } = data;

                    performance.mark("information-fetch-end");

                    const animeIds = [...created, ...updated];
                    Logger.debug(`Refetching completed, took ${performance.measure("information-fetch", "information-fetch-start", "information-fetch-end").duration.toFixed(2)}ms, created ${created.length} anime entries, updated ${updated.length} anime entries.`);

                    await this.queue.add( { // Higher priority than the daily anime sync
                        animeIds: animeIds,
                        infoOnly: false
                    }, {
                        priority: 4,
                        removeOnComplete: true
                    });

                    if (created.length) {
                        await this.informationWorker.send({
                            event: "resync",
                            data: created
                        });
                    }
                } else if (event === "fetch-specific") {
                    const updatedAnimeId = data;

                    if (updatedAnimeId) {
                        await this.queue.add( { // Highest priority since this is manual request
                            animeIds: [updatedAnimeId],
                            infoOnly: false
                        }, {
                            priority: 1,
                            removeOnComplete: true
                        });
                    }
                }
            });
        }
    }

    async resyncAnime(ids: string[] | undefined = undefined) {
        const mappings = await (await fetch(this.animeListMappingEndpoint)).json();

        let animeList;

        if (!ids?.length) {
            animeList = await this.databaseService.anime.findMany({
                select: {
                    id: true,
                    anilistId: true
                }
            });
        } else {
            animeList = await this.databaseService.$transaction(ids.map(id => this.databaseService.anime.findUnique({
                where: {
                    id: id
                },
                select: {
                    id: true,
                    anilistId: true
                }
            })))
        }

        const transactions = [];

        for (let anime of animeList) {
            let mapping = mappings.find(mapping => mapping?.anilist_id === anime.anilistId);
            if (!mapping) continue;

            const mappingObject: object = {};

            for (let k in mapping) {
                if (k === "type") continue;

                mappingObject[k.replace("_id", "")] = mapping[k];
            }

            transactions.push(this.databaseService.anime.update({
                where: {
                    id: anime.id
                },
                data: {
                    mappings: {
                        ...mappingObject
                    }
                }
            }));
        }

        await this.databaseService.$transaction(transactions);
    }

    convertToDbAnime(anilistAnime) {
        let nextEpisode = anilistAnime.nextAiringEpisode, currentEpisode = 0;
        if (nextEpisode) {
            currentEpisode = nextEpisode.episode - 1;
            nextEpisode = dayjs.unix(nextEpisode.airingAt).utc().toISOString();
        } else {
            if (anilistAnime.status === "FINISHED") {
                currentEpisode = anilistAnime.episodes;
            }
        }

        return {
            title: anilistAnime.title,
            anilistId: anilistAnime.id,
            slug: slugify(anilistAnime.title.userPreferred || anilistAnime.title.english || anilistAnime.title.romaji).toLowerCase(),
            coverImage: anilistAnime.coverImage.extraLarge,
            color: anilistAnime.coverImage.color,
            bannerImage: anilistAnime.bannerImage,
            description: anilistAnime.description,
            duration: anilistAnime.duration,
            popularity: anilistAnime.popularity,
            averageScore: anilistAnime.averageScore,
            status: anilistAnime.status,
            season: anilistAnime.season,
            seasonInt: anilistAnime.seasonInt,
            year: anilistAnime.seasonYear,
            next: nextEpisode,
            genre: {
                connectOrCreate: anilistAnime.genres.map(genre => {
                    return {
                        where: { name: genre },
                        create: { name: genre }
                    }
                })
            },
            currentEpisode: currentEpisode,
            synonyms: anilistAnime.synonyms,
            title_english: anilistAnime.title.english,
            title_romaji: anilistAnime.title.romaji
        };
    }

    async fetchAnimeByAnilistID(anilistId) {
        let animeDbUpdateId = undefined;

        const requestVariables = {
            id: anilistId
        };

        let animeList = await this.client.request(SPECIFIC_ANIME, requestVariables);

        const anilistAnime = animeList?.Page?.media[0];

        if (!anilistAnime) throw new NotFoundException("Such anime cannot be found from Anilist");

        const animeDbObject = this.convertToDbAnime(anilistAnime);

        let animeDb = await this.databaseService.anime.findUnique({
            where: {
                anilistId: anilistAnime.id
            }
        });

        if (!animeDb) { // Anime does not exist in our database, immediately push it to scrape
            let id = cuid();
            await this.databaseService.anime.create({
                data: {
                    id: id,
                    ...animeDbObject
                }
            });

            animeDbUpdateId = id;
        } else {
            if (animeDb.currentEpisode !== animeDbObject.currentEpisode) { // Anime exists in the database but current episode count from Anilist is not the one we stored in database. This means the anime might have updated, push it to scrape queue
                animeDbUpdateId = animeDb.id;
            }

            await this.databaseService.anime.update({
                where: {
                    anilistId: anilistAnime.id
                },
                data: {
                    ...animeDbObject
                }
            })
        }

        return animeDbUpdateId;
    }

    async refetchAnime(): Promise<object> {
        const currentSeason = Math.floor((new Date().getMonth() / 12 * 4)) % 4;

        let previousSeason = currentSeason - 1;
        if (previousSeason < 0) previousSeason = 3;

        const trackingAnime = [];
        let current = true;
        let hasNextPageCurrent = true, hasNextPagePast = true;
        let currentPage = 1;

        const requestVariables = {
            season: this.seasons[currentSeason],
            page: currentPage,
            year: new Date().getFullYear(),
            status: "RELEASING",
            format: "TV"
        };

        // No way I'm going to write types for these requests...
        while (hasNextPageCurrent || hasNextPagePast) {
            let animeList = await this.client.request(AIRING_ANIME, requestVariables);

            // @ts-ignore
            trackingAnime.push(...animeList.Page.media);

            if (current) {
                hasNextPageCurrent = animeList.Page.pageInfo.hasNextPage;
                currentPage++;

                if (!hasNextPageCurrent) {
                    current = false;
                    requestVariables.season = this.seasons[previousSeason];
                    requestVariables.year = this.seasons[currentSeason] === "SPRING" ? new Date().getFullYear() - 1 : new Date().getFullYear();

                    currentPage = 1;
                }
            } else {
                hasNextPagePast = animeList.Page.pageInfo.hasNextPage;
                currentPage++;
            }

            requestVariables.page = currentPage;
        }

        let createdAnimeIds = [];
        let updatedAnimeIds = [];

        const transactions = [];

        for (let anime of trackingAnime) {
            const animeDbObject = this.convertToDbAnime(anime);
            let animeDb = await this.databaseService.anime.findUnique({
                where: {
                    anilistId: anime.id
                }
            });

            if (!animeDb) { // Anime does not exist in our database, immediately push it to scrape
                let id = cuid();
                transactions.push(this.databaseService.anime.create({
                    data: {
                        id: id,
                        ...animeDbObject
                    }
                }));
                createdAnimeIds.push(id);
            } else {
                if (animeDb.currentEpisode !== animeDbObject.currentEpisode) { // Anime exists in the database but current episode count from Anilist is not the one we stored in database. This means the anime might have updated, push it to scrape queue
                    updatedAnimeIds.push(animeDb.id);
                }

                transactions.push(this.databaseService.anime.update({
                    where: {
                        anilistId: anime.id
                    },
                    data: {
                        ...animeDbObject
                    }
                }))
            }
        }

        await this.databaseService.$transaction(transactions);
        return {
            created: createdAnimeIds,
            updated: updatedAnimeIds
        }
    }
}