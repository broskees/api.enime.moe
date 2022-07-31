import { load } from 'cheerio';
import fetch from 'node-fetch';
import { IVideo } from '../types';
import VideoExtractor from '../extractor';

class StreamTape extends VideoExtractor {
    protected override serverName = "StreamTape";
    protected override sources: IVideo[] = [];

    override extract = async (videoUrl: URL): Promise<IVideo> => {
        try {
            const res = await (await fetch(videoUrl.href).catch(() => {
                throw new Error("Video not found");
            })).text();

            const $ = load(await res);

            let [fh, sh] = $.html()
                ?.match(/robotlink'\).innerHTML = (.*)'/)![1]
                .split("+ ('");

            sh = sh.substring(3);
            fh = fh.replace(/\"/g, "");

            const url = `https:${fh}${sh}`;

            this.sources.push({
                url: url.replaceAll("'", ""),
                m3u8: url.includes(".m3u8"),
            });

            return this.sources[0];
        } catch (err) {
            throw new Error((err as Error).message);
        }
    };
}
export default StreamTape;