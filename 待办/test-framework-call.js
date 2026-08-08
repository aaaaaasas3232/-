// 模拟 framework 注册 methods 时包的那一层
// 真实代码 src/core/app-registry.js:73
// normalizedMethods[methodName] = (...args) => method.apply(methodContext, args);

function registerApp(appConfig, methodContext) {
    const normalized = {};
    for (const [name, method] of Object.entries(appConfig.methods)) {
        normalized[name] = (...args) => method.apply(methodContext, args);
    }
    return normalized;
}

// framework 调用 method 时其实就是 framework 调 normalized[name]()
const methodContext = {
    app: { state: { answers: {} } },
    toolkit: { db: { name: 'fakeDb' } }
};

// ===== A: 你写的普通方法（项目实际写法）=====
const appA = {
    methods: {
        setAnswer(field, value) {
            console.log('  [A 方法] this.app 是?', this.app ? '✅ 存在' : '❌ 不存在');
            this.app.state.answers[field] = value;
            return '✅ A 写入成功';
        }
    }
};
const normA = registerApp(appA, methodContext);

// ===== B: 你写的箭头函数 =====
const appB = {
    methods: {
        setAnswer: (field, value) => {
            console.log('  [B 箭头] this.app 是?', this.app ? '✅ 存在' : '❌ 不存在');
            this.app.state.answers[field] = value;
            return '✅ B 写入成功';
        }
    }
};
const normB = registerApp(appB, methodContext);

console.log('===== 写法 A：methods: { setAnswer() {...} }（项目实际写法）=====');
console.log('  框架调用结果:', normA.setAnswer('name', '小听'));
console.log('  答案:', JSON.stringify(methodContext.app.state.answers));

console.log('\n===== 写法 B：methods: { setAnswer: (a,b) => {...} }（箭头函数）=====');
console.log('  框架调用结果:', normB.setAnswer('name', '小听'));
console.log('  答案:', JSON.stringify(methodContext.app.state.answers));