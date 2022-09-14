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
    public serverId: string;
    public decryptionKey: string;

    private websocket: ReconnectingWebSocket;
    private intervalId;

    private readonly redisClient: RedisClient;
    private readonly host = "wss://ws1.rapid-cloud.co/socket.io/?EIO=4&transport=websocket";

    private readonly decryptionKeyFlow = "https://worker.enime.moe/rapid-cloud/decryption-key";

    constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: RedisCache) {
        this.redisClient = this.cacheManager.store.getClient();
    }

    async onModuleInit() {
        await this.refreshDecryptionKey();
        await this.refreshServerId();
    }

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

    @Cron(CronExpression.EVERY_10_MINUTES)
    async refreshDecryptionKey() {
        this.decryptionKey = (await axios.get(this.decryptionKeyFlow, {
            headers: {
                "x-api-key": process.env.WORKER_API_KEY
            }
        })).data;
    }

    @Cron(CronExpression.EVERY_2_HOURS)
    async refreshServerId() {
        try {
            if (this.intervalId) clearInterval(this.intervalId);

            if (this.websocket) this.websocket.reconnect(); // Reconnect every 2 hours to manually refresh the server ID

            if (!this.websocket) this.websocket = new ReconnectingWebSocket(async () => {
                await this.clearCachedUrls();
                return this.host;
            }, undefined, {
                WebSocket: WS,
                reconnectionDelayGrowFactor: 1.0 // Don't use grow factor,
            });

            this.websocket.addEventListener("open", () => {
                this.websocket.send("40");
                if (this.intervalId) clearInterval(this.intervalId);
                this.intervalId = setInterval(() => {
                    this.websocket.send("3");
                }, 20000);
            });

            this.websocket.addEventListener("message", ({ data }) => {
                data = data.toString();
                if (data?.startsWith("40")) {
                    this.serverId = JSON.parse(data.split("40")[1]).sid;
                } else if (data === "2") {
                    this.websocket.send("3");
                }
            });

            this.websocket.addEventListener("error", () => {
                Logger.error("Websocket error");
            });
        } catch (e) {
            Logger.error("Websocket error occurred", e);
        }
    }
}
