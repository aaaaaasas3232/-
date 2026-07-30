/**
 * 设置 App · 设计 Token（软编码）
 *
 * 所有颜色 / 圆角 / 间距 / 字号都集中在这里定义，便于后续在「一个地方」换肤。
 * 渲染层只引用 token 名字（如 `T.color.surface`），不直接写 `#xxx`。
 *
 * 颜色风格：iOS Settings
 *   - 浅色为主，#F2F2F7（系统灰背景）/ #FFFFFF（分组卡片）/ 标签色（蓝/绿/橙/紫/灰）
 *   - 玻璃感：半透明白 + 细边
 */

const systemBlue = '#0A84FF';
const systemGreen = '#34C759';
const systemOrange = '#FF9F0A';
const systemPurple = '#AF52DE';
const systemIndigo = '#5856D6';
const systemRed = '#FF3B30';
const systemYellow = '#FFCC00';
const systemGray = '#8E8E93';
const systemGray2 = '#AEAEB2';
const systemGray3 = '#C7C7CC';
const systemGray4 = '#D1D1D6';
const systemGray5 = '#E5E5EA';
const systemGray6 = '#F2F2F7';

const label = '#000000';
const secondaryLabel = 'rgba(60, 60, 67, 0.72)';
const tertiaryLabel = 'rgba(60, 60, 67, 0.5)';
const quaternaryLabel = 'rgba(60, 60, 67, 0.32)';

const separator = 'rgba(60, 60, 67, 0.18)';
const separatorOpaque = '#C6C6C8';

const fillPrimary = 'rgba(120, 120, 128, 0.2)';
const fillSecondary = 'rgba(120, 120, 128, 0.16)';
const fillTertiary = 'rgba(118, 118, 128, 0.12)';

export const T = Object.freeze({
    color: Object.freeze({
        // iOS 系统色
        blue: systemBlue,
        green: systemGreen,
        orange: systemOrange,
        purple: systemPurple,
        indigo: systemIndigo,
        red: systemRed,
        yellow: systemYellow,
        gray: systemGray,
        gray2: systemGray2,
        gray3: systemGray3,
        gray4: systemGray4,
        gray5: systemGray5,
        gray6: systemGray6,

        // iOS 文字色阶
        label,
        secondaryLabel,
        tertiaryLabel,
        quaternaryLabel,

        // 分隔线
        separator,
        separatorOpaque,

        // 填充（input / track / etc.）
        fillPrimary,
        fillSecondary,
        fillTertiary,

        // 应用页面背景（iOS 系统灰）
        pageBackground: '#F2F2F7',
        // 卡片背景（分组卡片）
        cardBackground: '#FFFFFF',
        // 二级 / 嵌套卡片
        nestedBackground: '#F8F8FA',

        // 危险 / 警告
        warning: '#FF9F0A',
        warningSurface: 'rgba(255, 159, 10, 0.12)',
        warningBorder: 'rgba(255, 159, 10, 0.28)',
        warningText: '#7A4F00',

        destructive: systemRed,
        destructiveSurface: 'rgba(255, 59, 48, 0.12)',

        // 阴影色
        shadowSoft: 'rgba(0, 0, 0, 0.04)',
        shadowCard: 'rgba(0, 0, 0, 0.08)',

        // 透明 / 焦点环
        focusRing: 'rgba(10, 132, 255, 0.24)',
        pressedOverlay: 'rgba(0, 0, 0, 0.04)',
    }),

    radius: Object.freeze({
        card: '12px',
        group: '10px',
        field: '8px',
        chip: '999px',
        switch: '999px',
        avatar: '50%',
    }),

    font: Object.freeze({
        body: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
        // iOS 主标题 17px 常规 / 13px 副标题 / 22px section 标题 / 11px footer
        titleSize: '16px',
        bodySize: '14px',
        captionSize: '12px',
        footnoteSize: '11px',
        sectionTitleSize: '12px',
        footerSize: '11px',
    }),

    space: Object.freeze({
        pagePaddingX: '14px',
        groupGap: '16px',
        groupPaddingX: '14px',
        groupPaddingY: '10px',
        rowMinHeight: '40px',
    }),
});

/**
 * 主页面 5 个入口的图标颜色（iOS 设置风）
 * 命名沿用原代码，方便替换
 */
export const ENTRY_GLYPH_TINT = Object.freeze({
    appearance: T.color.gray,
    world: T.color.green,
    user: T.color.blue,
    ai: T.color.orange,
    api: T.color.purple,
});