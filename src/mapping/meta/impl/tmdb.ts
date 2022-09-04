import MetaProvider from '../meta.provider';
import { AnimeMeta, EpisodeMeta } from '../../../types/global';
import axios from 'axios';
import dayjs from 'dayjs';

export default class TmdbMetaProvider extends MetaProvider {
    public override name = "TmDB";

    private tmdbApiUrl = "https://api.themoviedb.org/3/";
    private tmdbImageUrl = "https://image.tmdb.org/t/p/original";

    override async loadMeta(anime, excludedEpisodes, parsedMapping): Promise<AnimeMeta> {
        // @ts-ignore
        const aniDbId = anime?.mappings?.anidb;
        if (!aniDbId) return undefined;

        const tvdb = parsedMapping[String(aniDbId)];
        if (!tvdb) return undefined;

        if (tvdb.id === "movie" || tvdb.season === "a") return undefined;

        const { data: tmdb } = await axios.get(this.buildTmdbRequestUrl(this.tmdbApiUrl + `/find/${tvdb}?language=en-US&external_source=tvdb_id`));

        if (!tmdb?.tv_results?.length) return undefined;

        const result = tmdb.tv_results[0];

        const tmdbId = result.id;
        const { data: tmdbSeasonInfo, status: tmdbSeasonInfoStatus } = await axios.get(this.buildTmdbRequestUrl(this.tmdbApiUrl + `/tv/${tmdbId}/season/${tvdb.season}`), { validateStatus: () => true });
        if (tmdbSeasonInfoStatus !== 200) return undefined;

        const episodeMetas: EpisodeMeta[] = [];

        for (let episode of tmdbSeasonInfo.episodes) {
            episodeMetas.push({
                image: this.tmdbImageUrl + episode.still_path,
                // @ts-ignore
                title: episode.name,
                titleVariations: undefined,
                description: episode.overview,
                airedAt: episode.air_date ? dayjs(episode.air_date).toDate() : undefined,
                number: episode.number + (tvdb.offset || 0)
            });
        }

        return {
            episodes: episodeMetas
        };
    }

    buildTmdbRequestUrl(url) {
        const parsedUrl = new URL(url);
        // @ts-ignore
        parsedUrl.searchParams.append("api_key", process.env.TMDB_API_KEY);

        return parsedUrl.href;
    }
}