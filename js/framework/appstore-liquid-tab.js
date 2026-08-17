// ================================================================
// App Store 专属 · Liquid Bottom Bar 交互
// ------------------------------------------------------------
// 作用范围:仅当 .app-shell 内部包含 .appstore-app 时生效
// 行为:
//   - 监听 .app-tab-item 的 .active 切换,接管成 liquid 动画
//   - 把"激活"语义从 framework 的 .active 改为 .is-liquid-active
//     (避免和 framework 自带的 transform/color transition 打架)
//   - 用 data-glyph(首字母)/ data-color(液球色)给伪元素喂数据
//   - 退出 appstore 时自动还原,下次进入重新初始化
// ================================================================

const GLYPH_BY_LABEL = (label) => {
    if (!label) return '';
    const trimmed = String(label).trim();
    if (!trimmed) return '';
    // 中文:取第一个字符;英文:取第一个大写字母
    return trimmed.charAt(0);
};

// 粉蓝粉（今天/游戏/App）对应 App Store 按钮粉蓝感
const DEFAULT_COLORS = ['#ff69b4', '#007aff', '#ff69b4'];

function setupShell(shell) {
    const tabBar = shell.querySelector('.app-tab-bar');
    if (!tabBar || tabBar.dataset.appstoreLiquidReady === '1') return;
    tabBar.dataset.appstoreLiquidReady = '1';

    const items = Array.from(tabBar.querySelectorAll('.app-tab-item'));

    // 给每个 item 注入 data-glyph / data-color
    items.forEach((item, idx) => {
        // 文字标签是 .app-tab-item 最后一个 div 节点的内容
        const labelEl = item.querySelector('div:last-child');
        const label = labelEl ? labelEl.textContent.trim() : '';
        item.dataset.glyph = GLYPH_BY_LABEL(label);
        item.dataset.color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        // 用 CSS 变量喂颜色,让 ::after 伪元素能读到
        item.style.setProperty('--appstore-liquid-color', DEFAULT_COLORS[idx % DEFAULT_COLORS.length]);
    });

    let currentActive = null;

    function applyLiquid(newActiveEl) {
        // 旧激活态:走"塌缩"动画
        if (currentActive && currentActive !== newActiveEl) {
            const old = currentActive;
            old.classList.remove('is-liquid-active');
            old.classList.add('is-liquid-leaving');
            // 同时把 framework 的 .active 也保留(不影响功能)
            // 监听 animationend 清理 leaving 标记
            const cleanup = () => {
                old.classList.remove('is-liquid-leaving');
                old.removeEventListener('animationend', cleanup);
            };
            old.addEventListener('animationend', cleanup);
        }
        // 新激活态
        if (newActiveEl && newActiveEl !== currentActive) {
            newActiveEl.classList.remove('is-liquid-leaving');
            newActiveEl.classList.add('is-liquid-active');
        }
        currentActive = newActiveEl || currentActive;
    }

    // 初始:找到当前激活的 tab(framework 会给第一个 item 加 .active)
    const initiallyActive = items.find(item => item.classList.contains('active')) || items[0];
    if (initiallyActive) {
        // 首次不播塌缩动画,直接显示
        initiallyActive.classList.add('is-liquid-active');
        currentActive = initiallyActive;
    }

    // 用 MutationObserver 监听 .active 切换 —— framework 用 v-bind:class 切换
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.attributeName !== 'class') continue;
            const target = m.target;
            if (!target.classList.contains('app-tab-item')) continue;
            const isNowActive = target.classList.contains('active');
            if (isNowActive) {
                applyLiquid(target);
            }
        }
    });

    items.forEach(item => observer.observe(item, { attributes: true, attributeFilter: ['class'] }));

    // 切走时清理(用户点 home indicator / 切到其他 app)
    const shellObserver = new MutationObserver(() => {
        if (!shell.contains(tabBar)) {
            observer.disconnect();
            shellObserver.disconnect();
            delete tabBar.dataset.appstoreLiquidReady;
        }
    });
    shellObserver.observe(shell, { childList: true, subtree: true });
}

// ================================================================
// bootstrap
// ================================================================
function init() {
    if (typeof MutationObserver === 'undefined') return;

    const findAndSetup = () => {
        const shells = document.querySelectorAll('.app-shell');
        shells.forEach(shell => {
            if (shell.querySelector('.appstore-app')) {
                setupShell(shell);
            }
        });
    };

    // 初次扫描
    findAndSetup();

    // 监听 app 切换(.app-shell 内部的 .appstore-app 出现/消失)
    const rootObserver = new MutationObserver(() => {
        findAndSetup();
    });

    // 监听 #phone 子树变化(app 切换会触发整个 shell 替换)
    const phone = document.getElementById('phone');
    if (phone) {
        rootObserver.observe(phone, { childList: true, subtree: true });
    } else {
        // 兜底:监听 body
        rootObserver.observe(document.body, { childList: true, subtree: true });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
