import * as CryptoJS from 'crypto-js';
import VideoExtractor from '../extractor';
import { IVideo } from '../types';
import axios from '../../helper/request';

class GogoCDN extends VideoExtractor {
    protected override serverName = "goload";
    protected override sources: IVideo[] = [];

    private readonly keys = {
        key: CryptoJS.enc.Utf8.parse("37911490979715163134003223491201"),
        secondKey: CryptoJS.enc.Utf8.parse("54674138327930866480207815084989"),
        iv: CryptoJS.enc.Utf8.parse("3134003223491201"),
    };

    private referer: string = "";

    override extract = async (videoUrl: URL): Promise<IVideo> => {
        this.referer = videoUrl.href;

        const res = await axios.get(videoUrl.href, {
            timeout: 5000
        }); // We set timeout here and there so it'll eventually fall back to consumet if both our origin and backup proxy are "banned" (although this likely won't happen because Cloudflare is distributive)

        const encyptedParams = await this.generateEncryptedAjaxParams(
            res.data,
            videoUrl.searchParams.get("id") ?? ""
        );

        const encryptedData = await axios.get(
            `${videoUrl.protocol}//${videoUrl.hostname}/encrypt-ajax.php?${encyptedParams}`,
            {
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                },
                timeout: 5000
            }
        );

        const decryptedData = await this.decryptAjaxData(encryptedData.data.data);
        if (!decryptedData.source?.length && !decryptedData.source_bk?.length) throw new Error("No source found. Try a different server.");

        decryptedData.source.forEach((source: any) => {
            this.sources.push({
                url: source.file,
                m3u8: source.file.includes(".m3u8"),
            });
        });
        decryptedData.source_bk.forEach((source: any) => {
            this.sources.push({
                url: source.file,
                m3u8: source.file.includes(".m3u8"),
            });
        });

        return this.sources[0];
    }

    private generateEncryptedAjaxParams = async (text, id: string): Promise<string> => {
        const encryptedKey = CryptoJS.AES.encrypt(id, this.keys.key, {
            iv: this.keys.iv,
        });

        const scriptValue = text.match(/<script type="text\/javascript" src="[^"]+" data-name="episode" data-value="[^"]+"><\/script>/)[0].match(/data-value="[^"]+"/)[0].replace(/(data-value=)?"/, "");

        const decryptedToken = CryptoJS.AES.decrypt(scriptValue, this.keys.key, {
            iv: this.keys.iv,
        }).toString(CryptoJS.enc.Utf8);

        return `id=${encryptedKey}&alias=${id}&${decryptedToken}`;
    };

    private decryptAjaxData = async (encryptedData: string): Promise<any> => {
        const decryptedData = CryptoJS.enc.Utf8.stringify(
            CryptoJS.AES.decrypt(encryptedData, this.keys.secondKey, {
                iv: this.keys.iv,
            })
        );

        return JSON.parse(decryptedData);
    };
}

export default GogoCDN;