import { Module } from '@nestjs/common';
import DatabaseModule from '../database/database.module';
import { BullModule } from '@nestjs/bull';
import DatabaseService from '../database/database.service';

@Module({
    imports: [DatabaseModule, BullModule.registerQueue({
        name: "mapping"
    })],
    providers: []
})
export default class MappingModule {
    constructor(private readonly databaseService: DatabaseService) {
    }
}