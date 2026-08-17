/**
 * cover-designer 工具栏面板模块化注册表
 * — 每个模块 = toolbar 1 个按钮 + 下方 panel 区域渲染该模块的全部工具
 * — 点 toolbar 切换 = 整个 panel 区域内容替换(不再 11 个 group 全部渲染在 DOM 里)
 * — 默认 panel 区域完全空白,点哪个按钮才渲染哪个模块
 *
 * icon 字段同时驱动顶部快捷工具栏(legacy-html.js 直接读这里,不再各写一套)。
 * 图标统一规格:24×24 viewBox / 只描边不填充 / stroke-width 1.6 / round 端点。
 */

const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

export const TOOLBAR_MODULES = [
    {
        id: 'text-type',
        label: '文字类型',
        icon: `<svg ${ICON_ATTRS}><rect x="3" y="3.2" width="18" height="17.6" rx="5"/><path d="M8.4 8.6h7.2"/><path d="M12 8.6v7"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="text-type">
                <div class="cd-control-label">文字类型</div>
                <div class="cd-btn-grid">
                    <button class="cd-btn" data-cd-action="add-text-type" data-type="diary">日记体</button>
                    <button class="cd-btn" data-cd-action="add-text-type" data-type="blog">博客体</button>
                    <button class="cd-btn" data-cd-action="add-text-type" data-type="chat-left">对话-左</button>
                    <button class="cd-btn" data-cd-action="add-text-type" data-type="chat-right">对话-右</button>
                    <button class="cd-btn" data-cd-action="add-text-type" data-type="image">图片卡片</button>
                </div>
            </div>`,
    },
    {
        id: 'bg',
        label: '背景',
        icon: `<svg ${ICON_ATTRS}><path d="M12 3.2 3.5 7.5 12 11.8l8.5-4.3z"/><path d="M3.5 12.2 12 16.5l8.5-4.3"/><path d="M3.5 16.6 12 20.9l8.5-4.3"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="bg">
                <!-- 封面背景图 -->
                <div class="cd-control-label">封面背景图</div>
                <div class="cd-bg-options" id="cdBgOptions">
                    <div class="cd-bg-option" data-bg="https://s1.imagehub.cc/images/2025/05/31/97811b2386f57f4b3dd84d7c16fe67de.jpeg">
                        <img src="https://s1.imagehub.cc/images/2025/05/31/97811b2386f57f4b3dd84d7c16fe67de.jpeg" alt="背景1">
                    </div>
                    <div class="cd-bg-option" data-bg="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=500&auto=format">
                        <img src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=500&auto=format" alt="背景2">
                    </div>
                    <div class="cd-bg-option" data-bg="https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?q=80&w=500&auto=format">
                        <img src="https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?q=80&w=500&auto=format" alt="背景3">
                    </div>
                    <div class="cd-bg-option" data-bg="https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=500&auto=format">
                        <img src="https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=500&auto=format" alt="背景4">
                    </div>
                    <div class="cd-bg-option" data-bg="https://images.unsplash.com/photo-1477554193778-9562c28588c0?q=80&w=500&auto=format">
                        <img src="https://images.unsplash.com/photo-1477554193778-9562c28588c0?q=80&w=500&auto=format" alt="背景5">
                    </div>
                </div>
                <button class="cd-btn cd-block-btn cd-change-bg-btn" data-cd-action="upload-bg" style="margin-top: 12px; width: 100%;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8l-5-5-5 5"></path><path d="M12 3v12"></path>
                    </svg>
                    上传自定义背景
                </button>

                <!-- 封面底色(背景图之下的打底色) -->
                <div class="cd-control-label" style="margin-top: 20px;">封面底色</div>
                <div class="cd-color-picker">
                    <div class="cd-color-dot" data-cd-card-color="#f4f1ec" style="background: #f4f1ec;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#ede7df" style="background: #ede7df;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#dfe6e9" style="background: #dfe6e9;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#d8d3cb" style="background: #d8d3cb;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#c9bab2" style="background: #c9bab2;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#c9b0b3" style="background: #c9b0b3;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#a58f90" style="background: #a58f90;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#6d6b68" style="background: #6d6b68;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#454545" style="background: #454545;"></div>
                    <div class="cd-color-dot" data-cd-card-color="#ffffff" style="background: #ffffff;"></div>
                </div>
                <div class="cd-color-input-group" style="margin-top: 12px;">
                    <input type="text" id="cdCustomCardColorInput" class="cd-color-input" placeholder="#RRGGBB 或 rgba()" style="flex: 1;">
                    <div class="cd-color-preview" id="cdCustomCardColorPreview"></div>
                    <button class="cd-btn" data-cd-action="apply-custom-card-color" style="min-width: 80px;">应用</button>
                </div>

                <!-- 背景蒙版:压暗背景图,让文字更清晰 -->
                <div class="cd-control-label" style="margin-top: 15px;">背景蒙版</div>
                <div class="cd-slider-container">
                    <input type="range" id="cdBgMask" min="0" max="0.7" value="0" step="0.05">
                    <span class="cd-value-display" id="cdBgMaskValue">0</span>
                </div>

                <div class="cd-panel-hint">元素自身的底色请到「文字底色」面板设置</div>
            </div>`,
    },
    {
        id: 'text-style',
        label: '文字样式',
        icon: `<svg ${ICON_ATTRS}><path d="M7.6 4.4v15.2"/><path d="M7.6 4.4h5a3.7 3.7 0 0 1 0 7.4h-5"/><path d="M7.6 11.8h5.8a3.9 3.9 0 0 1 0 7.8H7.6"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="text-style">
                <div class="cd-control-label">文字样式</div>
                <div class="cd-text-styles">
                    <div class="cd-style-btn" data-cd-style="bold">加粗</div>
                    <div class="cd-style-btn" data-cd-style="italic">斜体</div>
                    <div class="cd-style-btn" data-cd-style="underline">下划线</div>
                </div>
                <div class="cd-text-effects">
                    <div class="cd-effect-btn" data-cd-effect="blur">模糊</div>
                    <div class="cd-effect-btn" data-cd-effect="shadow">阴影</div>
                    <div class="cd-effect-btn" data-cd-effect="glow">发光</div>
                </div>
                <div class="cd-paragraph-spacing-control">
                    <span class="cd-control-label cd-sub-label">字号</span>
                    <div class="cd-slider-container">
                        <input type="range" id="cdFontSize" min="12" max="28" value="16">
                        <span class="cd-value-display" id="cdFontSizeValue">16px</span>
                    </div>
                    <span class="cd-control-label cd-sub-label-top">字间距</span>
                    <div class="cd-slider-container">
                        <input type="range" id="cdLetterSpacing" min="0" max="5" step="0.1" value="0.5">
                        <span class="cd-value-display" id="cdSpacingValue">0.5px</span>
                    </div>
                    <span class="cd-control-label cd-sub-label-top">行高</span>
                    <div class="cd-slider-container">
                        <input type="range" id="cdLineHeight" min="1" max="3" step="0.1" value="1.8">
                        <span class="cd-value-display" id="cdLineHeightValue">1.8</span>
                    </div>
                    <span class="cd-control-label cd-sub-label-top">段距</span>
                    <div class="cd-slider-container">
                        <input type="range" id="cdParagraphSpacing" min="0" max="30" step="1" value="12">
                        <span class="cd-value-display" id="cdParagraphSpacingValue">12px</span>
                    </div>
                </div>
                <div class="cd-text-align-controls">
                    <div class="cd-text-align-btn" data-cd-align="left">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" x2="14" y1="6" y2="6"/><line x1="4" x2="18" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                    </div>
                    <div class="cd-text-align-btn" data-cd-align="center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="16" y1="6" y2="6"/><line x1="6" x2="18" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                    </div>
                    <div class="cd-text-align-btn" data-cd-align="right">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" x2="20" y1="6" y2="6"/><line x1="6" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                    </div>
                </div>
                <button class="cd-btn cd-block-btn" data-cd-action="apply-all-text-style">应用到所有文字</button>
            </div>`,
    },
    {
        id: 'font',
        label: '字体',
        icon: `<svg ${ICON_ATTRS}><path d="M2.8 17.6 6.9 7.2a.9.9 0 0 1 1.7 0l4.1 10.4"/><path d="M4.5 14h6.6"/><circle cx="18" cy="14.6" r="3.1"/><path d="M21.1 11.2v6.4"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="font">
                <!-- 字体选择器 -->
                <div class="cd-control-label">字体选择</div>
                <div class="cd-font-selector">
                    <div class="cd-font-option cd-selected" data-cd-font="Huiwen-mincho">
                        <div class="cd-font-preview" style="font-family: 'Huiwen-mincho', serif;">生活的美好在于细节的温柔</div>
                        <div class="cd-font-name">Huiwen-mincho (默认)</div>
                    </div>
                    <div class="cd-font-option" data-cd-font="serif">
                        <div class="cd-font-preview" style="font-family: serif;">生活的美好在于细节的温柔</div>
                        <div class="cd-font-name">衬线字体 (Serif)</div>
                    </div>
                    <div class="cd-font-option" data-cd-font="sans-serif">
                        <div class="cd-font-preview" style="font-family: sans-serif;">生活的美好在于细节的温柔</div>
                        <div class="cd-font-name">无衬线字体 (Sans-serif)</div>
                    </div>
                    <div class="cd-font-option" data-cd-font="monospace">
                        <div class="cd-font-preview" style="font-family: monospace;">生活的美好在于细节的温柔</div>
                        <div class="cd-font-name">等宽字体 (Monospace)</div>
                    </div>
                </div>
                
                <!-- 自定义字体 -->
                <div class="cd-control-label" style="margin-top: 15px;">自定义字体</div>
                <input type="text" class="cd-custom-font-input" id="cdCustomFontInput" placeholder="输入@import url()或字体名称">
                
                <div class="cd-control-label" style="margin-top: 10px;">示例：</div>
                <div class="cd-font-example-code">
                    @import url("https://fontsapi.zeoseven.com/65/main/result.css");<br><br>
                    body {<br>
                    &nbsp;&nbsp;font-family: "BoutiqueBitmap9x9 1.5 R";<br>
                    &nbsp;&nbsp;font-weight: normal;<br>
                    }
                </div>
                
                <!-- 字体大小控制 -->
                <div class="cd-control-label" style="margin-top: 15px;">字体大小</div>
                <div class="cd-slider-container">
                    <input type="range" id="cdFontSizeSlider" min="12" max="28" value="16" step="1">
                    <span class="cd-value-display" id="cdFontSizeDisplay">16px</span>
                </div>
                
                <button class="cd-apply-all-btn" data-cd-action="apply-all-font">应用到所有元素</button>
            </div>`,
    },
    {
        id: 'text-color',
        label: '文字颜色',
        icon: `<svg ${ICON_ATTRS}><path d="M4.4 14.6 8.9 4.8a1 1 0 0 1 1.8 0l4.5 9.8"/><path d="M6.3 10.8h6.9"/><rect x="3.4" y="17.6" width="17.2" height="3.2" rx="1.6" fill="currentColor" stroke="none"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="text-color">
                <!-- 颜色选择器 -->
                <div class="cd-control-label">文字颜色</div>
                <div class="cd-color-picker">
                    <div class="cd-color-dot" data-cd-color="#454545" style="background: #454545;"></div>
                    <div class="cd-color-dot" data-cd-color="#6d6b68" style="background: #6d6b68;"></div>
                    <div class="cd-color-dot" data-cd-color="#9b958b" style="background: #9b958b;"></div>
                    <div class="cd-color-dot" data-cd-color="#b5aea5" style="background: #b5aea5;"></div>
                    <div class="cd-color-dot" data-cd-color="#d8d3cb" style="background: #d8d3cb;"></div>
                    <div class="cd-color-dot" data-cd-color="#b4a79f" style="background: #b4a79f;"></div>
                    <div class="cd-color-dot" data-cd-color="#c9bab2" style="background: #c9bab2;"></div>
                    <div class="cd-color-dot" data-cd-color="#d6c8be" style="background: #d6c8be;"></div>
                    <div class="cd-color-dot" data-cd-color="#a58f90" style="background: #a58f90;"></div>
                    <div class="cd-color-dot" data-cd-color="#c9b0b3" style="background: #c9b0b3;"></div>
                </div>
                
                <!-- 自定义颜色输入 -->
                <div class="cd-color-input-group" style="margin-top: 12px;">
                    <input type="text" id="cdCustomTextColorInput" class="cd-color-input" placeholder="#RRGGBB 或 rgba()" style="flex: 1;">
                    <div class="cd-color-preview" id="cdCustomTextColorPreview"></div>
                    <button class="cd-btn" data-cd-action="apply-custom-text-color" style="min-width: 80px;">应用</button>
                </div>
                
                <button class="cd-apply-all-btn" data-cd-action="apply-all-text-color">应用到所有相同类型元素</button>
            </div>`,
    },
    {
        id: 'text-bg',
        label: '文字底色',
        icon: `<svg ${ICON_ATTRS}><path d="M9.4 3.4 4.5 8.3a1.9 1.9 0 0 0 0 2.7l5.2 5.2a1.9 1.9 0 0 0 2.7 0l4.9-4.9z"/><path d="M7.6 6.5 12.7 11.6"/><path d="M19.4 14.6s1.9 2.3 1.9 3.6a1.9 1.9 0 1 1-3.8 0c0-1.3 1.9-3.6 1.9-3.6z"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="text-bg">
                <!-- 背景颜色选择器 -->
                <div class="cd-control-label">组件背景色</div>
                <div class="cd-color-picker">
                    <div class="cd-color-dot cd-transparent-bg" data-cd-color="transparent"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(255,255,255,0.2)" style="background-color: rgba(255,255,255,0.2);"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(237,234,229,0.3)" style="background-color: rgba(237,234,229,0.3);"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(223,230,233,0.25)" style="background-color: rgba(223,230,233,0.25);"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(216,211,203,0.25)" style="background-color: rgba(216,211,203,0.25);"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(201,186,178,0.25)" style="background-color: rgba(201,186,178,0.25);"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(201,176,179,0.2)" style="background-color: rgba(201,176,179,0.2);"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(165,143,144,0.2)" style="background-color: rgba(165,143,144,0.2);"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(214,200,190,0.25)" style="background-color: rgba(214,200,190,0.25);"></div>
                    <div class="cd-color-dot" data-cd-color="rgba(180,167,159,0.2)" style="background-color: rgba(180,167,159,0.2);"></div>
                </div>
                
                <!-- 自定义背景颜色输入 -->
                <div class="cd-color-input-group" style="margin-top: 12px;">
                    <input type="text" id="cdCustomBgColorInput" class="cd-color-input" placeholder="#RRGGBB 或 rgba()" style="flex: 1;">
                    <div class="cd-color-preview" id="cdCustomBgColorPreview"></div>
                    <button class="cd-btn" data-cd-action="apply-custom-bg" style="min-width: 80px;">应用</button>
                </div>
                
                <!-- 透明度控制 -->
                <div class="cd-control-label" style="margin-top: 15px;">透明度</div>
                <div class="cd-slider-container">
                    <input type="range" id="cdBgOpacity" min="0" max="1" value="0.2" step="0.05">
                    <span class="cd-value-display" id="cdBgOpacityValue">0.2</span>
                </div>
                
                <button class="cd-apply-all-btn" data-cd-action="apply-all-text-bg">应用到所有相同类型元素</button>
            </div>`,
    },
    {
        id: 'bubble',
        label: '气泡样式',
        icon: `<svg ${ICON_ATTRS}><path d="M20.6 11.8a7.6 7.6 0 0 1-8.2 7.6 8.7 8.7 0 0 1-2.5-.4l-5.5 1.6 1.6-4.7a7.4 7.4 0 0 1-1.2-4.1 7.6 7.6 0 0 1 7.9-7.6 7.6 7.6 0 0 1 7.9 7.6z"/><path d="M9.2 11.7h5.6"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="bubble">
                <!-- 气泡预览 -->
                <div class="cd-bubble-preview" id="cdBubblePreview">气泡预览</div>
                
                <!-- 气泡模糊度 -->
                <div class="cd-control-label" style="margin-top: 12px;">模糊度</div>
                <div class="cd-slider-container">
                    <input type="range" id="cdBubbleBlur" min="0" max="15" value="8">
                    <span class="cd-value-display" id="cdBubbleBlurValue">8px</span>
                </div>
                
                <!-- 气泡透明度 -->
                <div class="cd-control-label" style="margin-top: 12px;">透明度</div>
                <div class="cd-slider-container">
                    <input type="range" id="cdBubbleOpacity" min="0" max="1" value="0.3" step="0.05">
                    <span class="cd-value-display" id="cdBubbleOpacityValue">0.3</span>
                </div>
                
                <!-- 气泡圆角 -->
                <div class="cd-control-label" style="margin-top: 12px;">四角圆角</div>
                <div class="cd-toggle-switch">
                    <span class="cd-toggle-label">统一圆角</span>
                    <label class="cd-switch">
                        <input type="checkbox" id="cdUniformRadiusToggle" checked>
                        <span class="cd-slider"></span>
                    </label>
                </div>

                <div id="cdUniformRadiusControls">
                    <div class="cd-slider-container">
                        <input type="range" id="cdBubbleRadius" min="0" max="25" value="18">
                        <span class="cd-value-display" id="cdBubbleRadiusValue">18px</span>
                    </div>
                </div>

                <div id="cdCustomRadiusControls" class="cd-panel-hidden" style="margin-top: 10px;">
                    <div class="cd-control-label">左上角</div>
                    <div class="cd-slider-container">
                        <input type="range" id="cdTopLeftRadius" min="0" max="25" value="18">
                        <span class="cd-value-display" id="cdTopLeftRadiusValue">18px</span>
                    </div>
                    
                    <div class="cd-control-label">右上角</div>
                    <div class="cd-slider-container">
                        <input type="range" id="cdTopRightRadius" min="0" max="25" value="18">
                        <span class="cd-value-display" id="cdTopRightRadiusValue">18px</span>
                    </div>
                    
                    <div class="cd-control-label">左下角</div>
                    <div class="cd-slider-container">
                        <input type="range" id="cdBottomLeftRadius" min="0" max="25" value="6">
                        <span class="cd-value-display" id="cdBottomLeftRadiusValue">6px</span>
                    </div>
                    
                    <div class="cd-control-label">右下角</div>
                    <div class="cd-slider-container">
                        <input type="range" id="cdBottomRightRadius" min="0" max="25" value="18">
                        <span class="cd-value-display" id="cdBottomRightRadiusValue">18px</span>
                    </div>
                </div>
                
                <!-- 边框 -->
                <div class="cd-toggle-switch" style="margin-top: 15px;">
                    <span class="cd-toggle-label">边框</span>
                    <label class="cd-switch">
                        <input type="checkbox" id="cdBorderToggle">
                        <span class="cd-slider"></span>
                    </label>
                </div>
                
                <div id="cdBorderControls" class="cd-panel-hidden" style="margin-top: 10px;">
                    <!-- 边框宽度 -->
                    <div class="cd-slider-container">
                        <input type="range" id="cdBorderWidth" min="1" max="5" value="1">
                        <span class="cd-value-display" id="cdBorderWidthValue">1px</span>
                    </div>
                    
                    <!-- 边框颜色 -->
                    <div class="cd-control-label">边框颜色</div>
                    <div class="cd-color-picker">
                        <div class="cd-color-dot" data-cd-border-color="#454545" style="background-color: #454545;"></div>
                        <div class="cd-color-dot" data-cd-border-color="#9b958b" style="background-color: #9b958b;"></div>
                        <div class="cd-color-dot" data-cd-border-color="#b5aea5" style="background-color: #b5aea5;"></div>
                        <div class="cd-color-dot" data-cd-border-color="#d8d3cb" style="background-color: #d8d3cb;"></div>
                        <div class="cd-color-dot" data-cd-border-color="#c9bab2" style="background-color: #c9bab2;"></div>
                    </div>
                    
                    <!-- 自定义边框颜色 -->
                    <div class="cd-color-input-group">
                        <input type="text" id="cdCustomBorderColorInput" class="cd-color-input" placeholder="#RRGGBB 或 rgba()">
                        <div class="cd-color-preview" id="cdCustomBorderColorPreview"></div>
                        <button class="cd-btn" data-cd-action="apply-custom-border-color" style="min-width: 80px;">应用</button>
                    </div>
                </div>
                
                <!-- 阴影 -->
                <div class="cd-toggle-switch" style="margin-top: 15px;">
                    <span class="cd-toggle-label">阴影</span>
                    <label class="cd-switch">
                        <input type="checkbox" id="cdShadowToggle">
                        <span class="cd-slider"></span>
                    </label>
                </div>
                
                <div id="cdShadowControls" class="cd-panel-hidden" style="margin-top: 10px;">
                    <!-- 阴影强度 -->
                    <div class="cd-slider-container">
                        <input type="range" id="cdShadowIntensity" min="1" max="20" value="8">
                        <span class="cd-value-display" id="cdShadowIntensityValue">8px</span>
                    </div>
                    
                    <!-- 阴影颜色 -->
                    <div class="cd-control-label">阴影颜色</div>
                    <div class="cd-color-picker">
                        <div class="cd-color-dot" data-cd-shadow-color="rgba(0,0,0,0.1)" style="background-color: rgba(0,0,0,0.1);"></div>
                        <div class="cd-color-dot" data-cd-shadow-color="rgba(0,0,0,0.2)" style="background-color: rgba(0,0,0,0.2);"></div>
                        <div class="cd-color-dot" data-cd-shadow-color="rgba(155,149,139,0.2)" style="background-color: rgba(155,149,139,0.2);"></div>
                        <div class="cd-color-dot" data-cd-shadow-color="rgba(165,143,144,0.15)" style="background-color: rgba(165,143,144,0.15);"></div>
                    </div>
                    
                    <!-- 自定义阴影颜色 -->
                    <div class="cd-color-input-group">
                        <input type="text" id="cdCustomShadowColorInput" class="cd-color-input" placeholder="#RRGGBB 或 rgba()">
                        <div class="cd-color-preview" id="cdCustomShadowColorPreview"></div>
                        <button class="cd-btn" data-cd-action="apply-custom-shadow-color" style="min-width: 80px;">应用</button>
                    </div>
                </div>
                
                <!-- 应用按钮 -->
                <button class="cd-btn cd-block-btn" data-cd-action="apply-current-bubble" style="width: 100%; margin-top: 15px;">应用到选中气泡</button>
                <button class="cd-apply-all-btn" data-cd-action="apply-all-bubble">应用到所有气泡</button>
            </div>`,
    },
    {
        id: 'blog-setting',
        label: '博客设置',
        icon: `<svg ${ICON_ATTRS}><rect x="2.8" y="4.4" width="18.4" height="15.2" rx="4"/><circle cx="8.2" cy="10.2" r="2.1"/><path d="M4.9 16.4a3.7 3.7 0 0 1 6.6 0"/><path d="M14.6 9.4h4"/><path d="M14.6 13.2h4"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="blog-setting">
                <!-- 显示/隐藏开关 -->
                <div class="cd-toggle-switch">
                    <span class="cd-toggle-label">显示图片</span>
                    <label class="cd-switch">
                        <input type="checkbox" id="cdBlogImageToggle" checked>
                        <span class="cd-slider"></span>
                    </label>
                </div>
                <div class="cd-toggle-switch">
                    <span class="cd-toggle-label">显示头像</span>
                    <label class="cd-switch">
                        <input type="checkbox" id="cdBlogAvatarToggle" checked>
                        <span class="cd-slider"></span>
                    </label>
                </div>
                <div class="cd-toggle-switch">
                    <span class="cd-toggle-label">显示位置</span>
                    <label class="cd-switch">
                        <input type="checkbox" id="cdBlogLocationToggle" checked>
                        <span class="cd-slider"></span>
                    </label>
                </div>
                
                <!-- 输入字段 -->
                <div class="cd-control-label" style="margin-top: 15px;">博客ID</div>
                <input type="text" id="cdBlogIdInput" class="cd-input" placeholder="输入博客ID" style="width: 100%; text-align: left;">
                
                <div class="cd-control-label" style="margin-top: 12px;">位置</div>
                <input type="text" id="cdBlogLocationInput" class="cd-input" placeholder="输入位置信息" style="width: 100%; text-align: left;">
                
                <div class="cd-control-label" style="margin-top: 12px;">作者名称</div>
                <input type="text" id="cdBlogAuthorInput" class="cd-input" placeholder="输入作者名" style="width: 100%; text-align: left;">
                
                <!-- 头像设置 -->
                <div class="cd-control-label" style="margin-top: 15px;">头像设置</div>
                <div class="cd-avatar-options">
                    <div class="cd-avatar-option">
                        <label class="cd-avatar-option-label">
                            <input type="radio" name="cdAvatarType" value="letter" checked> 纯色字母
                        </label>
                        <div class="cd-avatar-preview" id="cdAvatarLetterPreview">H</div>
                    </div>
                    <div class="cd-avatar-option">
                        <label class="cd-avatar-option-label">
                            <input type="radio" name="cdAvatarType" value="image"> 上传图片
                        </label>
                        <div class="cd-avatar-preview" id="cdAvatarImagePreview">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <path d="M21 15l-5-5L5 21"></path>
                            </svg>
                        </div>
                    </div>
                </div>
                
                <!-- 头像字母设置 -->
                <div id="cdAvatarLetterControls">
                    <div class="cd-control-label" style="margin-top: 12px;">头像字母</div>
                    <input type="text" id="cdAvatarLetterInput" class="cd-input" placeholder="单个字母" maxlength="1" style="width: 100%; text-align: left;">
                    
                    <div class="cd-control-label" style="margin-top: 10px;">头像背景色</div>
                    <div class="cd-avatar-color-grid">
                        <div class="cd-avatar-color cd-avatar-swatch-cream" data-color="#cbc5bb" style="background: #cbc5bb;"></div>
                        <div class="cd-avatar-color" data-color="#b5aea5" style="background: #b5aea5;"></div>
                        <div class="cd-avatar-color" data-color="#a58f90" style="background: #a58f90;"></div>
                        <div class="cd-avatar-color" data-color="#c9b0b3" style="background: #c9b0b3;"></div>
                        <div class="cd-avatar-color" data-color="#9b958b" style="background: #9b958b;"></div>
                        <div class="cd-avatar-color" data-color="#d8d3cb" style="background: #d8d3cb;"></div>
                    </div>
                    
                    <div class="cd-color-row" style="margin-top: 8px;">
                        <input type="text" id="cdCustomAvatarColorInput" class="cd-input" placeholder="#RRGGBB" style="flex: 1;">
                        <div class="cd-color-preview-inline" id="cdCustomAvatarColorPreview"></div>
                    </div>
                </div>
                
                <!-- 头像图片上传 -->
                <div id="cdAvatarImageControls" style="display: none;">
                    <button class="cd-btn" data-cd-action="upload-avatar-image" style="width: 100%; margin-top: 12px;">上传头像图片</button>
                </div>
                
                <!-- 应用按钮 -->
                <button class="cd-btn cd-block-btn" data-cd-action="apply-blog-setting" style="margin-top: 15px;">应用博客设置</button>
                <button class="cd-apply-all-btn" data-cd-action="apply-all-blog">应用到所有博客</button>
            </div>`,
    },
    {
        id: 'blog-icons',
        label: '博客图标',
        icon: `<svg ${ICON_ATTRS}><path d="M12 20.2s-7.6-4.7-7.6-9.8A4.4 4.4 0 0 1 12 7.5a4.4 4.4 0 0 1 7.6 2.9c0 5.1-7.6 9.8-7.6 9.8z"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="blog-icons">
                <div class="cd-control-label">博客图标</div>
                <div class="cd-panel-section">
                    <span class="cd-panel-label">点赞图标</span>
                    <div id="cdLikeIconSelector" class="cd-icon-selector">
                        <div class="cd-icon-option cd-selected">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </div>
                        <div class="cd-icon-option">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        </div>
                        <div class="cd-icon-option">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </div>
                    </div>
                </div>
                <div class="cd-panel-section">
                    <span class="cd-panel-label">评论图标</span>
                    <div id="cdCommentIconSelector" class="cd-icon-selector">
                        <div class="cd-icon-option cd-selected">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        </div>
                        <div class="cd-icon-option">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </div>
                    </div>
                </div>
                <div class="cd-panel-section">
                    <span class="cd-panel-label">分享图标</span>
                    <div id="cdShareIconSelector" class="cd-icon-selector">
                        <div class="cd-icon-option cd-selected">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        </div>
                        <div class="cd-icon-option">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </div>
                    </div>
                </div>
                <button class="cd-btn cd-block-btn" data-cd-action="apply-blog-icons">应用图标</button>
            </div>`,
    },
    {
        id: 'image-card',
        label: '图片卡片',
        icon: `<svg ${ICON_ATTRS}><rect x="3.4" y="3.6" width="17.2" height="16.8" rx="3.6"/><path d="M3.4 15.4h17.2"/><circle cx="8.4" cy="8.6" r="1.4"/><path d="M5 13.2l2.6-2.5a1.8 1.8 0 0 1 2.5 0l2.5 2.5"/><path d="M7.2 18h6.4"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="image-card">
                <!-- 上传新图片 -->
                <button class="cd-btn cd-block-btn" data-cd-action="upload-image" style="width: 100%;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"></path>
                    </svg>
                    上传图片
                </button>
                
                <!-- 图片描述 -->
                <div class="cd-control-label" style="margin-top: 15px;">图片描述</div>
                <input type="text" id="cdImageDescription" class="cd-image-description-input" placeholder="描述这张图片...">
                
                <!-- 圆角设置 -->
                <div class="cd-control-label" style="margin-top: 15px;">圆角</div>
                <div class="cd-slider-container">
                    <input type="range" id="cdImageBorderRadius" min="0" max="30" value="12">
                    <span class="cd-value-display" id="cdImageBorderRadiusValue">12px</span>
                </div>
                
                <!-- 蒙层透明度 -->
                <div class="cd-control-label" style="margin-top: 12px;">蒙层透明度</div>
                <div class="cd-slider-container">
                    <input type="range" id="cdImageOverlayOpacity" min="0" max="0.5" step="0.05" value="0.2">
                    <span class="cd-value-display" id="cdImageOverlayOpacityValue">0.2</span>
                </div>
                
                <!-- 蒙层颜色 -->
                <div class="cd-control-label" style="margin-top: 12px;">蒙层颜色</div>
                <div class="cd-color-picker">
                    <div class="cd-color-dot" data-cd-overlay-color="rgba(100,100,100,0.2)" style="background-color: rgba(100,100,100,0.2);"></div>
                    <div class="cd-color-dot" data-cd-overlay-color="rgba(150,150,150,0.2)" style="background-color: rgba(150,150,150,0.2);"></div>
                    <div class="cd-color-dot" data-cd-overlay-color="rgba(200,200,200,0.2)" style="background-color: rgba(200,200,200,0.2);"></div>
                    <div class="cd-color-dot" data-cd-overlay-color="rgba(180,167,159,0.2)" style="background-color: rgba(180,167,159,0.2);"></div>
                    <div class="cd-color-dot" data-cd-overlay-color="rgba(165,143,144,0.2)" style="background-color: rgba(165,143,144,0.2);"></div>
                </div>
                
                <!-- 应用按钮 -->
                <button class="cd-btn cd-block-btn" data-cd-action="apply-current-image-card" style="width: 100%; margin-top: 15px;">应用到选中图片</button>
                <button class="cd-apply-all-btn" data-cd-action="apply-all-image-card">应用样式到所有图片</button>
            </div>`,
    },
    {
        id: 'position',
        label: '元素位置',
        icon: `<svg ${ICON_ATTRS}><path d="M12 3.6v16.8"/><path d="M8.4 7.2 12 3.6l3.6 3.6"/><path d="M8.4 16.8 12 20.4l3.6-3.6"/><path d="M4.4 12h3.2"/><path d="M16.4 12h3.2"/></svg>`,
        panelHtml: () => `
            <div class="cd-control-group cd-current-group" data-control-id="position">
                <div class="cd-control-label">元素上下位置</div>
                <div class="cd-slider-container">
                    <input type="range" id="cdElementPositionY" min="-50" max="50" value="0">
                    <span class="cd-value-display" id="cdElementPositionYValue">0px</span>
                </div>
                <button class="cd-btn" data-cd-action="reset-position" style="width: 100%; margin-top: 10px;">重置位置</button>
            </div>`,
    },
];
