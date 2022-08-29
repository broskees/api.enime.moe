import EnimeEvent from '../event';

export default class AnimeRefetchEvent extends EnimeEvent {
    public specific: boolean;
    public animeIds: string[];
    public createdAnimeIds: string[];

    constructor(specific: boolean, animeIds: string[], createdAnimeIds: string[]) {
        super();

        this.specific = specific;
        this.animeIds = animeIds;
        this.createdAnimeIds = createdAnimeIds;
    }
}