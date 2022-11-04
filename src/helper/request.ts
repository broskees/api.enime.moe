import axiosRetry from '@enime-project/axios-retry';
import axios, { AxiosRequestConfig } from 'axios';
export const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0';

const proxyHosts = ["https://proxy.enime.moe"];

const exemptRetryStatuses = [404, 500, 501, 502, 503];

const proxyHost = () => {
    return proxyHosts[0];
}

axiosRetry(axios, {
    retries: 1, // Only retry once, this is in order to balance out the requests so the server IP won't get banned by shits for few minutes causing timeout
    shouldResetTimeout: true,
    retryCondition: (_error) => !_error?.response?.status ? true : !exemptRetryStatuses.includes(_error.response.status),
    retryDelay: () => 500,
    onRetry: async (number, error, requestConfig) => {
        requestConfig.url = proxyHost() + "?url=" + encodeURIComponent(requestConfig.url);
        // @ts-ignore
        if (process.env.PROXY_API_KEY) {
            requestConfig.headers["x-api-key"] = process.env.PROXY_API_KEY;
        }
    }
});

export const proxiedGet = async (url, config: AxiosRequestConfig<any> = {}) => {
    let additionalHeaders = {
        ...config.headers,
        "user-agent": USER_AGENT
    }

    if (process.env.PROXY_API_KEY) {
        additionalHeaders["x-api-key"] = process.env.PROXY_API_KEY
    }

    return axios.get(proxyHost() + "?url=" + encodeURIComponent(url), {
        ...config,
        headers: additionalHeaders
    })
}

export default axios;