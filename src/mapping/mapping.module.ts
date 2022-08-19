import { Module } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import MappingController from './mapping.controller';
import MappingService from './mapping.service';
import TvdbService from './tvdb.service';

@Module({
    imports: [],
    providers: [MappingService, TvdbService],
    controllers: [MappingController],
    exports: [MappingService, TvdbService]
})
export default class MappingModule {
    constructor() {
    }
}