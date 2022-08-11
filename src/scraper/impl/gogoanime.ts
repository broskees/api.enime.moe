import Scraper, { USER_AGENT } from '../scraper';
import * as cheerio from 'cheerio';
import { AnimeWebPage, Episode, RawSource, SourceType } from '../../types/global';
import fetch from 'node-fetch';
import * as similarity from 'string-similarity';
import { deepMatch } from '../../helper/match';
import GogoCDN from '../../extractor/impl/gogocdn';
import { sleep } from '../../helper/tool';

// Credit to https://github.com/riimuru/gogoanime/blob/46edf3de166b7c5152919d6ac12ab6f55d9ed35b/lib/helpers/extractors/goload.js
export default class GogoanimeScraper extends Scraper {
    override enabled = true;
    override infoOnly = false;
    override priority = 1;
    override consumetServiceUrl = "https://consumet-api.herokuapp.com/anime/gogoanime/";

    async getSourceConsumet(sourceUrl: string | URL): Promise<RawSource> {
        if (typeof sourceUrl === "string") sourceUrl = new URL(sourceUrl);

        let response = (await (await fetch(`${this.consumetServiceUrl}${sourceUrl.pathname}`)).json());
        let rawSourceUrl = response.sources[0].url;

        return {
            video: rawSourceUrl,
            subtitle: undefined,
            referer: response.headers.Referer,
            browser: true
        }
    }

    override async getRawSource(sourceUrl): Promise<RawSource> {
        const url = sourceUrl instanceof URL ? sourceUrl : new URL(sourceUrl);
        const video = await (new GogoCDN().extract(url));

        return {
            video: video.url,
            referer: url.href,
            browser: true
        }
    }

    async fetch(path: string, startNumber: number, endNumber: number): Promise<Episode[]> {
        let url = `${this.url()}${path}`;

        let response = this.get(url, {}, true);
        let responseText = await (await response).data;

        let $ = cheerio.load(responseText);

        const movieId = $("#movie_id").attr("value");

        url = `https://ajax.gogo-load.com/ajax/load-list-episode?ep_start=${startNumber}&ep_end=${endNumber}&id=${movieId}`;
        response = this.get(url, {}, true);
        responseText = await (await response).data;

        $ = cheerio.load(responseText);

        const episodesSource = [];

        $("#episode_related > li").each((i, el) => {
            episodesSource.push({
                number: parseInt($(el).find(`div.name`).text().replace("EP ", "")),
                url: `${this.url()}${$(el).find(`a`).attr('href')?.trim()}`,
            });
        });

        const episodesMapped = [];

        for (let episode of episodesSource) {
            if (!episode.url) continue;

            let embedResponse = this.get(episode.url, {}, true);
            let embedResponseText = await (await embedResponse).data;

            let $$ = cheerio.load(embedResponseText);

            let embedUrl = $$("iframe").first().attr("src");

            if (!embedUrl) continue;

            episodesMapped.push({
                ...episode,
                url: `https:${embedUrl}`,
                title: undefined,
                format: "m3u8",
                referer: episode.url,
                type: SourceType.PROXY
            });
        }

        return episodesMapped;
    }

    async match(t): Promise<AnimeWebPage> {
        let url = `${this.url()}/search.html?keyword=${encodeURIComponent(t.current)}`;

        // Credit to https://github.com/AniAPI-Team/AniAPI/blob/main/ScraperEngine/resources/gogoanime.py
        let response = this.get(url, {}, true);
        const responseText = await (await response).data;
        let $ = cheerio.load(responseText);

        let showElement = $(".last_episodes > ul > li").first();

        if (!showElement?.length) return undefined;

        let link = $(showElement).find(".name > a");
        let title = link.attr("title"), path = link.attr("href");

        // Bruh..
        let pass = false;
        if (!title) return undefined;

        let cleanedTitle = this.clean(title)

        for (let alt of [t.english, t.romaji, t.native, ...(t.synonyms || [])]) {
            if (alt && deepMatch(alt, title)) {
                pass = true;
                break;
            }
        }

        if (!t.original && t.current && similarity.compareTwoStrings(t.current.toLowerCase(), cleanedTitle.toLowerCase()) >= 0.75) pass = true;

        if (!pass) return undefined;

        return {
            title: title,
            path: path
        };
    }
    
    clean(title) {
        return title.replaceAll(/(th|rd|nd|st) (Season)/gmi, "").replaceAll(/\([^\(]*\)$/gmi, "").trimEnd();
    }

    name(): string {
        return "Gogoanime";
    }

    url(): string {
        return "https://gogoanime.lu";
    }

}