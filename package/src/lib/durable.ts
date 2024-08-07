import { DurableObject } from 'cloudflare:workers';
import { Handler } from './procedure';
import { DurableOptions, DurableRequestEvent, Env, Participant, Router, Session } from './types';
import { getHandler } from './server';
import { deserializeAttachment, serializeAttachment, socketify, socketiparse } from './deform';
import { createDurableRequestEvent, handleRequest } from './request';
import { error, FLARERROR, getErrorAsJson, handleError } from './error';
import { WSAPI, createRecursiveProxy } from './wsProxy';
import { parse } from './utils';

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

				const sessions = this.getSessions().filter(({ ws, session }) => {
					if (session.connected !== true) {
						return false;
					}
					if (omit && omit.length > 0) {
						return !omit.includes(session.participant.id);
					}
					if (to === 'ALL' || !to) {
						return true;
					} else {
						return [to].flat().includes(session.participant.id);
					}
				});

				sessions.forEach(({ ws }) => {
					ws.send(socketify({ type, data: parsedData, ctx }));
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
			let session: Session | undefined = undefined;
			let ws: WebSocket | undefined = undefined;
			try {
				const [client, server] = Object.values(new WebSocketPair());
				ws = server;
				const event = createDurableRequestEvent(request);
				const url = new URL(request.url);
				const participant = url.searchParams.get('participant');
				const searchParamsParticipant = participant ? JSON.parse(participant) : { id: crypto.randomUUID() };

				const accepted = (await opts?.acceptConnection?.({ event, object: this })) || true;
				if (!accepted) {
					throw error('UNAUTHORIZED');
				}
				const remoteParticipant = await opts?.getParticipant?.({ event: event, object: this });

				session = {
					id: crypto.randomUUID(),
					participant: Object.assign({}, searchParamsParticipant, remoteParticipant || {}),
					connected: true,
					createdAt: Date.now(),
					data: (await opts?.getSessionData?.({ event, object: this })) || {},
				};

				serializeAttachment(server, session);
				this.state.acceptWebSocket(server);
				this.sendPresence();

				return new Response(null, {
					status: 101,
					webSocket: client,
				});
			} catch (error) {
				opts?.onError?.({ error, ws, session, object: this });
				return handleError(error);
			}
		}

		async webSocketMessage(ws: WebSocket, message: string): Promise<void> {
			const { type, data } = socketiparse(message as string);
			const session = deserializeAttachment(ws);
			if (!topicsIn) {
				throw error('SERVICE_UNAVAILABLE');
			}
			try {
				await opts?.onMessage?.({ ws, session, message, object: this });
				const handler = getHandler(topicsIn, String(type).split('.')) as Handler<any, any, any, any>;
				const parsedData = await parse(handler?.schema, data);
				await handler?.call({ session, ws } as any, parsedData, this);
			} catch (error) {
				opts?.onError?.({ error, ws, session, message, object: this });
				const { body, status, statusText } = getErrorAsJson(error);
				ws.send(socketify({ type: 'error', data: { ...JSON.parse(body), status, statusText } }));
			}
		}
		async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
			setTimeout(() => {
				this.sendPresence();
			});
		}

		getSessions = () => {
			return this.ctx.getWebSockets().map((ws) => ({
				session: deserializeAttachment(ws),
				ws,
			}));
		};

		sendPresence = () => {
			const webSockets: WebSocket[] = [];
			const participants = this.getSessions()
				.filter(({ ws, session }) => {
					if (session.connected !== true) {
						return false;
					}
					webSockets.push(ws);
					return true;
				})
				.map(({ session: { participant } }) => participant);

			webSockets.forEach((value) => {
				value.send(socketify({ type: 'presence', data: participants }));
			});
		};
	};
};
