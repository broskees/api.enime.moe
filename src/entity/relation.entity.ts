import { ApiProperty } from '@nestjs/swagger';

export default class Relation {
    @ApiProperty({
        description: "Related anime",
        type: Object
    })
    anime: object;

    @ApiProperty({
        description: "Type of the relation",
        example: "SEQUEL"
    })
    type: "PREQUEL" | "SEQUEL" | "PARENT" | "SIDE_STORY";
}