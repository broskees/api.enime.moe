import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import MappingService from '../mapping/mapping.service';
import RapidCloudService from './rapid-cloud/rapid-cloud.service';
import { Throttle } from '@nestjs/throttler';

@Controller("/tool")
@ApiExcludeController()
export default class ToolController {
    constructor(private readonly rapidCloudService: RapidCloudService, private readonly mappingService: MappingService) {
    }

    @Get("/mapping/:provider/:id")
    @Throttle(60, 2)
    async externalProviderMapping(@Param("provider") provider: string, @Param("id") id: number | string) {
        if (provider === "type") return {};

        const mappings = await this.mappingService.getMappings();

        provider = provider.toLowerCase();
        if (provider === "myanimelist") provider = "mal";

        // @ts-ignore
        let mapping = mappings.find(mapping => {
            return mapping[provider.endsWith("_id") ? provider : `${provider}_id`] == id
        });
        if (!mapping) return {};
        delete mapping["type"];

        return mapping;
    }

    @Get("/rapid-cloud/server-id")
    async rapidCloudServerId() {
        return this.rapidCloudService.serverId;
    }
}