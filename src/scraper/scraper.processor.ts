import { Job, DoneCallback } from 'bull';
import { ScraperJobData, SourceType } from '../types/global';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import ScraperModule from './scraper.module';
import cuid from 'cuid';
import dayjs from 'dayjs';
import DatabaseService from '../database/database.service';
import ScraperService from './scraper.service';
import MetaService from '../mapping/meta/meta.service';
import axios from 'axios';

export default async function (job: Job<ScraperJobData>, cb: DoneCallback) {
    const app = await NestFactory.createApplicationContext(ScraperModule);

    try {
        let scraperService = app.select(ScraperModule).get(ScraperService);
        let databaseService = app.select(ScraperModule).get(DatabaseService);
        let metaService = app.select(ScraperModule).get(MetaService);

        const { animeIds: ids, infoOnly } = job.data;

        const updated = [];

        let progress = 0;

        Logger.debug(`Received a job to scrape ${ids.length} anime, info only mode: ${infoOnly}`);

        for (let id of ids) {
            let anime = await databaseService.anime.findUnique({
                where: {
                    id
                },
                include: {
                    _count: {
                        select: { episodes: true },
                    }
                }
            });

            if (!anime) {
                Logger.debug(`Scraper queue detected an ID ${id} but its corresponding anime entry does not exist in the database. Skipping this job.`);
                continue;
            }

            if (anime.status === "NOT_YET_RELEASED") {
                Logger.debug(`Scraper queue detected an ID ${id} is not yet released, skipping this job.`);
                continue;
            }

            let malSyncData;

            // @ts-ignore
            if (anime.mappings.mal) {
                // @ts-ignore
                malSyncData = (await axios.get(`https://api.malsync.moe/mal/anime/${anime.mappings.mal}`, { validateStatus: () => true })).data;

                try {
                    malSyncData = malSyncData?.Sites
                } catch (e) {

                }
            }

            let requireMetaSync = false;

            let lastChecks = anime.lastChecks || {};
            let lastEpisodeUpdate = anime.lastEpisodeUpdate;

            try {
                for (let scraper of await scraperService.scrapers()) {
                    if (infoOnly && !scraper.infoOnly) continue;

                    const title = anime.title;
                    title["synonyms"] = anime.synonyms;

                    let lastCheckedTime = dayjs(lastChecks ? lastChecks[scraper.websiteMeta.id] || 0 : 0);
                    const status = anime.status;

                    const current = dayjs(new Date());

                    if (status === "FINISHED" && current.year() - anime.year > 1 && lastCheckedTime.diff(current, "week") <= 4) {
                        continue;
                    } else if (status === "HIATUS" && !!anime.next) {
                        const next = dayjs(anime.next);

                        if (next.isAfter(current) && next.diff(current, "day") >= 3) continue;
                    }

                    let matchedAnimeEntry;

                    if (malSyncData) {
                        const scraperKey = Object.keys(malSyncData).find(key => key.toLowerCase() === scraper.name().toLowerCase());
                        if (scraperKey && malSyncData[scraperKey]) {
                            const keys = Object.keys(malSyncData[scraperKey]);
                            let entryKey = keys.find(key => !key.includes("dub") && !key.includes("uncensored"));
                            if (anime.format === "TV") { // Sometimes MalSync trolls and put movie adaption in piracy site mappings (e.g. Fate UBW), we better handle this part
                                let tvKey = keys.find(key => !key.includes("dub") && !key.includes("uncensored") && key.includes("tv"));
                                if (tvKey) entryKey = tvKey;
                            }

                            if (entryKey) {
                                let malSyncEntry = malSyncData[scraperKey][entryKey];

                                matchedAnimeEntry = {
                                    title: malSyncEntry.title,
                                    path: (new URL(malSyncEntry.url)).pathname?.replace("gogoanime.lu", "gogoanime.ee")
                                }
                            }
                        }
                    }

                    //  if (!matchedAnimeEntry) matchedAnimeEntry = await scraperModule.matchAnime(anime.title, scraper);
                    if (!matchedAnimeEntry) continue;

                    lastChecks[scraper.websiteMeta.id] = Date.now();

                    let episodeToScrapeLower = Number.MAX_SAFE_INTEGER, episodeToScraperHigher = Number.MIN_SAFE_INTEGER;

                    let excludedNumbers = [];

                    const episodesWithSourceTransactions = [];

                    if (!Number.isNaN(anime.currentEpisode)) {
                        for (let i = 0; i <= anime.currentEpisode; i++) {
                            episodesWithSourceTransactions.push(databaseService.episode.findUnique({
                                where: {
                                    animeId_number: {
                                        animeId: anime.id,
                                        number: i
                                    }
                                },
                                include: {
                                    sources: true
                                }
                            }));
                        }
                    }

                    const episodesWithSource = await databaseService.$transaction(episodesWithSourceTransactions);
                    for (let i = 0; i < episodesWithSource.length; i++) {
                        const episodeWithSource = episodesWithSource[i];

                        if (episodeWithSource) {
                            let exclude = false;

                            if (episodeWithSource.sources.some(source => source.websiteId === scraper.websiteMeta.id)) exclude = true;

                            if (exclude) {
                                excludedNumbers.push(episodeWithSource.number);
                                continue;
                            }
                        }

                        episodeToScrapeLower = Math.min(episodeToScrapeLower,i);
                        episodeToScraperHigher = Math.max(episodeToScraperHigher, i);
                    }

                    if (episodeToScraperHigher === Number.MIN_SAFE_INTEGER || episodeToScrapeLower === Number.MAX_SAFE_INTEGER) continue;

                    try {
                        if (infoOnly && scraper.infoOnly) excludedNumbers = []; // If we're only updating titles, no need to exclude episodes from scraping since sometimes sites update titles slower than the sources

                        let scrapedEpisodes = scraper.fetch(matchedAnimeEntry.path, episodeToScrapeLower, episodeToScraperHigher, excludedNumbers);
                        if (scrapedEpisodes instanceof Promise) scrapedEpisodes = await scrapedEpisodes;

                        if (!scrapedEpisodes) continue;
                        if (Array.isArray(scrapedEpisodes) && !scrapedEpisodes.length) continue;

                        if (!Array.isArray(scrapedEpisodes)) scrapedEpisodes = [scrapedEpisodes];
                        if (scrapedEpisodes.length > anime.currentEpisode) continue; // STOP! This anime source site uses a different episode numbering strategy that it will potentially break the database. Don't bother use this anime's information from this site

                        for (let scrapedEpisode of scrapedEpisodes) {
                            if (Number.isNaN(scrapedEpisode.number) || scrapedEpisode.number % 1 !== 0) continue; // Do not scrape #"NaN" episodes or ".5" episodes

                            if (scrapedEpisode.number > anime.currentEpisode) continue; // Piracy sites tend to troll sometimes and publish wrong episodes (e.g. ep6 but it's actually ep5 and ep6 isn't even out yet)

                            let episodeDb = await databaseService.episode.findUnique({
                                where: {
                                    animeId_number: {
                                        animeId: anime.id,
                                        number: scrapedEpisode.number
                                    }
                                }
                            });

                            if (!episodeDb) {
                                requireMetaSync = true;

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
                                if (!episodeDb.airedAt) requireMetaSync = true;

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

                                let scrapedEpisodeDb = await databaseService.source.findUnique({
                                    where: {
                                        episodeId_websiteId: {
                                            episodeId: episodeDb.id,
                                            websiteId: scraper.websiteMeta.id
                                        }
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
                                            target: url,
                                            resolution: scrapedEpisode.resolution,
                                            format: scrapedEpisode.format,
                                            referer: scrapedEpisode.referer?.trim()
                                        }
                                    });

                                    updated.push({
                                        // @ts-ignore
                                        anime: title.userPreferred,
                                        animeSlug: anime.slug,
                                        episodeTitle: episodeDb.title,
                                        episodeNumber: episodeDb.number,
                                        episodeId: episodeDb.id,
                                        source: scraper.name()
                                    });

                                    lastEpisodeUpdate = new Date();
                                    Logger.debug(`Updated an anime with episode number ${episodeDb.number} under ID ${anime.id}`);
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

            await databaseService.anime.update({
                where: {
                    id: anime.id
                },
                data: {
                    lastChecks: lastChecks,
                    lastEpisodeUpdate: lastEpisodeUpdate
                }
            });
            if (requireMetaSync) await metaService.synchronize(anime);
        }

        progress++;
        await job.progress(progress);

        if (updated.length) {
            const groupedUpdates = updated.reduce(function (r, a) {
                r[a.source] = r[a.source] || [];
                r[a.source].push(a);
                return r;
            }, {});

            for (let groupUpdateKey of Object.keys(groupedUpdates)) {
                const groupUpdate = groupedUpdates[groupUpdateKey];
                await axios.post(process.env.DISCORD_WEBHOOK_URL, {
                    "content": `There ${groupUpdate.length <= 1 ? "is an update" : "are multiple updates"} to the Enime database`,
                    "embeds": [{
                        "description": groupUpdate.map(update => {
                            return `${update.anime} Episode ${update.episodeNumber} ${update.episodeTitle ? `- ${update.episodeTitle}` : ""} (Watch it [here](https://enime.moe/watch/${update.animeSlug}/${update.episodeNumber}) on Enime.moe)`
                        }).join("\n"),
                        "url": `https://api.enime.moe`,
                        "color": 15198183,
                        "author": {
                            "name": `Provided by ${groupUpdateKey || "Unknown"}`
                        },
                        "footer": {
                            "text": "Enime Project"
                        },
                        "timestamp": new Date().toISOString(),
                        "fields": []
                    }],
                }, {
                    headers: {"Content-Type": "application/json"}
                });
            }
        }

        cb(null, "Done");
    } catch (e) {
        console.log(e)
        cb(e);
    }

    await app.close();
}
