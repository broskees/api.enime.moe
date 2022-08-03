import { Job, DoneCallback } from 'bull';
import { ScraperJobData, SourceType } from '../types/global';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import ScraperModule from './scraper.module';
import cuid from 'cuid';
import dayjs from 'dayjs';
import DatabaseService from '../database/database.service';
import ScraperService from './scraper.service';
import fetch from 'node-fetch';

export default async function (job: Job<ScraperJobData>, cb: DoneCallback) {
    const app = await NestFactory.create(ScraperModule);
    let scraperModule = app.get(ScraperModule);
    let scraperService = app.select(ScraperModule).get(ScraperService);
    let databaseService = app.select(ScraperModule).get(DatabaseService);

    const { animeIds: ids, infoOnly } = job.data;

    const updated = [];

    let progress = 0;
    for (let id of ids) {
        Logger.debug(`Received a job to fetch anime with ID ${id}, info only mode: ${infoOnly}`);

        const anime = await databaseService.anime.findUnique({
            where: {
                id
            }
        });

        if (!anime) {
            Logger.debug(`Scraper queue detected an ID ${id} but its corresponding anime entry does not exist in the database. Skipping this job.`);
            return;
        }

        if (anime.status === "NOT_YET_RELEASED") {
            Logger.debug(`Scraper queue detected an ID ${id} is not yet released, skipping this job.`);
            return;
        }

        let malSyncData;

        // @ts-ignore
        if (anime.mappings.mal) {
            // @ts-ignore
            malSyncData = await fetch(`https://api.malsync.moe/mal/anime/${anime.mappings.mal}`);

            try {
                malSyncData = (await malSyncData.json())?.Sites
            } catch (e) {

            }
        }

        try {
            for (let scraper of await scraperService.scrapers()) {
                if (infoOnly && !scraper.infoOnly) continue;

                const title = anime.title;
                title["synonyms"] = anime.synonyms;


                let matchedAnimeEntry;

                if (malSyncData) {
                    const scraperKey = Object.keys(malSyncData).find(key => key.toLowerCase() === scraper.name().toLowerCase());
                    if (scraperKey && malSyncData[scraperKey]) {
                        const entryKey = Object.keys(malSyncData[scraperKey]).find(key => !key.includes("dub") && !key.includes("uncensored"));

                        if (entryKey) {
                            let malSyncEntry = malSyncData[scraperKey][entryKey];

                            matchedAnimeEntry = {
                                title: malSyncEntry.title,
                                path: (new URL(malSyncEntry.url)).pathname
                            }
                        }
                    }
                }

                if (!matchedAnimeEntry) matchedAnimeEntry = await scraperModule.matchAnime(anime.title, scraper);
                if (!matchedAnimeEntry) continue;

                let episodeToScrapeLower = Number.MAX_SAFE_INTEGER, episodeToScraperHigher = Number.MIN_SAFE_INTEGER;

                for (let i = 1; i <= anime.currentEpisode; i++) {
                    const episodeWithSource = await databaseService.episode.findFirst({
                        where: {
                            AND: [
                                {
                                    animeId: anime.id,
                                },
                                {
                                    number: i
                                }
                            ]
                        },
                        include: {
                            sources: true
                        }
                    });

                    if (episodeWithSource && episodeWithSource.sources.some(source => source.websiteId === scraper.websiteMeta.id)) {
                        continue;
                    }

                    episodeToScrapeLower = Math.min(episodeToScrapeLower, i);
                    episodeToScraperHigher = Math.max(episodeToScraperHigher, i);
                }

                try {
                    let scrapedEpisodes = scraper.fetch(matchedAnimeEntry.path, episodeToScrapeLower, episodeToScraperHigher);

                    if (scrapedEpisodes instanceof Promise) scrapedEpisodes = await scrapedEpisodes;
                    if (!scrapedEpisodes) continue;

                    if (!Array.isArray(scrapedEpisodes)) scrapedEpisodes = [scrapedEpisodes];
                    if (scrapedEpisodes.length > anime.currentEpisode) continue; // STOP! This anime source site uses a different episode numbering strategy that it will potentially break the database. Don't bother use this anime's information from this site

                    for (let scrapedEpisode of scrapedEpisodes) {
                        let episodeDb = await databaseService.episode.findFirst({
                            where: {
                                AND: [
                                    {
                                        animeId: anime.id
                                    },
                                    {
                                        number: scrapedEpisode.number
                                    }
                                ]
                            }
                        });

                        if (!episodeDb) {
                            episodeDb = await databaseService.episode.create({
                                data: {
                                    anime: {
                                        connect: { id: anime.id }
                                    },
                                    number: scrapedEpisode.number,
                                    title: scrapedEpisode.title
                                }
                            })
                        } else {
                            if (scrapedEpisode.title && !episodeDb.title) {
                                episodeDb = await databaseService.episode.update({
                                    where: {
                                        id: episodeDb.id
                                    },
                                    data: {
                                        title: scrapedEpisode.title
                                    }
                                });

                                Logger.debug(`Updated an anime with episode title ${episodeDb.title} #${scrapedEpisode.number} under ID ${anime.id}`);
                            }
                        }

                        if (!infoOnly && !scraper.infoOnly) {
                            let url = scrapedEpisode.url;
                            let scrapedEpisodeId = cuid();

                            let scrapedEpisodeDb = await databaseService.source.findFirst({
                                where: {
                                    episodeId: episodeDb.id,
                                    websiteId: scraper.websiteMeta.id
                                }
                            });

                            if (!scrapedEpisodeDb) { // Normally we should not check here but just in case
                                scrapedEpisodeDb = await databaseService.source.create({
                                    data: {
                                        id: scrapedEpisodeId,
                                        website: {
                                            connect: { id: scraper.websiteMeta.id }
                                        },
                                        episode: {
                                            connect: { id: episodeDb.id }
                                        },
                                        // @ts-ignore
                                        type: scrapedEpisode.type === SourceType.DIRECT ? "DIRECT" : "PROXY",
                                        url: url,
                                        resolution: scrapedEpisode.resolution,
                                        format: scrapedEpisode.format,
                                        referer: scrapedEpisode.referer?.trim()
                                    }
                                });

                                updated.push({
                                    // @ts-ignore
                                    anime: title.userPreferred,
                                    episodeTitle: episodeDb.title,
                                    episodeNumber: episodeDb.number,
                                    episodeId: episodeDb.id,
                                    source: scraper.name()
                                });

                                Logger.debug(`Updated an anime with episode number ${episodeDb.number} under ID ${anime.id}`);
                                await databaseService.anime.update({
                                    where: {
                                        id: anime.id
                                    },
                                    data: {
                                        lastEpisodeUpdate: dayjs().toISOString()
                                    }
                                })
                            }
                        }
                    }
                } catch (e) {
                    Logger.error(`Error with anime ID ${anime.id} with scraper on url ${scraper.url()}, skipping this job`, e);
                }
            }
        } catch (e) {
            Logger.error(e);
            Logger.error(e.stack);
        }

        progress++;
        await job.progress(progress);
    }

    if (updated.length) {
        const groupedUpdates = updated.reduce(function (r, a) {
            r[a.source] = r[a.source] || [];
            r[a.source].push(a);
            return r;
        }, {});

        let res = await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                "content": `There ${updated.length === 1 ? "is an update" : "are multiple updates"} to the Enime database`,
                "embeds": Object.keys(groupedUpdates).map(source => {
                    const updates = groupedUpdates[source];

                    return {
                        "description": updates.map(update => {
                            return `${update.anime} Episode ${update.episodeNumber} ${update.episodeTitle ? `- ${update.episodeTitle}` : ""} (Watch it [here](https://enime.moe/watch/${update.episodeId}) on Enime.moe)`
                        }).join("\n"),
                        "url": `https://api.enime.moe`,
                        "color": 15198183,
                        "author": {
                            "name": `Provided by ${source || "Unknown"}`
                        },
                        "footer": {
                            "text": "Enime Project"
                        },
                        "timestamp": new Date().toISOString(),
                        "fields": []
                    }
                }),
            })
        })

        console.log(await res.json())
    }

    cb(null, "Done");
}
