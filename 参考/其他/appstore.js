(function(global) {
    'use strict';

    // ============ 系统应用 SVG 图标库（与桌面图标完全一致）============
    var APP_ICONS = {
        // nook - 系统设置 (粉色熊猫) - 与桌面一致
        'nook': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="nook-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFB6C1"/><stop offset="50%" stop-color="#FF8FAB"/><stop offset="100%" stop-color="#FF69B4"/></linearGradient><clipPath id="nook-clip-store"><rect width="60" height="60" rx="13"/></clipPath></defs><rect width="60" height="60" rx="13" fill="url(#nook-bg-store)"/><g clip-path="url(#nook-clip-store)"><g transform="translate(46, 46) rotate(-45)"><circle cx="-16" cy="-8" r="10" fill="#FFF"/><circle cx="16" cy="-8" r="10" fill="#FFF"/><ellipse cx="0" cy="8" rx="22" ry="20" fill="#FFF"/></g></g></svg>',
        
        // murmurr - 聊天应用 (蓝色星形) - 与桌面一致
        'murmurr': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="chat-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#b8e0f7"/><stop offset="100%" stop-color="#8ecae6"/></linearGradient></defs><rect width="60" height="60" rx="13" fill="url(#chat-bg-store)"/><path d="M0,-22 Q2.5,-4 15,0 Q2.5,4 0,22 Q-2.5,4 -15,0 Q-2.5,-4 0,-22Z" fill="#4a9eca" transform="translate(15, 12) scale(1.5)"/><path d="M0,-22 Q2.5,-4 15,0 Q2.5,4 0,22 Q-2.5,4 -15,0 Q-2.5,-4 0,-22Z" fill="#3d8ab8" transform="translate(45, 49) scale(1.5)"/></svg>',
        
        // 天气应用 (蓝色云朵) - 与桌面一致
        'weather': '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" fill="#3D8BD4"/><defs><pattern id="grid-store" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#4A95DA"/><rect x="2" y="2" width="18" height="18" rx="3" fill="#3D8BD4"/><rect x="22" y="22" width="18" height="18" rx="3" fill="#3D8BD4"/></pattern></defs><rect width="120" height="120" fill="url(#grid-store)"/><path d="M30 68 Q30 52 46 52 Q50 38 66 38 Q84 38 88 54 Q102 56 102 70 Q102 84 88 84 L38 84 Q24 84 24 70 Q24 60 30 68 Z" fill="#2D6EB8" transform="translate(2,4)"/><path d="M28 64 Q28 48 44 48 Q48 34 64 34 Q82 34 86 50 Q100 52 100 66 Q100 80 86 80 L36 80 Q22 80 22 68" fill="#FFFFFF"/></svg>',
        
        // Qmessage - 短信应用 (绿青渐变) - 与桌面一致
        'sms': '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sms-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A8E6CF"/><stop offset="100%" stop-color="#56CCF2"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#sms-bg-store)"/><rect x="25" y="35" width="70" height="50" rx="8" fill="white" opacity="0.95"/><line x1="35" y1="50" x2="65" y2="50" stroke="#56CCF2" stroke-width="4" stroke-linecap="round"/><line x1="35" y1="62" x2="85" y2="62" stroke="#A8E6CF" stroke-width="4" stroke-linecap="round"/><line x1="35" y1="74" x2="75" y2="74" stroke="#56CCF2" stroke-width="4" stroke-linecap="round"/><circle cx="85" cy="75" r="12" fill="#FFD93D" opacity="0.9"/><path d="M85 70 L85 77 L88 74" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        
        // echooo - 音乐应用 (粉色音符) - 与桌面一致
        'music': '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="music-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFB6D9"/><stop offset="100%" stop-color="#FFC2E2"/></linearGradient><filter id="softShadow-store"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dx="0" dy="2" result="offsetblur"/><feFlood flood-color="#FF69B4" flood-opacity="0.2"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="120" height="120" rx="28" fill="url(#music-bg-store)"/><g transform="translate(15, -78) rotate(21)"><path d="M12 3v6.9c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V9h3V6h-5z" fill="white" opacity="0.95" filter="url(#softShadow-store)" transform="scale(9)"/></g></svg>',
        
        // 韩味购物 (粉绿四叶草) - 与桌面一致
        'shop': '<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="shop-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="40%" stop-color="#fee1ef"/><stop offset="80%" stop-color="#dffbea"/></linearGradient><filter id="clover-shadow-store" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.2"/><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#ffb3b3" flood-opacity="0.15"/></filter></defs><rect width="180" height="180" rx="40" fill="url(#shop-bg-store)"/><g filter="url(#clover-shadow-store)" transform="translate(48, -15) scale(1.41) rotate(30)"><path d="M68.55 55.14l-6.77 2.04s.43 3.76-.32 9.14c-.75 5.37-2.26 13.97-.75 25.26c1.5 11.29 6.99 17.41 10.86 21.6c1.55 1.68 5.7 4.84 6.45 6.56c.75 1.72 2.04 4.19 3.87 4.19s4.62-2.26 5.05-5.7c.43-3.44-5.05-3.01-10.86-9.35c-5.33-5.82-9.24-12.58-10-21.39c-.75-8.81.43-17.3.97-20.64c.54-3.33 1.5-11.71 1.5-11.71z" fill="#feecfc"/><path d="M77.03 5.63c2.27-1.13 9.71-2.91 14.65 2.1s3.72 11.25 4.94 12.14c1.21.89 8.66-.57 13.84 4.61s3.64 13.91 1.37 16.1c-2.27 2.19-24.44-13.51-24.44-13.51L77.03 5.63z" fill="#feecfc"/><path d="M29.44 19.71s.73-7.36 4.53-11.25c3.4-3.48 8.91-4.86 13.99-2.67c6.56 2.83-7.11 23.63-7.11 23.63L16.41 41.48s-5.75-7.8-.16-15.94c4.77-6.96 13.19-5.83 13.19-5.83z" fill="#feecfc"/><path d="M18.76 58.98c-2.35 1.46-7.25 8.49-2.6 15.93c4.05 6.47 9.79 6.31 9.79 6.31S24.49 89.8 30 94.65c5.34 4.71 14.02 3.16 16.53 1.62c2.99-1.83-5.2-26.38-5.2-26.38L18.76 58.98z" fill="#feecfc"/><path d="M92.32 72.48S73.05 87.21 75.76 91.4c3.05 4.73 14.44 6.53 19.64 2.28c6.23-5.1 4.05-10.28 5.1-11.49c1.05-1.21 5.83-1.38 8.09-6.23c2.27-4.86 1.78-10.67-1.06-14.15c-2.83-3.48-15.21 10.67-15.21 10.67z" fill="#feecfc"/><path d="M63.18 43.37c3.32-.24 1.59-9.05 1.86-16.11c.45-11.81 3.71-15.71 6.71-18.52c2.85-2.67 7.36-3.96 8.38-4.15c1.6-.29 5.75 2.56 8 7.87c1.93 4.56 1.78 10.3 3.41 11.7s9.18-.99 14.99 4.36c5.81 5.35 5.77 10.21 5.77 11.29c0 1.08-3.56 5.5-9.61 7.32c-7.49 2.26-20.61 1.28-24.63 1.2s-7.05.31-6.97 2.09c.08 1.78 4.96 1.32 8.91 1.24s13.31 1.01 20.53 4.26c6.97 3.14 8.6 7.63 9.22 10.69c.54 2.67-1.08 6.27-3.87 7.98c-2.79 1.7-8.87 1.55-10.23 3.14c-1.86 2.17.85 8.99-5.5 13.17s-12.42 2.41-13.72 1.31c-4.87-4.14-6.04-9.4-6.97-17.23c-.93-7.82-1.55-16.19-4.96-16.19s-5.19 9.84-6.66 18.28s-5.35 18.24-13.71 20.1c-6.06 1.35-11.7-5.04-12.08-9.41c-.40-4.57.29-9.13-.85-10.81c-1.39-2.05-8.39.02-12.55-6.31c-3.64-5.54-2.09-9.33-1.32-10.34c.74-.96 4.34-5.69 13.40-7.17s26.26 1.12 26.49-2.09c.23-3.21-13.94-2.67-18.59-2.67s-14.27.37-19.06-3.49c-3.64-2.94-4.72-5.90-4.94-6.83c-.35-1.45.63-7.91 5.89-11.12c6.54-4 11.76-1.25 13.31-2.33c1.55-1.08-1.24-6.32 3.34-13.01c3.56-5.19 9.71-6.20 10.46-5.89c3.14 1.27 7.03 3.80 9.82 9.45s3.72 12.08 3.72 16.81s-.70 11.60 2.01 11.41z" fill="#feecfc"/></g></svg>',
        
        // 梦境编织
        'dreamweaver': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dw-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1a1035"/><stop offset="50%" stop-color="#2d1b4e"/><stop offset="100%" stop-color="#1a1035"/></linearGradient><linearGradient id="dwLineGrad-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A855F7"/><stop offset="30%" stop-color="#EC4899"/><stop offset="60%" stop-color="#F472B6"/><stop offset="100%" stop-color="#22D3EE"/></linearGradient><filter id="dwGlow-store" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="60" height="60" rx="13" fill="url(#dw-bg-store)"/><path d="M8 30 Q8 12 30 8 Q52 4 54 24 Q56 38 42 44 Q32 48 30 52 Q28 56 20 52 Q6 46 10 32 Q12 24 20 20 Q26 17 30 20 Q36 24 32 30 Q28 36 22 32 Q18 28 22 24 Q26 20 30 24 Q34 28 30 32 Q26 36 24 30 Q22 24 28 22 Q34 20 36 26 Q38 32 32 36 Q24 42 18 36 Q10 28 18 20 Q28 10 42 16 Q54 22 50 36 Q46 50 30 54 Q14 58 8 44 Q4 34 8 30" fill="none" stroke="url(#dwLineGrad-store)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#dwGlow-store)"/></svg>',
        
        // 求职助手 (紫色公文包) - 与桌面一致
        'job': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="job-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C4B5FD"/><stop offset="50%" stop-color="#8B5CF6"/><stop offset="100%" stop-color="#7B5CFA"/></linearGradient><clipPath id="job-clip-store"><rect width="60" height="60" rx="13"/></clipPath></defs><rect width="60" height="60" rx="13" fill="url(#job-bg-store)"/><g clip-path="url(#job-clip-store)"><g transform="translate(46, 46) rotate(-15)"><rect x="-24" y="-17" width="48" height="34" rx="6" fill="#FFF"/><path d="M-12 -17 L-12 -23 Q-12 -29 -6 -29 L6 -29 Q12 -29 12 -23 L12 -17" fill="none" stroke="#FFF" stroke-width="5" stroke-linecap="round"/></g></g></svg>',
        
        // 果冻蛇 (粉色果冻蛇) - 与桌面一致
        'jellysnake': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="jelly-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFB6D9"/><stop offset="50%" stop-color="#FF8FAB"/><stop offset="100%" stop-color="#FF69B4"/></linearGradient></defs><rect width="60" height="60" rx="13" fill="url(#jelly-bg-store)"/><g transform="translate(42, 42) rotate(-20)"><circle cx="-7" cy="-4" r="3.5" fill="#FFF"/><circle cx="7" cy="-4" r="3.5" fill="#FFF"/><path d="M-6 6 Q0 12 6 6" fill="none" stroke="#FFF" stroke-width="2.5" stroke-linecap="round"/></g></svg>',
        
        // 小组件管理器 - 与桌面一致
        'widget': '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="widget-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A8E6CF"/><stop offset="100%" stop-color="#56CCF2"/></linearGradient><filter id="widget-shadow-store" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#3BB8A8" flood-opacity="0.2"/></filter></defs><rect width="100" height="100" rx="22" fill="url(#widget-bg-store)"/><g filter="url(#widget-shadow-store)"><rect x="16" y="16" width="30" height="30" rx="8" fill="#FFF" opacity="0.95"/><circle cx="31" cy="31" r="8" fill="#56CCF2" opacity="0.5"/><rect x="54" y="16" width="30" height="30" rx="8" fill="#FFF" opacity="0.95"/><path d="M64 26 L74 36 M74 26 L64 36" stroke="#A8E6CF" stroke-width="3" stroke-linecap="round" opacity="0.8"/><rect x="16" y="54" width="30" height="30" rx="8" fill="#FFF" opacity="0.95"/><rect x="24" y="62" width="14" height="3" rx="1.5" fill="#56CCF2" opacity="0.7"/><rect x="24" y="68" width="10" height="3" rx="1.5" fill="#A8E6CF" opacity="0.7"/><rect x="24" y="74" width="12" height="3" rx="1.5" fill="#56CCF2" opacity="0.7"/><rect x="54" y="54" width="30" height="30" rx="8" fill="#FFF" opacity="0.95"/><path d="M62 69 L67 74 L77 64" stroke="#A8E6CF" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/></g></svg>',
        
        // 气泡编辑 - 与桌面一致
        'bubbleeditor': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bubble-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#93C5FD"/><stop offset="50%" stop-color="#60A5FA"/><stop offset="100%" stop-color="#3B82F6"/></linearGradient><clipPath id="bubble-clip-store"><rect width="60" height="60" rx="13"/></clipPath></defs><rect width="60" height="60" rx="13" fill="url(#bubble-bg-store)"/><g clip-path="url(#bubble-clip-store)"><g transform="translate(30, 30) scale(1.15)"><path d="M 0 -14 C 8.27 -14 15 -8.641 15 -2.051 C 15 0.579 13.959 2.961 11.779 5.301 C 10.209 7.081 7.661 9.04 5.311 10.66 C 2.961 12.26 0.8 13.52 0 13.85 C -0.32 13.98 -0.56 14.039 -0.75 14.039 C -1.41 14.039 -1.351 13.341 -1.301 13.051 C -1.261 12.831 -1.08 11.789 -1.08 11.789 C -1.03 11.419 -0.981 10.831 -1.131 10.461 C -1.301 10.051 -1.971 9.84 -2.461 9.74 C -9.661 8.8 -15 3.849 -15 -2.051 C -15 -8.641 -8.27 -14 0 -14 z" fill="#FFF"/></g></g></svg>',
        
        // 手记 - 与桌面一致
        'notes': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="notes-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFB6D9"/><stop offset="50%" stop-color="#FF8FAB"/><stop offset="100%" stop-color="#FF7AA2"/></linearGradient><clipPath id="notes-clip-store"><rect width="60" height="60" rx="13"/></clipPath></defs><rect width="60" height="60" rx="13" fill="url(#notes-bg-store)"/><g clip-path="url(#notes-clip-store)"><g transform="translate(48, 50) rotate(-15)"><rect x="-17" y="-22" width="34" height="44" rx="4" fill="#FFF"/><line x1="-10" y1="-6" x2="10" y2="-6" stroke="#FF8FAB" stroke-width="2" stroke-linecap="round"/><line x1="-10" y1="1" x2="7" y2="1" stroke="#FFB6D9" stroke-width="2" stroke-linecap="round"/><line x1="-10" y1="8" x2="3" y2="8" stroke="#FFB6D9" stroke-width="2" stroke-linecap="round"/></g></g></svg>',
        
        // 微博 - 与桌面一致
        'weibo': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="weibo-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFF3E0"/><stop offset="50%" stop-color="#FFE0B2"/><stop offset="100%" stop-color="#FFCC80"/></linearGradient></defs><rect width="60" height="60" rx="13" fill="url(#weibo-bg-store)"/></svg>',
        
        // 偶像养成 - 与桌面一致
        'idolcareer': '<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="idol-bg-store" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9333EA"/><stop offset="50%" stop-color="#C084FC"/><stop offset="100%" stop-color="#E879F9"/></linearGradient><filter id="idol-glow-store"><feGaussianBlur stdDeviation="0.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="60" height="60" rx="13" fill="url(#idol-bg-store)"/><path d="M30 12 L30 44 M24 44 L36 44 L36 48 L24 48 Z" stroke="rgba(255,255,255,0.95)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="30" cy="18" rx="10" ry="6" fill="rgba(255,255,255,0.9)"/><circle cx="30" cy="30" r="3" fill="rgba(255,255,255,0.9)"/><path d="M12 18 Q30 8 48 18" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" stroke-linecap="round"/><path d="M8 28 Q30 18 52 28" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="14" r="2" fill="rgba(255,255,255,0.8)"/><circle cx="42" cy="14" r="2" fill="rgba(255,255,255,0.8)"/></svg>'
    };

    function AppStoreApp() {
        EnhancedApp.call(this, {
            id: 'appstore-app',
            name: 'App Store',
            color: '#F2F2F7',
            barStyle: 'dark',
            tabs: [
                { name: '今天', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>', content: '' },
                { name: '游戏', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M21.58 16.09l-1.09-7.66A3.996 3.996 0 0016.53 5H7.47a3.996 3.996 0 00-3.96 3.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4 1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2-3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>', content: '' },
                { name: 'App', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>', content: '' }
            ]
        });
        
        this.currentTabIndex = 0;
        this.apps = this.getAppsData();
        this.installedApps = {};
    }

    AppStoreApp.prototype = Object.create(EnhancedApp.prototype);
    AppStoreApp.prototype.constructor = AppStoreApp;

    // ============ 系统应用数据（与桌面同步）============
    AppStoreApp.prototype.getAppsData = function() {
        return [
            {
                id: 'chat-app',
                name: 'murmurr',
                subtitle: '与AI伙伴聊天',
                developer: 'XiaoTing Studio',
                category: '社交',
                categoryTag: 'social',
                rating: 4.9,
                ratingsCount: '2.8万',
                size: '45.2',
                age: '12+',
                rank: 1,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.murmurr),
                screenshots: [
                    'linear-gradient(180deg, #b8e0f7 0%, #8ecae6 100%)',
                    'linear-gradient(180deg, #E8F2FF 0%, #FFF5F7 100%)',
                    'linear-gradient(180deg, #b8e0f7 0%, #8ecae6 100%)'
                ],
                description: 'murmurr 是一款智能聊天应用，让你与各种独特的AI角色进行深度对话。\n\n【主要功能】\n• 多样AI角色：每个角色都有独特的性格和故事背景\n• 实时对话：流畅的聊天体验，AI即时回复\n• 朋友圈动态：查看AI好友的日常分享\n• 通讯录管理：管理你的AI好友列表\n• 消息设置：自定义回复模式和消息提醒',
                whatsNew: '本次更新：\n- 新增多位AI角色\n- 优化对话体验\n- 修复已知问题',
                whatsNewDate: '1周前',
                version: '2.1.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'dream-weaver-app',
                name: '梦境编织',
                subtitle: 'AI互动剧情体验',
                developer: 'XiaoTing Studio',
                category: '娱乐',
                categoryTag: 'entertainment',
                rating: 4.8,
                ratingsCount: '1.5万',
                size: '128.6',
                age: '12+',
                rank: 2,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.dreamweaver),
                screenshots: [
                    'linear-gradient(180deg, #1a1035 0%, #2d1b4e 100%)',
                    'linear-gradient(180deg, #9D4EDD 0%, #FF6B9D 100%)',
                    'linear-gradient(180deg, #2d1b4e 0%, #1a1035 100%)'
                ],
                description: '梦境编织是一款沉浸式AI互动故事应用。\n\n【主要功能】\n• AI驱动剧情：每次体验都是独特的故事\n• 多重结局：你的选择决定故事走向\n• 精美场景：身临其境的视觉体验\n• 角色互动：与故事角色深度交流\n• 剧本编辑：创作属于你的故事',
                whatsNew: '本次更新：\n- 新增多个主题场景\n- 优化剧情生成算法\n- 界面视觉升级',
                whatsNewDate: '3天前',
                version: '3.2.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: true,
                isGame: false
            },
            {
                id: 'music-app',
                name: 'echooo',
                subtitle: '发现你的专属音乐',
                developer: 'XiaoTing Studio',
                category: '音乐',
                categoryTag: 'music',
                rating: 4.7,
                ratingsCount: '8562',
                size: '62.4',
                age: '4+',
                rank: 3,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.music),
                screenshots: [
                    'linear-gradient(180deg, #FFB6D9 0%, #FFC2E2 100%)',
                    'linear-gradient(180deg, #fff5f8 0%, #ffffff 100%)',
                    'linear-gradient(180deg, #FFB6D9 0%, #FFC2E2 100%)'
                ],
                description: 'echooo 音乐应用，让你随时随地享受音乐。\n\n【主要功能】\n• 歌曲播放：流畅的音乐播放体验\n• 歌单管理：创建和管理你的歌单\n• 音乐发现：发现热门和推荐音乐\n• 歌词显示：同步显示歌词\n• 播放控制：灵动岛音乐控制',
                whatsNew: '本次更新：\n- 优化播放性能\n- 新增更多歌曲',
                whatsNewDate: '5天前',
                version: '1.8.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'shop-app',
                name: '韩味购物',
                subtitle: '简约生活美学',
                developer: 'XiaoTing Studio',
                category: '购物',
                categoryTag: 'shopping',
                rating: 4.6,
                ratingsCount: '6234',
                size: '78.9',
                age: '4+',
                rank: 4,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.shop),
                screenshots: [
                    'linear-gradient(180deg, #fee1ef 0%, #dffbea 100%)',
                    'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
                    'linear-gradient(180deg, #dffbea 0%, #fee1ef 100%)'
                ],
                description: '韩味购物，无印良品风格的购物体验。\n\n【主要功能】\n• 精选商品：高品质韩风商品\n• 外卖服务：美食配送到家\n• 购物车：便捷的购物流程\n• 订单管理：追踪你的订单\n• 个人钱包：账户余额管理',
                whatsNew: '本次更新：\n- 新增更多商品\n- 优化购物体验',
                whatsNewDate: '1周前',
                version: '2.3.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: true,
                isGame: false
            },
            {
                id: 'weather-app',
                name: '天气',
                subtitle: '精准天气预报',
                developer: 'XiaoTing Studio',
                category: '天气',
                categoryTag: 'weather',
                rating: 4.8,
                ratingsCount: '3892',
                size: '28.5',
                age: '4+',
                rank: 5,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.weather),
                screenshots: [
                    'linear-gradient(180deg, #4A95DA 0%, #3D8BD4 100%)',
                    'linear-gradient(180deg, #67B8DE 0%, #4A90D9 100%)',
                    'linear-gradient(180deg, #3D8BD4 0%, #4A95DA 100%)'
                ],
                description: '天气应用，让你随时掌握天气动态。\n\n【主要功能】\n• 实时天气：准确的天气信息\n• 多城市：管理多个城市天气\n• 天气动画：精美的天气动效\n• 天气搜索：搜索任意城市\n• 详细信息：温度、湿度、风力等',
                whatsNew: '本次更新：\n- 优化天气数据\n- 新增天气动画',
                whatsNewDate: '2周前',
                version: '1.2.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'sms-app',
                name: 'Qmessage',
                subtitle: '简洁短信体验',
                developer: 'XiaoTing Studio',
                category: '工具',
                categoryTag: 'utilities',
                rating: 4.4,
                ratingsCount: '2156',
                size: '22.1',
                age: '4+',
                rank: 6,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.sms),
                screenshots: [
                    'linear-gradient(180deg, #A8E6CF 0%, #56CCF2 100%)',
                    'linear-gradient(180deg, #E8F2FF 0%, #FFF5F7 100%)',
                    'linear-gradient(180deg, #56CCF2 0%, #A8E6CF 100%)'
                ],
                description: 'Qmessage 短信应用，简洁优雅的短信体验。\n\n【主要功能】\n• 短信管理：管理所有短信对话\n• AI短信：接收AI角色的短信\n• 头像框：自定义头像装饰\n• 神秘消息：有趣的神秘来电\n• 同步设置：与聊天应用联动',
                whatsNew: '本次更新：\n- 新增头像框\n- 优化界面设计',
                whatsNewDate: '1周前',
                version: '1.3.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'job-app',
                name: '求职助手',
                subtitle: '找到理想工作',
                developer: 'XiaoTing Studio',
                category: '商务',
                categoryTag: 'business',
                rating: 4.3,
                ratingsCount: '1892',
                size: '34.7',
                age: '4+',
                rank: 7,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.job),
                screenshots: [
                    'linear-gradient(180deg, #b8e0f7 0%, #8ecae6 100%)',
                    'linear-gradient(180deg, #5eb8d9 0%, #8ecae6 100%)',
                    'linear-gradient(180deg, #8ecae6 0%, #b8e0f7 100%)'
                ],
                description: '求职助手，帮助你管理求职过程。\n\n【主要功能】\n• 职位浏览：发现心仪的工作\n• 简历管理：创建和管理简历\n• 面试日程：追踪面试安排\n• 薪资计算：薪资对比工具\n• 求职统计：追踪求职进度',
                whatsNew: '本次更新：\n- 新增更多职位\n- 优化搜索功能',
                whatsNewDate: '5天前',
                version: '1.1.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'system-config-app',
                name: 'nook',
                subtitle: '系统设置中心',
                developer: 'XiaoTing Studio',
                category: '工具',
                categoryTag: 'utilities',
                rating: 4.9,
                ratingsCount: '5623',
                size: '18.2',
                age: '4+',
                rank: 8,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.nook),
                screenshots: [
                    'linear-gradient(180deg, #FFB6C1 0%, #FF69B4 100%)',
                    'linear-gradient(180deg, #FF8FAB 0%, #FFB6C1 100%)',
                    'linear-gradient(180deg, #FF69B4 0%, #FF8FAB 100%)'
                ],
                description: 'nook 是系统的核心设置中心。\n\n【主要功能】\n• 系统设置：管理所有系统选项\n• AI管理：管理AI角色设置\n• 主题设置：自定义界面主题\n• 数据管理：备份和恢复数据\n• 关于系统：查看系统信息',
                whatsNew: '本次更新：\n- 优化设置界面\n- 新增更多选项',
                whatsNewDate: '3天前',
                version: '2.0.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'jelly-snake',
                name: '果冻蛇',
                subtitle: '解压益智游戏',
                developer: 'XiaoTing Studio',
                category: '游戏',
                categoryTag: 'games',
                rating: 4.7,
                ratingsCount: '12580',
                size: '42.8',
                age: '4+',
                rank: 1,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.jellysnake),
                screenshots: [
                    'linear-gradient(180deg, #FFB6D9 0%, #FF8FAB 100%)',
                    'linear-gradient(180deg, #FF8FAB 0%, #FF7AA2 100%)',
                    'linear-gradient(180deg, #FF7AA2 0%, #FFB6D9 100%)'
                ],
                description: '果冻蛇，一款结合贪吃蛇和2048的解压游戏。\n\n【游戏特色】\n• 物理引擎：柔软的果冻物理效果\n• 2048玩法：相同数字合并升级\n• 多种模式：普通模式和无尽模式\n• 排行榜：挑战最高分数\n• 简约设计：清新的视觉风格',
                whatsNew: '本次更新：\n- 新增无尽模式\n- 优化游戏手感',
                whatsNewDate: '2天前',
                version: '3.2.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: true
            },
            {
                id: 'widget-manager-app',
                name: '小组件',
                subtitle: '桌面小组件管理',
                developer: 'XiaoTing Studio',
                category: '工具',
                categoryTag: 'utilities',
                rating: 4.6,
                ratingsCount: '2845',
                size: '12.3',
                age: '4+',
                rank: 9,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.widget),
                screenshots: [
                    'linear-gradient(180deg, #A8E6CF 0%, #56CCF2 100%)',
                    'linear-gradient(180deg, #56CCF2 0%, #A8E6CF 100%)',
                    'linear-gradient(180deg, #A8E6CF 0%, #56CCF2 100%)'
                ],
                description: '小组件管理器，自定义你的桌面。\n\n【主要功能】\n• 小组件库：多种实用小组件\n• 自定义布局：灵活的布局设置\n• 快捷操作：一键访问常用功能\n• 样式设置：自定义组件样式',
                whatsNew: '本次更新：\n- 新增更多小组件\n- 优化管理界面',
                whatsNewDate: '4天前',
                version: '1.2.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'bubble-editor-app',
                name: '气泡编辑',
                subtitle: '自定义聊天气泡',
                developer: 'XiaoTing Studio',
                category: '工具',
                categoryTag: 'utilities',
                rating: 4.5,
                ratingsCount: '3156',
                size: '15.8',
                age: '4+',
                rank: 10,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.bubbleeditor),
                screenshots: [
                    'linear-gradient(180deg, #A8E6CF 0%, #7DD3B0 100%)',
                    'linear-gradient(180deg, #7DD3B0 0%, #5BC4A0 100%)',
                    'linear-gradient(180deg, #5BC4A0 0%, #A8E6CF 100%)'
                ],
                description: '气泡编辑器，自定义你的聊天气泡样式。\n\n【主要功能】\n• 气泡样式：多种气泡模板\n• 颜色定制：自定义气泡颜色\n• 边框效果：丰富的边框样式\n• 预览功能：实时预览效果\n• 导出分享：分享你的设计',
                whatsNew: '本次更新：\n- 新增更多气泡模板\n- 优化编辑体验',
                whatsNewDate: '1周前',
                version: '1.1.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'notes-app',
                name: '手记',
                subtitle: '简约笔记应用',
                developer: 'XiaoTing Studio',
                category: '效率',
                categoryTag: 'productivity',
                rating: 4.6,
                ratingsCount: '4521',
                size: '18.5',
                age: '4+',
                rank: 11,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.notes),
                screenshots: [
                    'linear-gradient(180deg, #FFE0EC 0%, #FFB6D9 100%)',
                    'linear-gradient(180deg, #FF8FAB 0%, #FF7AA2 100%)',
                    'linear-gradient(180deg, #FFB6D9 0%, #FFE0EC 100%)'
                ],
                description: '手记，简约优雅的笔记应用。\n\n【主要功能】\n• 快速记录：轻松记录灵感\n• 分类管理：整理你的笔记\n• 搜索功能：快速查找内容\n• 云端同步：数据安全备份\n• 清新界面：舒适的书写体验',
                whatsNew: '本次更新：\n- 新增标签功能\n- 优化编辑体验',
                whatsNewDate: '3天前',
                version: '1.3.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: false,
                isGame: false
            },
            {
                id: 'weibo-app',
                name: '微博',
                subtitle: '发现热门话题',
                developer: 'XiaoTing Studio',
                category: '社交',
                categoryTag: 'social',
                rating: 4.4,
                ratingsCount: '8.5万',
                size: '85.2',
                age: '12+',
                rank: 12,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.weibo),
                screenshots: [
                    'linear-gradient(180deg, #FF6B6B 0%, #E8454A 100%)',
                    'linear-gradient(180deg, #E8454A 0%, #D63031 100%)',
                    'linear-gradient(180deg, #D63031 0%, #FF6B6B 100%)'
                ],
                description: '微博，发现热门话题和有趣内容。\n\n【主要功能】\n• 热门话题：实时热搜榜单\n• 动态发布：分享你的生活\n• 关注好友：追踪感兴趣的人\n• 互动评论：与大家交流\n• 消息通知：及时获取回复',
                whatsNew: '本次更新：\n- 新增超话功能\n- 优化加载速度',
                whatsNewDate: '2天前',
                version: '12.5.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: true,
                isGame: false
            },
            {
                id: 'idol-career-app',
                name: '偶像养成',
                subtitle: '打造你的偶像之路',
                developer: 'XiaoTing Studio',
                category: '游戏',
                categoryTag: 'games',
                rating: 4.7,
                ratingsCount: '2.3万',
                size: '156.8',
                age: '12+',
                rank: 2,
                price: '免费',
                icon: 'data:image/svg+xml,' + encodeURIComponent(APP_ICONS.idolcareer),
                screenshots: [
                    'linear-gradient(180deg, #9333EA 0%, #C084FC 100%)',
                    'linear-gradient(180deg, #C084FC 0%, #E879F9 100%)',
                    'linear-gradient(180deg, #E879F9 0%, #9333EA 100%)'
                ],
                description: '偶像养成，打造属于你的偶像之路。\n\n【游戏特色】\n• 偶像培养：训练和提升偶像能力\n• 演出舞台：参加各种演出活动\n• 粉丝互动：与粉丝建立联系\n• 时尚穿搭：为偶像设计造型\n• 剧情故事：体验精彩的成长故事',
                whatsNew: '本次更新：\n- 新增演唱会玩法\n- 新增限定服装',
                whatsNewDate: '1周前',
                version: '2.8.0',
                languages: '简体中文',
                developerInfo: {
                    name: 'XiaoTing Studio',
                    website: 'xiaoting.app',
                    privacy: '隐私政策'
                },
                inAppPurchases: true,
                isGame: true
            }
        ];
    };

    AppStoreApp.prototype.render = function() {
        var self = this;
        
        var win = document.createElement('div');
        win.className = 'app-window hidden';
        win.style.background = '#F2F2F7';
        
        var tabBarHtml = '<div class="app-tab-bar" style="background:rgba(249,249,249,0.94);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:0.5px solid rgba(0,0,0,0.1);">';
        this.tabs.forEach(function(tab, index) {
            var activeClass = index === 0 ? 'active' : '';
            var color = index === 0 ? '#FF69B4' : '#8E8E93';
            tabBarHtml += '<div class="app-tab-item ' + activeClass + '" data-index="' + index + '" style="color:' + color + ';">' +
                '<span class="tab-icon" style="font-size:22px;">' + tab.icon + '</span>' +
                '<span style="font-size:10px;margin-top:2px;">' + tab.name + '</span>' +
            '</div>';
        });
        tabBarHtml += '</div>';
        
        var html = '';
        html += '<div class="app-status-bar-gap"></div>';
        html += '<div class="app-page-stack">';
        html += '<div class="app-content-page" id="main-content-area" style="overflow-y:auto;-webkit-overflow-scrolling:touch;">';
        html += this.renderTabContent(0);
        html += '</div>';
        html += '</div>';
        html += tabBarHtml;
        html += '<div class="home-indicator" style="background-color:rgba(0,0,0,0.3);"></div>';
        html += '<div class="home-indicator-area"></div>';
        
        win.innerHTML = html;
        document.getElementById('appContainer').appendChild(win);
        this.appWindow = win;
        this.windowCache = true;
        
        this.bindTabEvents();
        this.bindHomeIndicatorEvents();
        this.bindCurrentTabEvents(0);
        this.loadInstalledApps();
    };

    AppStoreApp.prototype.bindTabEvents = function() {
        var self = this;
        var tabItems = this.appWindow.querySelectorAll('.app-tab-item');
        var contentArea = this.appWindow.querySelector('#main-content-area');
        
        tabItems.forEach(function(item, index) {
            item.onclick = function(e) {
                e.stopPropagation();
                if (index === self.currentTabIndex) return;
                
                tabItems.forEach(function(t) {
                    t.classList.remove('active');
                    t.style.color = '#8E8E93';
                });
                item.classList.add('active');
                item.style.color = '#FF69B4';
                
                contentArea.innerHTML = self.renderTabContent(index);
                contentArea.scrollTop = 0;
                self.currentTabIndex = index;
                self.bindCurrentTabEvents(index);
            };
        });
    };

    AppStoreApp.prototype.renderTabContent = function(tabIndex) {
        switch(tabIndex) {
            case 0: return this.renderTodayTab();
            case 1: return this.renderGamesTab();
            case 2: return this.renderAppsTab();
            default: return '';
        }
    };

    AppStoreApp.prototype.renderTodayTab = function() {
        var self = this;
        var html = '';
        
        html += '<div style="padding:20px 20px 10px;">';
        html += '<div style="font-size:11px;color:#8E8E93;font-weight:600;text-transform:uppercase;">' + this.getTodayDate() + '</div>';
        html += '<div style="font-size:34px;font-weight:700;margin-top:2px;">今天</div>';
        html += '</div>';
        
        // 精选应用卡片
        html += '<div style="padding:0 20px 20px;">';
        html += this.renderFeaturedCard(this.apps[0]); // murmurr
        html += '</div>';
        
        html += '<div style="padding:0 20px 20px;">';
        html += this.renderFeaturedCard(this.apps[1]); // 梦境编织
        html += '</div>';
        
        // 精选游戏
        var gameApp = this.apps.find(function(a) { return a.isGame; });
        if (gameApp) {
            html += '<div style="padding:0 20px 20px;">';
            html += this.renderFeaturedCard(gameApp);
            html += '</div>';
        }
        
        html += '<div style="height:100px;"></div>';
        
        return html;
    };

    AppStoreApp.prototype.renderFeaturedCard = function(app) {
        var html = '';
        html += '<div class="featured-card" data-appid="' + app.id + '" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);cursor:pointer;">';
        html += '<div style="height:220px;background:' + app.screenshots[0] + ';display:flex;align-items:center;justify-content:center;position:relative;">';
        html += '<img src="' + app.icon + '" style="width:80px;height:80px;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.2);">';
        html += '<div style="position:absolute;top:15px;left:15px;font-size:11px;color:rgba(255,255,255,0.9);font-weight:600;text-transform:uppercase;">' + (app.isGame ? '精选游戏' : '精选 APP') + '</div>';
        html += '</div>';
        html += '<div style="padding:12px 15px;display:flex;align-items:center;gap:12px;">';
        html += '<img src="' + app.icon + '" style="width:48px;height:48px;border-radius:11px;">';
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-size:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + app.name + '</div>';
        html += '<div style="font-size:13px;color:#8E8E93;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + app.subtitle + '</div>';
        html += '</div>';
        html += this.renderGetButton(app);
        html += '</div>';
        html += '</div>';
        return html;
    };

    AppStoreApp.prototype.renderGamesTab = function() {
        var self = this;
        var html = '';
        
        html += '<div style="padding:20px;">';
        html += '<div style="font-size:34px;font-weight:700;">游戏</div>';
        html += '</div>';
        
        // 筛选出游戏应用
        var games = this.apps.filter(function(app) { return app.isGame; });
        
        if (games.length > 0) {
            html += '<div style="padding:0 20px 15px;">';
            html += '<div style="font-size:20px;font-weight:700;">热门游戏</div>';
            html += '</div>';
            
            html += '<div style="padding:0 20px;">';
            html += '<div style="background:white;border-radius:12px;overflow:hidden;">';
            games.forEach(function(app, index) {
                html += self.renderAppListItem(app, index);
            });
            html += '</div>';
            html += '</div>';
        } else {
            html += '<div style="padding:0 20px;">';
            html += '<div style="background:white;border-radius:12px;padding:20px;text-align:center;color:#8E8E93;">';
            html += '<div style="margin-bottom:10px;"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#8E8E93"><path d="M21.58 16.09l-1.09-7.66A3.996 3.996 0 0016.53 5H7.47a3.996 3.996 0 00-3.96 3.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4 1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2-3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg></div>';
            html += '<div>暂无游戏推荐</div>';
            html += '</div>';
            html += '</div>';
        }
        
        html += '<div style="height:100px;"></div>';
        return html;
    };

    AppStoreApp.prototype.renderAppsTab = function() {
        var self = this;
        var html = '';
        
        html += '<div style="padding:20px 20px 15px;">';
        html += '<div style="font-size:34px;font-weight:700;">App</div>';
        html += '</div>';
        
        // 筛选非游戏应用
        var nonGameApps = this.apps.filter(function(app) { return !app.isGame; });
        
        html += '<div style="padding:0 20px 15px;">';
        html += '<div style="font-size:20px;font-weight:700;">热门免费 App</div>';
        html += '</div>';
        
        html += '<div style="padding:0 20px;">';
        html += '<div style="background:white;border-radius:12px;overflow:hidden;">';
        nonGameApps.forEach(function(app, index) {
            html += self.renderAppListItem(app, index);
        });
        html += '</div>';
        html += '</div>';
        
        html += '<div style="height:100px;"></div>';
        return html;
    };

    AppStoreApp.prototype.renderAppListItem = function(app, index) {
        var html = '';
        var borderStyle = index < this.apps.length - 1 ? 'border-bottom:0.5px solid #E5E5EA;' : '';
        
        html += '<div class="app-list-item" data-appid="' + app.id + '" style="display:flex;align-items:center;padding:12px 15px;' + borderStyle + 'cursor:pointer;">';
        html += '<div style="font-size:18px;font-weight:500;color:#8E8E93;width:24px;text-align:center;margin-right:12px;">' + app.rank + '</div>';
        html += '<img src="' + app.icon + '" style="width:62px;height:62px;border-radius:14px;margin-right:12px;">';
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-size:16px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + app.name + '</div>';
        html += '<div style="font-size:13px;color:#8E8E93;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + app.subtitle + '</div>';
        html += '</div>';
        html += this.renderGetButton(app);
        html += '</div>';
        
        return html;
    };

    AppStoreApp.prototype.renderGetButton = function(app) {
        var isInstalled = this.installedApps[app.id];
        if (isInstalled) {
            return '<button class="open-btn" data-appid="' + app.id + '" style="padding:6px 18px;background:#E5E5EA;color:#FF69B4;border:none;border-radius:15px;font-size:15px;font-weight:600;cursor:pointer;min-width:70px;">打开</button>';
        }
        return '<button class="get-btn" data-appid="' + app.id + '" style="padding:6px 18px;background:linear-gradient(135deg,#FF69B4,#FF8FAB);color:white;border:none;border-radius:15px;font-size:15px;font-weight:600;cursor:pointer;min-width:70px;">获取</button>';
    };

    AppStoreApp.prototype.renderStars = function(rating) {
        var html = '<div style="display:flex;gap:1px;">';
        var fullStars = Math.floor(rating);
        var hasHalf = rating % 1 >= 0.5;
        
        for (var i = 0; i < 5; i++) {
            if (i < fullStars) {
                html += '<span style="color:#FF69B4;font-size:10px;">★</span>';
            } else if (i === fullStars && hasHalf) {
                html += '<span style="color:#FF69B4;font-size:10px;">★</span>';
            } else {
                html += '<span style="color:#D1D1D6;font-size:10px;">★</span>';
            }
        }
        html += '</div>';
        return html;
    };

    AppStoreApp.prototype.bindCurrentTabEvents = function(tabIndex) {
        var self = this;
        var contentArea = this.appWindow.querySelector('#main-content-area');
        
        var featuredCards = contentArea.querySelectorAll('.featured-card');
        featuredCards.forEach(function(card) {
            card.onclick = function(e) {
                if (e.target.classList.contains('get-btn') || e.target.classList.contains('open-btn')) return;
                var appId = card.getAttribute('data-appid');
                self.openAppDetail(appId);
            };
        });
        
        var appItems = contentArea.querySelectorAll('.app-list-item');
        appItems.forEach(function(item) {
            item.onclick = function(e) {
                if (e.target.classList.contains('get-btn') || e.target.classList.contains('open-btn')) return;
                var appId = item.getAttribute('data-appid');
                self.openAppDetail(appId);
            };
        });
        
        var getBtns = contentArea.querySelectorAll('.get-btn');
        getBtns.forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var appId = btn.getAttribute('data-appid');
                self.installApp(appId, btn);
            };
        });
        
        var openBtns = contentArea.querySelectorAll('.open-btn');
        openBtns.forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var appId = btn.getAttribute('data-appid');
                self.openApp(appId);
            };
        });
    };

    AppStoreApp.prototype.openApp = function(appId) {
        // 尝试打开对应的应用
        if (typeof PhoneCore !== 'undefined' && PhoneCore.openApp) {
            PhoneCore.openApp(appId);
        } else {
            this.notifyInfo('正在打开应用...');
        }
    };

    AppStoreApp.prototype.openAppDetail = function(appId) {
        var self = this;
        var app = this.apps.find(function(a) { return a.id === appId; });
        if (!app) return;
        
        var html = this.renderAppDetailPage(app);
        var page = this.openDetailPage(html, { background: '#FFFFFF', enableHomeIndicator: true });
        this.bindDetailPageEvents(page, app);
    };

    AppStoreApp.prototype.renderAppDetailPage = function(app) {
        var self = this;
        var html = '';
        
        html += '<div style="padding:20px;padding-bottom:0;">';
        html += '<div style="display:flex;gap:15px;">';
        html += '<img src="' + app.icon + '" style="width:118px;height:118px;border-radius:26px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
        html += '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;">';
        html += '<div style="font-size:22px;font-weight:600;line-height:1.2;">' + app.name + '</div>';
        html += '<div style="font-size:14px;color:#8E8E93;margin-top:4px;">' + app.subtitle + '</div>';
        html += '<div style="margin-top:12px;">';
        html += this.renderDetailGetButton(app);
        html += '</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<div style="display:flex;padding:20px;gap:0;border-bottom:0.5px solid #E5E5EA;overflow-x:auto;">';
        html += '<div style="flex:1;text-align:center;min-width:80px;border-right:0.5px solid #E5E5EA;">';
        html += '<div style="font-size:11px;color:#8E8E93;margin-bottom:4px;">' + app.ratingsCount + ' 个评分</div>';
        html += '<div style="font-size:18px;font-weight:700;">' + app.rating + '</div>';
        html += '<div style="display:flex;justify-content:center;gap:1px;margin-top:2px;">' + this.renderStarsSmall(app.rating) + '</div>';
        html += '</div>';
        html += '<div style="flex:1;text-align:center;min-width:80px;border-right:0.5px solid #E5E5EA;">';
        html += '<div style="font-size:11px;color:#8E8E93;margin-bottom:4px;">年龄</div>';
        html += '<div style="font-size:18px;font-weight:700;">' + app.age + '</div>';
        html += '<div style="font-size:11px;color:#8E8E93;margin-top:2px;">岁</div>';
        html += '</div>';
        html += '<div style="flex:1;text-align:center;min-width:80px;border-right:0.5px solid #E5E5EA;">';
        html += '<div style="font-size:11px;color:#8E8E93;margin-bottom:4px;">排行榜</div>';
        html += '<div style="font-size:18px;font-weight:700;">#' + app.rank + '</div>';
        html += '<div style="font-size:11px;color:#8E8E93;margin-top:2px;">' + app.category + '</div>';
        html += '</div>';
        html += '<div style="flex:1;text-align:center;min-width:80px;">';
        html += '<div style="font-size:11px;color:#8E8E93;margin-bottom:4px;">开发者</div>';
        html += '<div style="font-size:18px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#8E8E93"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>';
        html += '<div style="font-size:11px;color:#8E8E93;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 5px;">' + app.developer + '</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<div style="padding:20px;border-bottom:0.5px solid #E5E5EA;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
        html += '<div style="font-size:20px;font-weight:700;">预览</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:10px;-webkit-overflow-scrolling:touch;">';
        app.screenshots.forEach(function(bg, index) {
            html += '<div style="flex-shrink:0;width:220px;height:390px;background:' + bg + ';border-radius:20px;display:flex;align-items:center;justify-content:center;">';
            html += '<div style="color:white;font-size:14px;opacity:0.8;">预览 ' + (index + 1) + '</div>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
        
        html += '<div style="padding:20px;border-bottom:0.5px solid #E5E5EA;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">';
        html += '<div style="font-size:20px;font-weight:700;">新功能</div>';
        html += '<div style="font-size:14px;color:#8E8E93;">' + app.whatsNewDate + '</div>';
        html += '</div>';
        html += '<div style="font-size:13px;color:#8E8E93;margin-bottom:8px;">版本 ' + app.version + '</div>';
        html += '<div id="whats-new-content" style="font-size:15px;line-height:1.5;color:#000;">';
        html += '<div class="whats-new-text" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + app.whatsNew.replace(/\n/g, '<br>') + '</div>';
        html += '<div class="whats-new-expand" style="color:#FF69B4;margin-top:8px;cursor:pointer;display:block;">更多</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<div style="padding:20px;border-bottom:0.5px solid #E5E5EA;">';
        html += '<div style="font-size:20px;font-weight:700;margin-bottom:15px;">描述</div>';
        html += '<div id="description-content">';
        html += '<div class="description-text" style="font-size:15px;line-height:1.6;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;">' + app.description + '</div>';
        html += '<div class="description-expand" style="color:#FF69B4;margin-top:8px;cursor:pointer;display:block;">更多</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<div style="padding:20px;border-bottom:0.5px solid #E5E5EA;">';
        html += this.renderInfoRow('开发者', app.developerInfo.name, '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#8E8E93"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>');
        html += '</div>';
        
        html += '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:700;margin-bottom:15px;">信息</div>';
        html += this.renderInfoItem('供应商', app.developerInfo.name);
        html += this.renderInfoItem('大小', app.size + ' MB');
        html += this.renderInfoItem('类别', app.category);
        html += this.renderInfoItem('兼容性', 'XiaoTing Phone');
        html += this.renderInfoItem('语言', app.languages);
        html += this.renderInfoItem('年龄分级', app.age);
        if (app.inAppPurchases) {
            html += this.renderInfoItem('App 内购买', '是');
        }
        html += this.renderInfoItem('价格', app.price);
        html += '</div>';
        
        html += '<div style="height:50px;"></div>';
        
        return html;
    };

    AppStoreApp.prototype.renderDetailGetButton = function(app) {
        var isInstalled = this.installedApps[app.id];
        if (isInstalled) {
            return '<button class="detail-open-btn" data-appid="' + app.id + '" style="padding:8px 32px;background:#E5E5EA;color:#FF69B4;border:none;border-radius:18px;font-size:16px;font-weight:600;cursor:pointer;">打开</button>';
        }
        return '<button class="detail-get-btn" data-appid="' + app.id + '" style="padding:8px 32px;background:linear-gradient(135deg,#FF69B4,#FF8FAB);color:white;border:none;border-radius:18px;font-size:16px;font-weight:600;cursor:pointer;">获取</button>';
    };

    AppStoreApp.prototype.renderStarsSmall = function(rating) {
        var html = '';
        var fullStars = Math.floor(rating);
        for (var i = 0; i < 5; i++) {
            if (i < fullStars) {
                html += '<span style="color:#FF69B4;font-size:8px;">★</span>';
            } else {
                html += '<span style="color:#D1D1D6;font-size:8px;">★</span>';
            }
        }
        return html;
    };

    AppStoreApp.prototype.renderInfoRow = function(label, value, icon) {
        var html = '';
        html += '<div style="display:flex;align-items:center;gap:12px;cursor:pointer;">';
        html += '<div style="width:32px;height:32px;background:#E5E5EA;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;">' + icon + '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:13px;color:#8E8E93;">' + label + '</div>';
        html += '<div style="font-size:15px;color:#FF69B4;">' + value + '</div>';
        html += '</div>';
        html += '<span style="color:#C7C7CC;font-size:18px;">›</span>';
        html += '</div>';
        return html;
    };

    AppStoreApp.prototype.renderInfoItem = function(label, value) {
        var html = '';
        html += '<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:0.5px solid #E5E5EA;">';
        html += '<div style="font-size:15px;color:#8E8E93;">' + label + '</div>';
        html += '<div style="font-size:15px;color:#000;text-align:right;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + value + '</div>';
        html += '</div>';
        return html;
    };

    AppStoreApp.prototype.bindDetailPageEvents = function(page, app) {
        var self = this;
        
        var getBtn = page.querySelector('.detail-get-btn');
        if (getBtn) {
            getBtn.onclick = function(e) {
                e.stopPropagation();
                self.installApp(app.id, getBtn, true);
            };
        }
        
        var openBtn = page.querySelector('.detail-open-btn');
        if (openBtn) {
            openBtn.onclick = function(e) {
                e.stopPropagation();
                self.openApp(app.id);
            };
        }
        
        var whatsNewExpand = page.querySelector('.whats-new-expand');
        var whatsNewText = page.querySelector('.whats-new-text');
        if (whatsNewExpand && whatsNewText) {
            whatsNewExpand.onclick = function() {
                var isExpanded = whatsNewText.style.webkitLineClamp === 'unset';
                if (isExpanded) {
                    whatsNewText.style.webkitLineClamp = '3';
                    whatsNewText.style.display = '-webkit-box';
                    whatsNewExpand.textContent = '更多';
                } else {
                    whatsNewText.style.webkitLineClamp = 'unset';
                    whatsNewText.style.display = 'block';
                    whatsNewExpand.textContent = '收起';
                }
            };
        }
        
        var descExpand = page.querySelector('.description-expand');
        var descText = page.querySelector('.description-text');
        if (descExpand && descText) {
            descExpand.onclick = function() {
                var isExpanded = descText.style.webkitLineClamp === 'unset';
                if (isExpanded) {
                    descText.style.webkitLineClamp = '4';
                    descText.style.display = '-webkit-box';
                    descExpand.textContent = '更多';
                } else {
                    descText.style.webkitLineClamp = 'unset';
                    descText.style.display = 'block';
                    descExpand.textContent = '收起';
                }
            };
        }
    };

    AppStoreApp.prototype.installApp = function(appId, btn, isDetailPage) {
        var self = this;
        var app = this.apps.find(function(a) { return a.id === appId; });
        if (!app) return;
        
        var originalText = btn.textContent;
        var originalBg = btn.style.background;
        var originalColor = btn.style.color;
        
        btn.disabled = true;
        btn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 1s linear infinite;"></span>';
        btn.style.background = 'linear-gradient(135deg,#FF69B4,#FF8FAB)';
        btn.style.color = 'white';
        
        if (!document.querySelector('#app-store-spinner-style')) {
            var style = document.createElement('style');
            style.id = 'app-store-spinner-style';
            style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        
        setTimeout(function() {
            self.installedApps[appId] = true;
            self.saveInstalledApps();
            
            btn.disabled = false;
            btn.textContent = '打开';
            btn.style.background = '#E5E5EA';
            btn.style.color = '#FF69B4';
            btn.classList.remove('get-btn', 'detail-get-btn');
            btn.classList.add(isDetailPage ? 'detail-open-btn' : 'open-btn');
            
            btn.onclick = function(e) {
                e.stopPropagation();
                self.openApp(appId);
            };
            
            self.notifySuccess(app.name + ' 已安装');
            self.refreshCurrentTab();
        }, 2000);
    };

    AppStoreApp.prototype.refreshCurrentTab = function() {
        var contentArea = this.appWindow.querySelector('#main-content-area');
        if (contentArea) {
            contentArea.innerHTML = this.renderTabContent(this.currentTabIndex);
            this.bindCurrentTabEvents(this.currentTabIndex);
        }
    };

    AppStoreApp.prototype.loadInstalledApps = function() {
        var self = this;
        PhoneCore.db.get('app_data', 'appstore-installed').then(function(data) {
            if (data && data.apps) {
                self.installedApps = data.apps;
                self.refreshCurrentTab();
            }
        });
    };

    AppStoreApp.prototype.saveInstalledApps = function() {
        PhoneCore.db.put('app_data', {
            appId: 'appstore-installed',
            apps: this.installedApps
        });
    };

    AppStoreApp.prototype.getTodayDate = function() {
        var now = new Date();
        var weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        var month = now.getMonth() + 1;
        var day = now.getDate();
        return month + '月' + day + '日 ' + weekDays[now.getDay()];
    };

    global.AppStoreApp = AppStoreApp;

    EventBus.on('core:initialized', function() {
        var app = new AppStoreApp();
        PhoneCore.registerApp(app);
    });

})(window);
