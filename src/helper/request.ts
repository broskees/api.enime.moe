import axiosRetry from '@enime-project/axios-retry';
import axios, { AxiosRequestConfig } from 'axios';
export const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0';

const gimmeProxyUrl = "https://gimmeproxy.com/api/getProxy?get=true&protocol=http,https&maxCheckPeriod=60";

const proxyHosts = ["https://proxy.enime.moe"];

const proxyHost = () => {
    return proxyHosts[0];
}

axiosRetry(axios, {
    retries: 1, // Only retry once, this is in order to balance out the requests so the server IP won't get banned by shits for few minutes causing timeout
    shouldResetTimeout: true,
    retryCondition: (_error) => true,
    retryDelay: () => 500,
    onRetry: async (number, __, requestConfig) => {
        requestConfig.url = proxyHost() + "?url=" + encodeURIComponent(requestConfig.url);
        // @ts-ignore
        requestConfig.headers["x-api-key"] = process.env.PROXY_API_KEY;
    }
});

export const proxiedGet = async (url, config: AxiosRequestConfig<any> = {}) => {
    return axios.get(proxyHost() + "?url=" + encodeURIComponent(url), {
        ...config,
        headers: {
            ...config.headers,
            "user-agent": USER_AGENT,
            "x-api-key": process.env.PROXY_API_KEY
        }
    })
}

export default axios;