import { Module } from '@nestjs/common';
import DatabaseModule from '../database/database.module';
import SearchController from './search.controller';

@Module({
    imports: [DatabaseModule],
    controllers: [SearchController]
})
export default class SearchModule {
}