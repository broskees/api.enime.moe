import VideoExtractor from '../extractor';
import { ISubtitle, IVideo } from '../types';
import { load } from 'cheerio';
import { USER_AGENT } from '../../helper/request';
import axios from 'axios';

class RapidCloud extends VideoExtractor {
    protected override serverName = 'RapidCloud';
    protected override sources: IVideo[] = [];

    private readonly host = 'https://rapid-cloud.co';

    constructor(private readonly serverId) {
        super();
    }

    override extract = async (videoUrl: URL): Promise<{ source: IVideo } & { subtitles: ISubtitle[] }> => {
        try {
            const id = videoUrl.href.split('/').pop()?.split('?')[0];
            const options = {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Referer: videoUrl.href,
                    'User-Agent': USER_AGENT,
                },
            };

            let res = null;

            const sId = this.serverId;

            res = await (await axios.get(
                `${this.host}/ajax/embed-6/getSources?id=${id}&sId=${sId}`,
                options
            )).data;

            return {
                source: {
                    url: res.sources[0].file,
                    m3u8: res.sources[0].file.includes(".m3u8"),
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
