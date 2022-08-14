import { Module } from '@nestjs/common';
import DatabaseService from '../database/database.service';
import MappingController from './mapping.controller';
import MappingService from './mapping.service';

@Module({
    imports: [],
    providers: [MappingService],
    controllers: [MappingController],
    exports: [MappingService]
})
export default class MappingModule {
    constructor() {
    }
}