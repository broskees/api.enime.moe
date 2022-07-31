import { Injectable, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';

@Injectable()
export default class SocketService implements OnModuleInit {
    public serverId: string;

    async onModuleInit() {
        const ws = new WebSocket("wss://ws1.rapid-cloud.ru/socket.io/?EIO=4&transport=websocket");

        ws.on("open", () => {
            ws.send("40");
        });

        ws.on("message", (data: string) => {
            data = data.toString();
            if (data?.startsWith("40")) {
                this.serverId = JSON.parse(data.split("40")[1]).sid;
            } else if (data === "2") {
                ws.send("3");
            }
        });

        setInterval(() => {
            ws.send("3");
        }, 1000);
    }
}