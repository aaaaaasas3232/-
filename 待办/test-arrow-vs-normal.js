// 模拟 framework 调你的方法时的样子
const framework = {
    app: { state: { answers: {} } }
};

function callFromFramework(method, ...args) {
    // 这是 framework 真实调用的方式：method(payload) —— 没指定 this
    return method(...args);
}

// ============ 写法 1：function 关键字（你问的）============
function setAnswer_v1(field, value) {
    if (!this?.app?.state) return '❌ 写法 1: this 是 ' + JSON.stringify(this);
    this.app.state.answers[field] = value;
    return '✅ 写法 1: 写入成功';
}

// ============ 写法 2：方法简写（项目里实际就是这个）============
const obj_v2 = {
    setAnswer_v2(field, value) {
        if (!this?.app?.state) return '❌ 写法 2: this 是 ' + JSON.stringify(this);
        this.app.state.answers[field] = value;
        return '✅ 写法 2: 写入成功';
    }
};

// ============ 写法 3：箭头函数（你说的 const setAnswer => ()）============
const setAnswer_v3 = (field, value) => {
    if (!this?.app?.state) return '❌ 写法 3: this 是 ' + JSON.stringify(this);
    this.app.state.answers[field] = value;
    return '✅ 写法 3: 写入成功';
};

// ============ 写法 4：箭头函数，对象 methods 里 ============
const obj_v4 = {
    setAnswer_v4: (field, value) => {
        if (!this?.app?.state) return '❌ 写法 4: this 是 ' + JSON.stringify(this);
        this.app.state.answers[field] = value;
        return '✅ 写法 4: 写入成功';
    }
};

// ============ 调用 ============
console.log('===== 写法 1: function setAnswer() =====');
try { console.log(callFromFramework(setAnswer_v1, 'name', '小听')); }
catch (e) { console.log('💥', e.message); }

console.log('\n===== 写法 2: methods 里写 setAnswer() { }（项目真实写法）=====');
try { console.log(callFromFramework(obj_v2.setAnswer_v2, 'name', '小听')); }
catch (e) { console.log('💥', e.message); }

console.log('\n===== 写法 3: const setAnswer = (field, value) => { } =====');
try { console.log(callFromFramework(setAnswer_v3, 'name', '小听')); }
catch (e) { console.log('💥', e.message); }

console.log('\n===== 写法 4: methods 里 setAnswer: (field, value) => { } =====');
try { console.log(callFromFramework(obj_v4.setAnswer_v4, 'name', '小听')); }
catch (e) { console.log('💥', e.message); }