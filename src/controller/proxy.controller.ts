import {
    CACHE_MANAGER, CacheInterceptor,
    Controller,
    Get, Header, Inject,
    Injectable, InternalServerErrorException, Logger,
    NotFoundException,
    Param, Res, UseInterceptors

} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NoCache } from '../cache/no-cache.decorator';
import { ApiExcludeController } from '@nestjs/swagger';
import SourceService from '../source/source.service';

@Controller("/proxy")
@Injectable()
@ApiExcludeController()
export default class ProxyController {
    constructor(private readonly sourceService: SourceService) {
    }

    @Get("/source/:id/subtitle")
    @Throttle(10, 60)
    @NoCache()
    async sourceSubtitleProxy(@Param("id") id, @Res() res) {
        id = id.replace(/\.[^/.]+$/, "");
        const rawSource = await this.sourceService.getSource(id);

        return res.redirect(302, rawSource.subtitle);
    }

    @Get("/source/:id")
    @Throttle(10, 60)
    @NoCache()
    async sourceProxy(@Param("id") id, @Res() res) {
        id = id.replace(/\.[^/.]+$/, "");
        const rawSource = await this.sourceService.getSource(id);

        return res.redirect(302, rawSource.url);
    }
}