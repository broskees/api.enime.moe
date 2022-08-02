import { Module } from '@nestjs/common';
import InformationModule from '../information/information.module';
import AdminController from './admin.controller';
import DatabaseModule from '../database/database.module';
import ScraperModule from '../scraper/scraper.module';
import { BullModule } from '@nestjs/bull';

@Module({
    imports: [BullModule.registerQueue({
        name: "scrape"
    }), InformationModule, DatabaseModule, ScraperModule],
    controllers: [AdminController]
})
export default class AdminModule {

}