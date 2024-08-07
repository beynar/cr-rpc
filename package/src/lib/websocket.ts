import { DObject } from './client';
import { socketify, socketiparse } from './deform';
import { Handler } from './procedure';
import { Get, InferOutPutAtPath, InferSchemaOutPutAtPath, RegisteredParticipant, Router, RouterPaths, Schema, SchemaInput } from './types';
import { WSAPI, createRecursiveProxy } from './wsProxy';

type MessagePayload<O extends Router, T extends RouterPaths<O>> = {
	type: T;
	data: InferSchemaOutPutAtPath<O, T>;
	ctx: InferOutPutAtPath<O, T>;
};
export type ConnectOptions<O extends Router> = {
	participant?: RegisteredParticipant;
	onOpen?: () => void;
	onClose?: () => void;
	messages: Partial<{
		[K in RouterPaths<O>]: Get<O, K> extends Handler<infer M, infer S, infer H, infer D>
			? (payload: { data: InferSchemaOutPutAtPath<O, K>; ctx: InferOutPutAtPath<O, K> }) => void
			: never;
	}>;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class WebSocketClient<I extends Router, O extends Router> {
	protected lastHeartBeatTs?: Date;
	private autoReconnectInterval = 1000; // ms
	private maxReconnectAttempts = 7;
	private object: DObject;
	private url: string;
	private opts: ConnectOptions<O>;
	private sendQueue: string[] = [];
	private abortController?: AbortController;
	private pingInterval: number = 10000;
	private pongTimeout: number = 10000;
	private pingTimer?: any;
	private pongTimer?: any;

	private startPingPong() {
		this.pingTimer = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send('ping');
				this.pongTimer = setTimeout(() => {
					this.reconnect();
				}, this.pongTimeout);
			}
		}, this.pingInterval);
	}

	private stopPingPong() {
		if (this.pingTimer) clearInterval(this.pingTimer);
		if (this.pongTimer) clearTimeout(this.pongTimer);
	}

	ws: WebSocket | null = null;

	state: 'CONNECTED' | 'CLOSED' | 'RECONNECTING' = 'CLOSED';
	presence: RegisteredParticipant[] = [];

	destroy = () => {
		this.ws?.close();
		this.abortController?.abort();
		this.state = 'CLOSED';
	};

	send = createRecursiveProxy(async ({ type, data }) => {
		const message = socketify({ type, data });
		if (!this.ws || this.ws.readyState !== 1) {
			this.sendQueue.push(message);
		} else {
			this.ws.send(message);
		}
	}) as WSAPI<I>;

	private reconnect = async () => {
		if (this.state === 'RECONNECTING') return;
		this.ws = null;
		this.state = 'RECONNECTING';
		let attempts = 0;
		while (this.state === 'RECONNECTING' && attempts < this.maxReconnectAttempts) {
			console.log({ attempts });
			await wait(this.autoReconnectInterval * Math.pow(2, attempts));
			try {
				await this.open();
			} catch (error) {
				console.log(`Reconnection attempt ${attempts + 1} failed:`, error);
				attempts++;
			}
		}
		if (attempts === this.maxReconnectAttempts) {
			console.log(`closing after ${attempts} attempts`);

			this.destroy();
		}
	};

	open = () => {
		return new Promise((resolve, reject) => {
			const endpoint = new URL(this.url);
			const searchParams = new URLSearchParams({
				id: this.object.id!,
				object: this.object.name!,
			});
			if (this.opts.participant) {
				searchParams.set('participant', JSON.stringify(this.opts.participant));
			}
			endpoint.search = searchParams.toString();
			this.abortController?.abort();
			this.abortController = new AbortController();
			const signal = {
				signal: this.abortController.signal,
			};
			this.ws = new WebSocket(endpoint.toString());

			this.ws.addEventListener(
				'open',
				() => {
					this.state = 'CONNECTED';
					while (this.sendQueue.length > 0) {
						const data = this.sendQueue.pop()!;
						this.ws!.send(data);
					}
					this.opts.onOpen?.();
					this.startPingPong();
					resolve(this);
				},
				signal,
			);
			this.ws.addEventListener(
				'close',
				(e: CloseEvent) => {
					switch (e.code) {
						case 1000: // CLOSE_NORMAL
							console.log(`WebSocket: normally closed`);
							break;
						default:
							// Abnormal closure
							this.reconnect();
					}
					if (this.state === 'CONNECTED') {
						// only change state if it's not already closed or reconnecting
						this.state = 'CLOSED';
					}

					this.opts.onClose?.();
					this.stopPingPong();
					reject(e);
				},
				signal,
			);
			this.ws.addEventListener(
				'error',
				(e) => {
					switch (e.message) {
						case 'ECONNREFUSED':
							this.reconnect();
							break;
						default:
						// this.onerror(e);
					}
					if (this.state === 'CONNECTED') {
						// only change state if it's not already closed or reconnecting
						this.state = 'CLOSED';
					}
					this.stopPingPong();
					reject(e);
				},
				signal,
			);
			this.ws.addEventListener('message', this.onMessage, signal);
		});
	};

	onMessage = (e: MessageEvent) => {
		if (e.data === 'pong') {
			if (this.pongTimer) clearTimeout(this.pongTimer);
		} else {
			const { type, data } = socketiparse(e.data as string) as MessagePayload<O, RouterPaths<O>>;
			if (type === 'presence') {
				this.presence = data as RegisteredParticipant[];
				console.log(this.presence, data);
			} else {
				this.opts.messages[type]?.({ data, ctx: data });
			}
		}
	};
	constructor(opts: ConnectOptions<O>, url: string, object: DObject) {
		this.url = url.replace('http://', 'ws://').replace('https://', 'wss://');
		this.object = object;
		this.opts = opts;
	}
}

export const createWebSocketConnection = async <I extends Router, O extends Router>(
	ops: ConnectOptions<O>,
	url: string,
	object: DObject,
) => {
	const client = new WebSocketClient<I, O>(ops, url, object);
	await client.open();
	return client;
};
