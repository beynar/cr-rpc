<script lang="ts">
	import { onMount } from 'svelte';
	import * as Y from 'yjs';
	import { WebsocketProvider } from 'y-websocket';
	import { api, publicApi } from '../../api';
	import { DocProvider } from 'flarepc/yjs/client';
	let doc = $state<Y.Doc>();

	let text = $state<string>();
	onMount(async () => {
		console.log('hello');

		const { awareness, doc: D, client } = await publicApi.TestDurable('test').doc(DocProvider);
		doc = D;
		text = D.getText('text').toJSON();

		D.on('update', () => {
			text = D.getText('text').toJSON();
		});
	});
</script>

<button
	onclick={async () => {
		const res = await publicApi.TestDurable('test').update();
		console.log(res);
	}}
>
	add text remote
</button>
<button
	onclick={async () => {
		doc.getText('text').insert(0, 'Hello, world!');
	}}
>
	add text
</button>
<button
	onclick={async () => {
		doc.getText('text').delete(0, doc.getText('text').length);
	}}
>
	delete
</button>
{#if doc}
	<div class="grid bg-slate-200 h-screen grid-cols-2 gap-4 p-10">
		{!text ? 'none' : text}
	</div>
{/if}
