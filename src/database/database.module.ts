import { Global, Module } from '@nestjs/common';
import DatabaseService from './database.service';

@Global()
@Module({
    providers: [{
        provide: "DATABASE",
        useClass: DatabaseService
    }],
    exports: [
        "DATABASE"
    ]
})
export default class DatabaseModule {
    constructor() {
    }
}