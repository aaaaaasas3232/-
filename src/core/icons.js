// ============================================
// 图标 / UI 符号 / 设计 token
// 从 apps.js 第 1-45 行提取
// ============================================

export const APP_ICONS = {
    spark: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"></path></svg>`,
    grid: `<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="6" height="6" rx="1.5"></rect><rect x="14" y="4" width="6" height="6" rx="1.5"></rect><rect x="4" y="14" width="6" height="6" rx="1.5"></rect><rect x="14" y="14" width="6" height="6" rx="1.5"></rect></svg>`,
    layers: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7l9 5 9-5-9-5Z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 17 9 5 9-5"></path></svg>`,
    bell: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"></path><path d="M10 20a2 2 0 0 0 4 0"></path></svg>`,
};

export const UI_ICONS = {
    chevronRight: '›',
    heart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z"></path></svg>`,
    heartOutline: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"></path></svg>`,
    play: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7-11-7Z"></path></svg>`,
    pause: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z"></path></svg>`,
    prev: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zM18 6v12l-8-6 8-6Z"></path></svg>`,
    next: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 6h2v12h-2zM6 18V6l8 6-8 6Z"></path></svg>`,
    musicNote: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h6V3h-8Z"></path></svg>`,
    send: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 20.85 12 3.4 3.6 3.33 10l12.17 2-12.17 2 .07 6.4Z"></path></svg>`,
    plus: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>`,
    back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>`
};

export const UI_TOKENS = Object.freeze({
    radius: {
        card: 'rounded-[28px]',
        group: 'rounded-[24px]',
        tile: 'rounded-[20px]',
        chip: 'rounded-full'
    },
    shadow: {
        card: 'shadow-[0_14px_28px_rgba(15,23,42,0.06)]',
        tile: 'shadow-[0_10px_24px_rgba(15,23,42,0.06)]',
        soft: 'shadow-[0_8px_18px_rgba(15,23,42,0.08)]'
    },
    surface: {
        card: 'bg-white/92 border border-white/80',
        muted: 'bg-white/55',
        soft: 'bg-slate-50/90 border border-white/80'
    }
});

export const UI_SYMBOLS = Object.freeze({
    settingsBlue: '☀',
    privacyBlue: '✦',
    avatarListen: '听'
});
