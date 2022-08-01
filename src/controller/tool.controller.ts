import { Controller, Get } from '@nestjs/common';
import RapidCloudService from '../rapid-cloud/rapid-cloud.service';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller("/tool")
@ApiExcludeController()
export default class ToolController {
    constructor(private readonly rapidCloudService: RapidCloudService) {
    }

    @Get("/rapid-cloud/server-id")
    async rapidCloudServerId() {
        return this.rapidCloudService.serverId;
    }
}