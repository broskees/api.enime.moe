import { Module } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import MappingController from './mapping.controller';
import MappingService from './mapping.service';
import MetaService from './meta/meta.service';

@Module({
    imports: [],
    providers: [MappingService, MetaService],
    controllers: [MappingController],
    exports: [MappingService, MetaService]
})
export default class MappingModule {
    constructor() {
    }
}