import { stringify, parse } from './transform';
import { createRecursiveProxy } from './recursiveProxy';
import type { MessageHandlers, MessagePayload, Participant, Router, RouterPaths, WSAPI } from './types';

export type WebSocketState = 'RECONNECTING' | 'CONNECTED' | 'CLOSED';

export type ConnectOptions<O extends Router> = {
	searchParams?: Record<string, string>;
	onOpen?: () => void;
	onClose?: () => void;
	onPresence?: (presence: Participant[]) => void;
	onStateChange?: (state: WebSocketState) => void;
	onError?: (error: { body: string; status: number; statusText: string }) => void;
	onReconnectionFailed?: () => void;
	handlers: MessageHandlers<O>;
	dedupeConnection?: boolean;
	autoReconnectInterval?: number;
	maxReconnectAttempts?: number;
	pingInterval?: number;
	pongTimeout?: number;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class WebSocketClient<I extends Router, O extends Router> {
	protected lastHeartBeatTs?: Date;
	private autoReconnectInterval = 1000; // ms
	private maxReconnectAttempts = 7;
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

	state: WebSocketState = 'CLOSED';
	presence: Participant[] = [];

	destroy = () => {
		this.ws?.close();
		this.abortController?.abort();
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
			this.opts.onReconnectionFailed?.();
			this.destroy();
		}
	};
	private setState = <S extends WebSocketState>(state: S) => {
		if (this.state !== state) {
			this.state = state;
			this.opts.onStateChange?.(state);
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

			this.ws.addEventListener(
				'open',
				() => {
					this.setState('CONNECTED');
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
							break;
						default:
							// Abnormal closure
							this.reconnect();
					}
					if (this.state === 'CONNECTED') {
						// only change state if it's not already closed or reconnecting
						this.setState('CLOSED');
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
		if (e.data === 'pong') {
			if (this.pongTimer) clearTimeout(this.pongTimer);
		} else {
			const { type, data } = parse(e.data as string) as MessagePayload<O, RouterPaths<O>>;
			if (type === 'presence') {
				this.presence = data as Participant[];
				this.opts.onPresence?.(this.presence);
			} else if (type === 'error') {
				this.opts.onError?.(data);
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
	};
	constructor(opts: ConnectOptions<O>, url: string) {
		this.url = url;
		this.opts = opts;
		this.autoReconnectInterval = opts.autoReconnectInterval || 1000;
		this.maxReconnectAttempts = opts.maxReconnectAttempts || 7;
		this.pingInterval = opts.pingInterval || 10000;
		this.pongTimeout = opts.pongTimeout || 10000;

		(globalThis as any).addEventListener('beforeunload', this.destroy);
		(globalThis as any).__flarews.set(this.url, this);
	}
}

export const createWebSocketConnection = async <I extends Router, O extends Router>(opts: ConnectOptions<O>, url: URL) => {
	const searchParams = new URLSearchParams(opts.searchParams);

	url.search = searchParams.toString();
	const stringifyEndpoint = url.toString();

	if (!(globalThis as any).__flarews) {
		(globalThis as any).__flarews = new Map();
	}
	if ((globalThis as any).__flarews.has(stringifyEndpoint) && opts.dedupeConnection !== false) {
		return (globalThis as any).__flarews.get(stringifyEndpoint) as WebSocketClient<I, O>;
	} else {
		const client = new WebSocketClient<I, O>(opts, stringifyEndpoint);
		await client.open();
		return client;
	}
};
