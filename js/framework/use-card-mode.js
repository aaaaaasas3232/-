/* 卡片模式 */
import {
    UI_CONSTANTS,
    createIndicatorGestureState,
    createCardDragState,
} from './utils.js';

const {
    CARD_DRAG_THRESHOLD,    // 5px - 拖拽启动阈值（参考系统）
    CARD_DISMISS_THRESHOLD, // 100px - 关闭距离阈值
    CARD_WIDTH,
    CARD_HEIGHT,
    CARD_RADIUS,            // 28px
    FULL_RADIUS,            // 40px
    CONVERT_TO_CARD_THRESHOLD, // 100px - 上滑进入卡片阈值
    INDICATOR_FULL_TRAVEL,  // 260px
} = UI_CONSTANTS;

// 卡片阶段状态
const Stage = {
    FULL: 'full',
    INDICATOR_DRAGGING: 'indicator-dragging',
    CARD_ENTERING: 'card-entering',
    CARD_IDLE: 'card-idle',
    CARD_DRAGGING: 'card-dragging',
    CARD_DISMISSING: 'card-dismissing',
};

function getScreenMetrics() {
    const phoneScreen = document.querySelector('.phone-screen');
    const phoneCase = document.querySelector('.phone-case');
    const phoneEl = document.getElementById('phone');
    const isFullscreen = phoneEl?.classList.contains('phone--fullscreen') ||
                         phoneCase?.classList.contains('phone-case--hidden');

    if (isFullscreen) {
        // 全屏模式：手机壳被隐藏，手机直接撑到当前视口。
        // 读真实尺寸，避免卡片位置写死 390x590 导致偏移。
        return { width: window.innerWidth, height: window.innerHeight, offsetX: 0, offsetY: 0 };
    }

    if (phoneScreen && phoneCase) {
        const screenRect = phoneScreen.getBoundingClientRect();
        const caseRect = phoneCase.getBoundingClientRect();
        return {
            width: screenRect.width,
            height: screenRect.height,
            offsetX: screenRect.left - caseRect.left,
            offsetY: screenRect.top - caseRect.top,
        };
    }

    return { width: 390, height: 590, offsetX: 8, offsetY: 8 };
}

function computeCardCenter() {
    const screen = getScreenMetrics();
    return {
        x: screen.offsetX + (screen.width - CARD_WIDTH) / 2,
        y: screen.offsetY + (screen.height - CARD_HEIGHT) / 2 - 30, // 参考系统：中心上移30px
    };
}

