import VideoExtractor from '../extractor';
import { ISubtitle, IVideo } from '../types';
import { USER_AGENT } from '../../scraper/scraper';
import fetch from 'node-fetch';
import { load } from 'cheerio';

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

            res = await (await fetch(
                `${this.host}/ajax/embed-6/getSources?id=${id}&sId=${sId}`,
                options
            )).json()  ;

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

    private captcha = async (url: string, key: string): Promise<string> => {
        const uri = new URL(url);
        const domain = uri.protocol + '//' + uri.host;

        const data = await (await fetch(`https://www.google.com/recaptcha/api.js?render=${key}`, {
            headers: {
                Referer: domain,
            },
        })).text();

        const v = data
            ?.substring(data.indexOf('/releases/'), data.lastIndexOf('/recaptcha'))
            .split('/releases/')[1];

        //TODO: NEED to fix the co (domain) parameter to work with every domain
        const anchor = `https://www.google.com/recaptcha/api2/anchor?ar=1&hl=en&size=invisible&cb=kr42069kr&k=${key}&co=aHR0cHM6Ly9yYXBpZC1jbG91ZC5ydTo0NDM.&v=${v}`;
        const c = load(await (await fetch(anchor)).text())('#recaptcha-token').attr('value');

        // currently its not returning proper response. not sure why
        const res = await fetch(
            `https://www.google.com/recaptcha/api2/reload?k=${key}`,
            {
                method: "POST",
                body: JSON.stringify({
                    v: v,
                    k: key,
                    c: c,
                    co: "aHR0cHM6Ly9yYXBpZC1jbG91ZC5ydTo0NDM.",
                    sa: "",
                    reason: "q",
                }),
                headers: {
                    Referer: anchor,
                }
            }
        );

        const text = await res.text();
        return text.substring(text.indexOf('rresp","'), text.lastIndexOf('",null'));
    };
}

export default RapidCloud;
