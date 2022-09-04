import TvdbMetaProvider from './impl/tvdb';
import AnidbMetaProvider from './impl/anidb';
import TmdbMetaProvider from './impl/tmdb';

export async function loadMeta({ name, anime, excluded, mapping }) {
    let provider;
    if (name === "TvDB") provider = new TvdbMetaProvider();
    else if (name === "TmDB") provider = new TmdbMetaProvider();
    else if (name === "AniDB") provider = new AnidbMetaProvider();

    if (!provider) return undefined;

    return await provider.loadMeta(anime, excluded, mapping);
}