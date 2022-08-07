import { Module } from '@nestjs/common';
import DatabaseModule from '../database/database.module';
import { BullModule } from '@nestjs/bull';
import DatabaseService from '../database/database.service';
import MappingController from './mapping.controller';
import MappingService from './mapping.service';
import CacheModule from '../cache/cache.module';

@Module({
    imports: [CacheModule, DatabaseModule, BullModule.registerQueue({
        name: "mapping"
    })],
    providers: [MappingService],
    controllers: [MappingController],
    exports: [MappingService]
})
export default class MappingModule {
    constructor(private readonly databaseService: DatabaseService) {
    }
}