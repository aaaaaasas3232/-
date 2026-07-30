# normalizeTextList：把输入统一变成干净数组

## 这次我真正理解到的核心

这个函数的目标不是“原样返回输入”，而是：

**不管传进来的是什么，都尽量整理成一个干净的数组。**

比如：

- 如果本来就是数组，就过滤一下里面的空内容
- 如果本来是单个值，就把它包成数组
- 如果本来是空值，就直接给空数组

所以它本质上是在做两件事：

- **数组化**：统一返回数组
- **清洗**：把没意义的空内容去掉

---

## 原代码

```js
const normalizeTextList = value =>
    Array.isArray(value) ? value.filter(Boolean) : value == null || value === '' ? [] : [value];
```

---

## 先拆成更容易读的样子

```js
const normalizeTextList = value =>
  Array.isArray(value)
    ? value.filter(Boolean)
    : (value == null || value === '' ? [] : [value]);
```

其实是两层判断：

### 第一层

```js
Array.isArray(value) ? value.filter(Boolean) : ...
```

意思是：

- 如果 `value` 是数组，就执行 `value.filter(Boolean)`
- 如果 `value` 不是数组，就继续走后面的判断

`Array.isArray(value)` 的作用就是：

**判断 `value` 是不是数组。**

---

### 第二层

```js
value == null || value === '' ? [] : [value]
```

意思是：

- 如果 `value` 是空值，就返回 `[]`
- 如果 `value` 不是空值，就返回 `[value]`

这里的空值包括：

- `null`
- `undefined`
- `''`

---

## `filter(Boolean)` 到底是什么意思

这里的 `Boolean` 不是单纯写个“布尔”在那，而是 **JavaScript 内置函数**。

它可以把任意值转成 `true` 或 `false`。

例如：

```js
Boolean('hello')    // true
Boolean('')         // false
Boolean(null)       // false
Boolean(undefined)  // false
Boolean(0)          // false
```

---

### 那 `filter(Boolean)` 是什么意思？

数组的 `filter()` 需要一个“判断函数”。

它会对数组每一项执行一次判断：

- 返回 `true` → 保留这一项
- 返回 `false` → 删掉这一项

所以：

```js
['a', '', null, 'b'].filter(Boolean)
```

其实相当于：

```js
['a', '', null, 'b'].filter(item => Boolean(item))
```

也就是：

- `Boolean('a')` → `true` → 保留
- `Boolean('')` → `false` → 去掉
- `Boolean(null)` → `false` → 去掉
- `Boolean('b')` → `true` → 保留

最后得到：

```js
['a', 'b']
```

所以可以记成一句话：

**`filter(Boolean)` = 把数组里“假值”过滤掉。**

这里的“假值”常见有：

- `''`
- `null`
- `undefined`
- `0`
- `false`
- `NaN`

---

## 为什么空值返回 `[]`

因为这个函数想统一输出“列表”。

如果输入是：

```js
null
''
undefined
```

这些都表示“没有有效内容”。

如果返回成：

```js
[null]
['']
[undefined]
```

虽然形式上也是数组，但里面装的是没意义的内容，后续处理会比较麻烦。

所以更合理的是直接返回：

```js
[]
```

意思就是：

**没有内容，但格式仍然统一成数组。**

---

## 为什么非空值返回 `[value]`

比如输入：

```js
'苹果'
```

它不是数组，但函数希望结果统一是数组。

所以就把它包起来：

```js
['苹果']
```

这一步可以理解成：

**把单个值提升成列表。**

这样后面代码就不用每次都重新判断：

- 这个东西是不是数组？
- 是不是单个字符串？
- 是不是空值？

因为函数已经帮我们统一好了。

---

## `value == null` 为什么这样写

这里：

```js
value == null
```

不是随便写的，而是 JS 里一个常见简写。

它等价于：

```js
value === null || value === undefined
```

也就是说：

```js
value == null
```

专门用来同时判断：

- `null`
- `undefined`

但不会把 `''`、`0`、`false` 也算进去。

所以这里写成：

```js
value == null || value === ''
```

意思就是：

**`null`、`undefined`、空字符串，都算没有有效文本内容。**

---

## 这整个函数的人话翻译

```js
const normalizeTextList = value =>
  Array.isArray(value)
    ? value.filter(Boolean)
    : (value == null || value === '' ? [] : [value]);
```

翻译成人话就是：

1. 如果传进来的本来就是数组，就把空项清掉
2. 如果不是数组，就看看它是不是空值
3. 如果是空值，就返回空数组
4. 如果不是空值，就把它包成数组返回

---

## 例子

```js
normalizeTextList(['a', '', null, 'b'])
// ['a', 'b']
```

```js
normalizeTextList('a')
// ['a']
```

```js
normalizeTextList('')
// []
```

```js
normalizeTextList(null)
// []
```

---

## 我这次顺便学到的点

### 1. 函数也可以直接当参数传进去

比如：

```js
value.filter(Boolean)
```

这里不是先执行 `Boolean()`，而是把 `Boolean` 这个函数本身传给 `filter`。

也就是说：

- 函数可以像变量一样被传来传去
- `filter` 会自己在内部拿每一项去调用这个函数

所以它等价于：

```js
value.filter(item => Boolean(item))
```

---

### 2. 三元表达式可以嵌套

像这样：

```js
条件1 ? 结果1 : 条件2 ? 结果2 : 结果3
```

实际意思是：

```js
条件1 ? 结果1 : (条件2 ? 结果2 : 结果3)
```

也就是：

- 先判断条件1
- 如果不成立，再去判断条件2

所以它本质上就是 `if / else if / else` 的缩写版。

---

## 一句总结

**`normalizeTextList` 的本质，就是把“可能是数组、可能是单值、可能是空值”的输入，统一整理成一个干净数组。**
