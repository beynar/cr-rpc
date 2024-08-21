import { removeAwarenessStates } from 'y-protocols/awareness';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import { WSSharedDoc, setupWSConnection, type AwarenessChanges } from './internal';
import { DurableOptions, DurableMeta, Env, Locals, createDurableServer } from '..';
import { StorageOptions, YTransactionStorageImpl } from './storage';

export type WebSocketAttachment = {
	roomId: string;
	connectedAt: Date;
};

type DurableDocEvent = {
	ctx: DurableObjectState;
	env: Env;
	locals: Locals;
	meta: DurableMeta;
};

type DurableDocOptions =
	| (DurableOptions &
			StorageOptions & {
				save: ({ doc, update }: { doc: Doc; update: Uint8Array }) => Promise<void>;
				get: (event: DurableDocEvent) => Promise<Doc | Uint8Array>;
			})
	| undefined;

export class DurableDoc extends createDurableServer() {
	durableDoc = true;
	doc = new WSSharedDoc();
	declare opts: DurableDocOptions;
	sessions = new Map<WebSocket, () => void>();
	awarenessClients = new Set<number>();
	storage: YTransactionStorageImpl;

	setMeta(meta: DurableMeta) {
		this.meta = meta;
		this.ctx.storage.put(this.meta);
	}
	constructor(
		public state: DurableObjectState,
		public env: Env,
	) {
		super(state, env);
		this.storage = new YTransactionStorageImpl(this.ctx.storage, this.opts);

		this.onArrayBufferMessage = this.onMessage;
		this.onConnectionClose = async (ws: WebSocket) => {
			await this.unregisterWebSocket(ws);
			await this.cleanup();
		};
		this.onConnectionOpen = this.registerWebSocket;
		void this.state.blockConcurrencyWhile(this.onStart);
	}

	onStart = async (): Promise<void> => {
		const doc = await this.storage.getYDoc();
		applyUpdate(this.doc, encodeStateAsUpdate(doc));
		for (const ws of this.state.getWebSockets()) {
			this.registerWebSocket(ws);
		}

		this.doc.on('update', async (update) => {
			await this.storage.storeUpdate(update);
		});
		this.doc.awareness.on('update', async ({ added, removed, updated }: AwarenessChanges) => {
			for (const client of [...added, ...updated]) {
				this.awarenessClients.add(client);
			}
			for (const client of removed) {
				this.awarenessClients.delete(client);
			}
		});
	};
	updateYDoc = async (update: Uint8Array): Promise<void> => {
		this.doc.update(update);
		await this.cleanup();
	};
	getYDoc = async (): Promise<Uint8Array> => {
		return encodeStateAsUpdate(this.doc);
	};
	onMessage = async (_sws: WebSocket, message: ArrayBuffer) => {
		await this.updateYDoc(new Uint8Array(message));
	};
	registerWebSocket = (ws: WebSocket) => {
		setupWSConnection(ws, this.doc);
		const s = this.doc.notify((message) => {
			ws.send(message);
		});
		this.sessions.set(ws, s);
	};
	unregisterWebSocket = async (ws: WebSocket) => {
		try {
			const dispose = this.sessions.get(ws);
			dispose?.();
			this.sessions.delete(ws);
			const clientIds = this.awarenessClients;
			removeAwarenessStates(this.doc.awareness, Array.from(clientIds), null);
		} catch (e) {
			console.error(e);
		}
	};
	cleanup = async () => {
		if (this.sessions.size < 1) {
			await this.storage.commit();
		}
	};
}

export const createDurableDoc = (opts?: DurableDocOptions) => {
	return class extends DurableDoc {
		_DOC_ = true;
		opts = opts;
	};
};
