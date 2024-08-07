import { DurableObject } from 'cloudflare:workers';
import { Handler } from './procedure';
import {
	DurableOptions,
	DurableRequestEvent,
	Env,
	InferInputAtPath,
	RegisteredParticipant,
	Router,
	RouterPaths,
	Schema,
	SchemaInput,
	Session,
} from './types';
import { getHandler } from './server';
import { parse } from './utils';
import { socketify, socketiparse } from './deform';
import { createDurableRequestEvent, handleRequest } from './request';
import { error, FLARERROR, handleError } from './error';
import { WSAPI, createRecursiveProxy } from './wsProxy';

type SendOptions = {
	to?: 'ALL' | (string & {}) | (string[] & {});
	omit?: string | string[];
};

export const createDurableServer = <_IN extends Router, _OUT extends Router>(opts?: DurableOptions, topicsIn?: _IN, topicsOut?: _OUT) => {
	return class DurableServer<R extends Router = Router, IN extends _IN = _IN, OUT extends _OUT = _OUT> extends DurableObject<any> {
		public ctx: DurableObjectState;
		public env: Env;
		// @ts-ignore
		id: string;
		state: DurableObjectState;
		storage: DurableObjectStorage;
		sessions: Map<WebSocket, Session> = new Map();
		requestEvents: Map<WebSocket, DurableRequestEvent> = new Map();
		// @ts-ignore
		requestEvent: DurableRequestEvent;
		router?: R;
		topicsIn?: IN;
		topicsOut?: OUT;

		constructor(ctx: DurableObjectState, env: Env) {
			super(ctx, env);
			this.state = ctx;
			this.storage = ctx.storage;
			this.env = env;
			this.ctx = ctx;
			this.env = env;
			this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
		}

		send = (
			{ omit, to = 'ALL' }: SendOptions = {
				to: 'ALL',
				omit: [],
			},
		) =>
			createRecursiveProxy(async ({ type, data }) => {
				if (!topicsOut) {
					throw error('SERVICE_UNAVAILABLE');
				}

				const handler = getHandler(topicsOut, type.split('.')) as Handler<any, any, any, any>;
				const parsedData = await parse(handler?.schema, data);
				const ctx = await handler?.call(this.requestEvent as any, parsedData, this);

				const sessions = Array.from(this.sessions.entries()).filter(([key, value]) => {
					if (value.connected !== true) {
						return false;
					}
					if (omit && omit.length > 0) {
						return !omit.includes(value.participant.id);
					}
					if (to === 'ALL' || !to) {
						return true;
					} else {
						return [to].flat().includes(value.participant.id);
					}
				});

				sessions.forEach(([key, value]) => {
					key.send(socketify({ type, data: parsedData, ctx }));
				});
			}) as WSAPI<_IN>;

		async handleRpc(request: Request) {
			const requestEvent = createDurableRequestEvent(request);
			if (!this.router) {
				throw error('SERVICE_UNAVAILABLE');
			}
			try {
				this.id = request.headers.get('x-flarepc-object-id') as string;
				const handler = getHandler(this.router, requestEvent.path);
				if (!handler) {
					error('NOT_FOUND');
				} else {
					return handleRequest(requestEvent as any, handler, this);
				}
			} catch (error) {
				return handleError(error);
			}
		}

		async fetch(request: Request) {
			try {
				const [client, server] = Object.values(new WebSocketPair());

				const url = new URL(request.url);
				const participant = url.searchParams.get('participant');
				const session = {
					id: crypto.randomUUID(),
					participant: participant ? JSON.parse(participant) : { id: crypto.randomUUID() },
					connected: true,
					createdAt: Date.now(),
					meta: request.cf,
				} satisfies Session & { participant: Partial<RegisteredParticipant> };

				const requestEvent = createDurableRequestEvent(request, server, session);

				session.participant = (await opts?.getParticipant?.({ event: requestEvent, object: this })) || session.participant;

				this.sessions.set(server, session);
				this.requestEvents.set(server, requestEvent);

				const accepted = await opts?.acceptConnection?.({ event: requestEvent, object: this });
				if (opts?.acceptConnection && !accepted) {
					throw error('UNAUTHORIZED');
				}

				this.state.acceptWebSocket(server);
				this.sendPresence();

				return new Response(null, {
					status: 101,
					webSocket: client,
				});
			} catch (error) {
				opts?.onError?.(error);
				return handleError(error);
			}
		}

		async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
			const { type, data } = socketiparse(message as string);
			if (!topicsIn) {
				throw error('SERVICE_UNAVAILABLE');
			}
			try {
				const handler = getHandler(topicsIn, String(type).split('.')) as Handler<any, any, any, any>;
				const parsedData = await parse(handler?.schema, data);
				const requestEvent = this.requestEvents.get(ws);
				await handler?.call(requestEvent as any, parsedData, this);
			} catch (error) {
				// send error somehow
				if (error instanceof FLARERROR) {
				} else {
				}
			}
		}
		async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
			console.log('closing');
			this.sessions.delete(ws);
			console.log(this.sessions.size);
			this.sendPresence();
		}

		sendPresence = () => {
			const webSockets: WebSocket[] = [];
			const sessions = Array.from(this.sessions.entries())
				.filter(([key, value]) => {
					if (value.connected !== true) {
						return false;
					}
					webSockets.push(key);
					return true;
				})
				.map(([key, value]) => value.participant);

			webSockets.forEach((value) => {
				value.send(socketify({ type: 'presence', data: sessions }));
			});
		};
	};
};
