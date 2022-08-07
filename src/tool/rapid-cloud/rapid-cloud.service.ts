import { CACHE_MANAGER, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache } from 'cache-manager';
import Source from '../../entity/source.entity';

@Injectable()
export default class RapidCloudService implements OnModuleInit {
    public serverId: string;
    private websocket: WebSocket;

    constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    }

    async onModuleInit() {
        await this.refreshServerId();
    }

    @Cron(CronExpression.EVERY_2_HOURS)
    async refreshServerId() {
        if (this.websocket) {
            const keys = await this.cacheManager.store.keys();

            for (let key of keys) {
                if (!key.startsWith("source-")) continue;

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

            this.websocket.close();
        }

        this.websocket = new WebSocket("wss://ws1.rapid-cloud.ru/socket.io/?EIO=4&transport=websocket");

        this.websocket.on("open", () => {
            this.websocket.send("40");
        });

        this.websocket.on("message", (data: string) => {
            data = data.toString();
            if (data?.startsWith("40")) {
                this.serverId = JSON.parse(data.split("40")[1]).sid;
            } else if (data === "2") {
                this.websocket.send("3");
            }
        });

        setInterval(() => {
            this.websocket.send("3");
        }, 20000);
    }
}