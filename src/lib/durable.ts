import { DurableObject } from 'cloudflare:workers';
import { object, string } from 'valibot';

import { durableProcedure, Handler } from './procedure';
import { Env, InferInputAtPath, RequestEvent, Router, RouterPaths } from './types';
import { getHandler } from './server';
import { parse } from './utils';
import { socketify } from './deform';
import { handleRequest } from './request';
import { error, FLARERROR, handleError } from './error';

export class DurableRouter<R extends Router = Router, IN extends Router = Router, OUT extends Router = Router> extends DurableObject {
	currentlyConnectedWebSockets;
	state: DurableObjectState;
	storage: DurableObjectStorage;
	env: Env;
	// @ts-ignore
	requestEvent: RequestEvent;
	sessions: Map<WebSocket, any>;
	lastTimestamp: number;
	ws?: WebSocket;
	router: R;
	topics: {
		in: IN;
		out: OUT;
	};
	constructor(ctx: DurableObjectState, env: Env, router: R, _in: IN, _out: OUT) {
		super(ctx, env);
		this.router = router;
		this.topics = {
			in: _in,
			out: _out,
		};
		this.state = ctx;
		this.storage = ctx.storage;
		this.env = env;
		this.sessions = new Map();
		this.lastTimestamp = 0;
		this.currentlyConnectedWebSockets = 0;
	}
	async fetch(request: Request) {
		if (request.url === '/connect') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);
			server.accept();
			this.currentlyConnectedWebSockets += 1;
			this.ws = server;
			server.addEventListener('message', (e) => {
				if (e.type === 'ping') {
					server.send('pong');
				} else {
					this.onMessage(e);
				}
			});
			server.addEventListener('open', () => {});

			server.addEventListener('close', (cls) => {
				this.currentlyConnectedWebSockets = Math.min(this.currentlyConnectedWebSockets - 1, 0);
				if (this.currentlyConnectedWebSockets === 0) {
					server.close(cls.code, 'Durable Object is closing WebSocket');
				}
			});
			server.send('Hello from client');
			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		} else {
			return new Response(null, {
				status: 101,
			});
		}
	}
	handleRpc = async (event: RequestEvent, path: string[]) => {
		const handler = getHandler(this.router, path);
		try {
			if (!handler) {
				error('NOT_FOUND');
			} else {
				return handleRequest(event, handler);
			}
		} catch (error) {
			return handleError(error);
		}
	};

	onMessage = (event: MessageEvent) => {
		if ('receive' in this && typeof this.receive === 'function') {
			this.receive(event.type, event.data);
		}
	};
}

const testProcedure = durableProcedure<Test>();

const topicsIn = {
	message: testProcedure()
		.input(object({ message: string() }))
		.handle(({ input, object }) => {
			object.send('message', { message: input.message });
			return {
				hello: input.message,
			};
		}),
};
const topicsOut = {
	message: testProcedure()
		.input(object({ message: string() }))
		.handle(({ input, object }) => {
			object.send('message', { message: input.message });
			return {
				hello: input.message,
			};
		}),
};

const router = {
	test: testProcedure()
		.input(object({ name: string() }))
		.handle(({ input, object }) => {
			object.send('message', {
				message: 'input.name',
			});
			return {
				hello: input.name,
			};
		}),
};

function createSender<D extends DurableRouter, E extends Router>(events: E, object: D) {
	return async <P extends RouterPaths<E>>(path: P, input: InferInputAtPath<E, P>) => {
		const handler = getHandler(events, String(path).split('.')) as Handler<any, any, any, any>;
		const parsedData = await parse(handler?.schema, input);
		const ctx = await handler?.call(object.requestEvent, parsedData, object);
		object.ws?.send(socketify({ type: path, input: parsedData, ctx }));
	};
}

function createReceiver<D extends DurableRouter, E extends Router>(events: E, object: D) {
	return async (path: RouterPaths<E>, input: any) => {
		try {
			const handler = getHandler(events, String(path).split('.')) as Handler<any, any, any, any>;
			const parsedData = await parse(handler?.schema, input);
			await handler?.call(object.requestEvent, parsedData, object);
		} catch (error) {
			if (error instanceof FLARERROR) {
				object.ws?.send(
					socketify({
						type: 'error',
						topic: path,
						error: {
							message: error.message,
							code: error.code,
						},
					}),
				);
			} else {
				object.ws?.send(
					socketify({
						type: 'error',
						topic: path,
						error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
					}),
				);
			}
		}
	};
}

class Test extends DurableRouter {
	send = createSender(topicsOut, this);
	receive = createReceiver(topicsIn, this);
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, router, topicsIn, topicsOut);
	}
}
