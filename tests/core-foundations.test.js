import test from 'node:test';
import assert from 'node:assert/strict';

import {
    WORLD_MODES,
    createProfileKey,
    isAppAvailableForWorld,
    registerEncounteredCharacter,
    registerGeoCandidate,
    resolveWorldMode,
} from '../src/core/world-profile.js';
import {
    applyAttributeDeltas,
    createSeededRandom,
    resolveContest,
    validateExperienceSetup,
} from '../src/core/experience-system.js';
import {
    chargeAsset,
    getAssetBalance,
    refundAsset,
} from '../src/core/asset-ledger.js';
import { composeContext } from '../src/core/context-composer.js';
import {
    clearSocialInfluenceProviders,
    collectSocialInfluences,
    listSocialInfluenceProviders,
    registerSocialInfluenceProvider,
} from '../src/core/social-influence-registry.js';

test('world mode resolution prefers explicit data and supports old presets', () => {
    assert.equal(resolveWorldMode({ experienceMode: 'idol' }), WORLD_MODES.IDOL);
    assert.equal(resolveWorldMode({ presetSource: { id: 'preset-actor-world' } }), WORLD_MODES.ACTOR);
    assert.equal(resolveWorldMode({ tagRefs: ['末世'] }), WORLD_MODES.APOCALYPSE);
    assert.equal(resolveWorldMode({ name: '普通校园世界' }), WORLD_MODES.GENERAL);
});

test('world availability and profile keys are deterministic', () => {
    assert.equal(createProfileKey({ id: 'u1' }, { id: 'w1' }), 'u1::w1');
    assert.equal(createProfileKey({ id: 'u1' }, null), null);

    const actorProfile = { world: { id: 'w1' }, mode: WORLD_MODES.ACTOR };
    assert.equal(isAppAvailableForWorld({
        worldAvailability: { includeModes: ['actor'] },
    }, actorProfile), true);
    assert.equal(isAppAvailableForWorld({
        worldAvailability: { excludeModes: ['actor'] },
    }, actorProfile), false);
});

test('experience setup, deltas, and contests stay bounded and reproducible', () => {
    const schema = [{ key: 'career', label: '职业生涯' }];
    assert.equal(validateExperienceSetup({}, schema).ok, false);
    assert.equal(validateExperienceSetup({ career: '青训选手' }, schema).ok, true);

    const applied = applyAttributeDeltas(
        { stamina: 2, focus: 9 },
        [
            { key: 'stamina', value: -5, reason: '透支训练' },
            { key: 'focus', value: 5 },
        ],
        { min: 0, max: 10 },
    );
    assert.deepEqual(applied.attributes, { stamina: 0, focus: 10 });
    assert.equal(applied.changes[0].applied, -2);

    const first = resolveContest({
        playerScore: 10,
        opponentScore: 20,
        random: createSeededRandom(20260815),
    });
    const replay = resolveContest({
        playerScore: 10,
        opponentScore: 20,
        random: createSeededRandom(20260815),
    });
    assert.deepEqual(first, replay);
    assert.ok(first.chance < 0.5);
    assert.ok(first.chance >= first.upsetFloor);
});

test('asset ledger checks balance and supports source-based refunds', async () => {
    let balance = 100;
    const entries = [];
    const sdk = {
        assetFlow: {
            getBalance: () => balance,
            listBySource: (sourceType, sourceId) => entries.filter((entry) => (
                entry.sourceType === sourceType && entry.sourceId === sourceId
            )),
            async add(entry) {
                balance -= entry.amount;
                entries.push(entry);
                return { ok: true, entry, balance };
            },
            async removeBySource(sourceType, sourceId) {
                const matched = entries.filter((entry) => (
                    entry.sourceType === sourceType && entry.sourceId === sourceId
                ));
                const amount = matched.reduce((sum, entry) => sum + entry.amount, 0);
                balance += amount;
                return { ok: true, removed: matched.length };
            },
        },
    };

    const charged = await chargeAsset({
        sdk,
        entityId: 'u1',
        amount: 30,
        sourceType: 'travel-ticket',
        sourceId: 'ticket-1',
    });
    assert.equal(charged.ok, true);
    assert.equal(getAssetBalance('user', 'u1', { sdk }), 70);

    const duplicate = await chargeAsset({
        sdk,
        entityId: 'u1',
        amount: 30,
        sourceType: 'travel-ticket',
        sourceId: 'ticket-1',
    });
    assert.equal(duplicate.duplicated, true);
    assert.equal(getAssetBalance('user', 'u1', { sdk }), 70);

    const insufficient = await chargeAsset({
        sdk,
        entityId: 'u1',
        amount: 80,
        sourceType: 'travel-ticket',
        sourceId: 'ticket-2',
    });
    assert.equal(insufficient.ok, false);
    assert.equal(insufficient.error, '余额不足');

    const refunded = await refundAsset({
        sdk,
        entityId: 'u1',
        sourceType: 'travel-ticket',
        sourceId: 'ticket-1',
    });
    assert.equal(refunded.ok, true);
    assert.equal(refunded.balance, 100);
});

