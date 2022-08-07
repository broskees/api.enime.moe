import { Module } from '@nestjs/common';
import ToolController from './tool.controller';
import MappingModule from '../mapping/mapping.module';
import RapidCloudService from './rapid-cloud/rapid-cloud.service';

@Module({
    imports: [MappingModule],
    providers: [RapidCloudService],
    controllers: [ToolController],
    exports: [RapidCloudService]
})
export default class ToolModule {

}