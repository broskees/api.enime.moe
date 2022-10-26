import VideoExtractor from '../extractor';
import { ISubtitle, IVideo } from '../types';
import * as CryptoJS from 'crypto-js';
import { USER_AGENT } from '../../helper/request';
import axios from 'axios';

class RapidCloud extends VideoExtractor {
    protected override serverName = 'RapidCloud';
    protected override sources: IVideo[] = [];

    private readonly host = 'https://rapid-cloud.co';

    constructor(private readonly decryptionKey) {
        super();
    }

    override extract = async (videoUrl: URL, referer: string): Promise<{ source: IVideo } & { subtitles: ISubtitle[] }> => {
        try {
            const id = videoUrl.href.split('/').pop()?.split('?')[0];
            const options = {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Referer: referer,
                    'User-Agent': USER_AGENT,
                },
            };

            let res = await (await axios.get(
                `${this.host}/ajax/embed-6/getSources?id=${id}`,
                options
            )).data;

            let sources = res.sources;
            if (res.encrypted) {
                sources = JSON.parse(CryptoJS.AES.decrypt(sources, this.decryptionKey).toString(CryptoJS.enc.Utf8));
            }

            return {
                source: {
                    url: sources[0].file,
                    m3u8: sources[0].file.includes(".m3u8"),
                },
                subtitles: res.tracks.map((s: any) => ({
                    url: s.file,
                    lang: s.label ? s.label : "Default (maybe)",
                }))
            };
        } catch (err) {
            throw new Error((err as Error).message);
        }
    };
}

export default RapidCloud;
