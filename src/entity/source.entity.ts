import { ApiProperty } from '@nestjs/swagger';

export default class Source {
    @ApiProperty({
        description: "Source ID",
        example: "cl5xgxxh2255801mnzpsq6xx8"
    })
    id: string;

    @ApiProperty({
        description: "Source url",
        example: "https://wwwx11.gogocdn.stream/videos/hls/WxUDti4tkwAmrtGldi_bHA/1659252376/188170/b5130f24fdc45958b378fa29fdb01a2c/ep.9.1657690095.m3u8"
    })
    url: string;

    @ApiProperty({
        description: "The source priority, some sources are verified to be more stable than others, higher priority usually means more stability",
        example: 1
    })
    priority: number;

    @ApiProperty({
        description: "The source website name",
        example: "Gogoanime"
    })
    website: string;

    @ApiProperty({
        description: "Sometimes the source website provides an external file as subtitle, this indicates if the current source has an external subtitle file",
        example: false
    })
    subtitle: boolean;

    @ApiProperty({
        description: "Sometimes the source website requires a `Referer` header in order to obtain the video file, this field is what you need to put for `Referer`",
        example: undefined
    })
    referer: string | undefined;

    @ApiProperty({
        description: "Sometimes the source website requires special headers in order to obtain the video file, this field is what you need to put for those headers",
        example: undefined
    })
    headers: object | undefined;

    @ApiProperty({
        description: "Due to CORS, some resources cannot be played by browsers, this field indicates whether the source can be safely played by browser. NOTE: If you are developing anything that's not a website then you can disregard this field",
        example: true
    })
    browser: boolean
}