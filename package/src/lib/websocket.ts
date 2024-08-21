import { stringify, parse } from './transform';
import { createRecursiveProxy } from './recursiveProxy';
import type { DocProviderConstructor, MessageHandlers, MessagePayload, Participant, Router, RouterPaths, WSAPI } from './types';
import { ObservableV2 } from 'lib0/observable';
import type { DocProvider, DocProviderOptions } from './yjs/client';

export type WebSocketState = 'RECONNECTING' | 'CONNECTED' | 'CLOSED';

export type ConnectOptions<O extends Router> = {
	searchParams?: Record<string, string>;
	handlers?: MessageHandlers<O>;
	dedupeConnection?: boolean;
	autoReconnectInterval?: number;
	maxReconnectAttempts?: number;
	pingInterval?: number;
	pongTimeout?: number;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Events = {
	open: (ws: WebSocketClient) => void;
	close: (ws: WebSocketClient) => void;
	arrayBufferMessage: (e: MessageEvent, ws: WebSocketClient) => void;
	presence: (presence: Participant[], ws: WebSocketClient) => void;
	error: (error: { body: string; status: number; statusText: string }, ws: WebSocketClient) => void;
	stateChange: (state: WebSocketState, ws: WebSocketClient) => void;
	reconnectionFailed: (ws: WebSocketClient) => void;
};

export class WebSocketClient<I extends Router = Router, O extends Router = Router> extends ObservableV2<Events> {
	protected lastHeartBeatTs?: Date;
	private autoReconnectInterval = 1000; // ms
	private maxReconnectAttempts = 7;
	private sendQueue: string[] = [];
	private abortController?: AbortController;
	private pingInterval: number = 10000;
	private pongTimeout: number = 10000;
	private pingTimer?: any;
	private pongTimer?: any;

	opts: ConnectOptions<O>;
	url: string;
	ws: WebSocket | null = null;
	state: WebSocketState = 'CLOSED';
	presence: Participant[] = [];

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

	destroy = () => {
		this.ws?.close();
		this.abortController?.abort();
		this.emit('close', [this]);
		this.setState('CLOSED');
	};

	send = createRecursiveProxy(async ({ type, data }) => {
		const message = stringify({ type, data });
		if (!this.ws || this.ws.readyState !== 1) {
			this.sendQueue.push(message);
		} else {
			this.ws.send(message);
		}
	}) as WSAPI<I>;
	sendRaw = (data: any) => {
		if (!this.ws || this.ws.readyState !== 1) {
			this.sendQueue.push(data);
		} else {
			this.ws.send(data);
		}
	};
	private reconnect = async () => {
		if (this.state === 'RECONNECTING') return;
		this.ws = null;
		this.setState('RECONNECTING');
		let attempts = 0;
		// @ts-ignore
		while (this.state === 'RECONNECTING' && attempts < this.maxReconnectAttempts) {
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
			this.emit('reconnectionFailed', [this]);
			this.destroy();
		}
	};
	private setState = <S extends WebSocketState>(state: S) => {
		if (this.state !== state) {
			this.state = state;

			this.emit('stateChange', [state, this]);
		}
	};
	open = () => {
		return new Promise((resolve, reject) => {
			this.abortController?.abort();
			this.abortController = new AbortController();
			const signal = {
				signal: this.abortController.signal,
			};
			this.ws = new WebSocket(this.url);
			(this.ws as any).binaryType = 'arraybuffer';

			this.ws.addEventListener(
				'open',
				() => {
					this.setState('CONNECTED');
					while (this.sendQueue.length > 0) {
						const data = this.sendQueue.pop()!;
						this.ws!.send(data);
					}

					this.emit('open', [this]);
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
							break;
						default:
							// Abnormal closure
							this.reconnect();
					}
					if (this.state === 'CONNECTED') {
						// only change state if it's not already closed or reconnecting
						this.setState('CLOSED');
					}
					this.stopPingPong();
					reject(e);
				},
				signal,
			);
			this.ws.addEventListener(
				'error',
				(e) => {
					console.log('error', e);
					switch (e.message) {
						case 'ECONNREFUSED':
							this.reconnect();
							break;
						default:
						// this.onerror(e);
					}
					if (this.state === 'CONNECTED') {
						// only change state if it's not already closed or reconnecting

						this.emit('close', [this]);
						this.setState('CLOSED');
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
		if (typeof e.data === 'string') {
			if (e.data === 'pong') {
				if (this.pongTimer) clearTimeout(this.pongTimer);
			} else {
				const { type, data } = parse(e.data as string) as MessagePayload<O, RouterPaths<O>>;
				if (type === 'presence') {
					this.presence = data as Participant[];

					this.emit('presence', [this.presence, this]);
				} else if (type === 'error') {
					this.emit('error', [data, this]);
				} else {
					const path = (type as string).split('.');
					let handler = this.opts.handlers as any;

					while (path.length > 0) {
						const segment = path.shift()!;
						handler = handler?.[segment as keyof typeof handler];
					}
					if (handler) {
						handler({ data, ctx: data });
					}
				}
			}
		} else {
			this.emit('arrayBufferMessage', [e, this]);
		}
	};
	constructor(url: string, opts: ConnectOptions<O> = {}) {
		super();
		this.url = url;
		this.opts = opts;
		this.autoReconnectInterval = opts?.autoReconnectInterval || 1000;
		this.maxReconnectAttempts = opts?.maxReconnectAttempts || 7;
		this.pingInterval = opts?.pingInterval || 10000;
		this.pongTimeout = opts?.pongTimeout || 10000;

		(globalThis as any).addEventListener('beforeunload', this.destroy);
		(globalThis as any).__flarews?.set(this.url, this);
	}
}

export const retrievePreviousClient = <I extends Router, O extends Router>(url: string) => {
	if (!(globalThis as any).__flarews) {
		(globalThis as any).__flarews = new Map();
	}
	return (globalThis as any).__flarews.get(url) as WebSocketClient<I, O> | undefined;
};

export const createWebSocketConnection = async <I extends Router, O extends Router>(url: URL, opts?: ConnectOptions<O>) => {
	const searchParams = new URLSearchParams(opts?.searchParams);
	url.search = searchParams.toString();
	const endpoint = url.toString();

	const previousClient = opts?.dedupeConnection !== false && retrievePreviousClient<I, O>(endpoint);

	const client = previousClient || new WebSocketClient<I, O>(endpoint, opts);

	if (!previousClient) {
		await client.open();
	}
	return client;
};

export const retrievePreviousProvider = <I extends Router, O extends Router>(endpoint: string) => {
	if (!(globalThis as any).__flaredocs) {
		(globalThis as any).__flaredocs = new Map();
	}
	return (globalThis as any).__flaredocs.get(endpoint) as DocProvider | undefined;
};
export type DocOptions<O extends Router> = ConnectOptions<O> & DocProviderOptions;

export const createDocumentConnection = <I extends Router, O extends Router>(
	url: URL,
	PROVIDER: DocProviderConstructor<O>,
	opts: DocOptions<O> = {},
): Promise<{ doc: DocProvider['doc']; awareness: DocProvider['awareness']; client: WebSocketClient<I, O> }> => {
	return new Promise(async (resolve, reject) => {
		try {
			const ws = await createWebSocketConnection<I, O>(url, opts);
			const previousProvider = opts?.dedupeConnection !== false && retrievePreviousProvider(url.toString());
			const provider = previousProvider || new PROVIDER(ws, opts || {});
			if (provider.synced) {
				return resolve({ doc: provider.doc, awareness: provider.awareness, client: ws });
			} else {
				provider.on('sync', () => {
					resolve({ doc: provider.doc, awareness: provider.awareness, client: ws });
				});
			}
		} catch (error) {
			reject(error);
		}
	});
};
