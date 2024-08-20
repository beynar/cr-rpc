import { error, Schema } from '.';

export const validate = <S extends Schema | undefined>(schema: S, data: any) => {
	if (schema === undefined) {
		return undefined;
	} else {
		// @ts-ignore
		const parseResult = schema.safeParse?.(data) || schema._run?.({ value: data }, { abortEarly: true, abortPipeEarly: true });
		const errors = parseResult?.error?.issues || parseResult.issues || parseResult.summary;
		if (errors) {
			throw error('BAD_REQUEST', errors);
		}
		if ('_run' in schema) {
			return parseResult.value;
		} else if ('safeParse' in schema) {
			return parseResult.data;
		}
		return parseResult.data || parseResult.output || parseResult;
	}
};
