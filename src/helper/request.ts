import axiosRetry from '@enime-project/axios-retry';
import axios, { AxiosRequestConfig } from 'axios';
export const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36';

const proxyHost1 = "https://proxy.enime.moe";

axiosRetry(axios, {
    retries: 1, // Only retry once, this is in order to balance out the requests so the server IP won't get banned by shits for few minutes causing timeout
    shouldResetTimeout: true,
    retryCondition: (_error) => true,
    retryDelay: () => 500,
    onRetry: async (number, __, requestConfig) => {
        requestConfig.url = proxyHost1 + "?url=" + encodeURIComponent(requestConfig.url);
        // @ts-ignore
        requestConfig.headers["x-api-key"] = process.env.PROXY_API_KEY;
    }
});

export const proxiedGet = async (url, config: AxiosRequestConfig<any> = {}) => {
    return axios.get(proxyHost1 + "?url=" + encodeURIComponent(url), {
        headers: {
            ...config.headers,
            "user-agent": USER_AGENT,
            "x-api-key": process.env.PROXY_API_KEY
        },
        ...config
    })
}

export default axios;