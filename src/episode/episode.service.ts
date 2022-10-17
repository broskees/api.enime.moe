import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import DatabaseService from '../database/database.service';

@Injectable()
export default class EpisodeService {
    constructor(private readonly databaseService: DatabaseService) {
    }

    async getEpisodeByAnimeIdentifier(animeId: string, episodeNumber: number) {
        if (Number.isNaN(episodeNumber)) throw new BadRequestException("The requested episode number has to be valid.");

        const episode = await this.databaseService.episode.findFirst({
            where: {
                number: Number(episodeNumber),
                anime: {
                    OR: [
                        {
                            slug: animeId
                        },
                        {
                            id: animeId
                        }
                    ]
                }
            },
            ...this.selectQuery()
        });

        if (!episode) throw new NotFoundException(`The episode with anime ID/slug ${animeId} and episode number ${episodeNumber} does not exist`);

        return this.processEpisode(episode);
    }

    async getEpisodeById(id: string) {
        const episode = await this.databaseService.episode.findUnique({
            where: {
                id: id
            },
            ...this.selectQuery()
        });

        if (!episode) throw new NotFoundException(`The episode with ID ${id} does not exist`);

        return this.processEpisode(episode);
    }

    private selectQuery() {
        return {
            select: {
                id: true,
                number: true,
                title: true,
                titleVariations: true,
                description: true,
                image: true,
                airedAt: true,
                createdAt: true,
                anime: {
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        episodes: true,
                        genre: {
                            select: {
                                name: true
                            }
                        },
                        bannerImage: true,
                        coverImage: true
                    }
                },
                sources: {
                    select: {
                        id: true,
                        target: true,
                        website: {
                            select: {
                                name: true,
                                priority: true,
                                subtitle: true,
                                url: true
                            }
                        }
                    }
                }
            }
        }
    }

    private processEpisode(episode) {
        const sources = episode.sources.map(source => {
            return {
                id: source.id,
                target: source.target,
                priority: source.website.priority,
                url: source.website.url
            }
        });

        sources.sort((a, b) => a.priority - b.priority);

        return {
            ...episode,
            anime: {
                // @ts-ignore
                ...episode.anime,
                episodes: episode.anime.episodes.sort((a, b) => a.number - b.number),
                genre: episode.anime.genre.map(g => g.name)
            },
            // @ts-ignore
            sources: sources
        };
    }
}