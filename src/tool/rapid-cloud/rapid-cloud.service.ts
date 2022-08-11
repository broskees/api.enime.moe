import { CACHE_MANAGER, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import WS from 'ws';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache } from 'cache-manager';
import Source from '../../entity/source.entity';
import ReconnectingWebSocket from 'reconnecting-websocket';

@Injectable()
export default class RapidCloudService implements OnModuleInit {
    public serverId: string;
    private websocket: ReconnectingWebSocket;
    private intervalId;

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
            if (this.intervalId) clearInterval(this.intervalId);
        }


        this.websocket = new ReconnectingWebSocket("wss://ws1.rapid-cloud.co/socket.io/?EIO=4&transport=websocket", [], {
            WebSocket: WS,
            reconnectionDelayGrowFactor: 1.0 // Don't use grow factor
        });

        try {
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
            Logger.error("Websocket error occurred");
        }
    }
}
