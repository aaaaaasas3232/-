/**
 * relax-app / 解压主体清单
 *
 * ============================================================
 * ★ 加新主体只需要动这个文件的一行 ★
 * ============================================================
 * 1) 在本目录建 `bubble-wrap.js`,里面调一次 `registerRelaxToy({...})`
 *    (契约见 `../registry.js` 顶部的长注释,示例见 `demo-jelly.js`)
 * 2) 在下面加一行 `import './bubble-wrap.js';`
 * 3) 样式写到 `css/apps/relax/_toys.css`
 *
 * 这些 import 是**纯副作用**的 —— 模块被执行时自己去 registry 报到,
 * 所以不需要 export 任何东西,也不需要在别处引用。
 *
 * 想做懒加载(主体多了以后按需 import)也可以:registry 有
 * `onRelaxToysChanged`,主体面板订阅了它,异步登记进来的主体会自动出现在列表里。
 */

import './demo-jelly.js';
import './bubble-board.js';
import './choco-board.js';
import './custom-html-board.js';
