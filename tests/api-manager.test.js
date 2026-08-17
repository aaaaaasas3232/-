import test from 'node:test';
import assert from 'node:assert/strict';

const rows = {
    apiKeys: [
        {
            id: 'key-1',
            label: 'Key 1',
            provider: 'openai-compatible',
            baseUrl: 'https://example.test/v1',
            apiKey: 'secret-1',
            model: 'model-1',
            enabled: true,
            sortOrder: 1,
        },
        {
            id: 'key-2',
            label: 'Key 2',
            provider: 'openai-compatible',
            baseUrl: 'https://example.test/v1',
            apiKey: 'secret-2',
            model: 'model-2',
            enabled: true,
            sortOrder: 2,
        },
    ],
    apiGroups: [
        {
            id: 'group-1',
            name: '轮询组',
            apiKeyIds: ['key-1', 'key-2'],
            strategy: 'round-robin',
            currentIndex: 0,
        },
    ],
    apiUsageLogs: [],
};

const db = {
    ready: Promise.resolve(),
    async getAll(store) {
        return (rows[store] || []).map(item => ({ ...item }));
    },
    async put(store, value) {
        const list = rows[store] || (rows[store] = []);
        const index = list.findIndex(item => item.id === value.id);
        if (index >= 0) list[index] = { ...value };
        else list.push({ ...value });
        return value;
    },
    async remove(store, id) {
        rows[store] = (rows[store] || []).filter(item => item.id !== id);
    },
};

globalThis.localStorage = {
    setItem() {},
    removeItem() {},
};
globalThis.window = {
    myDb: db,
    refreshPhoneApps() {},
};

const {
    getApiSdk,
    renderApiManagerSection,
    waitApiSdkReady,
} = await import('../js/apps/setting/api-manager/api-manager-section.js');

await waitApiSdkReady();
const sdk = getApiSdk();

test('API editor markup lets framework receive close and save actions', () => {
    const app = {
        state: {
            apiMgr: {
                tab: 'keys',
                editingKey: {
                    id: 'key_new_test',
                    provider: 'openai-compatible',
                    params: {},
                },
            },
        },
    };
    const html = renderApiManagerSection(app);

    assert.match(html, /data-api-modal-kind="key"/);
    assert.match(html, /method&quot;:&quot;apiSaveKey/);
    assert.match(html, /method&quot;:&quot;apiCloseKeyEditor/);
    assert.doesNotMatch(html, /event\.stopPropagation/);
});

test('shared executor rotates groups and writes successful calls to page statistics', async () => {
    const requestedModels = [];
    globalThis.fetch = async (_url, init) => {
        const body = JSON.parse(init.body);
        requestedModels.push(body.model);
        return new Response(JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };

    const before = sdk.apiUsageSdk.listAll().length;
    const first = await sdk.executeApiRequest({
        groupId: 'group-1',
        endpoint: 'chat/completions',
        body: { messages: [{ role: 'user', content: 'hi' }] },
    });
    const second = await sdk.executeApiRequest({
        groupId: 'group-1',
        endpoint: 'chat/completions',
        body: { messages: [{ role: 'user', content: 'again' }] },
    });

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.deepEqual(requestedModels, ['model-1', 'model-2']);
    assert.equal(sdk.apiUsageSdk.listAll().length, before + 2);
    assert.equal(sdk.apiUsageSdk.listAll()[0].totalTokens, 5);
});

test('one HTTP failure produces one log with the real status code', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
        error: { message: 'rate limited' },
    }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
    });

    const before = sdk.apiUsageSdk.listAll().length;
    const result = await sdk.executeApiRequest({
        apiKeyId: 'key-1',
        endpoint: 'chat/completions',
        body: { messages: [{ role: 'user', content: 'hi' }] },
    });
    const added = sdk.apiUsageSdk.listAll().slice(0, sdk.apiUsageSdk.listAll().length - before);

    assert.equal(result.success, false);
    assert.equal(result.statusCode, 429);
    assert.equal(added.length, 1);
    assert.equal(added[0].statusCode, 429);
});
