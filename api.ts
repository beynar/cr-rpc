import { createClient } from './src/lib/client';
import { AppRouter } from './src';

export const api = createClient<AppRouter>({
	endpoint: 'https://example.com/api/',
});
