import { CacheModule, Module } from '@nestjs/common';
import RapidCloudService from './rapid-cloud.service';

@Module({
    providers: [RapidCloudService]
})
export default class RapidCloudModule {

}