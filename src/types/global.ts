import { ISubtitle } from '../extractor/types';

export interface AnimeMeta {
    episodes: EpisodeMeta[];
}

export interface EpisodeMeta {
    title: string | undefined;
    titleVariations: object | undefined;
    description: string | undefined;
    number: number;
    image: string | undefined;
    airedAt: Date | undefined;
}

export interface WebsiteMeta {
    id: string;
    // Maybe more fields so we use a class here
}

export interface ScraperJobData {
    animeIds: string[];
    infoOnly?: boolean;
}

export interface AnimeWebPage {
    title?: string;
    path: string;
}

export interface Episode {
    title?: string;
    url: string;
    number?: number;
    resolution?: string;
    format?: string;
    referer?: string;
    filler?: boolean;
    type: SourceType;
}

export interface RawSource {
    video?: string;
    subtitle?: ISubtitle[];
    referer?: string;
    headers?: object;
    browser: boolean;
}

export enum SourceType {
    DIRECT,
    PROXY
}