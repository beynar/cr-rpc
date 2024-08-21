import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';

export type Key =
	| {
			type: 'update';
			name?: number;
	  }
	| {
			type: 'state';
			name: 'bytes' | 'doc' | 'count';
	  };

export const storageKey = (key: Key) => {
	return `ydoc:${key.type}:${key.name ?? ''}`;
};

export type StorageOptions = {
	/**
	 * @description default is 10KB
	 * @default 10 * 1024 * 1
	 */
	maxBytes?: number;
	/**
	 * @description default is 500 snapshot
	 * @default 500
	 */
	maxUpdates?: number;

	getInitialYDoc?: (doc: Doc) => void;
};

export class YTransactionStorageImpl {
	private readonly MAX_BYTES: number;
	private readonly MAX_UPDATES: number;
	private opts?: StorageOptions;
	// eslint-disable-next-line no-useless-constructor
	constructor(
		private readonly storage: DurableObjectStorage,
		opts?: StorageOptions,
	) {
		this.opts = opts;
		this.MAX_BYTES = opts?.maxBytes ?? 10 * 1024;
		if (this.MAX_BYTES > 128 * 1024) {
			// https://developers.cloudflare.com/durable-objects/platform/limits/
			throw new Error('maxBytes must be less than 128KB');
		}

		this.MAX_UPDATES = opts?.maxUpdates ?? 500;
	}

	async getYDoc(): Promise<Doc> {
		const snapshot = await this.storage.get<Uint8Array>(storageKey({ type: 'state', name: 'doc' }));
		const data = await this.storage.list<Uint8Array>({
			prefix: storageKey({ type: 'update' }),
		});

		const updates: Uint8Array[] = Array.from(data.values());
		const doc = new Doc();

		doc.transact(() => {
			if (updates.length > 0 || snapshot) {
				if (snapshot) {
					applyUpdate(doc, snapshot);
				}
				for (const update of updates) {
					applyUpdate(doc, update);
				}
			} else {
				if (this.opts?.getInitialYDoc) {
					this.opts?.getInitialYDoc(doc);
				}
			}
		});

		return doc;
	}

	storeUpdate(update: Uint8Array): Promise<void> {
		return this.storage.transaction(async (tx) => {
			const bytes = (await tx.get<number>(storageKey({ type: 'state', name: 'bytes' }))) ?? 0;
			const count = (await tx.get<number>(storageKey({ type: 'state', name: 'count' }))) ?? 0;

			const updateBytes = bytes + update.byteLength;
			const updateCount = count + 1;

			if (updateBytes > this.MAX_BYTES || updateCount > this.MAX_UPDATES) {
				const doc = await this.getYDoc();
				applyUpdate(doc, update);

				await this._commit(doc, tx);
			} else {
				await tx.put(storageKey({ type: 'state', name: 'bytes' }), updateBytes);
				await tx.put(storageKey({ type: 'state', name: 'count' }), updateCount);
				await tx.put(storageKey({ type: 'update', name: updateCount }), update);
			}
		});
	}

	private async _commit(doc: Doc, tx: Omit<DurableObjectTransaction, 'transaction'>) {
		const data = await tx.list<Uint8Array>({
			prefix: storageKey({ type: 'update' }),
		});

		for (const update of data.values()) {
			applyUpdate(doc, update);
		}

		const update = encodeStateAsUpdate(doc);

		await tx.delete(Array.from(data.keys()));
		await tx.put(storageKey({ type: 'state', name: 'bytes' }), 0);
		await tx.put(storageKey({ type: 'state', name: 'count' }), 0);
		await tx.put(storageKey({ type: 'state', name: 'doc' }), update);
	}

	async commit(): Promise<void> {
		const doc = await this.getYDoc();

		return this.storage.transaction(async (tx) => {
			await this._commit(doc, tx);
		});
	}
}
