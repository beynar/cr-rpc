import { HandleFunction } from './types.new';
import { Procedure } from './procedure.new';

// export type Router<R extends AnyRouter> = {
// 	[K in keyof R]: R[K] extends AnyPath
// 		? K extends string
// 			? Record<`[${R[K]['param']}]`, Path<K, R[K]['router']>>
// 			: never
// 		: R[K] extends AnyProcedure
// 			? Procedure<R[K]['middlewares'], R[K]['schema'], R[K]['handleFunction']>
// 			: R[K] extends AnyRouter
// 				? Router<R[K]>
// 				: never;
// };

export type Router<R extends Router<R, P>, P extends string = string> = {
	[K in keyof R]: R[K] extends Router<infer R>
		? Router<R, P>
		: R[K] extends Procedure<any, any, any>
			? Procedure<R[K]['middlewares'], R[K]['schema'], HandleFunction<R[K]['schema'], R[K]['middlewares'], 'test'>>
			: never;
};
// };
// export type Router<R extends AnyRouter> = {
// 	[K in keyof R]: R[K] extends AnyPath
// 		? PathParam<R[K]['param'], R[K]['router']>
// 		: R[K] extends AnyRouter
// 			? Router<R[K]>
// 			: R[K] extends AnyProcedure
// 				? Procedure<R[K]['middlewares'], R[K]['schema'], R[K]['handleFunction']>
// 				: never;
// };

// type RecursiveOverloadOfProcedureHandleFunction<R extends AnyRouter, Params extends string[]> = {
// 	[K in keyof R]: R[K] extends AnyRouter
// 		? RecursiveOverloadOfProcedureHandleFunction<R[K], Params>
// 		: R[K] extends AnyProcedure
// 			? Procedure<R[K]['middlewares'], R[K]['schema'], HandleFunction<R[K]['schema'], R[K]['middlewares'], string[]>>
// 			: never;
// };

export const router = <const R extends Router<R, P>, P extends string = 'string'>(r: R, p?: P[]): R => {
	return r;
};
