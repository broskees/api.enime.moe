import { CACHE_MANAGER, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import WS from 'ws';
import { Cron, CronExpression } from '@nestjs/schedule';
import Source from '../../entity/source.entity';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { RedisCache } from '../../redis/redis.interface';
import * as util from 'util';
import { RedisClient } from 'redis';
import axios from 'axios';

@Injectable()
export default class RapidCloudService implements OnModuleInit {
    public decryptionKey: string;

    private readonly redisClient: RedisClient;
    private readonly decryptionKeyFlow = "https://raw.githubusercontent.com/consumet/rapidclown/main/key.txt";

    constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: RedisCache) {
        this.redisClient = this.cacheManager.store.getClient();
    }

    async onModuleInit() {
        await this.refreshDecryptionKey();
    }

    /*
    async clearCachedUrls() {
        const keys = [];
        let cursor = "0";

        do {
            const scan = util.promisify(this.redisClient.scan).bind(this.redisClient);

            // @ts-ignore
            const reply = await scan(cursor, "MATCH", "source-*");

            cursor = reply[0];
            keys.push(...reply[1]);
        } while (cursor !== "0");

        for (let key of keys) {
            let data = await this.cacheManager.get(key);
            try {
                if (typeof data === "string") {
                    let parsedSource: Source = JSON.parse(data);
                    if (parsedSource.url.includes("betterstream")) await this.cacheManager.del(key);
                }
            } catch (e) {
                // Not json, pass
            }
        }
    }
     */

    @Cron(CronExpression.EVERY_10_MINUTES)
    async refreshDecryptionKey() {
        let params = {};

        if (process.env.WORKER_API_KEY) {
            params = {
                headers: {
                    "x-api-key": process.env.WORKER_API_KEY
                }
            };
        }

        this.decryptionKey = (await axios.get(this.decryptionKeyFlow, params)).data;
    }
}
