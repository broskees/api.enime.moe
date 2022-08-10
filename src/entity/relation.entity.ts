import { ApiProperty } from '@nestjs/swagger';

export default class Relation {
    @ApiProperty({
        description: "Related anime ID",
        type: Object
    })
    anime: {
        id: String
    }

    @ApiProperty({
        description: "Type of the relation",
        example: "SEQUEL"
    })
    type: "PREQUEL" | "SEQUEL" | "PARENT" | "SIDE_STORY";
}