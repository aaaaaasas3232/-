/**
 * settings-sdk · 内部事件总线
 *
 * 简单实现：每个订阅者是一个回调，emit 时把事件对象传给所有订阅者。
 * 用 Map 存储（key 递增）保证按订阅顺序执行。
 *
 * 事件 shape：{ scope, action, payload }
 *   scope   'users' | 'aiPersons' | 'worlds' | 'tagGroups' | 'tags'
 *           | 'locations' | 'snapshots' | 'profile' | 'sdk'
 *   action  'create' | 'update' | 'remove' | 'setActive' | 'import' | ...
 *   payload 任意（CRUD 里调用方填）
 */

export function createEventBus() {
    const subscribers = new Map();
    let nextId = 1;

    return {
        on(callback) {
            if (typeof callback !== 'function') return () => {};
            const id = nextId++;
            subscribers.set(id, callback);
            return () => subscribers.delete(id);
        },
        emit(event) {
            subscribers.forEach(cb => {
                try {
                    cb(event);
                } catch (err) {
                    console.warn('[settings-sdk] subscriber error', err);
                }
            });
        },
        clear() {
            subscribers.clear();
        },
        size() {
            return subscribers.size;
        },
    };
}