test('prompt composition keeps preview and sent content on one source', () => {
    const result = composeContext([
        { id: 'world', title: '世界观', content: '末日废土', locked: true, order: 10 },
        { id: 'optional', title: '附加要求', content: '不要生成', active: false, order: 20 },
        { id: 'task', title: '任务', content: '生成旅行地点', order: 30 },
    ]);

    assert.equal(result.parts.filter((part) => part.included).length, 2);
    assert.match(result.text, /<世界观开始>/);
    assert.match(result.text, /生成旅行地点/);
    assert.doesNotMatch(result.text, /不要生成/);
});

test('travel locations and social encounters register idempotently', async () => {
    const places = [];
    const locations = [];
    const persons = [];
    const sdk = {
        places: {
            list: ({ worldRef }) => places.filter((item) => item.worldRef === worldRef),
            get: (id) => places.find((item) => item.id === id) || null,
            async create(input) {
                const row = { id: `place-${places.length + 1}`, ...input };
                places.push(row);
                return row;
            },
        },
        locations: {
            list: ({ worldRef }) => locations.filter((item) => item.worldRef === worldRef),
            get: (id) => locations.find((item) => item.id === id) || null,
            getByPlace: (worldRef, placeRef) => locations.filter((item) => (
                item.worldRef === worldRef && item.placeRef === placeRef
            )),
            async create(input) {
                const row = { id: `location-${locations.length + 1}`, ...input };
                locations.push(row);
                return row;
            },
        },
        aiPersons: {
            list: () => persons,
            async create(input) {
                const row = { id: `person-${persons.length + 1}`, ...input };
                persons.push(row);
                return row;
            },
        },
    };
    const profile = { worldId: 'world-1' };

    const firstGeo = await registerGeoCandidate({
        placeName: '雾港',
        locationName: '潮汐旅店',
    }, { sdk, profile });
    const repeatedGeo = await registerGeoCandidate({
        placeName: '雾港',
        locationName: '潮汐旅店',
    }, { sdk, profile });
    assert.equal(firstGeo.createdPlace, true);
    assert.equal(firstGeo.createdLocation, true);
    assert.equal(repeatedGeo.createdPlace, false);
    assert.equal(repeatedGeo.createdLocation, false);
    assert.equal(places.length, 1);
    assert.equal(locations.length, 1);

    const firstFriend = await registerEncounteredCharacter({
        name: '阿舟',
        externalId: 'video-user-7',
        encounter: '在直播间聊到同一本书',
    }, { sdk, profile, sourceApp: 'youtube' });
    const repeatedFriend = await registerEncounteredCharacter({
        name: '阿舟',
        externalId: 'video-user-7',
    }, { sdk, profile, sourceApp: 'youtube' });
    assert.equal(firstFriend.created, true);
    assert.equal(repeatedFriend.created, false);
    assert.equal(persons.length, 1);
    assert.equal(persons[0].boundWorldId, 'world-1');
});

test('career apps can inject lazy, target-specific social influences', async () => {
    clearSocialInfluenceProviders();
    let calls = 0;
    const unregister = registerSocialInfluenceProvider({
        sourceAppId: 'actor-career',
        providerId: 'recent-career',
        label: '近期演艺经历',
        targetAppIds: ['youtube', 'blog'],
        channels: ['dm'],
        async getContent({ profile }) {
            calls += 1;
            return profile?.worldId === 'world-1'
                ? { content: '用户刚完成一场重要试镜。' }
                : '';
        },
    });

    assert.equal(listSocialInfluenceProviders('youtube', { channel: 'dm' }).length, 1);
    assert.equal(calls, 0);

    const parts = await collectSocialInfluences({
        targetAppId: 'youtube',
        channel: 'dm',
        profile: { worldId: 'world-1' },
    });
    assert.equal(calls, 1);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].source, 'actor-career');

    unregister();
    clearSocialInfluenceProviders();
});
