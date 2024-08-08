import { stringify, parse } from 'devalue';
import { Session } from './types';
const url = {
	stringify: (value: any) => {
		if (value instanceof URL) {
			return value.toString();
		}
	},
	parse: (value: any) => {
		return new URL(value);
	},
};

export const socketify = (value: unknown) => {
	return stringify(value, {
		URL: url.stringify,
	});
};

export const socketiparse = (value: string) => {
	return parse(value, {
		URL: url.parse,
	});
};

export const form = (value: unknown, formData: FormData = new FormData()) => {
	const stringified = stringify(value, {
		File: (value: any) => {
			if (value instanceof File) {
				formData.append(value.name, value);
				return value.name;
			}
		},
		URL: url.stringify,
	});
	formData.set('value', stringified);
	return formData;
};

export const deform = (formData: FormData) => {
	const stringified = formData.get('value') as string;
	const value = parse(stringified, {
		File: (value: any) => {
			return formData.get(value) as File;
		},
		URL: url.parse,
	});
	return value;
};

export const serializeAttachment = (ws: WebSocket, value: Session) => {
	ws.serializeAttachment(socketify(value));
};

export const deserializeAttachment = (ws: WebSocket): Session => {
	return socketiparse(ws.deserializeAttachment()) as Session;
};
