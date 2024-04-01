/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
/// <reference types="@cloudflare/workers-types/2023-07-01" />
declare global {
    interface Env {
        MY_KV_NAMESPACE: KVNamespace;
        MY_DURABLE_OBJECT: DurableObjectNamespace;
        MY_BUCKET: R2Bucket;
        MY_SERVICE: Fetcher;
        MY_QUEUE: Queue;
        VECTORIZE: VectorizeIndex;
    }
}
declare const _default: {
    fetch: any;
};
export default _default;
//# sourceMappingURL=index.d.ts.map