//SOURCE : https://github.com/napolab/y-durableobjects/blob/main/src/yjs/internal.ts

// import type { YTransactionStorageImpl } from './storage';
import { createDecoder, readVarUint, readVarUint8Array } from 'lib0/decoding';
import { createEncoder, length, toUint8Array, writeVarUint, writeVarUint8Array } from 'lib0/encoding';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { readSyncMessage, writeSyncStep1, writeUpdate } from 'y-protocols/sync';
import { Doc } from 'yjs';

type YTransactionStorageImpl = any;

export const setupWSConnection = (ws: WebSocket, doc: RemoteDoc) => {
	{
		const encoder = createTypedEncoder('sync');
		writeSyncStep1(encoder, doc);
		ws.send(toUint8Array(encoder));
	}

	{
		const states = doc.awareness.getStates();
		if (states.size > 0) {
			const encoder = createTypedEncoder('awareness');
			const update = encodeAwarenessUpdate(doc.awareness, Array.from(states.keys()));
			writeVarUint8Array(encoder, update);

			ws.send(toUint8Array(encoder));
		}
	}
};

export const messageType = {
	sync: 0,
	awareness: 1,
};

export type AwarenessChanges = {
	added: number[];
	updated: number[];
	removed: number[];
};

export interface RemoteDoc extends Doc {
	readonly awareness: Awareness;
}

export const isMessageType = (type: string): type is keyof typeof messageType => {
	return Object.keys(messageType).includes(type);
};

export const createTypedEncoder = (type: keyof typeof messageType) => {
	if (!isMessageType(type)) {
		throw new Error(`Unsupported message type: ${type}`);
	}

	const encoder = createEncoder();
	writeVarUint(encoder, messageType[type]);

	return encoder;
};

export interface InternalYDurableObject {
	// private state
	doc: WSSharedDoc;
	storage: YTransactionStorageImpl;
	sessions: Map<WebSocket, () => void>;
	awarenessClients: Set<number>;

	// private api

	onStart(): Promise<void>;
	createRoom(roomId: string): WebSocket;

	registerWebSocket(ws: WebSocket): void;
	unregisterWebSocket(ws: WebSocket): void;
	cleanup(): void;

	// public api
	fetch(request: Request): Promise<Response>;
	webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void;
	webSocketError(ws: WebSocket): void;
	webSocketClose(ws: WebSocket): void;

	getYDoc(): Promise<Uint8Array>;
	updateYDoc(update: Uint8Array): Promise<void>;
}

type Listener<T> = (message: T) => void;
type Unsubscribe = () => void;
interface Notification<T> extends RemoteDoc {
	notify(cb: Listener<T>): Unsubscribe;
}

export class WSSharedDoc extends Doc implements Notification<Uint8Array> {
	private listeners = new Set<Listener<Uint8Array>>();
	readonly awareness = new Awareness(this);

	constructor(gc = true) {
		super({ gc });
		this.awareness.setLocalState(null);

		// カーソルなどの付加情報の更新通知
		this.awareness.on('update', (changes: AwarenessChanges) => {
			this.awarenessChangeHandler(changes);
		});
		// yDoc の更新通知
		this.on('update', (update: Uint8Array) => {
			this.syncMessageHandler(update);
		});
	}

	update(message: Uint8Array) {
		const encoder = createEncoder();
		const decoder = createDecoder(message);
		const type = readVarUint(decoder);

		switch (type) {
			case messageType.sync: {
				writeVarUint(encoder, messageType.sync);
				readSyncMessage(decoder, encoder, this, null);

				// changed remote doc
				if (length(encoder) > 1) {
					this._notify(toUint8Array(encoder));
				}
				break;
			}
			case messageType.awareness: {
				applyAwarenessUpdate(this.awareness, readVarUint8Array(decoder), null);
				break;
			}
		}
	}

	notify(listener: Listener<Uint8Array>) {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	private syncMessageHandler(update: Uint8Array) {
		const encoder = createTypedEncoder('sync');
		writeUpdate(encoder, update);

		this._notify(toUint8Array(encoder));
	}
	private awarenessChangeHandler({ added, updated, removed }: AwarenessChanges) {
		const changed = [...added, ...updated, ...removed];
		const encoder = createTypedEncoder('awareness');
		const update = encodeAwarenessUpdate(this.awareness, changed, this.awareness.states);
		writeVarUint8Array(encoder, update);

		this._notify(toUint8Array(encoder));
	}

	private _notify(message: Uint8Array) {
		for (const subscriber of this.listeners) {
			subscriber(message);
		}
	}
}
