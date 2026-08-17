/**
 * chat-app / ac-modal —— re-export shim
 *
 * ★ AcModal 已提升到框架层 `src/core/components/ac-modal.js`(它本来就没有
 *   任何 chat 业务耦合)。本文件保留只为兼容 chat 内部 20+ 处老 import 路径,
 *   不要在这里加逻辑 —— 改组件请改框架层那份。
 *
 * chat 的皮肤仍然在 `css/apps/chat/_chat-ac-modal.css`
 * (`.app-shell[data-app-id="chat"] .ac-*`,优先级高于 `css/core/ac-modal.css` 基线)。
 */

export { AcModal, default } from '@/src/core/components/ac-modal.js';
