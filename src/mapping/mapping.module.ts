import { CacheModule, Module } from '@nestjs/common';
import DatabaseModule from '../database/database.module';
import DatabaseService from '../database/database.service';
import MappingController from './mapping.controller';
import MappingService from './mapping.service';
import * as redisStore from 'cache-manager-redis-store';

@Module({
    imports: [DatabaseModule, CacheModule.register({
        store: redisStore,
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        isGlobal: true
    })],
    providers: [MappingService],
    controllers: [MappingController],
    exports: [MappingService]
})
export default class MappingModule {
    constructor(private readonly databaseService: DatabaseService) {
    }
}