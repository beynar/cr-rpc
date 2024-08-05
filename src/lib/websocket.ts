import { socketiparse } from './deform';
import { Handler } from './procedure';
import { Get, InferOutPutAtPath, InferSchemaOutPutAtPath, RegisteredParticipant, Router, RouterPaths } from './types';

type MessagePayload<O extends Router, T extends RouterPaths<O>> = {
	type: T;
	data: InferSchemaOutPutAtPath<O, T>;
	ctx: InferOutPutAtPath<O, T>;
};
export type ConnectOptions<O extends Router> = {
	headers?: Record<string, string>;
	participant?: RegisteredParticipant;
	onOpen?: () => void;
	onClose?: () => void;
	messages: Partial<{
		[K in RouterPaths<O>]: Get<O, K> extends Handler<infer M, infer S, infer H, infer D>
			? (payload: { data: InferSchemaOutPutAtPath<O, K>; ctx: InferOutPutAtPath<O, K> }) => void
			: never;
	}>;
};
export class WebSocketClient<I extends Router, O extends Router> {
	ws: WebSocket;
	state: 'CONNECTING' | 'CONNECTED' | 'CLOSING' | 'CLOSED' = 'CLOSED';
	participant?: RegisteredParticipant;
	abortController = new AbortController();

	destroy() {
		this.ws.close();
		this.abortController.abort();
	}

	send = <T extends RouterPaths<I>>(type: T, data: InferSchemaOutPutAtPath<I, T>) => {
		console.log(type, data);
	};

	constructor(opts: ConnectOptions<O>, url: string, resolve?: (value: WebSocketClient<I, O>) => void) {
		this.ws = new WebSocket(
			url,
			Object.entries(opts.headers || {}).reduce((acc, [key, value]) => {
				acc.push(`${key}: ${value}`);
				return acc;
			}, [] as string[]),
		);
		this.state = 'CONNECTING';
		this.ws.addEventListener(
			'open',
			() => {
				this.ws.send(
					JSON.stringify({
						type: 'connect',
						data: opts.participant,
					}),
				);
				resolve?.(this);
				opts.onOpen?.();
			},
			{
				signal: this.abortController.signal,
			},
		);
		this.ws.addEventListener(
			'close',
			() => {
				this.state = 'CLOSED';
				opts.onClose?.();
			},
			{
				signal: this.abortController.signal,
			},
		);
		this.ws.addEventListener(
			'message',
			(e) => {
				const { type, data } = socketiparse(e.data as string) as MessagePayload<O, RouterPaths<O>>;
				if (type === 'ping') {
					this.ws.send('pong');
				} else if (type === 'connect') {
					this.state === 'CONNECTED';
				} else {
					opts.messages[type]?.({ data, ctx: data });
				}
			},
			{
				signal: this.abortController.signal,
			},
		);

		this.participant = opts.participant;
	}
}

export const createWebSocketConnection = <I extends Router, O extends Router>(ops: ConnectOptions<O>, url: string) => {
	return new Promise<WebSocketClient<I, O>>((resolve, reject) => {
		new WebSocketClient(ops, url, resolve);
	});
};
