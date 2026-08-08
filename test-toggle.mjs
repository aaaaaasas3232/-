import('./js/apps/setting/world/sdk/reply-prompts.js').then(async (mod) => {
    const sdk = {
        aiPersons: {
            get(id) {
                if (id === 'test-ai') {
                    return {
                        id: 'test-ai',
                        replyPrompts: [
                            { id: 'a', title: 'A', content: 'aaa', active: true, order: 1 },
                            { id: 'b', title: 'B', content: 'bbb', active: true, order: 2 },
                            { id: 'c', title: 'C', content: 'ccc', active: false, order: 3 },
                        ]
                    };
                }
                return null;
            },
            async update(id, patch) {
                console.log('  [mock] aiPersons.update', id, JSON.stringify(patch).slice(0, 80));
                const p = this.get(id);
                if (p && patch.replyPrompts) {
                    p.replyPrompts = patch.replyPrompts;
                }
                return p;
            }
        }
    };
    const api = mod.createReplyPromptsApi(sdk);
    console.log('=== 初始 list ===');
    console.log('list:', api.list('test-ai').map(p => p.id + ':' + (p.active !== false)));
    console.log('listActive:', api.listActive('test-ai').map(p => p.id));
    console.log();
    console.log('=== toggle a: true -> false ===');
    await api.toggleActive('test-ai', 'a');
    console.log('list:', api.list('test-ai').map(p => p.id + ':' + (p.active !== false)));
    console.log('listActive:', api.listActive('test-ai').map(p => p.id));
    console.log();
    console.log('=== toggle c: false -> true ===');
    await api.toggleActive('test-ai', 'c');
    console.log('list:', api.list('test-ai').map(p => p.id + ':' + (p.active !== false)));
    console.log('listActive:', api.listActive('test-ai').map(p => p.id));
});