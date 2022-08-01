import { Module } from '@nestjs/common';
import InformationModule from '../information/information.module';
import AdminController from './admin.controller';

@Module({
    imports: [InformationModule],
    controllers: [AdminController]
})
export default class AdminModule {

}