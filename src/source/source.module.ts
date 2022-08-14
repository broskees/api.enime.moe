import { Module } from '@nestjs/common';
import ScraperModule from '../scraper/scraper.module';
import SourceService from './source.service';
import SourceController from './source.controller';
import ToolModule from '../tool/tool.module';

@Module({
    imports: [ScraperModule, ToolModule],
    controllers: [SourceController],
    providers: [SourceService],
    exports: [SourceService]
})
export default class SourceModule {

}