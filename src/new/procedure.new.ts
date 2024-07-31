import { HandleFunction, Middleware, PreparedHandler, RequestEvent, ReturnOfMiddlewares, Schema, SchemaInput } from './types.new';

export class Procedure<M extends Middleware[], S extends Schema | undefined, H extends HandleFunction<S, M>> {
	private middlewares: M = [] as any;
	private handleFunction: H = undefined as any;
	schema: S = undefined as any;

	constructor(...middlewares: M) {
		this.middlewares = middlewares;
	}

	public parse = (data: any) => {
		if (this.schema === undefined) {
			return undefined;
		} else {
			// @ts-ignore
			const parseResult = this.schema.safeParse?.(data) || this.schema._parse?.(data);
			const errors = parseResult?.error?.issues || parseResult.issues;
			if (errors) {
				throw new Error(JSON.stringify(errors));
			}
			return parseResult.data || parseResult.output;
		}
	};

	private async useMiddlewares(event: RequestEvent): Promise<ReturnOfMiddlewares<M>> {
		const data = {};
		if (this.middlewares) {
			for (let middleware of this.middlewares) {
				Object.assign(data, await middleware(event));
			}
		}
		return data as ReturnOfMiddlewares<M>;
	}
	handle = (handleFunction: H) => {
		this.handleFunction = handleFunction;
		// @ts-ignore
		return this as Procedure<M, S, H, P>;
	};

	input = <SS extends S>(schema: SS) => {
		this.schema = schema;
		// @ts-ignore
		return this as Procedure<M, SS, HandleFunction<SS, M>>;
	};

	call = async (event: RequestEvent, input: S extends Schema ? SchemaInput<S> : undefined): Promise<ReturnType<H>> => {
		return this.handleFunction({ event, input, ctx: await this.useMiddlewares(event) } as any);
	};
}

export const procedure = <M extends Middleware[]>(...middlewares: M) => {
	return new Procedure(...middlewares);
};
