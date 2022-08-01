import { Controller, Get } from '@nestjs/common';
import RapidCloudService from '../rapid-cloud/rapid-cloud.service';

@Controller("/tool")
export default class ToolController {
    constructor(private readonly rapidCloudService: RapidCloudService) {
    }

    @Get("/rapid-cloud/server-id")
    async rapidCloudServerId() {
        return this.rapidCloudService.serverId;
    }
}