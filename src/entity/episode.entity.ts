import Anime from './anime.entity';
import Source from './source.entity';
import { ApiProperty } from '@nestjs/swagger';

export default class Episode {
    @ApiProperty({
        description: "Episode ID",
        example: "cl5xgxxh2255801mnzpsq6xx8"
    })
    id: string;

    @ApiProperty({
        description: "Anime that has this episode",
        type: Object
    })
    anime: object;

    @ApiProperty({
        description: "Episode number",
        example: 1
    })
    number: number;

    @ApiProperty({
        description: "Episode title",
        example: "Easy Does It"
    })
    title: string | null;

    @ApiProperty({
        description: "Episode title variations",
        example: {
            english: "Easy Does it",
            native: "Easy Does it"
        }
    })
    titleVariations: object | null;

    @ApiProperty({
        description: "Episode description",
        example: "Takina Inoue, a secret agent who protects the security of Japan called a “Lycoris,” is ordered to transfer to the café LycoReco in consequence of a certain incident. Takina is enthusiastic about returning to DA now that she’s buddied up with the super-elite No. 1 Lycoris (?) Chisato, but her job at LycoReco is just one weird thing after another!?"
    })
    description: string | null;

    @ApiProperty({
        description: "Episode image",
        example: "https://artworks.thetvdb.com/banners/v4/episode/8916235/screencap/62c116db01f7f.jpg"
    })
    image: string | null;

    @ApiProperty({
        description: "Episode aired date",
        example: "2022-07-02T07:00:00.000Z"
    })
    airedAt: Date | null;

    @ApiProperty({
        description: "Episode sources",
        type: Source,
        isArray: true
    })
    sources: Source[];
}