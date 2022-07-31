export interface ISubtitle {
    /**
     * The **url** that should take you to the subtitle **directly**.
     */
    url: string;
    /**
     * The language of the subtitle
     */
    lang: string;
}

export interface ISource {
    referer?: string;
    headers?: { [k: string]: string };
    subtitles?: ISubtitle[];
    sources: IVideo[];
}

export interface IVideo {
    /**
     * The **MAIN URL** of the video provider that should take you to the video
     */
    url: string;
    /**
     * make sure to set this to `true` if the video is hls
     */
    m3u8?: boolean;
    [x: string]: unknown; // other fields
}

export enum StreamingServers {
    GogoCDN = "gogocdn",
    StreamSB = "streamsb",
    MixDrop = "mixdrop",
    UpCloud = "upcloud",
    VidCloud = "vidcloud",
    /**
     * To use rapidcloud, you need to setup web socket connection with rapidcloud.\
     * connect the web socket server to `wss://ws1.rapid-cloud.ru/socket.io/?EIO=4&transport=websocket`. then
     * set a **message listener**, and inside the message listener, if you recieve a message equals to "2" send a "3".
     * when the video is ready to play. send a "3".
     * when the video stops playing close the web socket connection with the code `4969`.
     */
    RapidCloud = "rapidcloud",
    StreamTape = "streamtape",
    VizCloud = "vizcloud",
    // same as vizcloud
    MyCloud = "mycloud",
}