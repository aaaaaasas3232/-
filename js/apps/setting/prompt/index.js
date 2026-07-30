/**
 * 设置 App · Prompt 工程模块
 */

import { renderPromptSection } from './section.js';
import { loadPromptCache, buildPromptMethods } from './prompt-methods.js';

export const bootstrapPrompt = () => loadPromptCache();

export {
    renderPromptSection,
    buildPromptMethods,
};
