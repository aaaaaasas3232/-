/**
 * relax-app / 解压主体:「捏捏果冻」(单只大果冻)
 *
 * ------------------------------------------------------------
 * 玩法
 * ------------------------------------------------------------
 * 一只整块果冻铺满容器,按下 → 凹陷 + 出声 + 震动。
 * 持续按着持续震动,松手回到原状。
 *
 * ★ 用户要求:果冻跟巧克力都「只有一个,能放大的大小再大一点」——
 *   所以这个主体去掉了 configurable:grid 配置(没法调多块),
 *   容器由 ToyHost 决定大小,本主体只管把果冻画满给进来的容器。
 *
 * ★ 用户要求「果冻下面不应该有盘子」——真正的元凶是主体外面那层 .jelly-board
 *   奶白圆角外壳,已经删掉了,现在主体的 DOM 只有果冻本身。
 *   舞台那层盘子归「装扮 → 盘子」的开关管,主体不写死(见 fit)。
 *
 * ★ 宽高必须相等 —— 尺寸由 applyUnit() 内联成 min(容器宽,高) 的正方形。
 *   写成 CSS 百分比的话 aspect-ratio 会失效,果冻会被竖长方形的舞台拉成鸡蛋。
 *
 * ★ 主体内部**不要**碰 localStorage、不要插全局 <style>、不要读 store。
 *    颜色只认 host.tint,样式写在 css/apps/relax/_toys.css。
 */

import { registerRelaxToy } from '../registry.js';

const JELLY_ICON = `
<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="10" width="24" height="18" rx="7" fill="currentColor"/>
    <path d="M4 15c6-6 16-6 24 0v-2a7 7 0 0 0-7-7H11a7 7 0 0 0-7 7z" fill="currentColor" opacity="0.6"/>
    <ellipse cx="12" cy="16" rx="3.4" ry="2.4" fill="#ffffff" opacity="0.5"/>
</svg>`;

registerRelaxToy({
    id: 'demo-jelly',
    name: '捏捏果冻',
    summary: '按下去就凹一下',
    icon: JELLY_ICON,
    defaultTint: '#ffc8dd',
    tintable: true,
    /*
     * ★ 走盘子系统(理由同巧克力):fit:'stage' 会让舞台整段跳过盘子渲染,
     *   用户上传的自定义盘子也跟着不见。要不要盘子由「装扮 → 盘子」开关决定。
     */
    fit: 'plate',
    aspect: 1,
    defaultSoundId: 'jelly',
    resettable: true,
    // ★ 故意不声明 configurable —— 用户要求「果冻只有一个,不能调个数」。
    //   气泡板(bubble-board)仍然是可调的,UI 会按各自声明的 configurable 自动展示控制区。
    deletable: false,

    mount(host) {
        // ★ 没有任何包裹层:主体就是这一只果冻。
        //   以前外面套了个 .jelly-board 的 div,它带奶白底+圆角+投影,
        //   看起来就是果冻自带了一个盘子 —— 用户不要,连元素一起删掉。
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'jelly-cell jelly-cell--single';
        cell.dataset.index = '0';
        cell.style.setProperty('--jelly-skew', `${(Math.random() * 2 - 1) * 4}deg`);
        cell.style.setProperty('--jelly-round', randomBlobRadius());

        const shine = document.createElement('span');
        shine.className = 'jelly-shine';
        cell.appendChild(shine);
        host.el.appendChild(cell);

        /**
         * 果冻锁成正方形:边长取容器短边,直接写成内联 px。
         * 交给 CSS 写百分比的话,舞台是竖长方形,宽高两个方向都成了确定值,
         * aspect-ratio 会被忽略,果冻就被拉成竖着的鸡蛋。
         *
         * 用 offsetWidth 而不是 getBoundingClientRect():后者带上了
         * .rx-toy-host 的 scale(),用户放大一次尺寸就跟着翻一倍。
         */
        const SIZE_RATIO = 0.86;   // 留点边,别贴着屏幕两侧,也给投影留位置
        function applyUnit(width, height) {
            const w = width || host.el.offsetWidth;
            const h = height || host.el.offsetHeight;
            const unit = Math.min(w, h) * SIZE_RATIO;
            if (unit > 0) {
                cell.style.width = `${unit}px`;
                cell.style.height = `${unit}px`;
            }
        }
        applyUnit();

        function squish() {
            cell.classList.remove('is-squish');
            void cell.offsetWidth;
            cell.classList.add('is-squish');
            host.playSound({ rate: 0.92 + Math.random() * 0.18 });
            host.haptic('medium');
        }

        function release() {
            cell.classList.remove('is-pressed');
        }

        function onPointerDown(event) {
            event.preventDefault();
            squish();
            cell.classList.add('is-pressed');
            // 持续按住期间,每隔 ~180ms 再补一次轻微震动 + 声音,让用户一直按一直有反馈
            if (cell._holdTimer) clearInterval(cell._holdTimer);
            cell._holdTimer = setInterval(() => {
                if (!cell.classList.contains('is-pressed')) return;
                cell.classList.remove('is-squish');
                void cell.offsetWidth;
                cell.classList.add('is-squish');
                host.playSound({ rate: 0.88 + Math.random() * 0.22 });
                host.haptic('light');
            }, 220);
            try {
                if (event.pointerId != null && cell.setPointerCapture) {
                    cell.setPointerCapture(event.pointerId);
                }
            } catch { /* ignore */ }
        }

        function onPointerUp() {
            if (cell._holdTimer) {
                clearInterval(cell._holdTimer);
                cell._holdTimer = null;
            }
            release();
            host.playSound({ rate: 0.78 + Math.random() * 0.14 });
            host.haptic('light');
        }

        cell.addEventListener('pointerdown', onPointerDown);
        cell.addEventListener('pointerup', onPointerUp);
        cell.addEventListener('pointerleave', onPointerUp);
        cell.addEventListener('pointercancel', onPointerUp);
        host.onCleanup(() => {
            if (cell._holdTimer) clearInterval(cell._holdTimer);
            cell.removeEventListener('pointerdown', onPointerDown);
            cell.removeEventListener('pointerup', onPointerUp);
            cell.removeEventListener('pointerleave', onPointerUp);
            cell.removeEventListener('pointercancel', onPointerUp);
        });

        return {
            destroy() {
                if (cell._holdTimer) clearInterval(cell._holdTimer);
                cell.remove();
            },
            setTint(hex) {
                cell.style.setProperty('--jelly-tint', hex);
            },
            setSize(width, height) {
                applyUnit(width, height);
            },
            reset() {
                cell.classList.remove('is-squish', 'is-pressed');
                if (cell._holdTimer) {
                    clearInterval(cell._holdTimer);
                    cell._holdTimer = null;
                }
            },
        };
    },
});

function randomBlobRadius() {
    const pick = () => 34 + Math.round(Math.random() * 26);
    return `${pick()}% ${pick()}% ${pick()}% ${pick()}% / ${pick()}% ${pick()}% ${pick()}% ${pick()}%`;
}