import { Injectable, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';

@Injectable()
export default class SocketService implements OnModuleInit {
    public serverId: string;
    private websocket: WebSocket;

    async onModuleInit() {
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
            } else {
                this.websocket.send("40");
            }
        });

        setInterval(() => {
            this.websocket.send("3");
        }, 20000);
    }
}