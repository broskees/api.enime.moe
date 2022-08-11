import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export default class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {

    constructor() {
        super({
            ...(!process.env.PRODUCTION && {
                // log: ["query", "error"]
            })
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    async enableShutdownHooks(app: INestApplication) {
        this.$on("beforeExit", async () => {
            await app.close();
        });
    }

}