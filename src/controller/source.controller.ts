import {
    CacheTTL,
    Controller,
    Get,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    Param
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import Source from '../entity/source.entity';
import { NoCache } from '../cache/no-cache.decorator';
import SourceService from '../source/source.service';

@Controller("/source")
export default class SourceController {
    constructor(private readonly sourceService: SourceService) {
    }

    @Get(":id")
    @NoCache()
    @ApiOperation({ operationId: "Get source", summary: "Get a source object with provided ID" })
    @ApiResponse({
        status: 200,
        description: "The found source object with the ID provided",
        type: Source
    })
    @ApiResponse({
        status: 404,
        description: "The source cannot be found within the database for given ID"
    })
    async source(@Param("id") id: string): Promise<Source> {
        return await this.sourceService.getSource(id);
    }
}