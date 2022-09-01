import { Module } from '@nestjs/common';
import MappingController from './mapping.controller';
import MappingService from './mapping.service';
import MetaService from './meta/meta.service';
import CacheModule from '../cache/cache.module';

@Module({
    imports: [CacheModule],
    providers: [MappingService, MetaService],
    controllers: [MappingController],
    exports: [MappingService, MetaService]
})
export default class MappingModule {
    constructor() {
    }
}