import { Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { GraphQLClient } from 'graphql-request';
import utc from 'dayjs/plugin/utc';
import dayjs from 'dayjs';
import DatabaseService from '../database/database.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import slugify from 'slugify';
import cuid from 'cuid';
import { resolve } from 'path';
import MappingService from '../mapping/mapping.service';
import Prisma from '@prisma/client';
import MetaService from '../mapping/meta/meta.service';
import Piscina from 'piscina';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import AnimeRefetchEvent from '../events/impl/anime.refetch.event';

@Injectable()
export default class InformationService implements OnApplicationBootstrap {
    private readonly client: GraphQLClient;
    private readonly anilistBaseEndpoint = "https://graphql.anilist.co";
    private piscina: Piscina;

    constructor(private eventEmitter: EventEmitter2, @Inject("DATABASE") private readonly databaseService: DatabaseService, private readonly mappingService: MappingService, private readonly metaService: MetaService, @InjectQueue("scrape") private readonly queue: Queue) {
        this.client = new GraphQLClient(this.anilistBaseEndpoint, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });

        if (!process.env.TESTING) dayjs.extend(utc);

        this.piscina = new Piscina({
            filename: resolve(__dirname, "information.worker.js")
        });
    }

    async onApplicationBootstrap() {
    }

    @OnEvent("anime.refetch", { async: true })
    async handleAnimeRefetchEvent(event: AnimeRefetchEvent) {
        if (event.animeIds?.length) {
            await this.queue.add( {
                animeIds: event.animeIds,
                infoOnly: false
            }, {
                priority: event.specific ? 1 : 4,
                removeOnComplete: true
            });
        }

        if (event.createdAnimeIds?.length) {
            this.resyncAnime(event.createdAnimeIds).then(() => {
                Logger.debug("Resync-ed newly created anime(s)");
            }).catch(error => {
                Logger.error(`Newly created anime(s) failed ot resync: ${error}`);
            });
        }
    }

    async fetchRelations(id: string | number, preloaded = undefined) {
        const conditions = [];
        if (typeof id === "number") conditions.push({
            anilistId: id as number
        });
        else conditions.push({
            id: id as string
        });

        const anime = await this.databaseService.anime.findFirst({
            where: {
                OR: conditions
            }
        });

        if (!anime) return;

        const edges = await this.piscina.run({
            anime: anime,
            preloaded: preloaded
        }, { name: "fetchAnilistEdges" });

        const relations = await Promise.all(edges.filter(edge => edge.node.id !== anime.anilistId && edge.node.type === "ANIME" && Prisma.RelationType[edge.relationType]).map(edge => {
            return new Promise((resolve) => {
                this.fetchAnimeByAnilistID(edge.node.id)
                    .then(relatedAnimeId => {
                        resolve({
                            type: edge.relationType,
                            id: relatedAnimeId
                        })
                    })
                    .catch(e => {
                        Logger.error(e)
                    })
            })
        }));

        const parsedRelations = [];

        for (let r of relations) {
            let forwardRelation = await this.databaseService.relation.findUnique({
                where: {
                    type_animeId: {
                        animeId: r.id,
                        type: r.type
                    }
                }
            });

            if (!forwardRelation) {
                forwardRelation = await this.databaseService.relation.create({
                    data: {
                        animeId: r.id,
                        type: r.type,
                        linked: {
                            connect: {
                                id: anime.id
                            }
                        }
                    }
                })
            } else {
                forwardRelation = await this.databaseService.relation.update({
                    where: {
                        id: forwardRelation.id
                    },
                    data: {
                        linked: {
                            connect: {
                                id: anime.id
                            }
                        }
                    }
                })
            }

            try { // Ignore Prisma's complain about "unique constraint violation", there is no way this can be non-unique I'm not sure why Prisma is complaining so
                await this.databaseService.anime.update({
                    where: {
                        id: anime.id
                    },
                    data: {
                        linkedRelations: {
                            connect: {
                                id: forwardRelation.id,
                                type_animeId: {
                                    animeId: forwardRelation.animeId,
                                    type: forwardRelation.type
                                }
                            }
                        }
                    }
                })
            } catch (e) {

            }
            parsedRelations.push(forwardRelation);
        }

        return parsedRelations;
    }

    async resyncAnime(ids: string[] | undefined = undefined) {
        const mappings = await this.mappingService.getMappings();

        let animeList;

        if (!ids?.length) {
            animeList = await this.databaseService.anime.findMany({
                where: {
                    status: {
                        not: "RELEASING"
                    }
                },
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
            })));
        }

        return await Promise.allSettled(animeList.map(anime => {
            return new Promise<number>((resolve, reject) => {
                // @ts-ignore
                let mapping = mappings?.find(mapping => mapping?.anilist_id == anime.anilistId);
                if (!mapping) reject(0);

                const mappingObject: object = {};

                for (let k in mapping) {
                    if (k === "type") continue;

                    mappingObject[k.replace("_id", "")] = mapping[k];
                }

                this.databaseService.anime.update({
                    where: {
                        id: anime.id
                    },
                    data: {
                        mappings: {
                            ...mappingObject
                        }
                    },
                    include: {
                        episodes: true
                    }
                }).then(dbAnime => {
                    if (dbAnime.episodes.some(ep => !ep.airedAt || !ep.title || !ep.titleVariations || !ep.image || !ep.description)) this.metaService.synchronize(dbAnime).catch(error => reject(error)).then(() => resolve(0));
                    else resolve(0)
                }).catch(error => {
                    Logger.error(error);
                    reject(error)
                })
            })
        })).catch(error => {
            Logger.error(error);
        });
    }

    async convertToDbAnime(anilistAnime, includeMapping = true) {
        let nextEpisode = anilistAnime.nextAiringEpisode, currentEpisode = 0;
        if (nextEpisode) {
            currentEpisode = nextEpisode.episode - 1;
            nextEpisode = dayjs.unix(nextEpisode.airingAt).utc().toISOString();
        } else {
            if (anilistAnime.status === "FINISHED") {
                currentEpisode = anilistAnime.episodes;
            }
        }

        let mappingObject = undefined;

        if (includeMapping) {
            mappingObject = {};

            const mappings = await this.mappingService.getMappings() as unknown as any[];
            let mapping = mappings?.find(mapping => mapping?.anilist_id == anilistAnime.id);

            if (mapping) {
                for (let k in mapping) {
                    if (k === "type") continue;

                    mappingObject[k.replace("_id", "")] = mapping[k];
                }
            }
        }

        slugify.extend({"×": "x", "/": "-", "?": "-question", ";": "-"})

        return {
            title: anilistAnime.title,
            anilistId: anilistAnime.id,
            slug: slugify(anilistAnime.title.english || anilistAnime.title.romaji).toLowerCase(),
            coverImage: anilistAnime.coverImage.extraLarge,
            color: anilistAnime.coverImage.color,
            bannerImage: anilistAnime.bannerImage,
            description: anilistAnime.description,
            duration: anilistAnime.duration,
            popularity: anilistAnime.popularity,
            averageScore: anilistAnime.averageScore,
            status: anilistAnime.status,
            season: anilistAnime.season || "UNKNOWN",
            seasonInt: anilistAnime.seasonInt,
            year: anilistAnime.seasonYear,
            format: anilistAnime.format || "UNKNOWN",
            next: nextEpisode,
            ...(!!mappingObject && {
                mappings: mappingObject
            }),
            genre: {
                connectOrCreate: anilistAnime.genres.map(genre => {
                    return {
                        where: { name: genre },
                        create: { name: genre }
                    }
                })
            },
            currentEpisode: currentEpisode,
            synonyms: anilistAnime.synonyms
        };
    }

    async fetchAnimeByAnilistIDBatch(anilistIds) {
        anilistIds = anilistIds.filter(async anilistId => await this.databaseService.anime.findUnique({
            where: {
                anilistId: anilistId
            }
        }));

        const anilistAnimeList = await Promise.all(anilistIds.map(anilistId => {
            return new Promise((resolve, reject) => {
                this.piscina.run({
                    anilistId: anilistId
                }, { name: "fetchAnilistAnime" })
                    .then(anilistAnime => resolve(anilistAnime))
                    .catch(error => reject(error))
            })
        }));

        for (let anilistAnime of anilistAnimeList) {
            if (!anilistAnime) throw new NotFoundException("Such anime cannot be found from Anilist");

            const animeDbObject = await this.convertToDbAnime(anilistAnime);

            let animeDb = await this.databaseService.anime.upsert({
                where: {
                    anilistId: animeDbObject.anilistId
                },
                create: {
                    id: cuid(),
                    ...animeDbObject
                },
                update: {
                    ...animeDbObject
                }
            });

            await this.fetchRelations(animeDb.id, anilistAnime);
        }
    }

    async fetchAnimeByAnilistID(anilistId, force = false) {
        let animeDbUpdateId = undefined;

        let animeDb = await this.databaseService.anime.findUnique({
            where: {
                anilistId: anilistId
            }
        });

        if (!animeDb || force) {
            const anilistAnime = await this.piscina.run({
                anilistId: anilistId
            }, { name: "fetchAnilistAnime" });

            if (!anilistAnime) throw new NotFoundException("Such anime cannot be found from Anilist");

            const animeDbObject = await this.convertToDbAnime(anilistAnime, true);

            let id = animeDb ? animeDb.id : cuid();

            await this.databaseService.anime.upsert({
                where: {
                    anilistId: animeDbObject.anilistId
                },
                create: {
                    id: id,
                    ...animeDbObject
                },
                update: {
                    ...animeDbObject
                }
            });

            animeDbUpdateId = id;

            if (!animeDb) await this.fetchRelations(id, anilistAnime);
        }

        return animeDbUpdateId || animeDb.id;
    }

    async loadAnimeFromAnilist(condition, includePrevious = true) {
        const trackingAnime = await this.piscina.run({ condition: condition, includePrevious: includePrevious }, { name: "loadAnimeFromAnilist" });

        let response = await Promise.allSettled(trackingAnime.map(anime => {
            return new Promise((resolve, reject) => {
                this.convertToDbAnime(anime)
                    .then(animeDbObject => {
                        this.databaseService.anime.findUnique({
                            where: {
                                anilistId: anime.id
                            }
                        }).then(animeDb => {
                            if (!animeDb) {
                                let id = cuid();
                                return Promise.all([true, this.databaseService.anime.create({
                                    data: {
                                        id: id,
                                        ...animeDbObject
                                    }
                                })]);
                            } else {
                                const promises: [boolean, any, any] | [boolean, any] = [false, this.databaseService.anime.update({
                                    where: {
                                        anilistId: anime.id
                                    },
                                    data: {
                                        ...animeDbObject
                                    }
                                })];

                                if (animeDb.status === "RELEASING" && animeDbObject.currentEpisode > animeDb.currentEpisode) {
                                    // @ts-ignore
                                    promises.push(this.databaseService.episode.upsert({
                                        where: {
                                            animeId_number: {
                                                animeId: animeDb.id,
                                                number: animeDbObject.currentEpisode
                                            }
                                        },
                                        create: {
                                            anime: {
                                                connect: {
                                                    id: animeDb.id
                                                }
                                            },
                                            airedAt: animeDb.next,
                                            number: animeDbObject.currentEpisode
                                        },
                                        update: {
                                            airedAt: animeDb.next
                                        }
                                    }))
                                }

                                return Promise.all(promises);
                            }
                        }).then(([created, animeDb]) => {
                            return {
                                id: animeDb.id,
                                created: created,
                                requireUpdate: created || animeDb.currentEpisode !== animeDbObject.currentEpisode
                            }
                        }).then(data => {
                            resolve(data);
                        }).catch(error => {
                            reject(error)
                        })
                    })
            })
        }));

        // @ts-ignore
        response = response.filter(r => r.status === "fulfilled").map(r => r.value);

        await Promise.all(trackingAnime.map(anime => this.fetchRelations(anime.id, anime)));

        // @ts-ignore
        this.eventEmitter.emit("anime.refetch", new AnimeRefetchEvent(false, response.filter(r => r.requireUpdate).map(r => r.id)), response.filter(r => r.created).map(r => r.id));
    }

    async refetchAnime() {
        let currentYear = new Date().getFullYear();
        const currentSeason = Math.floor((new Date().getMonth() / 12 * 4)) % 4;

        await this.loadAnimeFromAnilist({
            // year: currentYear,
            // season: this.seasons[currentSeason],
            format: "TV",
            status: "RELEASING"
        }, true);
    }
}