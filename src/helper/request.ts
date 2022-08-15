import axiosRetry from '@enime-project/axios-retry';
import axios from 'axios';

const proxyHost1 = "https://proxy.enime.moe";

axiosRetry(axios, {
    retries: 1, // Only retry once, this is in order to balance out the requests so the server IP won't get banned by GogoCDN for few minutes causing timeout
    shouldResetTimeout: true,
    retryCondition: (_error) => true,
    retryDelay: () => 500,
    onRetry: async (number, __, requestConfig) => {
        requestConfig.url = proxyHost1 + "?url=" + encodeURIComponent(requestConfig.url);
        // @ts-ignore
        requestConfig.headers["x-api-key"] = process.env.PROXY_API_KEY;
    }
});

export default axios;