export function useCardMode({ activeApp, appViewMode, closeApp }) {
    // 响应式状态
    const cardPosition = Vue.ref(computeCardCenter());
    const cardOpacity = Vue.ref(1);
    const cardRotate = Vue.ref(0);
    const cardBorderRadius = Vue.ref(FULL_RADIUS);
    const cardScale = Vue.ref(1);
    const desktopBlur = Vue.ref(0);
    const cardTranslateX = Vue.ref(0);  // 卡片拖拽的 transform translate
    const cardTranslateY = Vue.ref(0);
    
    // 阶段状态（内部使用）
    const stage = Vue.ref(Stage.FULL);
    // 拖拽后 50ms 内 isCardDragging 为 true，防止 click 误触发恢复全屏
    const isCardDragging = Vue.ref(false);
    
    // 手势状态 - 用 Vue.reactive 让模板能响应式访问
    const indicatorGesture = Vue.reactive(createIndicatorGestureState());
    const cardDrag = Vue.reactive(createCardDragState());
    
    // DOM refs
    const shellElement = Vue.ref(null);
    const desktopElement = Vue.ref(null);
    
    // rAF
    let moveFrame = 0;
    let pendingMove = null;
    
    // 桌面样式
    const desktopLayerStyle = Vue.computed(() => ({
        filter: desktopBlur.value > 0 ? `blur(${desktopBlur.value}px)` : '',
    }));

    // Shell 样式 - 简洁版
    // 【关键】永远不返回 transform/borderRadius，让 DOM 直写完全控制
    // 这避免了 Vue computed 与 DOM 直写之间的冲突
    const activeAppShellStyle = Vue.computed(() => {
        if (stage.value === Stage.FULL || stage.value === Stage.INDICATOR_DRAGGING) {
            return {
                left: '0px', top: '0px', width: '100%', height: '100%',
                opacity: 1, boxShadow: 'none',
            };
        }
        
        // card 模式：只返回布局属性，transform 由 DOM 直写控制
        const center = computeCardCenter();
        cardPosition.value = center;
        
        return {
            left: `${center.x + cardTranslateX.value}px`,
            top: `${center.y + cardTranslateY.value}px`,
            width: `${CARD_WIDTH}px`,
            height: `${CARD_HEIGHT}px`,
            opacity: cardOpacity.value,
            borderRadius: `${CARD_RADIUS}px`,
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        };
    });

    // ========== 桌面效果同步 ==========
    function syncDesktopBlur(blur) {
        desktopBlur.value = blur;
        const el = desktopElement.value;
        if (el) el.style.filter = blur > 0 ? `blur(${blur}px)` : '';
    }

    // ========== Home Indicator 手势 ==========
    function startIndicatorGesture(clientY) {
        if (stage.value !== Stage.FULL) return;
        
        indicatorGesture.active = true;
        indicatorGesture.startY = clientY;
        indicatorGesture.moveY = 0;
        stage.value = Stage.INDICATOR_DRAGGING;
        
        const shell = shellElement.value;
        if (shell) shell.style.transition = 'none';
    }

    function updateIndicatorGesture(clientY) {
        if (!indicatorGesture.active || stage.value !== Stage.INDICATOR_DRAGGING) return;

        const moveY = Math.min(0, clientY - indicatorGesture.startY);
        indicatorGesture.moveY = moveY;
        
        // 参考系统公式
        const absMove = Math.abs(moveY);
        const progress = Math.max(0, Math.min(1, absMove / INDICATOR_FULL_TRAVEL));
        const scale = Math.max(0.6, 1 - absMove / 800);
        const translateY = moveY * 0.5;
        const blur = Math.min(20, absMove / 30);
        const radius = Math.min(50, FULL_RADIUS + absMove / 15);

        // DOM 直写
        const shell = shellElement.value;
        if (shell) {
            shell.style.transform = `translate3d(0,${translateY}px,0) scale(${scale})`;
            shell.style.borderRadius = `${radius}px`;
        }
        
        syncDesktopBlur(blur);
        
        // 【关键修复】同步 indicatorProgress（指导书 16.2）
        // 之前没赋值，导致桌面 blur 不会变化
    }

    function endIndicatorGesture() {
        if (stage.value !== Stage.INDICATOR_DRAGGING) return;
        
        const absMove = Math.abs(indicatorGesture.moveY);
        
        // 【关键修复】只在松手时判断是否进入卡片（指导书 16.4）
        if (absMove > CONVERT_TO_CARD_THRESHOLD) {
            indicatorGesture.active = false;
            indicatorGesture.moveY = 0;
            enterCard();
            return;
        }
        
        // 回弹到全屏
        indicatorGesture.active = false;
        indicatorGesture.moveY = 0;
        
        const shell = shellElement.value;
        if (shell) {
            shell.style.transition = 'transform 0.4s cubic-bezier(0.2,0.8,0.2,1), border-radius 0.4s cubic-bezier(0.2,0.8,0.2,1)';
            shell.style.transform = '';
            shell.style.borderRadius = `${FULL_RADIUS}px`;
        }
        syncDesktopBlur(0);
        stage.value = Stage.FULL;
    }

    // ========== 进入卡片模式 ==========
    function enterCard() {
        stage.value = Stage.CARD_ENTERING;
        appViewMode.value = 'card';  // 同步模板状态
        // 注意：不设置 cardJustEnteredAt，避免 CSS 关键帧方向与 JS 最后一帧相反导致跳变
        // 直接用 transition 从最后一帧自然过渡到卡片
        
        const shell = shellElement.value;
        const center = computeCardCenter();
        
        // 【关键】从最后一帧手势姿态连续过渡到卡片
        // 不清 transform，让它从当前姿态自然过渡
        if (shell) {
            shell.style.transition = 'all 0.4s cubic-bezier(0.2,0.8,0.2,1)';
            shell.style.left = `${center.x}px`;
            shell.style.top = `${center.y}px`;
            shell.style.width = `${CARD_WIDTH}px`;
            shell.style.height = `${CARD_HEIGHT}px`;
            shell.style.transform = '';
            shell.style.borderRadius = `${CARD_RADIUS}px`;
            shell.style.boxShadow = '0 20px 50px rgba(0,0,0,0.3)';
        }
        
        // 桌面模糊固定
        syncDesktopBlur(20);
        
        // 重置拖拽 transform
        cardTranslateX.value = 0;
        cardTranslateY.value = 0;
        cardOpacity.value = 1;
        cardRotate.value = 0;
        cardScale.value = 1;
        
        // 冻结内容交互（参考系统）
        freezeAppContent(true);
        
        // 【关键】延迟 400ms 后才允许卡片拖拽（指导书 16.8）
        setTimeout(() => {
            if (stage.value === Stage.CARD_ENTERING) {
                stage.value = Stage.CARD_IDLE;
                if (shell) shell.style.transition = '';
            }
        }, 400);
    }

    // ========== 卡片拖拽 ==========
    function startCardDrag(clientX, clientY) {
        if (stage.value !== Stage.CARD_IDLE) return;
        
        cardDrag.active = true;
        cardDrag.startX = clientX;
        cardDrag.startY = clientY;
        cardDrag.moved = false;
        
        const shell = shellElement.value;
        if (shell) shell.style.transition = 'none';
    }

    function updateCardDrag(clientX, clientY) {
        if (!cardDrag.active || (stage.value !== Stage.CARD_IDLE && stage.value !== Stage.CARD_DRAGGING)) return;

        const dx = clientX - cardDrag.startX;
        const dy = clientY - cardDrag.startY;
        
        // 5px 阈值判断是否开始拖拽（参考系统）
        if (!cardDrag.moved && (Math.abs(dx) > CARD_DRAG_THRESHOLD || Math.abs(dy) > CARD_DRAG_THRESHOLD)) {
            cardDrag.moved = true;
            stage.value = Stage.CARD_DRAGGING;
            isCardDragging.value = true;
        }
        
        if (!cardDrag.moved) return;
        
        // rAF 合并
        pendingMove = { dx, dy };
        if (moveFrame) return;
        
        moveFrame = requestAnimationFrame(() => {
            moveFrame = 0;
            const move = pendingMove;
            if (!move) return;
            pendingMove = null;
            
            const distance = Math.sqrt(move.dx ** 2 + move.dy ** 2);
            const opacity = Math.max(0.3, 1 - distance / 400);
            const rotate = Math.max(-18, Math.min(18, move.dx / 20)); // 限制旋转角度
            
            const shell = shellElement.value;
            if (shell) {
                shell.style.transform = `translate3d(${move.dx}px,${move.dy}px,0) rotate(${rotate}deg)`;
                shell.style.opacity = String(opacity);
            }
            
            cardTranslateX.value = move.dx;
            cardTranslateY.value = move.dy;
            cardOpacity.value = opacity;
            cardRotate.value = rotate;
        });
    }

    function endCardDrag() {
        if (!cardDrag.active) return;
        cardDrag.active = false;
        cancelPendingMove();
        
        const shell = shellElement.value;
        
        // 没越过 5px 阈值
        if (!cardDrag.moved) {
            if (shell) shell.style.transition = '';
            isCardDragging.value = false;
            return;
        }
        
        // 计算最终位置
        const finalDx = cardTranslateX.value;
        const finalDy = cardTranslateY.value;
        const distance = Math.sqrt(finalDx ** 2 + finalDy ** 2);
        
        // 【关键修复】松手不足 100px 时回到中心（指导书 16.1）
        if (distance > CARD_DISMISS_THRESHOLD) {
            // 超过阈值：关闭 App，直接调用 dismissCard
            dismissCard();
            return;
        }
        
        // 不足阈值：回到中心
        if (shell) {
            shell.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            shell.style.transform = 'translate3d(0,0,0) rotate(0deg)';
            shell.style.opacity = '1';
        }
        
        cardTranslateX.value = 0;
        cardTranslateY.value = 0;
        cardOpacity.value = 1;
        cardRotate.value = 0;
        stage.value = Stage.CARD_IDLE;
        
        // 【关键修复】50ms 后清除拖拽标志，防止拖拽后 click 误触发（指导书 16.9）
        setTimeout(() => { isCardDragging.value = false; }, 50);
    }

    // ========== 关闭卡片 ==========
    function dismissCard() {
        stage.value = Stage.CARD_DISMISSING;
        
        const shell = shellElement.value;
        if (shell) {
            // 根据拖拽方向决定飞出方向
            const dx = cardTranslateX.value;
            const dy = cardTranslateY.value;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 计算方向，向该方向飞出
            const flyX = distance > 0 ? (dx / distance) * 200 : 0;
            const flyY = distance > 0 ? (dy / distance) * 200 : -200;
            
            shell.style.transition = 'all 0.3s ease-out';
            shell.style.transform = `translate3d(${flyX}px,${flyY}px,0) scale(0.5) rotate(0deg)`;
            shell.style.opacity = '0';
        }
        
        // 先清理桌面模糊，再关闭 App
        desktopBlur.value = 0;
        const desktopEl = desktopElement.value;
        if (desktopEl) desktopEl.style.filter = '';
        
        setTimeout(() => {
            closeApp();
            resetAllWithoutBlur();
        }, 300);
    }
    
    // resetAll 的简化版（不重复清理 blur）
    function resetAllWithoutBlur() {
        stage.value = Stage.FULL;
        appViewMode.value = 'full';
        isCardDragging.value = false;
        indicatorGesture.active = false;
        indicatorGesture.moveY = 0;
        cardDrag.active = false;
        cardDrag.moved = false;
        cancelPendingMove();
        
        cardTranslateX.value = 0;
        cardTranslateY.value = 0;
        cardOpacity.value = 1;
        cardRotate.value = 0;
        cardBorderRadius.value = FULL_RADIUS;
        cardScale.value = 1;
        
        freezeAppContent(false);
    }

    // ========== 恢复全屏 ==========
    function restoreFromCard() {
        if (stage.value !== Stage.CARD_IDLE) return;
        
        stage.value = Stage.FULL;
        appViewMode.value = 'full';  // 同步模板状态
        
        const shell = shellElement.value;
        if (shell) {
            shell.style.transition = 'all 0.4s cubic-bezier(0.2,0.8,0.2,1)';
            shell.style.left = '0px';
            shell.style.top = '0px';
            shell.style.width = '100%';
            shell.style.height = '100%';
            shell.style.transform = '';
            shell.style.borderRadius = `${FULL_RADIUS}px`;
            shell.style.boxShadow = 'none';
            shell.style.opacity = '1';
        }
        
        syncDesktopBlur(0);
        freezeAppContent(false);
        
        setTimeout(() => {
            if (shell) shell.style.transition = '';
            cardTranslateX.value = 0;
            cardTranslateY.value = 0;
        }, 400);
    }

    // ========== 冻结/解冻内容交互 ==========
    function freezeAppContent(frozen) {
        const appContent = document.querySelector('.app-content');
        const tabBar = document.querySelector('.app-tab-bar');
        const homeIndicator = document.querySelector('.home-indicator');
        
        [appContent, tabBar, homeIndicator].forEach(el => {
            if (el) el.style.pointerEvents = frozen ? 'none' : '';
        });
    }

    // ========== 取消相关 ==========
    function cancelPendingMove() {
        if (moveFrame) {
            cancelAnimationFrame(moveFrame);
            moveFrame = 0;
        }
        pendingMove = null;
    }

    function resetAll() {
        stage.value = Stage.FULL;
        appViewMode.value = 'full';  // 同步模板状态
        isCardDragging.value = false;
        indicatorGesture.active = false;
        indicatorGesture.moveY = 0;
        cardDrag.active = false;
        cardDrag.moved = false;
        cancelPendingMove();
        
        cardTranslateX.value = 0;
        cardTranslateY.value = 0;
        cardOpacity.value = 1;
        cardRotate.value = 0;
        cardBorderRadius.value = FULL_RADIUS;
        cardScale.value = 1;
        
        // 直接清零桌面模糊（不需要通过 Vue 响应式）
        desktopBlur.value = 0;
        const desktopEl = desktopElement.value;
        if (desktopEl) desktopEl.style.filter = '';
        
        freezeAppContent(false);
        
        const shell = shellElement.value;
        if (shell) {
            shell.style.transition = '';
            shell.style.transform = '';
            shell.style.opacity = '';
        }
    }
    
    // 兼容模板：卡片点击处理
    function handleAppShellClick(e) {
        onCardClick(e);
    }

    // ========== 事件处理 ==========
    function onHomeIndicatorPointerDown(e) {
        if (e.pointerType === 'mouse') return;
        e.preventDefault();
        startIndicatorGesture(e.clientY);
        e.currentTarget?.setPointerCapture?.(e.pointerId);
    }

    // 兼容 core-shim/index.html 的命名（@pointerdown="onHomeIndicatorDown"）
    function onHomeIndicatorDown(e) {
        return onHomeIndicatorPointerDown(e);
    }

    function onHomeIndicatorMouseDown(e) {
        e.preventDefault();
        startIndicatorGesture(e.clientY);
        
        const mouseMove = ev => updateIndicatorGesture(ev.clientY);
        const mouseUp = ev => {
            endIndicatorGesture();
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('mouseup', mouseUp);
        };
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
    }

    function onHomeIndicatorMove(e) {
        if (!e || e.pointerType === 'mouse') return;
        updateIndicatorGesture(e.clientY);
    }

    function onHomeIndicatorUp(e) {
        if (!e || e.pointerType === 'mouse') return;
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
        endIndicatorGesture();
    }

    function onHomeIndicatorCancel(e) {
        if (!e) return;
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
        cancelIndicatorState();
    }

    // 兼容模板 @pointercancel.stop="cancelIndicatorGesture"
    function cancelIndicatorGesture(e) {
        return onHomeIndicatorCancel(e);
    }

    function cancelIndicatorState() {
        indicatorGesture.active = false;
        indicatorGesture.moveY = 0;
        
        const shell = shellElement.value;
        if (shell) {
            shell.style.transition = '';
            shell.style.transform = '';
            shell.style.borderRadius = '';
        }
        syncDesktopBlur(0);
        
        if (stage.value === Stage.INDICATOR_DRAGGING) {
            stage.value = Stage.FULL;
        }
    }

    function onCardPointerDown(e) {
        if (e.pointerType === 'mouse') return;
        // 只在卡片模式下拦截事件，防止浏览器默认行为（如页面滚动 / 聚焦输入框）
        if (stage.value === Stage.CARD_IDLE) {
            e.preventDefault();
            startCardDrag(e.clientX, e.clientY);
            e.currentTarget?.setPointerCapture?.(e.pointerId);
        }
        // 全屏模式下放行，让 input/select 等元素正常接收 pointerdown 并聚焦
    }

    function onCardMouseDown(e) {
        // 只在卡片模式下拦截
        if (stage.value === Stage.CARD_IDLE) {
            e.preventDefault();
            startCardDrag(e.clientX, e.clientY);
            const mouseMove = ev => updateCardDrag(ev.clientX, ev.clientY);
            const mouseUp = ev => {
                endCardDrag();
                document.removeEventListener('mousemove', mouseMove);
                document.removeEventListener('mouseup', mouseUp);
            };
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('mouseup', mouseUp);
        }
    }

    function onCardPointerMove(e) {
        if (e.pointerType === 'mouse') return;
        updateCardDrag(e.clientX, e.clientY);
    }

    function onCardPointerUp(e) {
        if (e.pointerType === 'mouse') return;
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
        endCardDrag();
    }

    function onCardPointerCancel(e) {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
        cardDrag.active = false;
        isCardDragging.value = false;
        cancelPendingMove();

        // 复位视觉
        const shell = shellElement.value;
        if (shell) {
            shell.style.transition = '';
            shell.style.transform = '';
            shell.style.opacity = '1';
        }
        cardTranslateX.value = 0;
        cardTranslateY.value = 0;
        cardOpacity.value = 1;
        cardRotate.value = 0;
    }

    // 兼容模板 @pointercancel="cancelCardDrag"
    function cancelCardDrag(e) {
        return onCardPointerCancel(e);
    }

    function onCardClick(e) {
        // 【关键修复】只在 card-idle 且未拖拽时恢复全屏（指导书 16.9）
        if (stage.value === Stage.CARD_IDLE && !isCardDragging.value) {
            e.stopPropagation();
            restoreFromCard();
        }
    }

    // 遮罩点击
    function handleOverlayClick() {
        if (stage.value === Stage.CARD_IDLE && !isCardDragging.value) {
            restoreFromCard();
            return 'handled';
        }
        closeApp();
        return 'handled';
    }

    return {
        // 状态
        stage,
        isCardDragging,
        indicatorGesture,  // 用于模板中 indicatorGesture.active
        cardPosition,
        cardOpacity,
        cardRotate,
        cardScale,
        cardTranslateX,
        cardTranslateY,
        
        // 样式
        desktopLayerStyle,
        activeAppShellStyle,
        
        // DOM refs
        shellElement,
        desktopElement,
        
        // Home Indicator 事件
        onHomeIndicatorPointerDown,
        onHomeIndicatorDown,        // 兼容 core-shim/index.html
        onHomeIndicatorMouseDown,
        onHomeIndicatorMove,
        onHomeIndicatorUp,
        onHomeIndicatorCancel,
        cancelIndicatorGesture,     // 兼容 core-shim/index.html

        // 卡片事件
        onCardPointerDown,
        onCardMouseDown,
        onCardPointerMove,
        onCardPointerUp,
        onCardPointerCancel,
        cancelCardDrag,             // 兼容 core-shim/index.html
        onCardClick,
        handleAppShellClick,
        
        // 遮罩
        handleOverlayClick,
        
        // 重置
        resetAll,
        resetCardState: resetAll, // 兼容 use-app-navigation.js 的 resetCardState
        
        // 调试用
        get stageValue() { return stage.value; },
    };
}
