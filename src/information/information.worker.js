import { AIRING_ANIME, SPECIFIC_ANIME } from './anilist-queries';
import { GraphQLClient } from 'graphql-request';

const anilistBaseEndpoint = "https://graphql.anilist.co";

function getClient(proxy = false) {
    return new GraphQLClient(proxy ? `https://proxy.enime.moe?url=${encodeURIComponent(anilistBaseEndpoint)}` : anilistBaseEndpoint, {
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-api-key": process.env.PROXY_API_KEY
        }
    });
}

export async function loadAnimeFromAnilist({ condition, includePrevious = true }) {
    const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
    const client = getClient();

    const trackingAnime = [];
    let current = true;
    let hasNextPageCurrent = true, hasNextPagePast = true;
    let currentPage = 1;

    if (!condition.season) includePrevious = false;
    let year = condition.year;

    let previousSeason = condition.season ? condition.season - 1 : undefined;
    if (previousSeason !== undefined && previousSeason < 0) previousSeason = 3;

    const requestVariables = {
        ...(condition.season && { season: condition.season } ),
        page: currentPage,
        ...(year && { year: year } ),
        ...(condition.status && { status: condition.status } ),
        ...(condition.format && { format: condition.format } )
    };

    // No way I'm going to write types for these requests...
    while (hasNextPageCurrent || (includePrevious && hasNextPagePast)) {
        let animeList = await client.request(AIRING_ANIME, requestVariables);

        // @ts-ignore
        trackingAnime.push(...animeList.Page.media);

        if (current) {
            hasNextPageCurrent = animeList.Page.pageInfo.hasNextPage;
            currentPage++;

            if (!hasNextPageCurrent && includePrevious) {
                current = false;
                requestVariables.season = seasons[previousSeason];
                requestVariables.year = seasons[condition.season] === "SPRING" ? year - 1 : year;

                currentPage = 1;
            }
        } else {
            hasNextPagePast = animeList.Page.pageInfo.hasNextPage;
            currentPage++;
        }

        requestVariables.page = currentPage;
    }

    return trackingAnime;
}

export async function fetchAnilistAnime({ anilistId }) {
    const client = getClient(true);

    let animeList = await client.request(SPECIFIC_ANIME, {
        id: anilistId
    });

    return animeList?.Page?.media[0];
}

export async function fetchAnilistEdges({ anime, preloaded = undefined }) {
    let anilistAnime = preloaded;
    if (!anilistAnime) {
        anilistAnime = (await fetchAnilistAnime({ anilistId: anime.anilistId }));
    }

    return anilistAnime?.relations?.edges;
}