import { Module } from '@nestjs/common';
import { ElasticsearchModule, ElasticsearchService } from '@nestjs/elasticsearch';
import SearchService from './search.service';
import DatabaseModule from '../database/database.module';
import SearchController from './search.controller';

@Module({
    imports: [DatabaseModule],
    // providers: [SearchService],
    controllers: [SearchController]
})
export default class SearchModule {
    static register() {
        /*
        if (process.env.ELASTICSEARCH_HOST) {
            return {
                module: SearchModule,
                imports: [ElasticsearchModule.register({
                    node: process.env.ELASTICSEARCH_HOST,
                    auth: {
                        username: process.env.ELASTICSEARCH_USERNAME,
                        password: process.env.ELASTICSEARCH_PASSWORD
                    }
                })]
            }
        }
         */

        return {
            module: SearchModule
        };
    }
}