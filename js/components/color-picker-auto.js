/**
 * ColorPicker 全局自动 mount 入口
 *
 * 单独存在的意义：让 src/index.js 在不动业务代码的情况下，
 * 只 import 一个文件就把 ColorPicker 的全局事件委托接好。
 *
 * 实现：在 color-picker.js 里已经做了 installColorPickerAutoMount，
 * 这里 re-export 一下，命名保持向后兼容。
 */

export { installColorPickerAutoMount } from './color-picker.js';