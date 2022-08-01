import { SkipThrottle } from '@nestjs/throttler';
import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import InformationService from '../information/information.service';

@SkipThrottle()
@Controller("/admin")
@ApiExcludeController()
@UseGuards(AdminGuard)
export default class AdminController {
    constructor(private readonly informationService: InformationService) {
    }

    @Put("/anime")
    async fetchAnime(@Body() animeId) {
        await this.informationService.executeWorker("fetch-specific", animeId);

        return "Done";
    }
}