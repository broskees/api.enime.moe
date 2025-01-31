import { CacheModule as NestCacheModule, Global, Module } from '@nestjs/common';
import * as redisStore from 'cache-manager-redis-store';

@Module({
    imports: [
        NestCacheModule.register({
            store: redisStore,
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
            password: process.env.REDIS_PASSWORD,
            isGlobal: true
        })
    ],
    exports: [NestCacheModule]
})
@Global()
export default class CacheModule {
}