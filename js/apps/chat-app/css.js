/**
 * 副作用入口:把 chat.css 拉进构建图。
 *
 * 注:本项目约定 chat-app 的样式通过 index.html 用 `<link>` 静态引入
 * (参见 /css/apps/chat/index.css 的 link 行),与 weather-app / appstore /
 * survey 同风格。本文件**暂时未被任何 module import**,保留作为备用入口
 * —— 后续如需切换为 ESM 注入方式,只需在 index.js 顶部加 `import './css.js'` 即可。
 */
import '../../../css/apps/chat/index.css';
