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
        description: "Episode title",
        example: null
    })
    image: string | null;

    @ApiProperty({
        description: "Episode source IDs",
        type: String,
        isArray: true
    })
    sources: string[];
}