import { ApiProperty } from '@nestjs/swagger';

export default class Stats {
    @ApiProperty({
        description: "Number of anime in the database",
        example: 86
    })
    anime: number;

    @ApiProperty({
        description: "Number of episode in the database",
        example: 986
    })
    episode: number;

    @ApiProperty({
        description: "Number of websites that the system is actively scraping from",
        example: 2
    })
    website: number;

    @ApiProperty({
        description: "Number of source in the database",
        example: {
            total: 1217,
            individual: [
                {
                    name: "Gogoanime",
                    url: "https://gogoanime.lu",
                    count: 691
                },
                {
                    name: "Zoro",
                    url: "https://zoro.to",
                    count: 526
                }
            ]
        }
    })
    sources: object;
}