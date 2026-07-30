
const MusicAppCSS = ` 
    .music-app-container { 
        background: linear-gradient(180deg, #fff5f8 0%, #ffffff 100%); 
        min-height: 100%; 
        padding-bottom: 85px; 
    } 
    .music-app-container::-webkit-scrollbar{display:none;} 
 
    .music-header { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        padding: 8px 20px 15px; 
    } 
    .music-header-title { 
        font-size: 28px; 
        font-weight: 700; 
        color: #1a1a1a; 
        letter-spacing: -0.5px; 
    } 
    .music-header-actions { 
        display: flex; 
        gap: 12px; 
    } 
    .music-header-btn { 
        width: 36px; 
        height: 36px; 
        border-radius: 50%; 
        background: rgba(251,114,153,0.1); 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
        transition: all 0.2s; 
    } 
    .music-header-btn:active { 
        transform: scale(0.92); 
        background: rgba(251,114,153,0.2); 
    } 
    .music-header-btn svg { 
        width: 18px; 
        height: 18px; 
        fill: #fb7299; 
    } 
    .music-search-bar { 
        margin: 0 20px 20px; 
        background: rgba(0,0,0,0.03); 
        border-radius: 14px; 
        padding: 12px 16px; 
        display: flex; 
        align-items: center; 
        gap: 10px; 
    } 
    .music-search-bar svg { 
        width: 18px; 
        height: 18px; 
        fill: #999; 
        flex-shrink: 0; 
    } 
    .music-search-bar input { 
        flex: 1; 
        border: none; 
        background: none; 
        font-size: 15px; 
        color: #333; 
        outline: none; 
    } 
    .music-search-bar input::placeholder { 
        color: #bbb; 
    } 
    .music-section { 
        margin-bottom: 25px; 
    } 
    .music-section-header { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        padding: 0 20px; 
        margin-bottom: 15px; 
    } 
    .music-section-title { 
        font-size: 20px; 
        font-weight: 700; 
        color: #1a1a1a; 
        letter-spacing: -0.3px; 
    } 
    .music-section-more { 
        font-size: 13px; 
        color: #fb7299; 
        cursor: pointer; 
    } 
    .music-playlist-scroll { 
        display: flex; 
        gap: 14px; 
        overflow-x: auto; 
        padding: 0 20px; 
        -webkit-overflow-scrolling: touch; 
        scrollbar-width: none; 
    } 
    .music-playlist-scroll::-webkit-scrollbar { 
        display: none; 
    } 
    .music-playlist-card { 
        flex-shrink: 0; 
        width: 120px; 
        cursor: pointer; 
    } 
    .music-playlist-card:active { 
        transform: scale(0.96); 
    } 
    .music-playlist-cover { 
        width: 120px; 
        height: 120px; 
        border-radius: 16px; 
        background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%); 
        margin-bottom: 10px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        overflow: hidden; 
        box-shadow: 0 6px 20px rgba(251,114,153,0.15); 
        position: relative; 
    } 
    .music-playlist-cover img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    } 
    .music-playlist-cover svg { 
        width: 36px; 
        height: 36px; 
        fill: rgb(255 255 255); 
    } 
    .music-playlist-cover-add { 
        background: rgba(251,114,153,0.08); 
        border: 2px dashed rgba(251,114,153,0.3); 
    } 
    .music-playlist-cover-add svg { 
        fill: rgba(251,114,153,0.5); 
    } 
    .music-playlist-name { 
        font-size: 14px; 
        font-weight: 600; 
        color: #1a1a1a; 
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis; 
    } 
    .music-playlist-count { 
        font-size: 12px; 
        color: #999; 
        margin-top: 3px; 
    } 
    .music-song-list { 
        padding: 0 20px; 
    } 
    .music-song-item { 
        display: flex; 
        align-items: center; 
        padding: 12px 0; 
        border-bottom: 1px solid rgba(0,0,0,0.04); 
        cursor: pointer; 
        transition: all 0.15s; 
    } 
    .music-song-item:last-child { 
        border-bottom: none; 
    } 
    .music-song-item:active { 
        background: rgba(251,114,153,0.05); 
        margin: 0 -20px; 
        padding: 12px 20px; 
    } 
    .music-song-cover { 
        width: 52px; 
        height: 52px; 
        border-radius: 12px; 
        overflow: hidden; 
        flex-shrink: 0; 
        margin-right: 14px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.08); 
    } 
    .music-song-cover img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    } 
    .music-song-cover-placeholder { 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
    } 
    .music-song-cover-placeholder svg { 
        width: 24px; 
        height: 24px; 
        fill: white; 
    } 
    .music-song-info { 
        flex: 1; 
        min-width: 0; 
    } 
    .music-song-name { 
        font-size: 15px; 
        font-weight: 600; 
        color: #1a1a1a; 
        margin-bottom: 4px; 
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis; 
    } 
    .music-song-artist { 
        font-size: 13px; 
        color: #999; 
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis; 
    } 
    .music-song-actions { 
        display: flex; 
        align-items: center; 
        gap: 8px; 
    } 
    .music-song-btn { 
        width: 32px; 
        height: 32px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
    } 
    .music-song-btn svg { 
        width: 20px; 
        height: 20px; 
        fill: #ccc; 
        transition: all 0.2s; 
    } 
    .music-song-btn.liked svg { 
        fill: #fb7299; 
    } 
    .music-song-btn:active svg { 
        transform: scale(0.85); 
    } 
    .music-song-play-btn { 
        width: 38px; 
        height: 38px; 
        border-radius: 50%; 
        background: linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%); 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        box-shadow: 0 4px 12px rgba(251,114,153,0.35); 
    } 
    .music-song-play-btn svg { 
        width: 16px; 
        height: 16px; 
        fill: white; 
        margin-left: 2px; 
    } 
    .music-fab { 
        position: fixed; 
        bottom: 80px; 
        right: 25px; 
        width: 52px; 
        height: 52px; 
        border-radius: 50%; 
        background: linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%); 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        box-shadow: 0 6px 20px rgba(251,114,153,0.4); 
        cursor: pointer; 
        z-index: 50; 
        transition: all 0.2s; 
    } 
    .music-fab:active { 
        transform: scale(0.92); 
    } 
    .music-fab svg { 
        width: 24px; 
        height: 24px; 
        fill: white; 
    } 
    .music-discover-grid { 
        display: grid; 
        grid-template-columns: repeat(2, 1fr); 
        gap: 14px; 
        padding: 0 20px; 
    } 
    .music-discover-card { 
        background: white; 
        border-radius: 18px; 
        padding: 18px; 
        cursor: pointer; 
        box-shadow: 0 2px 12px rgba(0,0,0,0.04); 
        transition: all 0.2s; 
    } 
    .music-discover-card:active { 
        transform: scale(0.97); 
    } 
    .music-discover-icon { 
        width: 44px; 
        height: 44px; 
        border-radius: 12px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        margin-bottom: 12px; 
    } 
    .music-discover-icon svg { 
        width: 22px; 
        height: 22px; 
        fill: white; 
    } 
    .music-discover-title { 
        font-size: 15px; 
        font-weight: 600; 
        color: #1a1a1a; 
        margin-bottom: 4px; 
    } 
    .music-discover-desc { 
        font-size: 12px; 
        color: #999; 
    } 
    .music-user-header { 
        text-align: center; 
        padding: 10px 20px 25px; 
    } 
    .music-user-avatar { 
        width: 80px; 
        height: 80px; 
        border-radius: 50%; 
        background: linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%); 
        margin: 0 auto 15px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        box-shadow: 0 8px 25px rgba(251,114,153,0.35); 
    } 
    .music-user-avatar svg { 
        width: 40px; 
        height: 40px; 
        fill: white; 
    } 
    .music-user-name { 
        font-size: 22px; 
        font-weight: 700; 
        color: #1a1a1a; 
        margin-bottom: 6px; 
    } 
    .music-user-bio { 
        font-size: 14px; 
        color: #999; 
    } 
    .music-user-stats { 
        display: flex; 
        justify-content: center; 
        gap: 50px; 
        padding: 20px; 
        margin: 0 20px 20px; 
        background: white; 
        border-radius: 20px; 
        box-shadow: 0 2px 12px rgba(0,0,0,0.04); 
    } 
    .music-user-stat { 
        text-align: center; 
    } 
    .music-user-stat-num { 
        font-size: 22px; 
        font-weight: 700; 
        color: #fb7299; 
    } 
    .music-user-stat-label { 
        font-size: 13px; 
        color: #999; 
        margin-top: 4px; 
    } 
    .music-menu-list { 
        padding: 0 20px; 
    } 
    .music-menu-item { 
        display: flex; 
        align-items: center; 
        padding: 16px; 
        background: white; 
        border-radius: 16px; 
        margin-bottom: 10px; 
        cursor: pointer; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.03); 
        transition: all 0.2s; 
    } 
    .music-menu-item:active { 
        transform: scale(0.98); 
    } 
    .music-menu-icon { 
        width: 42px; 
        height: 42px; 
        border-radius: 12px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        margin-right: 14px; 
    } 
    .music-menu-icon svg { 
        width: 22px; 
        height: 22px; 
        fill: white; 
    } 
    .music-menu-text { 
        flex: 1; 
        font-size: 16px; 
        font-weight: 500; 
        color: #1a1a1a; 
    } 
    .music-menu-arrow { 
        color: #ddd; 
        font-size: 20px; 
    } 
    .music-player-page { 
        min-height: 100%; 
        display: flex; 
        flex-direction: column; 
        padding: 0 25px 25px;
        --theme-color: #fb7299;
        --theme-color-light: #ff9a9e;
        --theme-color-dark: #e0557a;
        --theme-shadow: rgba(251,114,153,0.45);
        --theme-bg-light: rgba(251,114,153,0.08);
        transition: background 0.5s ease;
    } 
    .music-player-cover-wrap { 
        display: flex; 
        justify-content: center; 
        padding: 20px 0 30px; 
    } 
    .music-player-cover { 
        width: 240px; 
        height: 240px; 
        border-radius: 24px; 
        overflow: hidden; 
        box-shadow: 0 25px 60px rgba(0,0,0,0.2); 
    } 
    .music-player-cover img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    } 
    .music-player-cover-placeholder { 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
    } 
    .music-player-cover-placeholder svg { 
        width: 80px; 
        height: 80px; 
        fill: white; 
    } 
    .music-player-info { 
        text-align: center; 
        margin-bottom: 25px; 
    } 
    .music-player-title { 
        font-size: 24px; 
        font-weight: 700; 
        color: #1a1a1a; 
        margin-bottom: 8px; 
    } 
    .music-player-artist { 
        font-size: 16px; 
        color: #999; 
    } 
    .music-player-progress { 
        margin-bottom: 20px; 
    } 
    .music-player-progress-bar { 
        width: 100%; 
        height: 4px; 
        background: rgba(0,0,0,0.08); 
        border-radius: 2px; 
        cursor: pointer; 
        position: relative; 
    } 
    .music-player-progress-fill { 
        height: 100%; 
        background: linear-gradient(90deg, var(--theme-color, #fb7299), var(--theme-color-light, #ff9a9e)); 
        border-radius: 2px; 
        position: relative; 
        transition: width 0.1s linear, background 0.5s ease; 
    } 
    .music-player-progress-fill::after { 
        content: ''; 
        position: absolute; 
        right: -7px; 
        top: 50%; 
        transform: translateY(-50%); 
        width: 14px; 
        height: 14px; 
        background: var(--theme-color, #fb7299); 
        border-radius: 50%; 
        box-shadow: 0 2px 8px var(--theme-shadow, rgba(251,114,153,0.5));
        transition: background 0.5s ease, box-shadow 0.5s ease; 
    } 
    .music-player-time { 
        display: flex; 
        justify-content: space-between; 
        font-size: 12px; 
        color: #999; 
        margin-top: 10px; 
    } 
    .music-player-controls { 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        gap: 30px; 
        margin-bottom: 25px; 
    } 
    .music-player-btn { 
        width: 50px; 
        height: 50px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
        transition: transform 0.15s; 
    } 
    .music-player-btn:active { 
        transform: scale(0.88); 
    } 
    .music-player-btn svg { 
        width: 28px; 
        height: 28px; 
        fill: #333; 
    } 
    .music-player-btn-main { 
        width: 70px; 
        height: 70px; 
        border-radius: 50%; 
        background: linear-gradient(135deg, var(--theme-color, #fb7299) 0%, var(--theme-color-light, #ff9a9e) 100%); 
        box-shadow: 0 8px 25px var(--theme-shadow, rgba(251,114,153,0.45));
        transition: background 0.5s ease, box-shadow 0.5s ease; 
    } 
    .music-player-btn-main svg { 
        width: 32px; 
        height: 32px; 
        fill: white; 
    } 
    .music-player-actions { 
        display: flex; 
        justify-content: center; 
        gap: 45px; 
    } 
    .music-player-action { 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        cursor: pointer; 
    } 
    .music-player-action svg { 
        width: 24px; 
        height: 24px; 
        fill: #bbb; 
        margin-bottom: 6px; 
        transition: all 0.2s; 
    } 
    .music-player-action.liked svg { 
        fill: var(--theme-color, #fb7299);
        transition: fill 0.5s ease;
    }
    .music-player-action.active svg,
    .music-player-action[data-mode="repeat"] svg {
        fill: var(--theme-color, #fb7299);
        transition: fill 0.5s ease;
    }
    .music-player-action[data-mode="shuffle"] svg {
        fill: var(--theme-color-dark, #667eea);
        transition: fill 0.5s ease;
    }
    .music-player-action span { 
        font-size: 12px; 
        color: #999; 
    } 
    .music-lyrics-container { 
        margin-top: 25px; 
        padding: 20px; 
        background: rgba(255,255,255,0.8); 
        border-radius: 20px; 
        max-height: 140px; 
        overflow-y: auto; 
    } 
    .music-lyrics-container::-webkit-scrollbar { 
        display:none; 
    } 
    .music-lyrics-container::-webkit-scrollbar-thumb { 
        background: var(--theme-bg-light, rgba(251,114,153,0.3)); 
        border-radius: 2px; 
    } 
    .music-lyric-line { 
        text-align: center; 
        padding: 10px 0; 
        font-size: 14px; 
        color: #999; 
        transition: all 0.3s; 
    } 
    .music-lyric-line.active { 
        color: var(--theme-color, #fb7299); 
        font-size: 16px; 
        font-weight: 600; 
    } 
    .music-modal-overlay { 
        position: absolute; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        background: rgba(0,0,0,0.4); 
        display: flex; 
        align-items: flex-end; 
        justify-content: center; 
        z-index: 200; 
        animation: modalFadeIn 0.3s ease; 
    } 
    @keyframes modalFadeIn { 
        from { opacity: 0; } 
        to { opacity: 1; } 
    } 
    .music-modal { 
        background: white; 
        border-radius: 28px 28px 0 0; 
        width: 100%; 
        max-height: 85%; 
        padding: 20px 20px 40px; 
        animation: modalSlideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1); 
        overflow-y: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }
    .music-modal::-webkit-scrollbar {
        display: none;
    } 
    @keyframes modalSlideUp { 
        from { transform: translateY(100%); } 
        to { transform: translateY(0); } 
    } 
    .music-modal-handle { 
        width: 40px; 
        height: 4px; 
        background: #e0e0e0; 
        border-radius: 2px; 
        margin: 0 auto 20px; 
    } 
    .music-modal-title { 
        font-size: 20px; 
        font-weight: 700; 
        color: #1a1a1a; 
        text-align: center; 
        margin-bottom: 25px; 
    } 
    .music-modal-section { 
        margin-bottom: 20px; 
    } 
    .music-modal-label { 
        font-size: 13px; 
        font-weight: 600; 
        color: #999; 
        margin-bottom: 10px; 
        text-transform: uppercase; 
        letter-spacing: 0.5px; 
    } 
    .music-modal-input { 
        width: 100%; 
        padding: 15px 18px; 
        border: none; 
        border-radius: 14px; 
        font-size: 15px; 
        background: rgba(0,0,0,0.04); 
        outline: none; 
        transition: all 0.2s; 
    } 
    .music-modal-input:focus { 
        background: rgba(251,114,153,0.08); 
    } 
    .music-modal-input::placeholder { 
        color: #bbb; 
    } 
    .music-modal-file-input { 
        display: none; 
    } 
    .music-modal-file-btn { 
        width: 100%; 
        padding: 15px 18px; 
        border: 2px dashed rgba(251,114,153,0.3); 
        border-radius: 14px; 
        font-size: 14px; 
        color: #fb7299; 
        background: rgba(251,114,153,0.05); 
        cursor: pointer; 
        text-align: center; 
        transition: all 0.2s; 
    } 
    .music-modal-file-btn:hover { 
        background: rgba(251,114,153,0.1); 
        border-color: rgba(251,114,153,0.5); 
    } 
    .music-modal-file-btn.has-file { 
        background: rgba(251,114,153,0.1); 
        border-style: solid; 
        color: #333; 
    } 
    .music-modal-btns { 
        display: flex; 
        gap: 12px; 
        margin-top: 25px; 
    } 
    .music-modal-btn { 
        flex: 1; 
        padding: 16px; 
        border-radius: 14px; 
        font-size: 16px; 
        font-weight: 600; 
        cursor: pointer; 
        border: none; 
        transition: all 0.2s; 
    } 
    .music-modal-btn:active { 
        transform: scale(0.97); 
    } 
    .music-modal-btn-cancel { 
        background: rgba(0,0,0,0.05); 
        color: #666; 
    } 
    .music-modal-btn-confirm { 
        background: linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%); 
        color: white; 
        box-shadow: 0 4px 15px rgba(251,114,153,0.35); 
    }

    /* ============ 一起听页面样式 ============ */
    .listen-together-page {
        background: linear-gradient(180deg, #fff5f8 0%, #fff0f5 50%, #ffffff 100%);
    }
    .listen-together-content {
        padding: 0 20px 20px;
    }
    .listen-together-section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #666;
        margin-bottom: 15px;
        padding: 0 4px;
    }
    .listen-together-section-icon {
        width: 18px;
        height: 18px;
        color: #fb7299;
    }
    .listen-together-section-icon svg {
        width: 100%;
        height: 100%;
    }
    
    /* 空状态 */
    .listen-together-empty {
        text-align: center;
        padding: 50px 20px;
        background: white;
        border-radius: 24px;
        box-shadow: 0 4px 20px rgba(251,114,153,0.08);
    }
    .listen-together-empty-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 20px;
        color: #ddd;
    }
    .listen-together-empty-icon svg {
        width: 100%;
        height: 100%;
    }
    .listen-together-empty-title {
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;
    }
    .listen-together-empty-desc {
        font-size: 14px;
        color: #999;
    }
    
    /* 好友列表 */
    .listen-together-friends-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .listen-together-friend-item {
        display: flex;
        align-items: center;
        padding: 16px;
        background: white;
        border-radius: 20px;
        cursor: pointer;
        border: 2px solid transparent;
        box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .listen-together-friend-item:active {
        transform: scale(0.98);
    }
    .listen-together-friend-item.connected {
        background: linear-gradient(135deg, rgba(251,114,153,0.1) 0%, rgba(255,182,193,0.08) 100%);
        border-color: #fb7299;
        box-shadow: 0 4px 20px rgba(251,114,153,0.15);
    }
    .listen-together-friend-avatar {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        margin-right: 14px;
        flex-shrink: 0;
        position: relative;
    }
    .listen-together-friend-avatar img {
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .listen-together-friend-avatar-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #fb7299, #ff9a9e);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
        font-weight: 600;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .listen-together-friend-online {
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: 12px;
        height: 12px;
        background: #4ade80;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(74,222,128,0.4);
        z-index: 1;
    }
    .listen-together-friend-info {
        flex: 1;
        min-width: 0;
    }
    .listen-together-friend-name {
        font-weight: 600;
        font-size: 16px;
        color: #1a1a1a;
        margin-bottom: 4px;
    }
    .listen-together-friend-status {
        font-size: 13px;
        color: #888;
    }
    .listen-together-friend-item.connected .listen-together-friend-status {
        color: #fb7299;
    }
    .listen-together-friend-action {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .listen-together-invite-icon {
        width: 24px;
        height: 24px;
        color: #ccc;
        transition: color 0.2s;
    }
    .listen-together-invite-icon svg {
        width: 100%;
        height: 100%;
    }
    .listen-together-friend-item:hover .listen-together-invite-icon {
        color: #fb7299;
    }
    
    /* 音波指示器 */
    .listen-together-wave-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        height: 24px;
    }
    .listen-together-wave-indicator span {
        width: 4px;
        height: 12px;
        background: linear-gradient(180deg, #fb7299, #ff9a9e);
        border-radius: 2px;
        animation: waveAnimation 1s ease-in-out infinite;
    }
    .listen-together-wave-indicator span:nth-child(1) { animation-delay: 0s; }
    .listen-together-wave-indicator span:nth-child(2) { animation-delay: 0.15s; }
    .listen-together-wave-indicator span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes waveAnimation {
        0%, 100% { height: 8px; opacity: 0.5; }
        50% { height: 20px; opacity: 1; }
    }
    
    /* 空状态卡片 */
    .listen-together-idle-card {
        background: linear-gradient(135deg, rgba(251,114,153,0.08) 0%, rgba(255,182,193,0.12) 100%);
        border: 2px dashed rgba(251,114,153,0.3);
        border-radius: 20px;
        padding: 20px;
        margin: 0 20px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
    .listen-together-idle-icon {
        width: 48px;
        height: 48px;
        color: #fb7299;
        margin-bottom: 12px;
        opacity: 0.8;
    }
    .listen-together-idle-icon svg {
        width: 100%;
        height: 100%;
    }
    .listen-together-idle-content {
        margin-bottom: 16px;
    }
    .listen-together-idle-title {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 6px;
    }
    .listen-together-idle-desc {
        font-size: 12px;
        color: #888;
    }
    .listen-together-idle-song {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: white;
        border-radius: 12px;
        width: 100%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .listen-together-idle-song-cover {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        overflow: hidden;
        flex-shrink: 0;
    }
    .listen-together-idle-song-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .listen-together-idle-song-cover svg {
        width: 18px;
        height: 18px;
        fill: white;
    }
    .listen-together-idle-song-info {
        flex: 1;
        min-width: 0;
        text-align: left;
    }
    .listen-together-idle-song-title {
        font-size: 13px;
        font-weight: 600;
        color: #333;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .listen-together-idle-song-artist {
        font-size: 11px;
        color: #888;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    /* 活跃状态卡片 */
    .listen-together-active-card {
        background: linear-gradient(135deg, #ffffff 0%, #fefefe 50%, #fafafa 100%);
        border-radius: 24px;
        padding: 18px;
        margin: 0 20px 20px;
        color: #fb7299;
        box-shadow: 
            0 8px 32px rgba(0,0,0,0.08),
            0 2px 8px rgba(0,0,0,0.04),
            inset 0 1px 0 rgba(255,255,255,0.8);
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(251,114,153,0.15);
        backdrop-filter: blur(10px);
    }
    .listen-together-active-card::before {
        content: '';
        position: absolute;
        top: -80%;
        right: -40%;
        width: 200px;
        height: 200px;
        background: radial-gradient(circle, rgba(251,114,153,0.06) 0%, rgba(251,114,153,0.02) 40%, transparent 70%);
        pointer-events: none;
        animation: floatGlow 6s ease-in-out infinite;
    }
    .listen-together-active-card::after {
        content: '';
        position: absolute;
        bottom: -60%;
        left: -30%;
        width: 180px;
        height: 180px;
        background: radial-gradient(circle, rgba(251,114,153,0.08) 0%, transparent 60%);
        pointer-events: none;
        animation: floatGlow 8s ease-in-out infinite reverse;
    }
    @keyframes floatGlow {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
        50% { transform: translate(10px, 10px) scale(1.1); opacity: 1; }
    }
    .listen-together-active-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
        position: relative;
        z-index: 1;
    }
    .listen-together-active-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(251,114,153,0.08);
        padding: 6px 14px 6px 10px;
        border-radius: 20px;
        border: 1px solid rgba(251,114,153,0.12);
    }
    .listen-together-pulse {
        width: 10px;
        height: 10px;
        background: linear-gradient(135deg, #ffb6c1 0%, #ff69b4 50%, #ff1493 100%);
        border-radius: 50%;
        box-shadow: 
            0 0 0 0 rgba(255,105,180,0.6),
            0 0 8px rgba(255,105,180,0.5),
            inset 0 -1px 2px rgba(255,20,147,0.3);
        animation: pulseAnimation 2s ease-out infinite;
        border: 1px solid rgba(255,255,255,0.5);
    }
    @keyframes pulseAnimation {
        0% { 
            box-shadow: 0 0 0 0 rgba(255,105,180,0.6), 0 0 8px rgba(255,105,180,0.5), inset 0 -1px 2px rgba(255,20,147,0.3);
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
        }
        70% { 
            box-shadow: 0 0 0 10px rgba(255,105,180,0), 0 0 12px rgba(255,105,180,0.3), inset 0 -1px 2px rgba(255,20,147,0.3);
        }
        100% { 
            box-shadow: 0 0 0 0 rgba(255,105,180,0), 0 0 8px rgba(255,105,180,0.5), inset 0 -1px 2px rgba(255,20,147,0.3);
            transform: scale(1);
        }
    }
    .listen-together-status-text {
        font-weight: 600;
        font-size: 13px;
        color: #fb7299;
    }
    .listen-together-timer-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(251,114,153,0.08);
        padding: 6px 12px;
        border-radius: 16px;
        border: 1px solid rgba(251,114,153,0.12);
    }
    .listen-together-timer-icon {
        width: 12px;
        height: 12px;
        opacity: 0.7;
    }
    .listen-together-timer-icon svg {
        width: 100%;
        height: 100%;
        fill: #fb7299;
    }
    .listen-together-timer {
        font-size: 12px;
        font-weight: 600;
        font-family: 'SF Mono', 'Monaco', monospace;
        letter-spacing: 0.5px;
        color: #fb7299;
    }
    
    /* 伙伴信息 */
    .listen-together-partner-info {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 16px;
        font-size: 13px;
        position: relative;
        z-index: 1;
        color: #666;
    }
    .listen-together-partner-label {
        opacity: 0.8;
        font-weight: 500;
    }
    .listen-together-partner-name {
        font-size: 15px;
        font-weight: 700;
        padding: 5px 16px;
        background: linear-gradient(135deg, #fb7299 0%, #ff85a2 100%);
        color: white;
        border-radius: 14px;
        box-shadow: 0 3px 12px rgba(251,114,153,0.3);
        letter-spacing: 0.5px;
    }
    
    /* 当前播放 */
    .listen-together-now-playing {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        background: linear-gradient(135deg, rgba(251,114,153,0.06) 0%, rgba(251,114,153,0.03) 100%);
        border-radius: 18px;
        margin-bottom: 14px;
        border: 1px solid rgba(251,114,153,0.1);
        position: relative;
        z-index: 1;
    }
    .listen-together-song-cover {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        overflow: hidden;
        flex-shrink: 0;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        border: 2px solid rgba(255,255,255,0.8);
    }
    .listen-together-song-cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .listen-together-song-cover-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #fb7299, #ff9a9e);
    }
    .listen-together-song-cover-placeholder svg {
        width: 22px;
        height: 22px;
        fill: white;
    }
    .listen-together-song-info {
        flex: 1;
        min-width: 0;
    }
    .listen-together-song-title {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
        color: #333;
    }
    .listen-together-song-artist {
        font-size: 11px;
        color: #888;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    /* 操作按钮 */
    .listen-together-actions {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
        position: relative;
        z-index: 1;
    }
    .listen-together-action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px;
        background: linear-gradient(135deg, #fb7299 0%, #ff85a2 100%);
        border: none;
        border-radius: 12px;
        color: white;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 3px 12px rgba(251,114,153,0.25);
    }
    .listen-together-action-btn:active {
        transform: scale(0.96);
        box-shadow: 0 2px 8px rgba(251,114,153,0.3);
    }
    .listen-together-action-icon {
        width: 16px;
        height: 16px;
    }
    .listen-together-action-icon svg {
        width: 100%;
        height: 100%;
        fill: white;
    }
    
    /* 结束按钮 */
    .listen-together-end-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px;
        background: rgba(0,0,0,0.06);
        border: none;
        border-radius: 12px;
        color: #666;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        z-index: 1;
    }
    .listen-together-end-btn:active {
        transform: scale(0.98);
        background: rgba(0,0,0,0.1);
    }
    .listen-together-end-icon {
        width: 14px;
        height: 14px;
    }
    .listen-together-end-icon svg {
        width: 100%;
        height: 100%;
        fill: #999;
    }
    
    /* 历史记录区域 */
    .listen-together-history-section {
        padding: 0 20px 20px;
    }
    .listen-together-history-list {
        background: white;
        border-radius: 20px;
        padding: 8px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    }
    .listen-together-history-item {
        display: flex;
        align-items: center;
        padding: 14px;
        border-radius: 14px;
        transition: background 0.2s;
    }
    .listen-together-history-item:hover {
        background: rgba(251,114,153,0.05);
    }
    .listen-together-history-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        overflow: hidden;
        margin-right: 12px;
        flex-shrink: 0;
    }
    .listen-together-history-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .listen-together-history-avatar-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #fb7299, #ff9a9e);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: 600;
    }
    .listen-together-history-info {
        flex: 1;
        min-width: 0;
    }
    .listen-together-history-name {
        font-size: 14px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 2px;
    }
    .listen-together-history-meta {
        font-size: 12px;
        color: #999;
    }
    .listen-together-history-duration {
        font-size: 13px;
        font-weight: 500;
        color: #fb7299;
        padding: 4px 10px;
        background: rgba(251,114,153,0.1);
        border-radius: 10px;
    }
    .listen-together-history-empty {
        text-align: center;
        padding: 30px 20px;
        color: #999;
        font-size: 14px;
    }
    
    /* ============ 动感底部导航栏样式 - 悬浮毛玻璃小岛 ============ */
    .music-dynamic-tabbar {
        position: absolute !important;
        bottom: 22px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: calc(100% - 32px) !important;
        max-width: 380px !important;
        height: 60px !important;
        background: linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,245,248,0.8) 100%) !important;
        backdrop-filter: blur(25px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(25px) saturate(180%) !important;
        border-radius: 28px !important;
        border: 1px solid rgba(255,255,255,0.5) !important;
        box-shadow: 
            0 8px 32px rgba(251,114,153,0.15),
            0 4px 16px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.6) !important;
        overflow: hidden;
    }
    
    .music-tabbar-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        border-radius: 28px;
    }
    
    .music-tabbar-wave {
        position: absolute;
        bottom: -50%;
        left: -10%;
        width: 120%;
        height: 200%;
        background: radial-gradient(ellipse at center, rgba(251,114,153,0.12) 0%, transparent 70%);
        animation: tabbarWave 8s ease-in-out infinite;
        transform-origin: center bottom;
    }
    
    .music-tabbar-wave:nth-child(2) {
        background: radial-gradient(ellipse at center, rgba(255,182,193,0.1) 0%, transparent 70%);
        animation-delay: -2s;
        animation-duration: 10s;
    }
    
    .music-tabbar-wave:nth-child(3) {
        background: radial-gradient(ellipse at center, rgba(251,114,153,0.08) 0%, transparent 70%);
        animation-delay: -4s;
        animation-duration: 12s;
    }
    
    @keyframes tabbarWave {
        0%, 100% { transform: translateX(-10%) scale(1); }
        25% { transform: translateX(5%) scale(1.1); }
        50% { transform: translateX(10%) scale(1); }
        75% { transform: translateX(-5%) scale(1.1); }
    }
    
    .music-tab-indicator {
        position: absolute;
        bottom: 12px;
        height: 38px;
        border-radius: 19px;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 0;
    }
    
    .music-tab-indicator-inner {
        width: 100%;
        height: 100%;
        border-radius: 19px;
        background: linear-gradient(135deg, var(--tab-color-1, #fb7299) 0%, var(--tab-color-2, #ff9a9e) 100%);
        box-shadow: 0 4px 12px var(--tab-shadow, rgba(251,114,153,0.35));
        animation: indicatorPulse 2s ease-in-out infinite;
    }
    
    @keyframes indicatorPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.02); opacity: 0.9; }
    }
    
    .music-dynamic-tabbar .app-tab-item {
        position: relative;
        z-index: 1;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .music-dynamic-tabbar .app-tab-item.active {
        transform: translateY(-2px);
        color: white !important;
    }
    
    .music-dynamic-tabbar .app-tab-item.active .tab-icon svg {
        fill: white !important;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        animation: iconBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    @keyframes iconBounce {
        0% { transform: scale(0.8); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
    
    .music-dynamic-tabbar .app-tab-item:not(.active) .tab-icon svg {
        fill: #999;
        transition: all 0.3s ease;
    }
    
    .music-dynamic-tabbar .app-tab-item:not(.active):hover .tab-icon svg {
        fill: #fb7299;
        transform: scale(1.1);
    }
    
    /* 音乐节奏动画 - 播放时激活 */
    .music-dynamic-tabbar.playing .music-tabbar-wave {
        animation-duration: 3s;
    }
    
    .music-dynamic-tabbar.playing .app-tab-item.active .tab-icon svg {
        animation: musicPulse 0.5s ease-in-out infinite alternate;
    }
    
    @keyframes musicPulse {
        0% { transform: scale(1); }
        100% { transform: scale(1.1); }
    }
    
    /* 统一所有标签的颜色主题为粉色 */
    .music-dynamic-tabbar[data-tab="0"] .music-tab-indicator-inner,
    .music-dynamic-tabbar[data-tab="1"] .music-tab-indicator-inner,
    .music-dynamic-tabbar[data-tab="2"] .music-tab-indicator-inner,
    .music-dynamic-tabbar[data-tab="3"] .music-tab-indicator-inner {
        --tab-color-1: #fb7299;
        --tab-color-2: #ff9a9e;
        --tab-shadow: rgba(251,114,153,0.35);
    }
    
    /* 标签切换时的波纹效果 */
    .music-tab-ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.4);
        transform: scale(0);
        animation: tabRipple 0.6s ease-out forwards;
        pointer-events: none;
    }
    
    @keyframes tabRipple {
        to { transform: scale(4); opacity: 0; }
    }
    
    /* 浮动音符装饰 */
    .music-tabbar-notes {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
    }
    
    .music-note {
        position: absolute;
        font-size: 12px;
        opacity: 0;
        animation: floatNote 3s ease-in-out infinite;
    }
    
    .music-dynamic-tabbar.playing .music-note {
        opacity: 0.6;
    }
    
    @keyframes floatNote {
        0% { transform: translateY(30px) rotate(0deg); opacity: 0; }
        20% { opacity: 0.6; }
        80% { opacity: 0.6; }
        100% { transform: translateY(-20px) rotate(20deg); opacity: 0; }
    }

    .music-playlist-detail-header { 
        padding: 15px 20px; 
        display: flex; 
        align-items: center; 
        gap: 15px; 
    } 
    .music-playlist-detail-cover { 
        width: 100px; 
        height: 100px; 
        border-radius: 16px; 
        overflow: hidden; 
        box-shadow: 0 6px 20px rgba(0,0,0,0.12); 
        flex-shrink: 0; 
    } 
    .music-playlist-detail-cover img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    } 
    .music-playlist-detail-cover-placeholder { 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
    } 
    .music-playlist-detail-cover-placeholder svg { 
        width: 40px; 
        height: 40px; 
        fill: white; 
    } 
    .music-playlist-detail-info { 
        flex: 1; 
    } 
    .music-playlist-detail-name { 
        font-size: 20px; 
        font-weight: 700; 
        color: #1a1a1a; 
        margin-bottom: 6px; 
    } 
    .music-playlist-detail-count { 
        font-size: 14px; 
        color: #999; 
    } 
    .music-playlist-detail-actions { 
        display: flex; 
        gap: 10px; 
        padding: 15px 20px; 
    } 
    .music-playlist-action-btn { 
        flex: 1; 
        padding: 12px; 
        border-radius: 12px; 
        font-size: 14px; 
        font-weight: 600; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        gap: 6px; 
        cursor: pointer; 
        transition: all 0.2s; 
    } 
    .music-playlist-action-btn:active { 
        transform: scale(0.96); 
    } 
    .music-playlist-action-btn svg { 
        width: 18px; 
        height: 18px; 
    } 
    .music-playlist-action-btn-primary { 
        background: linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%); 
        color: white; 
    } 
    .music-playlist-action-btn-primary svg { 
        fill: white; 
    } 
    .music-playlist-action-btn-secondary { 
        background: rgba(0,0,0,0.05); 
        color: #666; 
    } 
    .music-playlist-action-btn-secondary svg { 
        fill: #666; 
    } 
    .music-empty-state { 
        text-align: center; 
        padding: 50px 20px; 
        color: #999; 
    } 
    .music-empty-state svg { 
        width: 60px; 
        height: 60px; 
        fill: #e0e0e0; 
        margin-bottom: 15px; 
    } 
    .music-empty-state-text { 
        font-size: 15px; 
        margin-bottom: 20px; 
    } 
    .music-empty-state-btn { 
        display: inline-flex; 
        align-items: center; 
        gap: 6px; 
        padding: 12px 24px; 
        background: linear-gradient(135deg, #fb7299 0%, #ff9a9e 100%); 
        color: white; 
        border-radius: 25px; 
        font-size: 14px; 
        font-weight: 600; 
        cursor: pointer; 
    } 
    .music-empty-state-btn svg { 
        width: 18px; 
        height: 18px; 
        fill: white; 
        margin: 0; 
    } 
    .music-song-item-menu { 
        position: absolute; 
        right: 0; 
        top: 100%; 
        background: white; 
        border-radius: 14px; 
        box-shadow: 0 8px 30px rgba(0,0,0,0.15); 
        overflow: hidden; 
        z-index: 100; 
        min-width: 160px; 
    } 
    .music-song-menu-item { 
        display: flex; 
        align-items: center; 
        gap: 12px; 
        padding: 14px 18px; 
        cursor: pointer; 
        transition: background 0.15s; 
    } 
    .music-song-menu-item:active { 
        background: rgba(0,0,0,0.05); 
    } 
    .music-song-menu-item svg { 
        width: 18px; 
        height: 18px; 
        fill: #666; 
    } 
    .music-song-menu-item span { 
        font-size: 14px; 
        color: #333; 
    } 
    .music-song-menu-item.danger span { 
        color: #ff4757; 
    } 
    .music-song-menu-item.danger svg { 
        fill: #ff4757; 
    } 
`; 
 
const MusicIslandCSS = ` 
    .island-music-quiet { 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        height: 100%; 
        padding: 0 12px; 
        gap: 8px; 
    } 
    .island-music-quiet-cover { 
        width: 24px; 
        height: 24px; 
        border-radius: 6px; 
        overflow: hidden; 
    } 
    .island-music-quiet-cover img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    } 
    .island-music-quiet-cover-placeholder { 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
    } 
    .island-music-quiet-cover-placeholder svg { 
        width: 12px; 
        height: 12px; 
        fill: white; 
    } 
    .island-music-quiet-wave { 
        display: flex; 
        align-items: flex-end; 
        gap: 2px; 
        height: 16px; 
    } 
    .island-music-quiet-wave span { 
        width: 3px; 
        background: #fb7299; 
        border-radius: 2px; 
    } 
    .island-music-quiet-wave.playing span { 
        animation: waveAnim 0.8s ease-in-out infinite; 
    } 
    .island-music-quiet-wave span:nth-child(1) { height: 4px; animation-delay: 0s; } 
    .island-music-quiet-wave span:nth-child(2) { height: 4px; animation-delay: 0.2s; } 
    .island-music-quiet-wave span:nth-child(3) { height: 4px; animation-delay: 0.4s; } 
    @keyframes waveAnim { 
        0%, 100% { height: 4px; } 
        50% { height: 16px; } 
    } 
    .island-music-medium { 
        display: flex; 
        flex-direction: column; 
        padding: 12px 15px; 
        height: 100%; 
        color: white; 
    } 
    .island-music-header { 
        display: flex; 
        align-items: center; 
        gap: 10px; 
        margin-bottom: 10px; 
    } 
    .island-music-cover { 
        width: 42px; 
        height: 42px; 
        border-radius: 10px; 
        overflow: hidden; 
        flex-shrink: 0; 
    } 
    .island-music-cover img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    } 
    .island-music-cover-placeholder { 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
    } 
    .island-music-cover-placeholder svg { 
        width: 20px; 
        height: 20px; 
        fill: white; 
    } 
    .island-music-info { 
        flex: 1; 
        min-width: 0; 
    } 
    .island-music-title { 
        font-size: 13px; 
        font-weight: 600; 
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis; 
    } 
    .island-music-artist { 
        font-size: 11px; 
        color: #aaa; 
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis; 
    } 
    .island-music-progress { 
        width: 100%; height: 7px; background-color: #404040; /* 尺寸、背景色 */ 
        border-radius: 3.5px; margin: 5px 0; position: relative; cursor: pointer; /* 圆角、外边距、定位、鼠标指针 */ 
    } 
    .island-music-progress-bar { 
        width: 100%; 
        height: 7px; 
        background: #404040; 
        border-radius: 2px; 
        cursor: pointer; 
    } 
    .island-music-progress-fill { 
        width: 40%; height: 100%; background-color: #fb7299; /* 初始宽度、高度、背景色 */ 
        border-radius: 3.5px; position: relative; transition: width 0.1s linear; /* 圆角、定位、宽度过渡 */ 
    } 
    .island-music-progress-fill::after { /* 进度条小圆点 */ 
        content: ''; position: absolute; right: -5px; top: 50%; transform: translateY(-55%); /* 定位 */ 
        width: 12px; height: 12px; background-color: white; border-radius: 50%; /* 尺寸、背景色、圆形 */ 
        box-shadow: 0 0 4px rgba(0,0,0,0.3); /* 阴影 */ 
    } 
 
    .island-music-controls { /* 控制按钮容器 */ 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        margin-top: auto; 
    } 
 
 
 
    .island-music-side-btns { /* 次要控制按钮 */ 
        display: flex; 
        gap: 10px; 
    } 
    .island-music-main-btns {  /* 主要控制按钮（播放/暂停） */ 
        display: flex; 
        align-items: center; 
        gap: 12px; 
    } 
    .island-music-btn { 
        width: 28px; 
        height: 28px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
    } 
    .island-music-btn svg { 
        width: 22px; 
        height: 22px; 
        fill: white; 
    } 
    .island-music-btn.liked svg { 
        width: 20px; 
        height: 20px; 
        fill: #fb7299; 
    } 
 
    .island-music-btn:hover { transform: scale(1.15); opacity: 0.8;} 
 
    .island-music-btn:active { transform: scale(1); opacity: 1.1;} 
 
    .island-music-btn-skip svg { 
        width: 20px; 
        height: 20px; 
        opacity: 0.8; 
    } 
    .island-music-large { 
        display: flex; 
        flex-direction: column; 
        padding: 15px; 
        height: 100%; 
        color: white; 
        overflow:hidden; 
    } 
    .island-music-large-header { 
        display: flex; 
        align-items: center; 
        gap: 12px; 
        margin-bottom: 12px; 
    } 
    .island-music-large-cover { 
        width: 52px; 
        height: 52px; 
        border-radius: 12px; 
        overflow: hidden; 
        flex-shrink: 0; 
    } 
    .island-music-large-cover img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
    } 
    .island-music-large-cover-placeholder { 
        width: 100%; 
        height: 100%; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
    } 
    .island-music-large-cover-placeholder svg { 
        width: 24px; 
        height: 24px; 
        fill: white; 
    } 
    .island-music-large-info { 
        flex: 1; 
        min-width: 0; 
    } 
    .island-music-large-title { 
        font-size: 15px; 
        font-weight: 600; 
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis; 
    } 
    .island-music-large-artist { 
        font-size: 12px; 
        color: #aaa; 
    } 
    .island-music-large-controls { 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        gap: 20px; 
        margin: 12px 0; 
    } 
    .island-music-large-btn { 
        width: 36px; 
        height: 36px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
    } 
    .island-music-large-btn svg { 
        width: 22px; 
        height: 22px; 
        fill: white; 
    } 
    .island-music-large-btn-main { 
        width: 50px; 
        height: 50px; 
        background: #fb7299; 
        border-radius: 50%; 
    } 
    .island-music-large-btn-main svg { 
        width: 26px; 
        height: 26px; 
    } 
    .island-music-lyrics { 
        flex: 1; 
        overflow-y: auto; 
        margin-top: 10px; 
        padding: 12px; 
        background: rgba(255,255,255,0.08); 
        border-radius: 14px; 
        position: relative; 
    } 
    .island-music-lyrics::-webkit-scrollbar { 
        display:none; 
    } 
    .island-music-lyrics::-webkit-scrollbar-thumb { 
        background: #555; 
        border-radius: 2px; 
    } 
    .island-music-lyric-line { 
        text-align: center; 
        padding: 6px 0; 
        font-size: 12px; 
        color: #777; 
        transition: all 0.3s; 
    } 
    .island-music-lyric-line.active { 
        color: #fb7299; 
        font-size: 14px; 
        font-weight: 600; 
    } 
`; 
 
const SVGIcons = { 
    music: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>', 
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', 
 
    pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>', 
 
    prev: '<svg viewBox="0 0 24 24"><path d="M11 16.07V7.93c0-.81-.91-1.28-1.58-.82l-4.77 3.53c-.61.46-.61 1.3 0 1.76l4.77 3.53c.67.47 1.58 0 1.58-.82zm1.66-3.25l4.77 3.53c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-4.77 3.53c-.61.45-.61 1.29 0 1.76z"/></svg>', 
 
    next: '<svg viewBox="0 0 24 24"><path d="M5.58 16.89l4.77-3.53c.61-.45.61-1.3 0-1.76L5.58 7.93c-.66-.47-1.58.01-1.58.82v7.24c0 .81.91 1.29 1.58.82zm8 0l4.77-3.53c.61-.45.61-1.3 0-1.76l-4.77-3.53c-.66-.47-1.58.01-1.58.82v7.24c0 .81.91 1.29 1.58.82z"/></svg>', 
 
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>', 
    heartOutline: '<svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>', 
    home: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>', 
    search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>', 
    user: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>', 
    add: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>', 
    playlist: '<svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>', 
    settings: '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>', 
    download: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>', 
    share: '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>', 
    link: '<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>', 
    chart: '<svg viewBox="0 0 24 24"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>', 
    radio: '<svg viewBox="0 0 24 24"><path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.11-.89-2-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z"/></svg>', 
    clock: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>', 
    more: '<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>', 
    delete: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>', 
    edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>', 
    file: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>', 
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>'
}; 
 
const defaultLyrics = [ 
    { time: 0, text: "♪ 音乐开始 ♪" }, 
    { time: 5, text: "月光洒落在窗台" }, 
    { time: 10, text: "思念随风轻轻来" }, 
    { time: 15, text: "记忆中的那片海" }, 
    { time: 20, text: "是否还在等待" }, 
    { time: 25, text: "时光匆匆不停歇" }, 
    { time: 30, text: "往事如烟已走远" }, 
    { time: 35, text: "唯有这首歌陪伴" }, 
    { time: 40, text: "温暖着每个夜晚" }, 
    { time: 45, text: "♪ 间奏 ♪" }, 
    { time: 55, text: "梦里花开又花落" }, 
    { time: 60, text: "岁月带走了什么" }, 
    { time: 65, text: "留下的是这首歌" }, 
    { time: 70, text: "和永远的你和我" }, 
    { time: 75, text: "♪ 音乐渐弱 ♪" } 
]; 
 
const MusicPlayerState = { 
    isPlaying: false, 
    currentSong: null, 
    currentTime: 0, 
    duration: 180, 
    progress: 0, 
    likedSongs: [], 
    playlists: [ 
        { id: 1, name: "我喜欢的音乐", cover: null, color: "#fb7299", songs: [] }, 
        { id: 2, name: "深夜电台", cover: null, color: "#667eea", songs: [] } 
    ], 
    playMode: 'list', 
    audio: null, 
    fakeInterval: null, 
    idleTimer: null, 
    idleTimeout: 60000,
    playHistory: [],  // 播放历史记录
    
    /* 【一起听状态】 */
    listenTogether: {
        active: false,           // 是否正在一起听
        sessionId: null,         // 活动会话ID
        aiId: null,              // 一起听的AI ID
        aiName: null,            // AI名称
        startTime: null,         // 开始时间
        invitePending: false     // 是否有待处理的邀请
    }, 
    songs: [ 
        { 
            id: 1, 
            title: "枕边童话", 
            artist: "小田音乐社", 
            cover: null, 
            color: "#ff99cc", 
            url: "https://www.joy127.com/url/111143.mp3", 
            lyrics: [ 
                { time: 0, text: "♪ 前奏 ♪" }, 
                { time: 8, text: "夜深了 你睡着了吗" }, 
                { time: 14, text: "月亮挂在窗台" }, 
                { time: 20, text: "我为你讲一个童话" }, 
                { time: 26, text: "关于爱和期待" }, 
                { time: 32, text: "星星眨眼睛" }, 
                { time: 38, text: "为你照亮梦的方向" }, 
                { time: 44, text: "枕边有我陪伴" }, 
                { time: 50, text: "不怕黑夜漫长" } 
            ] 
        }, 
        { 
            id: 2, 
            title: "凄美地", 
            artist: "郭顶", 
            cover: null, 
            color: "#6c5ce7", 
            url: "https://www.joy127.com/url/109731.mp3", 
            lyrics: defaultLyrics 
        }, 
        { 
            id: 3, 
            title: "晴天", 
            artist: "周杰伦", 
            cover: null, 
            color: "#74b9ff", 
            url: null, 
            lyrics: defaultLyrics 
        } 
    ] 
}; 
 
function injectMusicStyles() { 
    if (!document.getElementById('music-app-styles')) { 
        const style = document.createElement('style'); 
        style.id = 'music-app-styles'; 
        style.textContent = MusicAppCSS + MusicIslandCSS; 
        document.head.appendChild(style); 
    } 
} 
 
injectMusicStyles(); 

// ============ 歌词持久化存储功能 ============
const LYRICS_STORAGE_KEY = 'music_custom_lyrics';

// 保存歌词到 localStorage
function saveLyricsToStorage(songId, lyrics) {
    try {
        let savedLyrics = {};
        const stored = localStorage.getItem(LYRICS_STORAGE_KEY);
        if (stored) {
            savedLyrics = JSON.parse(stored);
        }
        savedLyrics[songId] = lyrics;
        localStorage.setItem(LYRICS_STORAGE_KEY, JSON.stringify(savedLyrics));
        return true;
    } catch (e) {
        console.error('保存歌词失败:', e);
        return false;
    }
}

// 从 localStorage 加载歌词
function loadLyricsFromStorage() {
    try {
        const stored = localStorage.getItem(LYRICS_STORAGE_KEY);
        if (stored) {
            const savedLyrics = JSON.parse(stored);
            // 将保存的歌词恢复到对应的歌曲
            MusicPlayerState.songs.forEach(function(song) {
                if (savedLyrics[song.id]) {
                    song.lyrics = savedLyrics[song.id];
                }
            });
        }
    } catch (e) {
        console.error('加载歌词失败:', e);
    }
}

// 删除指定歌曲的自定义歌词（恢复默认）
function clearSavedLyrics(songId) {
    try {
        const stored = localStorage.getItem(LYRICS_STORAGE_KEY);
        if (stored) {
            const savedLyrics = JSON.parse(stored);
            delete savedLyrics[songId];
            localStorage.setItem(LYRICS_STORAGE_KEY, JSON.stringify(savedLyrics));
        }
    } catch (e) {
        console.error('清除歌词失败:', e);
    }
}

// 页面加载时恢复歌词
loadLyricsFromStorage();

function initAudio() {
    if (!MusicPlayerState.audio) { 
        MusicPlayerState.audio = new Audio(); 
        MusicPlayerState.audio.addEventListener('timeupdate', function() { 
            if (MusicPlayerState.audio.duration > 0) { 
                MusicPlayerState.currentTime = MusicPlayerState.audio.currentTime; 
                MusicPlayerState.duration = MusicPlayerState.audio.duration; 
                MusicPlayerState.progress = (MusicPlayerState.currentTime / MusicPlayerState.duration) * 100; 
                updateAllProgressBars(); 
                updateLyrics(); 
            } 
        }); 
        MusicPlayerState.audio.addEventListener('loadedmetadata', function() { 
            MusicPlayerState.duration = MusicPlayerState.audio.duration; 
        }); 
        MusicPlayerState.audio.addEventListener('ended', function() { 
            playNextSong(); 
        }); 
        MusicPlayerState.audio.addEventListener('play', function() { 
            MusicPlayerState.isPlaying = true; 
            resetIdleTimer(); 
            updateAllPlayButtons(); 
        }); 
        MusicPlayerState.audio.addEventListener('pause', function() { 
            MusicPlayerState.isPlaying = false; 
            startIdleTimer(); 
            updateAllPlayButtons(); 
        }); 
    } 
} 
 
function startIdleTimer() { 
    clearIdleTimer(); 
    MusicPlayerState.idleTimer = setTimeout(function() { 
        if (!MusicPlayerState.isPlaying) {
            // 清除灵动岛
            if (DynamicIsland.activeApp === musicApp) { 
                DynamicIsland.clearApp(); 
            }
            // 如果正在一起听，暂停一分钟后自动断开
            if (MusicPlayerState.listenTogether.active) {
                endListenTogether();
                PhoneCore.notifications.send({
                    type: 'info',
                    title: '一起听已断开',
                    message: '暂停超过1分钟',
                    size: 'mini'
                });
            }
        }
    }, MusicPlayerState.idleTimeout); 
} 
 
function clearIdleTimer() { 
    if (MusicPlayerState.idleTimer) { 
        clearTimeout(MusicPlayerState.idleTimer); 
        MusicPlayerState.idleTimer = null; 
    } 
} 
 
function resetIdleTimer() { 
    clearIdleTimer(); 
} 
 
function updateAllProgressBars() { 
    const appProgress = document.querySelector('.music-player-progress-fill'); 
    if (appProgress) { 
        appProgress.style.width = MusicPlayerState.progress + '%'; 
    } 
    const appTimeNow = document.querySelector('.music-player-time-now'); 
    if (appTimeNow) { 
        appTimeNow.textContent = formatTime(MusicPlayerState.currentTime); 
    } 
    const appTimeTotal = document.querySelector('.music-player-time-total'); 
    if (appTimeTotal) { 
        appTimeTotal.textContent = formatTime(MusicPlayerState.duration); 
    } 
    const islandProgress = document.querySelector('.island-music-progress-fill'); 
    if (islandProgress) { 
        islandProgress.style.width = MusicPlayerState.progress + '%'; 
    } 
} 
 
function updateAllPlayButtons() { 
    const icon = MusicPlayerState.isPlaying ? SVGIcons.pause : SVGIcons.play; 
    document.querySelectorAll('.play-toggle-btn').forEach(function(btn) { 
        btn.innerHTML = icon; 
    }); 
    document.querySelectorAll('.island-play-btn').forEach(function(btn) { 
        btn.innerHTML = icon; 
    }); 
    const waveEls = document.querySelectorAll('.island-music-quiet-wave'); 
    waveEls.forEach(function(el) { 
        if (MusicPlayerState.isPlaying) { 
            el.classList.add('playing'); 
        } else { 
            el.classList.remove('playing'); 
        } 
    }); 
} 
 
function updateLyrics() { 
    const song = MusicPlayerState.currentSong; 
    if (!song || !song.lyrics) return; 
     
    const currentTime = MusicPlayerState.currentTime; 
    let activeIndex = 0; 
     
    for (let i = 0; i < song.lyrics.length; i++) { 
        if (currentTime >= song.lyrics[i].time) { 
            activeIndex = i; 
        } 
    } 
     
    document.querySelectorAll('.music-lyric-line, .island-music-lyric-line').forEach(function(line, index) { 
        if (parseInt(line.dataset.index) === activeIndex) { 
            if (!line.classList.contains('active')) { 
                line.classList.add('active'); 
                line.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
            } 
        } else { 
            line.classList.remove('active'); 
        } 
    }); 
} 
 
function formatTime(seconds) { 
    if (!seconds || isNaN(seconds)) return '0:00'; 
    const mins = Math.floor(seconds / 60); 
    const secs = Math.floor(seconds % 60); 
    return mins + ':' + (secs < 10 ? '0' : '') + secs; 
}

/* 【播放模式相关函数】 */
function getPlayModeIcon(mode) {
    switch(mode) {
        case 'repeat':
            return '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><path d="M12 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>';
        case 'shuffle':
            return '<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>';
        default:
            return '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>';
    }
}

function getPlayModeName(mode) {
    switch(mode) {
        case 'repeat': return '单曲循环';
        case 'shuffle': return '随机播放';
        default: return '列表循环';
    }
}

function togglePlayMode() {
    const modes = ['list', 'repeat', 'shuffle'];
    const currentIndex = modes.indexOf(MusicPlayerState.playMode);
    MusicPlayerState.playMode = modes[(currentIndex + 1) % modes.length];
    
    // 更新播放器页面的按钮
    refreshPlayModeButton();
    
    // 显示提示
    PhoneCore.notifications.send({
        type: 'info',
        title: '播放模式: ' + getPlayModeName(MusicPlayerState.playMode),
        size: 'mini'
    });
}

function refreshPlayModeButton() {
    const btn = document.querySelector('.play-mode-btn');
    if (btn) {
        btn.setAttribute('data-mode', MusicPlayerState.playMode);
        btn.innerHTML = getPlayModeIcon(MusicPlayerState.playMode) + '<span>' + getPlayModeName(MusicPlayerState.playMode) + '</span>';
        
        // 高亮单曲循环模式
        if (MusicPlayerState.playMode === 'repeat') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
}

function playSong(song) {
    initAudio(); 
     
    if (MusicPlayerState.fakeInterval) { 
        clearInterval(MusicPlayerState.fakeInterval); 
        MusicPlayerState.fakeInterval = null; 
    } 
     
    MusicPlayerState.currentSong = song; 
    MusicPlayerState.currentTime = 0; 
    MusicPlayerState.progress = 0; 
    
    // 记录播放历史
    addToPlayHistory(song.id);
    
    // 增加播放次数
    song.playCount = (song.playCount || 0) + 1;
     
    if (song.url) { 
        MusicPlayerState.audio.src = song.url; 
        MusicPlayerState.audio.load(); 
        MusicPlayerState.audio.play().catch(function(e) { 
            console.log('播放失败:', e); 
        }); 
    } else { 
        MusicPlayerState.duration = 180; 
        MusicPlayerState.isPlaying = true; 
        startFakeProgress(); 
    } 
     
    musicApp.activateIsland();
    
    // 更新底部导航栏播放状态
    updateTabBarPlayingState(musicApp);
} 
 
function startFakeProgress() { 
    if (MusicPlayerState.fakeInterval) { 
        clearInterval(MusicPlayerState.fakeInterval); 
    } 
    MusicPlayerState.fakeInterval = setInterval(function() { 
        if (MusicPlayerState.isPlaying && (!MusicPlayerState.currentSong || !MusicPlayerState.currentSong.url)) { 
            MusicPlayerState.currentTime += 1; 
            MusicPlayerState.progress = (MusicPlayerState.currentTime / MusicPlayerState.duration) * 100; 
            updateAllProgressBars(); 
            updateLyrics(); 
             
            if (MusicPlayerState.currentTime >= MusicPlayerState.duration) { 
                playNextSong(); 
            } 
        } 
    }, 1000); 
} 
 
function togglePlay() { 
    if (!MusicPlayerState.currentSong) return; 
     
    if (MusicPlayerState.currentSong.url && MusicPlayerState.audio) { 
        if (MusicPlayerState.isPlaying) { 
            MusicPlayerState.audio.pause(); 
        } else { 
            MusicPlayerState.audio.play().catch(function(e) { 
                console.log('播放失败:', e); 
            }); 
        } 
    } else { 
        MusicPlayerState.isPlaying = !MusicPlayerState.isPlaying; 
        if (MusicPlayerState.isPlaying) { 
            startFakeProgress(); 
            resetIdleTimer(); 
        } else { 
            startIdleTimer(); 
        } 
        updateAllPlayButtons(); 
    }
    
    // 更新底部导航栏播放状态
    updateTabBarPlayingState(musicApp);
} 
 
function playNextSong() { 
    const songs = MusicPlayerState.songs; 
    if (!songs.length) return; 
     
    let nextIndex = 0; 
    if (MusicPlayerState.currentSong) { 
        const currentIndex = songs.findIndex(s => s.id === MusicPlayerState.currentSong.id); 
        if (MusicPlayerState.playMode === 'repeat') { 
            nextIndex = currentIndex; 
        } else if (MusicPlayerState.playMode === 'shuffle') { 
            nextIndex = Math.floor(Math.random() * songs.length); 
        } else { 
            nextIndex = (currentIndex + 1) % songs.length; 
        } 
    } 
     
    if (songs[nextIndex]) { 
        playSong(songs[nextIndex]); 
        refreshPlayerPage(); 
    } 
} 
 
function playPrevSong() { 
    const songs = MusicPlayerState.songs; 
    if (!songs.length) return; 
     
    let prevIndex = 0; 
    if (MusicPlayerState.currentSong) { 
        const currentIndex = songs.findIndex(s => s.id === MusicPlayerState.currentSong.id); 
        prevIndex = (currentIndex - 1 + songs.length) % songs.length; 
    } 
     
    if (songs[prevIndex]) { 
        playSong(songs[prevIndex]); 
        refreshPlayerPage(); 
    } 
} 
 
function refreshPlayerPage() { 
    const playerPage = document.querySelector('.music-player-page'); 
    if (playerPage && MusicPlayerState.currentSong) { 
        const song = MusicPlayerState.currentSong; 
        const titleEl = playerPage.querySelector('.music-player-title'); 
        const artistEl = playerPage.querySelector('.music-player-artist'); 
        const coverEl = playerPage.querySelector('.music-player-cover'); 
        const lyricsContainer = playerPage.querySelector('.music-lyrics-container'); 
         
        if (titleEl) titleEl.textContent = song.title; 
        if (artistEl) artistEl.textContent = song.artist; 
        if (coverEl) { 
            coverEl.innerHTML = song.cover  
                ? '<img src="' + song.cover + '" alt="">' 
                : '<div class="music-player-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>'; 
        } 
        if (lyricsContainer) { 
            const lyrics = song.lyrics || defaultLyrics; 
            let lyricsHtml = ''; 
            lyrics.forEach(function(line, index) { 
                lyricsHtml += '<div class="music-lyric-line" data-index="' + index + '">' + line.text + '</div>'; 
            }); 
            lyricsContainer.innerHTML = lyricsHtml; 
        } 
         
        const likeBtn = playerPage.querySelector('.like-btn'); 
        if (likeBtn) { 
            if (isLiked(song.id)) { 
                likeBtn.classList.add('liked'); 
                likeBtn.querySelector('svg').outerHTML = SVGIcons.heart; 
            } else { 
                likeBtn.classList.remove('liked'); 
                likeBtn.querySelector('svg').outerHTML = SVGIcons.heartOutline; 
            } 
        }
        
        // 应用主题颜色
        if (song.cover) {
            // 如果有封面，从封面提取颜色
            extractAndApplyThemeColor(song.cover, song.color);
        } else {
            // 没有封面则使用歌曲的默认颜色
            applyThemeColorToPlayer(song.color);
        }
    } 
} 
 
function seekTo(percentage) { 
    MusicPlayerState.progress = percentage; 
    MusicPlayerState.currentTime = (percentage / 100) * MusicPlayerState.duration; 
     
    if (MusicPlayerState.audio && MusicPlayerState.currentSong && MusicPlayerState.currentSong.url) { 
        MusicPlayerState.audio.currentTime = MusicPlayerState.currentTime; 
    } 
     
    updateAllProgressBars(); 
} 
 
function toggleLike(songId) { 
    const index = MusicPlayerState.likedSongs.indexOf(songId); 
    if (index > -1) { 
        MusicPlayerState.likedSongs.splice(index, 1); 
    } else { 
        MusicPlayerState.likedSongs.push(songId); 
    } 
    updateLikeButtons(songId); 
} 
 
function isLiked(songId) { 
    return MusicPlayerState.likedSongs.indexOf(songId) > -1; 
} 
 
function updateLikeButtons(songId) { 
    document.querySelectorAll('.music-song-btn.like-btn[data-id="' + songId + '"]').forEach(function(btn) { 
        if (isLiked(songId)) { 
            btn.classList.add('liked'); 
        } else { 
            btn.classList.remove('liked'); 
        } 
    }); 
     
    document.querySelectorAll('.music-song-item[data-id="' + songId + '"]').forEach(function(item) { 
        const btn = item.querySelector('.like-btn'); 
        if (btn) { 
            if (isLiked(songId)) { 
                btn.classList.add('liked'); 
            } else { 
                btn.classList.remove('liked'); 
            } 
        } 
    }); 
} 
 
function extractColorFromImage(imgSrc, callback) { 
    const img = new Image(); 
    img.crossOrigin = 'Anonymous'; 
    img.onload = function() { 
        const canvas = document.createElement('canvas'); 
        const ctx = canvas.getContext('2d'); 
        canvas.width = 50; 
        canvas.height = 50; 
        ctx.drawImage(img, 0, 0, 50, 50); 
         
        try { 
            const imageData = ctx.getImageData(0, 0, 50, 50).data; 
            let r = 0, g = 0, b = 0, count = 0; 
             
            for (let i = 0; i < imageData.length; i += 4) { 
                const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3; 
                if (brightness > 30 && brightness < 220) { 
                    r += imageData[i]; 
                    g += imageData[i + 1]; 
                    b += imageData[i + 2]; 
                    count++; 
                } 
            } 
             
            if (count > 0) { 
                r = Math.round(r / count); 
                g = Math.round(g / count); 
                b = Math.round(b / count); 
                const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); 
                callback(hex); 
            } else { 
                callback('#fb7299'); 
            } 
        } catch (e) { 
            callback('#fb7299'); 
        } 
    }; 
    img.onerror = function() { 
        callback('#fb7299'); 
    }; 
    img.src = imgSrc; 
}

// 将十六进制颜色转换为RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 251, g: 114, b: 153 };
}

// 将RGB转换为十六进制颜色
function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// 根据主色调计算浅色和深色变体
function getColorVariants(hexColor) {
    const rgb = hexToRgb(hexColor);
    
    // 计算浅色变体（增加亮度）
    const lightR = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * 0.3));
    const lightG = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * 0.3));
    const lightB = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * 0.3));
    
    // 计算深色变体（降低亮度）
    const darkR = Math.round(rgb.r * 0.75);
    const darkG = Math.round(rgb.g * 0.75);
    const darkB = Math.round(rgb.b * 0.75);
    
    return {
        main: hexColor,
        light: rgbToHex(lightR, lightG, lightB),
        dark: rgbToHex(darkR, darkG, darkB),
        shadow: 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.45)',
        bgLight: 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.08)',
        bgGradient: 'linear-gradient(180deg, ' + hexColor + '35 0%, #fff 40%, ' + hexColor + '08 100%)'
    };
}

// 应用主题颜色到播放器页面
function applyThemeColorToPlayer(color) {
    const playerPage = document.querySelector('.music-player-page');
    if (!playerPage) return;
    
    const variants = getColorVariants(color);
    
    // 设置CSS变量
    playerPage.style.setProperty('--theme-color', variants.main);
    playerPage.style.setProperty('--theme-color-light', variants.light);
    playerPage.style.setProperty('--theme-color-dark', variants.dark);
    playerPage.style.setProperty('--theme-shadow', variants.shadow);
    playerPage.style.setProperty('--theme-bg-light', variants.bgLight);
    
    // 更新背景渐变
    playerPage.style.background = variants.bgGradient;
}

// 从封面图片提取颜色并应用到播放器
function extractAndApplyThemeColor(imgSrc, fallbackColor) {
    if (imgSrc) {
        extractColorFromImage(imgSrc, function(extractedColor) {
            applyThemeColorToPlayer(extractedColor);
            // 同时更新歌曲的颜色属性
            if (MusicPlayerState.currentSong) {
                MusicPlayerState.currentSong.color = extractedColor;
            }
        });
    } else {
        applyThemeColorToPlayer(fallbackColor || '#fb7299');
    }
} 
 
function parseLrcFile(lrcText) { 
    const lines = lrcText.split('\n'); 
    const lyrics = []; 
    // 修复正则表达式：使用 \[ \] 匹配方括号，支持多种时间格式
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g; 
     
    lines.forEach(function(line) { 
        const matches = []; 
        let match; 
        // 重置正则lastIndex以确保正确匹配
        timeRegex.lastIndex = 0;
        while ((match = timeRegex.exec(line)) !== null) { 
            const minutes = parseInt(match[1]); 
            const seconds = parseInt(match[2]); 
            const ms = match[3] ? parseInt(match[3]) : 0; 
            const time = minutes * 60 + seconds + ms / (match[3] && match[3].length === 3 ? 1000 : 100); 
            matches.push(time); 
        } 
         
        // 修复替换正则表达式
        const text = line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim(); 
        if (text && matches.length > 0) { 
            matches.forEach(function(time) { 
                lyrics.push({ time: time, text: text }); 
            }); 
        } 
    }); 
     
    lyrics.sort(function(a, b) { return a.time - b.time; }); 
    return lyrics; 
} 
 
function addSongByUrl(url, title, artist, coverUrl, lrcText) { 
    const newSong = { 
        id: Date.now(), 
        title: title || '未知歌曲', 
        artist: artist || '未知艺术家', 
        cover: coverUrl || null, 
        color: '#fb7299', 
        url: url, 
        lyrics: lrcText ? parseLrcFile(lrcText) : defaultLyrics 
    }; 
     
    if (coverUrl) { 
        extractColorFromImage(coverUrl, function(color) { 
            newSong.color = color; 
            refreshSongList(); 
        }); 
    } 
     
    MusicPlayerState.songs.push(newSong); 
    refreshSongList(); 
    return newSong; 
} 
 
function refreshSongList() { 
    const contentArea = document.querySelector('#main-content-area'); 
    if (contentArea && musicApp.currentTabIndex === 0) { 
        contentArea.innerHTML = generateRecommendTabContent(); 
        bindMainTabEvents(contentArea); 
    } 
} 
 
function generateSongItemHtml(song, showDelete, playlistId) { 
    const likedClass = isLiked(song.id) ? 'liked' : ''; 
    const coverHtml = song.cover  
        ? '<img src="' + song.cover + '" alt="">' 
        : '<div class="music-song-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>'; 
     
    let deleteBtn = ''; 
    if (showDelete && playlistId) { 
        deleteBtn = '<div class="music-song-btn delete-btn" data-song-id="' + song.id + '" data-playlist-id="' + playlistId + '">' + SVGIcons.delete + '</div>'; 
    } 
     
    return '<div class="music-song-item" data-id="' + song.id + '">' + 
        '<div class="music-song-cover">' + coverHtml + '</div>' + 
        '<div class="music-song-info">' + 
            '<div class="music-song-name">' + song.title + '</div>' + 
            '<div class="music-song-artist">' + song.artist + '</div>' + 
        '</div>' + 
        '<div class="music-song-actions">' + 
            '<div class="music-song-btn like-btn ' + likedClass + '" data-id="' + song.id + '">' +  
                (isLiked(song.id) ? SVGIcons.heart : SVGIcons.heartOutline) +  
            '</div>' + 
            deleteBtn + 
            '<div class="music-song-play-btn">' + SVGIcons.play + '</div>' + 
        '</div>' + 
    '</div>'; 
} 
 
function generatePlaylistCardHtml(playlist) { 
    const coverHtml = playlist.cover  
        ? '<img src="' + playlist.cover + '" alt="">' 
        : '<div style="width:100%;height:100%;background:linear-gradient(135deg,' + (playlist.color || '#fb7299') + ',' + (playlist.color || '#fb7299') + '66);display:flex;align-items:center;justify-content:center;">' + SVGIcons.playlist + '</div>'; 
     
    return '<div class="music-playlist-card" data-id="' + playlist.id + '">' + 
        '<div class="music-playlist-cover">' + coverHtml + '</div>' + 
        '<div class="music-playlist-name">' + playlist.name + '</div>' + 
        '<div class="music-playlist-count">' + playlist.songs.length + '首</div>' + 
    '</div>'; 
} 
 
function generateRecommendTabContent() { 
    let songsHtml = ''; 
    MusicPlayerState.songs.forEach(function(song) { 
        songsHtml += generateSongItemHtml(song); 
    }); 
     
    let playlistsHtml = '<div class="music-playlist-card create-playlist-card">' + 
        '<div class="music-playlist-cover music-playlist-cover-add">' + SVGIcons.add + '</div>' + 
        '<div class="music-playlist-name">新建歌单</div>' + 
    '</div>'; 
     
    MusicPlayerState.playlists.forEach(function(playlist) { 
        playlistsHtml += generatePlaylistCardHtml(playlist); 
    }); 
     
    return '<div class="music-app-container">' + 
        '<div class="music-header">' + 
            '<div class="music-header-title">音乐</div>' + 
            '<div class="music-header-actions">' + 
                '<div class="music-header-btn add-song-btn">' + SVGIcons.add + '</div>' + 
            '</div>' + 
        '</div>' + 
        '<div class="music-search-bar">' + 
            SVGIcons.search + 
            '<input type="text" placeholder="搜索歌曲、艺术家">' + 
        '</div>' + 
        '<div class="music-section">' + 
            '<div class="music-section-header">' + 
                '<div class="music-section-title">我的歌单</div>' + 
                '<div class="music-section-more">查看全部</div>' + 
            '</div>' + 
            '<div class="music-playlist-scroll">' + playlistsHtml + '</div>' + 
        '</div>' + 
        '<div class="music-section">' + 
            '<div class="music-section-header">' + 
                '<div class="music-section-title">推荐歌曲</div>' + 
            '</div>' + 
            '<div class="music-song-list">' + songsHtml + '</div>' + 
        '</div>' + 
    '</div>'; 
} 
 
function generateDiscoverTabContent() { 
    return '<div class="music-app-container">' + 
        '<div class="music-header">' + 
            '<div class="music-header-title">发现</div>' + 
        '</div>' + 
        '<div class="music-search-bar">' + 
            SVGIcons.search + 
            '<input type="text" placeholder="搜索新音乐">' + 
        '</div>' + 
        '<div class="music-section">' + 
            '<div class="music-section-header">' + 
                '<div class="music-section-title">探索</div>' + 
            '</div>' + 
            '<div class="music-discover-grid">' + 
                '<div class="music-discover-card">' + 
                    '<div class="music-discover-icon" style="background:linear-gradient(135deg,#ff6b6b,#ee5a5a);">' + SVGIcons.chart + '</div>' + 
                    '<div class="music-discover-title">排行榜</div>' + 
                    '<div class="music-discover-desc">热门歌曲实时更新</div>' + 
                '</div>' + 
                '<div class="music-discover-card">' + 
                    '<div class="music-discover-icon" style="background:linear-gradient(135deg,#4ecdc4,#44bfb6);">' + SVGIcons.radio + '</div>' + 
                    '<div class="music-discover-title">私人电台</div>' + 
                    '<div class="music-discover-desc">为你量身定制</div>' + 
                '</div>' + 
                '<div class="music-discover-card">' + 
                    '<div class="music-discover-icon" style="background:linear-gradient(135deg,#a29bfe,#9388ee);">' + SVGIcons.playlist + '</div>' + 
                    '<div class="music-discover-title">精选歌单</div>' + 
                    '<div class="music-discover-desc">编辑精心推荐</div>' + 
                '</div>' + 
                '<div class="music-discover-card">' + 
                    '<div class="music-discover-icon" style="background:linear-gradient(135deg,#fd79a8,#f06292);">' + SVGIcons.clock + '</div>' + 
                    '<div class="music-discover-title">最近播放</div>' + 
                    '<div class="music-discover-desc">回顾你的歌单</div>' + 
                '</div>' + 
            '</div>' + 
        '</div>' + 
    '</div>'; 
} 
 
function generateMeTabContent() { 
    const likedCount = MusicPlayerState.likedSongs.length; 
    const playlistCount = MusicPlayerState.playlists.length; 
     
    return '<div class="music-app-container">' + 
        '<div class="music-header">' + 
            '<div class="music-header-title">我的</div>' + 
            '<div class="music-header-actions">' + 
                '<div class="music-header-btn">' + SVGIcons.settings + '</div>' + 
            '</div>' + 
        '</div>' + 
        '<div class="music-user-header">' + 
            '<div class="music-user-avatar">' + SVGIcons.user + '</div>' + 
            '<div class="music-user-name">音乐爱好者</div>' + 
            '<div class="music-user-bio">用音乐治愈每一天</div>' + 
        '</div>' + 
        '<div class="music-user-stats">' + 
            '<div class="music-user-stat">' + 
                '<div class="music-user-stat-num">' + likedCount + '</div>' + 
                '<div class="music-user-stat-label">喜欢</div>' + 
            '</div>' + 
            '<div class="music-user-stat">' + 
                '<div class="music-user-stat-num">' + playlistCount + '</div>' + 
                '<div class="music-user-stat-label">歌单</div>' + 
            '</div>' + 
            '<div class="music-user-stat">' + 
                '<div class="music-user-stat-num">' + MusicPlayerState.songs.length + '</div>' + 
                '<div class="music-user-stat-label">曲库</div>' + 
            '</div>' + 
        '</div>' + 
        '<div class="music-menu-list">' + 
            '<div class="music-menu-item liked-songs-menu">' + 
                '<div class="music-menu-icon" style="background:linear-gradient(135deg,#fb7299,#ff9a9e);">' + SVGIcons.heart + '</div>' + 
                '<div class="music-menu-text">我喜欢的音乐</div>' + 
                '<div class="music-menu-arrow">›</div>' + 
            '</div>' + 
            '<div class="music-menu-item lyrics-editor-menu">' + 
                '<div class="music-menu-icon" style="background:linear-gradient(135deg,#00c6fb,#005bea);">' + SVGIcons.edit + '</div>' + 
                '<div class="music-menu-text">歌词编辑</div>' + 
                '<div class="music-menu-arrow">›</div>' + 
            '</div>' + 
        '</div>' + 
    '</div>'; 
} 
 
/* ============ 一起听专用SVG图标 ============ */
const ListenTogetherIcons = {
    headphones: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h2v-8H5v-1a7 7 0 0 1 14 0v1h-2v8h2c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>',
    wave: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10zm-10 6c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm3-6c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
    connect: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm9 1h-4v2h4V9zm-4 4h4v2h-4v-2z"/></svg>',
    online: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>',
    invite: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
};

/* ============ 一起听计时器 ============ */
let listenTogetherTimerInterval = null;

function startListenTogetherTimer() {
    if (listenTogetherTimerInterval) {
        clearInterval(listenTogetherTimerInterval);
    }
    listenTogetherTimerInterval = setInterval(function() {
        updateListenTogetherTimerDisplay();
    }, 1000);
}

function stopListenTogetherTimer() {
    if (listenTogetherTimerInterval) {
        clearInterval(listenTogetherTimerInterval);
        listenTogetherTimerInterval = null;
    }
}

function updateListenTogetherTimerDisplay() {
    const lt = MusicPlayerState.listenTogether;
    if (!lt.active || !lt.startTime) return;
    
    const timerEl = document.querySelector('.listen-together-timer');
    if (timerEl) {
        const duration = Math.floor((Date.now() - lt.startTime) / 1000);
        timerEl.textContent = formatListenDuration(duration);
    }
}

function formatListenDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return hours + ':' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
    }
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

/* ============ 一起听标签页 ============ */
function generateListenTogetherTabContent() {
    const lt = MusicPlayerState.listenTogether;
    const isActive = lt.active;
    
    // 获取所有AI角色
    let aisHtml = '';
    const allAIs = PhoneCore ? (PhoneCore.getAIsByType('main') || []).concat(PhoneCore.getAIsByType('supporting') || []) : [];
    
    if (allAIs.length === 0) {
        aisHtml = '<div class="listen-together-empty">' +
            '<div class="listen-together-empty-icon">' + ListenTogetherIcons.headphones + '</div>' +
            '<div class="listen-together-empty-title">暂无好友</div>' +
            '<div class="listen-together-empty-desc">请先在系统配置中创建AI角色</div>' +
        '</div>';
    } else {
        aisHtml += '<div class="listen-together-friends-list">';
        allAIs.forEach(function(ai) {
            const isConnected = isActive && lt.aiId === ai.id;
            aisHtml += '<div class="listen-together-friend-item' + (isConnected ? ' connected' : '') + '" data-ai-id="' + ai.id + '">' +
                '<div class="listen-together-friend-avatar">';
            if (ai.avatar) {
                aisHtml += '<img src="' + ai.avatar + '" alt="">';
            } else {
                aisHtml += '<div class="listen-together-friend-avatar-placeholder">' + (ai.name ? ai.name.charAt(0) : '?') + '</div>';
            }
            if (isConnected) {
                aisHtml += '<div class="listen-together-friend-online"></div>';
            }
            aisHtml += '</div>' +
                '<div class="listen-together-friend-info">' +
                    '<div class="listen-together-friend-name">' + ai.name + '</div>' +
                    '<div class="listen-together-friend-status">' + (isConnected ? '正在一起听...' : '点击邀请') + '</div>' +
                '</div>' +
                '<div class="listen-together-friend-action">' +
                    (isConnected ? '<div class="listen-together-wave-indicator"><span></span><span></span><span></span></div>' : '<div class="listen-together-invite-icon">' + ListenTogetherIcons.invite + '</div>') +
                '</div>' +
            '</div>';
        });
        aisHtml += '</div>';
    }
    
    // 当前一起听状态卡片 - 始终显示
    let statusHtml = '';
    const currentSong = MusicPlayerState.currentSong;
    
    if (isActive) {
        // 活跃状态 - 显示正在一起听
        const duration = lt.startTime ? Math.floor((Date.now() - lt.startTime) / 1000) : 0;
        
        statusHtml = '<div class="listen-together-active-card">' +
            '<div class="listen-together-active-header">' +
                '<div class="listen-together-active-indicator">' +
                    '<div class="listen-together-pulse"></div>' +
                    '<span class="listen-together-status-text">正在一起听</span>' +
                '</div>' +
                '<div class="listen-together-timer-wrap">' +
                    '<div class="listen-together-timer-icon">' + ListenTogetherIcons.clock + '</div>' +
                    '<span class="listen-together-timer">' + formatListenDuration(duration) + '</span>' +
                '</div>' +
            '</div>' +
            
            '<div class="listen-together-partner-info">' +
                '<div class="listen-together-partner-label">与</div>' +
                '<div class="listen-together-partner-name">' + (lt.aiName || 'AI') + '</div>' +
                '<div class="listen-together-partner-label">一起</div>' +
            '</div>' +
            
            '<div class="listen-together-now-playing">' +
                '<div class="listen-together-song-cover">';
        
        if (currentSong) {
            if (currentSong.cover) {
                statusHtml += '<img src="' + currentSong.cover + '" alt="">';
            } else {
                statusHtml += '<div class="listen-together-song-cover-placeholder" style="background:linear-gradient(135deg,' + currentSong.color + ',' + currentSong.color + '99);">' + SVGIcons.music + '</div>';
            }
            statusHtml += '</div>' +
                '<div class="listen-together-song-info">' +
                    '<div class="listen-together-song-title">' + currentSong.title + '</div>' +
                    '<div class="listen-together-song-artist">' + currentSong.artist + '</div>' +
                '</div>';
        } else {
            statusHtml += '<div class="listen-together-song-cover-placeholder">' + SVGIcons.music + '</div>' +
                '</div>' +
                '<div class="listen-together-song-info">' +
                    '<div class="listen-together-song-title">未播放歌曲</div>' +
                    '<div class="listen-together-song-artist">选择一首歌开始吧</div>' +
                '</div>';
        }
        
        statusHtml += '</div>' +
            
            '<div class="listen-together-actions">' +
                '<button class="listen-together-action-btn ai-switch-song-btn">' +
                    '<div class="listen-together-action-icon">' + ListenTogetherIcons.shuffle + '</div>' +
                    '<span>让TA切歌</span>' +
                '</button>' +
                '<button class="listen-together-action-btn share-current-song-btn">' +
                    '<div class="listen-together-action-icon">' + ListenTogetherIcons.send + '</div>' +
                    '<span>分享歌曲</span>' +
                '</button>' +
            '</div>' +
            
            '<button class="listen-together-end-btn end-listen-together-btn">' +
                '<div class="listen-together-end-icon">' + ListenTogetherIcons.stop + '</div>' +
                '<span>结束一起听</span>' +
            '</button>' +
        '</div>';
        
        // 启动计时器
        setTimeout(startListenTogetherTimer, 100);
    } else {
        // 非活跃状态 - 显示空状态卡片，引导用户开始一起听
        statusHtml = '<div class="listen-together-idle-card">' +
            '<div class="listen-together-idle-icon">' + ListenTogetherIcons.headphones + '</div>' +
            '<div class="listen-together-idle-content">' +
                '<div class="listen-together-idle-title">一起听音乐</div>' +
                '<div class="listen-together-idle-desc">选择下方好友，邀请TA和你一起听歌</div>' +
            '</div>';
        
        // 显示当前播放的歌曲（如果有）
        if (currentSong) {
            statusHtml += '<div class="listen-together-idle-song">' +
                '<div class="listen-together-idle-song-cover">';
            if (currentSong.cover) {
                statusHtml += '<img src="' + currentSong.cover + '" alt="">';
            } else {
                statusHtml += '<div style="width:100%;height:100%;background:linear-gradient(135deg,' + currentSong.color + ',' + currentSong.color + '99);border-radius:8px;display:flex;align-items:center;justify-content:center;">' + SVGIcons.music + '</div>';
            }
            statusHtml += '</div>' +
                '<div class="listen-together-idle-song-info">' +
                    '<div class="listen-together-idle-song-title">' + currentSong.title + '</div>' +
                    '<div class="listen-together-idle-song-artist">' + currentSong.artist + '</div>' +
                '</div>' +
            '</div>';
        }
        
        statusHtml += '</div>';
    }
    
    // 一起听历史记录
    let historyHtml = '';
    if (PhoneCore && PhoneCore.activity) {
        historyHtml = '<div class="listen-together-history-section">' +
            '<div class="listen-together-section-header">' +
                '<div class="listen-together-section-icon">' + ListenTogetherIcons.history + '</div>' +
                '<span>一起听记录</span>' +
            '</div>' +
            '<div class="listen-together-history-list" id="listen-together-history"></div>' +
        '</div>';
    }
    
    return '<div class="music-app-container listen-together-page">' +
        '<div class="music-header">' +
            '<div class="music-header-title">一起听</div>' +
            '<div class="music-header-actions">' +
                '<div class="music-header-btn send-playlist-btn" title="分享歌单">' + SVGIcons.share + '</div>' +
            '</div>' +
        '</div>' +
        statusHtml +
        '<div class="listen-together-content">' +
            '<div class="listen-together-section-header">' +
                '<div class="listen-together-section-icon">' + ListenTogetherIcons.connect + '</div>' +
                '<span>选择好友</span>' +
            '</div>' +
            aisHtml +
        '</div>' +
        historyHtml +
    '</div>';
}

function bindListenTogetherTabEvents(container) {
    // AI好友点击 - 邀请一起听
    container.querySelectorAll('.listen-together-friend-item').forEach(function(item) {
        item.onclick = function() {
            const aiId = item.getAttribute('data-ai-id');
            if (MusicPlayerState.listenTogether.active && MusicPlayerState.listenTogether.aiId === aiId) {
                // 已经在一起听，不做操作
                return;
            }
            inviteListenTogether(aiId);
        };
    });
    
    // 结束一起听
    const endBtn = container.querySelector('.end-listen-together-btn');
    if (endBtn) {
        endBtn.onclick = function() {
            endListenTogether();
        };
    }
    
    // 分享歌单按钮
    const sharePlaylistBtn = container.querySelector('.send-playlist-btn');
    if (sharePlaylistBtn) {
        sharePlaylistBtn.onclick = function() {
            showSharePlaylistModal();
        };
    }
    
    // AI切歌按钮
    const aiSwitchBtn = container.querySelector('.ai-switch-song-btn');
    if (aiSwitchBtn) {
        aiSwitchBtn.onclick = function() {
            aiSwitchSong();
        };
    }
    
    // 分享当前歌曲按钮
    const shareCurrentBtn = container.querySelector('.share-current-song-btn');
    if (shareCurrentBtn) {
        shareCurrentBtn.onclick = function() {
            shareCurrentSong();
        };
    }
    
    // 加载一起听历史记录
    loadListenTogetherHistory(container);
}

/* 【加载一起听历史记录】 */
function loadListenTogetherHistory(container) {
    const historyList = container.querySelector('#listen-together-history');
    if (!historyList || !PhoneCore || !PhoneCore.activity) return;
    
    PhoneCore.activity.getAllRecords().then(function(records) {
        // 筛选一起听音乐的记录
        const musicRecords = records.filter(function(r) {
            return r.type === 'listening_music' && r.status === 'completed';
        }).sort(function(a, b) {
            return (b.startTime || b.timestamp) - (a.startTime || a.timestamp);
        }).slice(0, 10); // 最多显示10条
        
        if (musicRecords.length === 0) {
            historyList.innerHTML = '<div class="listen-together-history-empty">暂无一起听记录</div>';
            return;
        }
        
        let html = '';
        musicRecords.forEach(function(record) {
            const ai = PhoneCore.getAI(record.aiId);
            const aiName = ai ? ai.name : '未知';
            const aiAvatar = ai ? ai.avatar : null;
            const duration = record.duration || 0;
            const date = new Date(record.startTime || record.timestamp);
            const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
                           date.getHours().toString().padStart(2, '0') + ':' + 
                           date.getMinutes().toString().padStart(2, '0');
            
            html += '<div class="listen-together-history-item">' +
                '<div class="listen-together-history-avatar">';
            if (aiAvatar) {
                html += '<img src="' + aiAvatar + '" alt="">';
            } else {
                html += '<div class="listen-together-history-avatar-placeholder">' + (aiName ? aiName.charAt(0) : '?') + '</div>';
            }
            html += '</div>' +
                '<div class="listen-together-history-info">' +
                    '<div class="listen-together-history-name">与 ' + aiName + ' 一起听</div>' +
                    '<div class="listen-together-history-meta">' + dateStr + '</div>' +
                '</div>' +
                '<div class="listen-together-history-duration">' + formatListenDuration(Math.floor(duration / 1000)) + '</div>' +
            '</div>';
        });
        
        historyList.innerHTML = html;
    }).catch(function() {
        historyList.innerHTML = '<div class="listen-together-history-empty">加载记录失败</div>';
    });
}

/* 【邀请一起听】发送邀请卡片到聊天 */
function inviteListenTogether(aiId) {
    const ai = PhoneCore ? PhoneCore.getAI(aiId) : null;
    if (!ai) return;
    
    // 发送邀请卡片到聊天
    sendListenTogetherInvite(aiId, 'user');
    
    // 显示邀请通知
    PhoneCore.notifications.send({
        type: 'info',
        title: '已发送邀请',
        message: '等待 ' + ai.name + ' 接受',
        size: 'mini'
    });
    
    // 模拟AI接受邀请（1-2秒后自动接受）
    setTimeout(function() {
        // 添加AI接受消息到聊天
        if (ai.chatHistory) {
            const acceptMessages = [
                '好呀，一起听~',
                '来啦来啦！',
                '正好想听歌呢',
                '当然可以！',
                '好的，一起听吧'
            ];
            const randomMsg = acceptMessages[Math.floor(Math.random() * acceptMessages.length)];
            ai.chatHistory.push({
                role: 'assistant',
                content: randomMsg,
                timestamp: Date.now()
            });
            PhoneCore.saveAI(ai);
        }
        
        // 开始一起听
        startListenTogether(aiId);
        
        // 显示成功通知
        PhoneCore.notifications.send({
            type: 'success',
            title: ai.name + ' 加入了一起听',
            size: 'mini'
        });
    }, 1000 + Math.random() * 1000);
}

/* 【开始一起听】 */
function startListenTogether(aiId) {
    const ai = PhoneCore ? PhoneCore.getAI(aiId) : null;
    if (!ai) return;
    
    const lt = MusicPlayerState.listenTogether;
    lt.active = true;
    lt.aiId = aiId;
    lt.aiName = ai.name;
    lt.startTime = Date.now();
    
    // 使用ActivityTracker记录活动
    if (PhoneCore && PhoneCore.activity) {
        lt.sessionId = PhoneCore.activity.startActivity({
            type: 'listening_music',
            aiId: aiId,
            appId: 'music-app',
            metadata: {
                songId: MusicPlayerState.currentSong ? MusicPlayerState.currentSong.id : null,
                songTitle: MusicPlayerState.currentSong ? MusicPlayerState.currentSong.title : null
            }
        });
    }
    
    // 启动计时器
    startListenTogetherTimer();
    
    // 刷新界面
    refreshListenTogetherTab();
    
    PhoneCore.notifications.send({
        type: 'success',
        title: '开始一起听',
        message: '与 ' + ai.name + ' 一起听音乐',
        size: 'mini'
    });
}

/* 【结束一起听】 */
function endListenTogether() {
    const lt = MusicPlayerState.listenTogether;
    
    // 停止计时器
    stopListenTogetherTimer();
    
    // 计算一起听时长并保存记录
    if (lt.active && lt.sessionId && PhoneCore && PhoneCore.activity) {
        PhoneCore.activity.endActivity(lt.sessionId, {
            endReason: 'user_ended',
            songsPlayed: 1,
            totalDuration: lt.startTime ? Date.now() - lt.startTime : 0
        });
    }
    
    lt.active = false;
    lt.sessionId = null;
    lt.aiId = null;
    lt.aiName = null;
    lt.startTime = null;
    
    refreshListenTogetherTab();
    
    PhoneCore.notifications.send({
        type: 'info',
        title: '已结束一起听',
        size: 'mini'
    });
}

/* 【刷新一起听标签页】 */
function refreshListenTogetherTab() {
    const contentArea = document.querySelector('#main-content-area');
    if (contentArea && musicApp && musicApp.currentTabIndex === 1) {
        contentArea.innerHTML = generateListenTogetherTabContent();
        bindListenTogetherTabEvents(contentArea);
    }
}

/* 【AI切歌】模拟AI为你选择一首歌曲 */
function aiSwitchSong() {
    const lt = MusicPlayerState.listenTogether;
    if (!lt.active) return;
    
    const songs = MusicPlayerState.songs;
    if (!songs.length) {
        PhoneCore.notifications.send({
            type: 'warning',
            title: '没有可播放的歌曲',
            size: 'mini'
        });
        return;
    }
    
    // 随机选择一首不同的歌曲
    let randomIndex = Math.floor(Math.random() * songs.length);
    if (songs.length > 1 && MusicPlayerState.currentSong) {
        const currentIndex = songs.findIndex(s => s.id === MusicPlayerState.currentSong.id);
        while (randomIndex === currentIndex) {
            randomIndex = Math.floor(Math.random() * songs.length);
        }
    }
    
    const newSong = songs[randomIndex];
    const aiName = lt.aiName || 'TA';
    
    // 播放新歌曲
    playSong(newSong);
    refreshPlayerPage();
    refreshListenTogetherTab();
    
    // 显示AI切歌通知
    PhoneCore.notifications.send({
        type: 'info',
        title: aiName + ' 切换了歌曲',
        message: '正在播放：' + newSong.title,
        size: 'mini'
    });
    
    // 添加到聊天记录
    const ai = PhoneCore ? PhoneCore.getAI(lt.aiId) : null;
    if (ai && ai.chatHistory) {
        const songRecommendations = [
            '这首歌很适合现在的氛围！',
            '我觉得你会喜欢这首～',
            '换个风格听听看！',
            '这是我最近循环的歌！',
            '突然想到这首歌，一起听吧～'
        ];
        const randomComment = songRecommendations[Math.floor(Math.random() * songRecommendations.length)];
        
        ai.chatHistory.push({
            role: 'assistant',
            content: randomComment + '\n[' + newSong.title + ' - ' + newSong.artist + ']',
            timestamp: Date.now()
        });
        PhoneCore.saveAI(ai);
    }
}

/* 【分享当前歌曲】发送当前播放的歌曲到聊天 */
function shareCurrentSong() {
    const lt = MusicPlayerState.listenTogether;
    const song = MusicPlayerState.currentSong;
    
    if (!song) {
        PhoneCore.notifications.send({
            type: 'warning',
            title: '没有正在播放的歌曲',
            size: 'mini'
        });
        return;
    }
    
    const ai = PhoneCore ? PhoneCore.getAI(lt.aiId) : null;
    if (!ai) {
        PhoneCore.notifications.send({
            type: 'warning',
            title: '请先开始一起听',
            size: 'mini'
        });
        return;
    }
    
    // 创建歌曲分享卡片
    const songCard = {
        type: 'song_share',
        id: 'song_' + Date.now(),
        songId: song.id,
        title: song.title,
        artist: song.artist,
        cover: song.cover,
        color: song.color,
        duration: MusicPlayerState.duration,
        timestamp: Date.now()
    };
    
    // 添加到聊天记录
    if (ai.chatHistory) {
        ai.chatHistory.push({
            role: 'user',
            content: '',
            type: 'song_share',
            songCard: songCard,
            timestamp: Date.now()
        });
        PhoneCore.saveAI(ai);
    }
    
    PhoneCore.notifications.send({
        type: 'success',
        title: '歌曲已分享',
        message: song.title,
        size: 'mini'
    });
}

/* 【发送一起听邀请卡片到聊天】 */
function sendListenTogetherInvite(aiId, sender) {
    const ai = PhoneCore ? PhoneCore.getAI(aiId) : null;
    if (!ai) return;
    
    const song = MusicPlayerState.currentSong;
    const inviteCard = {
        type: 'listen_together_invite',
        id: 'invite_' + Date.now(),
        sender: sender, // 'user' 或 'ai'
        songId: song ? song.id : null,
        songTitle: song ? song.title : '邀请你一起听音乐',
        songArtist: song ? song.artist : '',
        songCover: song ? song.cover : null,
        songColor: song ? song.color : '#fb7299',
        timestamp: Date.now()
    };
    
    // 添加消息到聊天历史
    if (ai.chatHistory) {
        ai.chatHistory.push({
            role: sender === 'user' ? 'user' : 'assistant',
            content: '',
            type: 'listen_together_invite',
            inviteCard: inviteCard,
            timestamp: Date.now()
        });
        PhoneCore.saveAI(ai);
    }
}

/* 【分享歌单模态框】 */
function showSharePlaylistModal() {
    const playlists = MusicPlayerState.playlists;
    
    let playlistsHtml = '';
    playlists.forEach(function(pl) {
        playlistsHtml += '<div class="share-playlist-item" data-playlist-id="' + pl.id + '" style="' +
            'display:flex;align-items:center;padding:14px;margin-bottom:10px;' +
            'background:#f8f8f8;border-radius:14px;cursor:pointer;transition:all 0.2s;">' +
            '<div style="width:44px;height:44px;border-radius:10px;overflow:hidden;margin-right:12px;background:linear-gradient(135deg,' + (pl.color || '#fb7299') + ',' + (pl.color || '#fb7299') + '66);display:flex;align-items:center;justify-content:center;">' +
                SVGIcons.playlist +
            '</div>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:600;font-size:15px;color:#1a1a1a;">' + pl.name + '</div>' +
                '<div style="font-size:12px;color:#888;margin-top:2px;">' + pl.songs.length + '首歌曲</div>' +
            '</div>' +
        '</div>';
    });
    
    showModal('分享歌单给AI', 
        '<div style="max-height:300px;overflow-y:auto;">' + playlistsHtml + '</div>' +
        '<div style="margin-top:15px;">' +
            '<select id="share-playlist-ai-select" style="width:100%;padding:14px;border:1.5px solid rgba(251,114,153,0.2);border-radius:12px;font-size:14px;outline:none;">' +
                '<option value="">选择AI好友</option>' +
                getAIOptionsHtml() +
            '</select>' +
        '</div>',
        function() {
            // 确认分享
            const selected = document.querySelector('.share-playlist-item.selected');
            const aiSelect = document.querySelector('#share-playlist-ai-select');
            if (selected && aiSelect && aiSelect.value) {
                const playlistId = parseInt(selected.getAttribute('data-playlist-id'));
                const aiId = aiSelect.value;
                sharePlaylistToAI(playlistId, aiId);
            }
        }
    );
    
    // 绑定歌单选择事件
    setTimeout(function() {
        document.querySelectorAll('.share-playlist-item').forEach(function(item) {
            item.onclick = function() {
                document.querySelectorAll('.share-playlist-item').forEach(function(i) {
                    i.classList.remove('selected');
                    i.style.border = 'none';
                });
                item.classList.add('selected');
                item.style.border = '2px solid #fb7299';
            };
        });
    }, 100);
}

function getAIOptionsHtml() {
    let html = '';
    const allAIs = PhoneCore ? (PhoneCore.getAIsByType('main') || []).concat(PhoneCore.getAIsByType('supporting') || []) : [];
    allAIs.forEach(function(ai) {
        html += '<option value="' + ai.id + '">' + ai.name + '</option>';
    });
    return html;
}

/* 【分享歌单给AI】 */
function sharePlaylistToAI(playlistId, aiId) {
    const playlist = MusicPlayerState.playlists.find(function(p) { return p.id === playlistId; });
    const ai = PhoneCore ? PhoneCore.getAI(aiId) : null;
    if (!playlist || !ai) return;
    
    // 创建歌单分享卡片
    const shareCard = {
        type: 'playlist_share',
        id: 'playlist_share_' + Date.now(),
        playlistId: playlist.id,
        playlistName: playlist.name,
        playlistColor: playlist.color,
        songCount: playlist.songs.length,
        songNames: playlist.songs.map(function(s) { return s.title; }).slice(0, 5),
        timestamp: Date.now()
    };
    
    // 添加到聊天
    if (ai.chatHistory) {
        ai.chatHistory.push({
            role: 'user',
            content: '',
            type: 'playlist_share',
            shareCard: shareCard,
            timestamp: Date.now()
        });
        PhoneCore.saveAI(ai);
    }
    
    PhoneCore.notifications.send({
        type: 'success',
        title: '歌单已分享',
        message: '发送给 ' + ai.name,
        size: 'mini'
    });
}

function generatePlayerPageHtml(song) { 
    const liked = isLiked(song.id); 
    const likeIcon = liked ? SVGIcons.heart : SVGIcons.heartOutline; 
    const coverHtml = song.cover  
        ? '<img src="' + song.cover + '" alt="">' 
        : '<div class="music-player-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>'; 
     
    let lyricsHtml = ''; 
    const lyrics = song.lyrics || defaultLyrics; 
    lyrics.forEach(function(line, index) { 
        lyricsHtml += '<div class="music-lyric-line" data-index="' + index + '">' + line.text + '</div>'; 
    }); 
    
    // 获取颜色变体
    const colorVariants = getColorVariants(song.color);
    const themeStyles = '--theme-color:' + colorVariants.main + ';' +
        '--theme-color-light:' + colorVariants.light + ';' +
        '--theme-color-dark:' + colorVariants.dark + ';' +
        '--theme-shadow:' + colorVariants.shadow + ';' +
        '--theme-bg-light:' + colorVariants.bgLight + ';';
     
    return '<div class="music-player-page" style="' + themeStyles + 'background:' + colorVariants.bgGradient + ';">' + 
        '<div class="music-player-cover-wrap">' + 
            '<div class="music-player-cover">' + coverHtml + '</div>' + 
        '</div>' + 
        '<div class="music-player-info">' + 
            '<div class="music-player-title">' + song.title + '</div>' + 
            '<div class="music-player-artist">' + song.artist + '</div>' + 
        '</div>' + 
        '<div class="music-player-progress">' + 
            '<div class="music-player-progress-bar">' + 
                '<div class="music-player-progress-fill" style="width:' + MusicPlayerState.progress + '%;"></div>' + 
            '</div>' + 
            '<div class="music-player-time">' + 
                '<span class="music-player-time-now">' + formatTime(MusicPlayerState.currentTime) + '</span>' + 
                '<span class="music-player-time-total">' + formatTime(MusicPlayerState.duration) + '</span>' + 
            '</div>' + 
        '</div>' + 
        '<div class="music-player-controls">' + 
            '<div class="music-player-btn prev-btn">' + SVGIcons.prev + '</div>' + 
            '<div class="music-player-btn music-player-btn-main play-toggle-btn">' + (MusicPlayerState.isPlaying ? SVGIcons.pause : SVGIcons.play) + '</div>' + 
            '<div class="music-player-btn next-btn">' + SVGIcons.next + '</div>' + 
        '</div>' + 
        '<div class="music-player-actions">' + 
            '<div class="music-player-action play-mode-btn" data-mode="' + MusicPlayerState.playMode + '">' + 
                getPlayModeIcon(MusicPlayerState.playMode) + 
                '<span>' + getPlayModeName(MusicPlayerState.playMode) + '</span>' + 
            '</div>' + 
            '<div class="music-player-action like-btn ' + (liked ? 'liked' : '') + '" data-id="' + song.id + '">' + 
                likeIcon + 
                '<span>喜欢</span>' + 
            '</div>' + 
            '<div class="music-player-action add-to-playlist-btn" data-id="' + song.id + '">' + 
                SVGIcons.add + 
                '<span>收藏</span>' + 
            '</div>' + 
            '<div class="music-player-action share-btn">' + 
                SVGIcons.share + 
                '<span>分享</span>' + 
            '</div>' + 
        '</div>' + 
        '<div class="music-lyrics-container">' + lyricsHtml + '</div>' + 
    '</div>'; 
} 
 
function showModal(title, content, onConfirm, onCancel) { 
    const appWindow = musicApp.appWindow; 
    if (!appWindow) return; 
     
    const modal = document.createElement('div'); 
    modal.className = 'music-modal-overlay'; 
    modal.innerHTML = '<div class="music-modal">' + 
        '<div class="music-modal-handle"></div>' + 
        '<div class="music-modal-title">' + title + '</div>' + 
        content + 
    '</div>'; 
     
    appWindow.appendChild(modal); 
     
    const cancelBtn = modal.querySelector('.music-modal-btn-cancel'); 
    const confirmBtn = modal.querySelector('.music-modal-btn-confirm'); 
     
    if (cancelBtn) { 
        cancelBtn.onclick = function() { 
            modal.style.animation = 'modalFadeIn 0.2s ease reverse'; 
            modal.querySelector('.music-modal').style.animation = 'modalSlideUp 0.25s ease reverse'; 
            setTimeout(function() { modal.remove(); }, 200); 
            if (onCancel) onCancel(); 
        }; 
    } 
     
    if (confirmBtn) { 
        confirmBtn.onclick = function() { 
            if (onConfirm) { 
                const result = onConfirm(modal); 
                if (result !== false) { 
                    modal.style.animation = 'modalFadeIn 0.2s ease reverse'; 
                    modal.querySelector('.music-modal').style.animation = 'modalSlideUp 0.25s ease reverse'; 
                    setTimeout(function() { modal.remove(); }, 200); 
                } 
            } 
        }; 
    } 
     
    modal.onclick = function(e) { 
        if (e.target === modal) { 
            modal.style.animation = 'modalFadeIn 0.2s ease reverse'; 
            modal.querySelector('.music-modal').style.animation = 'modalSlideUp 0.25s ease reverse'; 
            setTimeout(function() { modal.remove(); }, 200); 
        } 
    }; 
     
    return modal; 
} 
 
function showAddSongModal() { 
    const content = '<div class="music-modal-section">' + 
            '<div class="music-modal-label">歌曲链接</div>' + 
            '<input type="text" class="music-modal-input" id="song-url-input" placeholder="输入音乐文件URL">' + 
        '</div>' + 
        '<div class="music-modal-section">' + 
            '<div class="music-modal-label">歌曲名称</div>' + 
            '<input type="text" class="music-modal-input" id="song-title-input" placeholder="输入歌曲名称">' + 
        '</div>' + 
        '<div class="music-modal-section">' + 
            '<div class="music-modal-label">艺术家</div>' + 
            '<input type="text" class="music-modal-input" id="song-artist-input" placeholder="输入艺术家名称">' + 
        '</div>' + 
        '<div class="music-modal-section">' + 
            '<div class="music-modal-label">封面图片</div>' + 
            '<input type="text" class="music-modal-input" id="song-cover-input" placeholder="输入封面图片URL（可选）">' + 
        '</div>' + 
        '<div class="music-modal-section">' + 
            '<div class="music-modal-label">歌词文件</div>' + 
            '<input type="file" class="music-modal-file-input" id="lrc-file-input" accept=".lrc,.txt">' + 
            '<div class="music-modal-file-btn" id="lrc-file-btn">' + SVGIcons.file + ' 选择LRC歌词文件</div>' + 
        '</div>' + 
        '<div class="music-modal-btns">' + 
            '<button class="music-modal-btn music-modal-btn-cancel">取消</button>' + 
            '<button class="music-modal-btn music-modal-btn-confirm">添加</button>' + 
        '</div>'; 
     
    const modal = showModal('添加歌曲', content, function(modalEl) { 
        const url = modalEl.querySelector('#song-url-input').value.trim(); 
        const title = modalEl.querySelector('#song-title-input').value.trim(); 
        const artist = modalEl.querySelector('#song-artist-input').value.trim(); 
        const cover = modalEl.querySelector('#song-cover-input').value.trim(); 
        const lrcContent = modalEl.querySelector('#lrc-file-input').dataset.content || ''; 
         
        if (!url) { 
            modalEl.querySelector('#song-url-input').style.borderColor = '#ff6b6b'; 
            return false; 
        } 
         
        addSongByUrl(url, title, artist, cover, lrcContent); 
        return true; 
    }); 
     
    if (modal) { 
        const fileBtn = modal.querySelector('#lrc-file-btn'); 
        const fileInput = modal.querySelector('#lrc-file-input'); 
         
        fileBtn.onclick = function() { 
            fileInput.click(); 
        }; 
         
        fileInput.onchange = function(e) { 
            const file = e.target.files[0]; 
            if (file) { 
                const reader = new FileReader(); 
                reader.onload = function(e) { 
                    fileInput.dataset.content = e.target.result; 
                    fileBtn.innerHTML = SVGIcons.check + ' ' + file.name; 
                    fileBtn.classList.add('has-file'); 
                }; 
                reader.readAsText(file); 
            } 
        }; 
    } 
} 
 
function showCreatePlaylistModal() { 
    const content = '<div class="music-modal-section">' + 
            '<div class="music-modal-label">歌单名称</div>' + 
            '<input type="text" class="music-modal-input" id="playlist-name-input" placeholder="给歌单起个名字">' + 
        '</div>' + 
        '<div class="music-modal-section">' + 
            '<div class="music-modal-label">封面图片</div>' + 
            '<input type="text" class="music-modal-input" id="playlist-cover-input" placeholder="输入封面图片URL（可选）">' + 
        '</div>' + 
        '<div class="music-modal-btns">' + 
            '<button class="music-modal-btn music-modal-btn-cancel">取消</button>' + 
            '<button class="music-modal-btn music-modal-btn-confirm">创建</button>' + 
        '</div>'; 
     
    showModal('新建歌单', content, function(modal) { 
        const name = modal.querySelector('#playlist-name-input').value.trim(); 
        const cover = modal.querySelector('#playlist-cover-input').value.trim(); 
         
        if (!name) { 
            modal.querySelector('#playlist-name-input').style.borderColor = '#ff6b6b'; 
            return false; 
        } 
         
        const newPlaylist = { 
            id: Date.now(), 
            name: name, 
            cover: cover || null, 
            color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'), 
            songs: [] 
        }; 
         
        if (cover) { 
            extractColorFromImage(cover, function(color) { 
                newPlaylist.color = color; 
                refreshSongList(); 
            }); 
        } 
         
        MusicPlayerState.playlists.push(newPlaylist); 
        refreshSongList(); 
        return true; 
    }); 
} 
 
function showAddToPlaylistModal(songId) { 
    let playlistsHtml = ''; 
    MusicPlayerState.playlists.forEach(function(playlist) { 
        const hasSong = playlist.songs.indexOf(songId) > -1; 
        const checkIcon = hasSong ? SVGIcons.check : ''; 
        playlistsHtml += '<div class="music-menu-item playlist-select-item" data-playlist-id="' + playlist.id + '" data-has-song="' + hasSong + '">' + 
            '<div class="music-menu-icon" style="background:linear-gradient(135deg,' + (playlist.color || '#fb7299') + ',' + (playlist.color || '#fb7299') + '88);">' + SVGIcons.playlist + '</div>' + 
            '<div class="music-menu-text">' + playlist.name + '</div>' + 
            '<div class="music-menu-arrow" style="color:#fb7299;">' + checkIcon + '</div>' + 
        '</div>'; 
    }); 
     
    const content = '<div class="music-menu-list" style="padding:0;">' + playlistsHtml + '</div>' + 
        '<div class="music-modal-btns">' + 
            '<button class="music-modal-btn music-modal-btn-cancel" style="flex:1;">完成</button>' + 
        '</div>'; 
     
    const modal = showModal('添加到歌单', content); 
     
    if (modal) { 
        modal.querySelectorAll('.playlist-select-item').forEach(function(item) { 
            item.onclick = function() { 
                const playlistId = parseInt(item.dataset.playlistId); 
                const playlist = MusicPlayerState.playlists.find(p => p.id === playlistId); 
                 
                if (playlist) { 
                    const songIndex = playlist.songs.indexOf(songId); 
                    if (songIndex > -1) { 
                        playlist.songs.splice(songIndex, 1); 
                        item.dataset.hasSong = 'false'; 
                        item.querySelector('.music-menu-arrow').innerHTML = ''; 
                    } else { 
                        playlist.songs.push(songId); 
                        item.dataset.hasSong = 'true'; 
                        item.querySelector('.music-menu-arrow').innerHTML = SVGIcons.check; 
                    } 
                } 
            }; 
        }); 
    } 
} 
 
function openPlaylistPage(playlist) { 
    let songsHtml = ''; 
    if (playlist.songs.length === 0) { 
        songsHtml = '<div class="music-empty-state">' + 
            SVGIcons.music + 
            '<div class="music-empty-state-text">歌单还是空的</div>' + 
            '<div class="music-empty-state-btn add-songs-to-playlist">' + SVGIcons.add + ' 添加歌曲</div>' + 
        '</div>'; 
    } else { 
        playlist.songs.forEach(function(songId) { 
            const song = MusicPlayerState.songs.find(s => s.id === songId); 
            if (song) { 
                songsHtml += generateSongItemHtml(song, true, playlist.id); 
            } 
        }); 
    } 
     
    const coverHtml = playlist.cover  
        ? '<img src="' + playlist.cover + '" alt="">' 
        : '<div class="music-playlist-detail-cover-placeholder" style="background:linear-gradient(135deg,' + (playlist.color || '#fb7299') + ',' + (playlist.color || '#fb7299') + '88);">' + SVGIcons.playlist + '</div>'; 
     
    const pageHtml = '<div class="music-app-container" style="min-height:100%;">' + 
        '<div class="music-playlist-detail-header">' + 
            '<div class="music-playlist-detail-cover">' + coverHtml + '</div>' + 
            '<div class="music-playlist-detail-info">' + 
                '<div class="music-playlist-detail-name">' + playlist.name + '</div>' + 
                '<div class="music-playlist-detail-count">' + playlist.songs.length + ' 首歌曲</div>' + 
            '</div>' + 
        '</div>' + 
        '<div class="music-playlist-detail-actions">' + 
            '<div class="music-playlist-action-btn music-playlist-action-btn-primary play-all-btn">' + 
                SVGIcons.play + ' 播放全部' + 
            '</div>' + 
            '<div class="music-playlist-action-btn music-playlist-action-btn-secondary edit-playlist-btn" data-id="' + playlist.id + '">' + 
                SVGIcons.edit + ' 编辑' + 
            '</div>' + 
        '</div>' + 
        '<div class="music-song-list">' + songsHtml + '</div>' + 
    '</div>'; 
     
    const page = musicApp.openDetailPage(pageHtml, { enableHomeIndicator: true, background: '#fff5f8' }); 
     
    if (page) { 
        bindPlaylistPageEvents(page, playlist); 
    } 
} 
 
function bindPlaylistPageEvents(page, playlist) { 
    const songItems = page.querySelectorAll('.music-song-item'); 
    songItems.forEach(function(item) { 
        const songId = parseInt(item.dataset.id); 
        const song = MusicPlayerState.songs.find(s => s.id === songId); 
         
        item.onclick = function(e) { 
            if (e.target.closest('.like-btn')) { 
                e.stopPropagation(); 
                toggleLike(songId); 
                const likeBtn = item.querySelector('.like-btn'); 
                if (isLiked(songId)) { 
                    likeBtn.classList.add('liked'); 
                    likeBtn.innerHTML = SVGIcons.heart; 
                } else { 
                    likeBtn.classList.remove('liked'); 
                    likeBtn.innerHTML = SVGIcons.heartOutline; 
                } 
                return; 
            } 
             
            if (e.target.closest('.delete-btn')) { 
                e.stopPropagation(); 
                const index = playlist.songs.indexOf(songId); 
                if (index > -1) { 
                    playlist.songs.splice(index, 1); 
                    item.style.animation = 'fadeOut 0.3s ease'; 
                    setTimeout(function() { 
                        item.remove(); 
                        const countEl = page.querySelector('.music-playlist-detail-count'); 
                        if (countEl) { 
                            countEl.textContent = playlist.songs.length + ' 首歌曲'; 
                        } 
                        if (playlist.songs.length === 0) { 
                            const songList = page.querySelector('.music-song-list'); 
                            if (songList) { 
                                songList.innerHTML = '<div class="music-empty-state">' + 
                                    SVGIcons.music + 
                                    '<div class="music-empty-state-text">歌单还是空的</div>' + 
                                '</div>'; 
                            } 
                        } 
                    }, 300); 
                } 
                return; 
            } 
             
            if (song) { 
                playSong(song); 
                openPlayerPage(song); 
            } 
        }; 
    }); 
     
    const playAllBtn = page.querySelector('.play-all-btn'); 
    if (playAllBtn) { 
        playAllBtn.onclick = function(e) { 
            e.stopPropagation(); 
            if (playlist.songs.length > 0) { 
                const firstSongId = playlist.songs[0]; 
                const firstSong = MusicPlayerState.songs.find(s => s.id === firstSongId); 
                if (firstSong) { 
                    playSong(firstSong); 
                    openPlayerPage(firstSong); 
                } 
            } 
        }; 
    } 
     
    const editBtn = page.querySelector('.edit-playlist-btn'); 
    if (editBtn) { 
        editBtn.onclick = function(e) { 
            e.stopPropagation(); 
            showEditPlaylistModal(playlist, page); 
        }; 
    } 
     
    const addSongsBtn = page.querySelector('.add-songs-to-playlist'); 
    if (addSongsBtn) { 
        addSongsBtn.onclick = function(e) { 
            e.stopPropagation(); 
            showAddSongsToPlaylistModal(playlist, page); 
        }; 
    } 
} 
 
function showEditPlaylistModal(playlist, page) { 
    const content = '<div class="music-modal-section">' + 
            '<div class="music-modal-label">歌单名称</div>' + 
            '<input type="text" class="music-modal-input" id="edit-playlist-name" value="' + playlist.name + '">' + 
        '</div>' + 
        '<div class="music-modal-section">' + 
            '<div class="music-modal-label">封面图片</div>' + 
            '<input type="text" class="music-modal-input" id="edit-playlist-cover" value="' + (playlist.cover || '') + '" placeholder="输入封面图片URL">' + 
        '</div>' + 
        '<div class="music-modal-btns">' + 
            '<button class="music-modal-btn music-modal-btn-cancel">取消</button>' + 
            '<button class="music-modal-btn music-modal-btn-confirm">保存</button>' + 
        '</div>' + 
        '<div style="margin-top:15px;">' + 
            '<button class="music-modal-btn" style="width:100%;background:#fff5f5;color:#ff6b6b;" id="delete-playlist-btn">删除歌单</button>' + 
        '</div>'; 
     
    const modal = showModal('编辑歌单', content, function(modalEl) { 
        const name = modalEl.querySelector('#edit-playlist-name').value.trim(); 
        const cover = modalEl.querySelector('#edit-playlist-cover').value.trim(); 
         
        if (!name) { 
            modalEl.querySelector('#edit-playlist-name').style.borderColor = '#ff6b6b'; 
            return false; 
        } 
         
        playlist.name = name; 
        playlist.cover = cover || null; 
         
        if (cover) { 
            extractColorFromImage(cover, function(color) { 
                playlist.color = color; 
                refreshSongList(); 
            }); 
        } 
         
        const nameEl = page.querySelector('.music-playlist-detail-name'); 
        if (nameEl) nameEl.textContent = name; 
         
        const coverEl = page.querySelector('.music-playlist-detail-cover'); 
        if (coverEl && cover) { 
            coverEl.innerHTML = '<img src="' + cover + '" alt="">'; 
        } 
         
        refreshSongList(); 
        return true; 
    }); 
     
    if (modal) { 
        const deleteBtn = modal.querySelector('#delete-playlist-btn'); 
        if (deleteBtn) { 
            deleteBtn.onclick = function() { 
                const index = MusicPlayerState.playlists.findIndex(p => p.id === playlist.id); 
                if (index > -1) { 
                    MusicPlayerState.playlists.splice(index, 1); 
                    refreshSongList(); 
                    modal.remove(); 
                    const backBtn = page.querySelector('.app-back-btn'); 
                    if (backBtn) backBtn.click(); 
                } 
            }; 
        } 
    } 
} 
 
function showAddSongsToPlaylistModal(playlist, page) { 
    let songsHtml = ''; 
    MusicPlayerState.songs.forEach(function(song) { 
        const inPlaylist = playlist.songs.indexOf(song.id) > -1; 
        const checkIcon = inPlaylist ? SVGIcons.check : ''; 
        const coverHtml = song.cover  
            ? '<img src="' + song.cover + '" style="width:100%;height:100%;object-fit:cover;">' 
            : '<div style="width:100%;height:100%;background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:white;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>'; 
         
        songsHtml += '<div class="music-menu-item song-select-item" data-song-id="' + song.id + '" data-in-playlist="' + inPlaylist + '">' + 
            '<div style="width:42px;height:42px;border-radius:10px;overflow:hidden;margin-right:14px;flex-shrink:0;">' + coverHtml + '</div>' + 
            '<div style="flex:1;min-width:0;">' + 
                '<div style="font-size:15px;font-weight:600;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + song.title + '</div>' + 
                '<div style="font-size:13px;color:#999;">' + song.artist + '</div>' + 
            '</div>' + 
            '<div class="music-menu-arrow" style="color:#fb7299;">' + checkIcon + '</div>' + 
        '</div>'; 
    }); 
     
    const content = '<div style="max-height:300px;overflow-y:auto;">' + 
        '<div class="music-menu-list" style="padding:0;">' + songsHtml + '</div>' + 
        '</div>' + 
        '<div class="music-modal-btns">' + 
            '<button class="music-modal-btn music-modal-btn-confirm" style="flex:1;">完成</button>' + 
        '</div>'; 
     
    const modal = showModal('添加歌曲', content, function() { 
        const songList = page.querySelector('.music-song-list'); 
        if (songList) { 
            let newSongsHtml = ''; 
            if (playlist.songs.length === 0) { 
                newSongsHtml = '<div class="music-empty-state">' + 
                    SVGIcons.music + 
                    '<div class="music-empty-state-text">歌单还是空的</div>' + 
                '</div>'; 
            } else { 
                playlist.songs.forEach(function(songId) { 
                    const song = MusicPlayerState.songs.find(s => s.id === songId); 
                    if (song) { 
                        newSongsHtml += generateSongItemHtml(song, true, playlist.id); 
                    } 
                }); 
            } 
            songList.innerHTML = newSongsHtml; 
            bindPlaylistPageEvents(page, playlist); 
        } 
         
        const countEl = page.querySelector('.music-playlist-detail-count'); 
        if (countEl) { 
            countEl.textContent = playlist.songs.length + ' 首歌曲'; 
        } 
         
        return true; 
    }); 
     
    if (modal) { 
        modal.querySelectorAll('.song-select-item').forEach(function(item) { 
            item.onclick = function() { 
                const songId = parseInt(item.dataset.songId); 
                const inPlaylist = item.dataset.inPlaylist === 'true'; 
                 
                if (inPlaylist) { 
                    const index = playlist.songs.indexOf(songId); 
                    if (index > -1) { 
                        playlist.songs.splice(index, 1); 
                    } 
                    item.dataset.inPlaylist = 'false'; 
                    item.querySelector('.music-menu-arrow').innerHTML = ''; 
                } else { 
                    playlist.songs.push(songId); 
                    item.dataset.inPlaylist = 'true'; 
                    item.querySelector('.music-menu-arrow').innerHTML = SVGIcons.check; 
                } 
            }; 
        }); 
    } 
} 
 
function openPlayerPage(song) { 
    const playerHtml = generatePlayerPageHtml(song); 
    const page = musicApp.openDetailPage(playerHtml, { enableHomeIndicator: true, background: '#fff5f8' }); 
     
    if (page) { 
        bindPlayerPageEvents(page, song);
        
        // 如果有封面图片，从封面提取颜色并应用主题
        if (song.cover) {
            extractAndApplyThemeColor(song.cover, song.color);
        }
    } 
} 
 
function bindPlayerPageEvents(page, song) { 
    const playToggleBtn = page.querySelector('.play-toggle-btn'); 
    if (playToggleBtn) { 
        playToggleBtn.onclick = function(e) { 
            e.stopPropagation(); 
            togglePlay(); 
        }; 
    } 
     
    const prevBtn = page.querySelector('.prev-btn'); 
    if (prevBtn) { 
        prevBtn.onclick = function(e) { 
            e.stopPropagation(); 
            playPrevSong(); 
        }; 
    } 
     
    const nextBtn = page.querySelector('.next-btn'); 
    if (nextBtn) { 
        nextBtn.onclick = function(e) { 
            e.stopPropagation(); 
            playNextSong(); 
        }; 
    } 
     
    const likeBtn = page.querySelector('.like-btn'); 
    if (likeBtn) { 
        likeBtn.onclick = function(e) { 
            e.stopPropagation(); 
            const songId = parseInt(likeBtn.dataset.id); 
            toggleLike(songId); 
            if (isLiked(songId)) { 
                likeBtn.classList.add('liked'); 
                likeBtn.querySelector('svg').outerHTML = SVGIcons.heart; 
            } else { 
                likeBtn.classList.remove('liked'); 
                likeBtn.querySelector('svg').outerHTML = SVGIcons.heartOutline; 
            } 
        }; 
    } 
     
    const addToPlaylistBtn = page.querySelector('.add-to-playlist-btn'); 
    if (addToPlaylistBtn) { 
        addToPlaylistBtn.onclick = function(e) { 
            e.stopPropagation(); 
            const songId = parseInt(addToPlaylistBtn.dataset.id); 
            showAddToPlaylistModal(songId); 
        }; 
    }
    
    // 播放模式切换按钮
    const playModeBtn = page.querySelector('.play-mode-btn');
    if (playModeBtn) {
        playModeBtn.onclick = function(e) {
            e.stopPropagation();
            togglePlayMode();
        };
    }
     
    const progressBar = page.querySelector('.music-player-progress-bar'); 
    if (progressBar) { 
        progressBar.onclick = function(e) { 
            e.stopPropagation(); 
            const rect = progressBar.getBoundingClientRect(); 
            const percentage = ((e.clientX - rect.left) / rect.width) * 100; 
            seekTo(Math.max(0, Math.min(100, percentage))); 
        }; 
    } 
} 
 
function openLikedSongsPage() { 
    let songsHtml = ''; 
    if (MusicPlayerState.likedSongs.length === 0) { 
        songsHtml = '<div class="music-empty-state">' + 
            SVGIcons.heartOutline + 
            '<div class="music-empty-state-text">还没有喜欢的歌曲</div>' + 
        '</div>'; 
    } else { 
        MusicPlayerState.likedSongs.forEach(function(songId) { 
            const song = MusicPlayerState.songs.find(s => s.id === songId); 
            if (song) { 
                songsHtml += generateSongItemHtml(song); 
            } 
        }); 
    } 
     
    const pageHtml = '<div class="music-app-container" style="min-height:100%;">' + 
        '<div class="music-section" style="padding-top:10px;">' + 
            '<div class="music-section-header">' + 
                '<div class="music-section-title">我喜欢的音乐</div>' + 
            '</div>' + 
            '<div class="music-song-list liked-songs-list">' + songsHtml + '</div>' + 
        '</div>' + 
    '</div>'; 
     
    const page = musicApp.openDetailPage(pageHtml, { enableHomeIndicator: true, background: '#fff5f8' }); 
     
    if (page) { 
        bindLikedSongsPageEvents(page); 
    } 
} 
 
function bindLikedSongsPageEvents(page) { 
    const songItems = page.querySelectorAll('.music-song-item'); 
    songItems.forEach(function(item) { 
        const songId = parseInt(item.dataset.id); 
        const song = MusicPlayerState.songs.find(s => s.id === songId); 
         
        item.onclick = function(e) { 
            if (e.target.closest('.like-btn')) { 
                e.stopPropagation(); 
                toggleLike(songId); 
                item.style.animation = 'fadeOut 0.3s ease'; 
                setTimeout(function() { 
                    item.remove(); 
                    if (MusicPlayerState.likedSongs.length === 0) { 
                        const listEl = page.querySelector('.liked-songs-list'); 
                        if (listEl) { 
                            listEl.innerHTML = '<div class="music-empty-state">' + 
                                SVGIcons.heartOutline + 
                                '<div class="music-empty-state-text">还没有喜欢的歌曲</div>' + 
                            '</div>'; 
                        } 
                    } 
                }, 300); 
                return; 
            } 
             
            if (song) { 
                playSong(song); 
                openPlayerPage(song); 
            } 
        }; 
    }); 
}

/* ============ 歌词编辑页面 ============ */
function openLyricsEditorPage() {
    let songsHtml = '';
    MusicPlayerState.songs.forEach(function(song) {
        const hasLyrics = song.lyrics && song.lyrics.length > 0 && song.lyrics !== defaultLyrics;
        const lyricsStatus = hasLyrics ? '<span style="color:#666;font-size:10px;background:#f0f0f0;padding:2px 6px;border-radius:2px;">已有歌词</span>' : '<span style="color:#999;font-size:10px;">默认歌词</span>';
        const coverHtml = song.cover 
            ? '<img src="' + song.cover + '" style="width:100%;height:100%;object-fit:cover;">' 
            : '<div style="width:100%;height:100%;background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);display:flex;align-items:center;justify-content:center;">' + SVGIcons.music + '</div>';
        
        songsHtml += '<div class="lyrics-editor-song-item" data-song-id="' + song.id + '" style="' +
            'display:flex;align-items:center;padding:12px 14px;margin-bottom:8px;' +
            'background:#fff;border-radius:4px;cursor:pointer;' +
            'border:1px solid #e8e8e8;transition:all 0.15s;">' +
            '<div style="width:44px;height:44px;border-radius:3px;overflow:hidden;margin-right:12px;flex-shrink:0;">' + coverHtml + '</div>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:13px;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.2px;">' + song.title + '</div>' +
                '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">' +
                    '<span style="font-size:11px;color:#888;letter-spacing:0.2px;">' + song.artist + '</span>' +
                    lyricsStatus +
                '</div>' +
            '</div>' +
            '<div style="color:#ccc;font-size:14px;font-weight:300;">›</div>' +
        '</div>';
    });
    
    const pageHtml = '<div class="music-app-container" style="min-height:100%;">' +
        '<div class="music-section" style="padding-top:10px;">' +
            '<div class="music-section-header">' +
                '<div class="music-section-title" style="font-size:14px;font-weight:500;letter-spacing:0.5px;">歌词编辑</div>' +
            '</div>' +
            '<div style="padding:0 20px 12px;">' +
                '<div style="font-size:11px;color:#888;line-height:1.7;letter-spacing:0.3px;">' +
                    '选择歌曲来编辑歌词，支持LRC格式<br>' +
                    '<span style="color:#666;">格式：[mm:ss.xx]歌词内容</span>' +
                '</div>' +
            '</div>' +
            '<div class="lyrics-editor-song-list" style="padding:0 20px;">' + songsHtml + '</div>' +
        '</div>' +
    '</div>';
    
    const page = musicApp.openDetailPage(pageHtml, { enableHomeIndicator: true, background: '#f5f5f5' });
    
    if (page) {
        bindLyricsEditorPageEvents(page);
    }
}

function bindLyricsEditorPageEvents(page) {
    const songItems = page.querySelectorAll('.lyrics-editor-song-item');
    songItems.forEach(function(item) {
        item.onclick = function() {
            const songId = parseInt(item.getAttribute('data-song-id'));
            const song = MusicPlayerState.songs.find(s => s.id === songId);
            if (song) {
                openSongLyricsEditor(song);
            }
        };
    });
}

function openSongLyricsEditor(song) {
    // 将现有歌词转换为LRC格式文本
    let currentLrcText = '';
    if (song.lyrics && song.lyrics.length > 0) {
        song.lyrics.forEach(function(line) {
            const mins = Math.floor(line.time / 60);
            const secs = Math.floor(line.time % 60);
            const ms = Math.floor((line.time % 1) * 100);
            currentLrcText += '[' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs + '.' + (ms < 10 ? '0' : '') + ms + ']' + line.text + '\n';
        });
    }
    
    const coverHtml = song.cover 
        ? '<img src="' + song.cover + '" style="width:100%;height:100%;object-fit:cover;">' 
        : '<div style="width:100%;height:100%;background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);display:flex;align-items:center;justify-content:center;">' + SVGIcons.music + '</div>';
    
    // 生成可视化歌词列表HTML
    function generateVisualLyricsList(lyrics) {
        if (!lyrics || lyrics.length === 0) {
            return '<div style="text-align:center;padding:30px;color:#999;font-size:12px;letter-spacing:0.3px;">暂无歌词，请先在文本编辑中输入或导入歌词</div>';
        }
        
        let html = '';
        lyrics.forEach(function(line, index) {
            const mins = Math.floor(line.time / 60);
            const secs = Math.floor(line.time % 60);
            const ms = Math.floor((line.time % 1) * 100);
            const timeStr = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs + '.' + (ms < 10 ? '0' : '') + ms;
            
            html += '<div class="lyrics-visual-item" data-index="' + index + '" style="' +
                'display:flex;align-items:center;padding:10px 12px;margin-bottom:6px;' +
                'background:#fafafa;border-radius:4px;transition:all 0.15s;border:1px solid #eee;">' +
                '<div style="display:flex;flex-direction:column;align-items:center;margin-right:10px;min-width:70px;">' +
                    '<span class="lyrics-time-display" style="font-family:monospace;font-size:11px;color:#333;font-weight:500;">' + timeStr + '</span>' +
                    '<div style="display:flex;gap:2px;margin-top:5px;">' +
                        '<button class="time-adjust-btn" data-index="' + index + '" data-delta="-1" style="' +
                            'width:20px;height:20px;border:1px solid #ddd;border-radius:2px;background:#fff;color:#666;' +
                            'font-size:9px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;"' +
                            'title="-1秒">-1</button>' +
                        '<button class="time-adjust-btn" data-index="' + index + '" data-delta="-0.5" style="' +
                            'width:20px;height:20px;border:1px solid #ddd;border-radius:2px;background:#fff;color:#666;' +
                            'font-size:8px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;"' +
                            'title="-0.5秒">-.5</button>' +
                        '<button class="time-adjust-btn" data-index="' + index + '" data-delta="-0.1" style="' +
                            'width:20px;height:20px;border:1px solid #ddd;border-radius:2px;background:#fff;color:#666;' +
                            'font-size:8px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;"' +
                            'title="-0.1秒">-.1</button>' +
                        '<button class="time-adjust-btn" data-index="' + index + '" data-delta="0.1" style="' +
                            'width:20px;height:20px;border:1px solid #ddd;border-radius:2px;background:#fff;color:#666;' +
                            'font-size:8px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;"' +
                            'title="+0.1秒">+.1</button>' +
                        '<button class="time-adjust-btn" data-index="' + index + '" data-delta="0.5" style="' +
                            'width:20px;height:20px;border:1px solid #ddd;border-radius:2px;background:#fff;color:#666;' +
                            'font-size:8px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;"' +
                            'title="+0.5秒">+.5</button>' +
                        '<button class="time-adjust-btn" data-index="' + index + '" data-delta="1" style="' +
                            'width:20px;height:20px;border:1px solid #ddd;border-radius:2px;background:#fff;color:#666;' +
                            'font-size:9px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;"' +
                            'title="+1秒">+1</button>' +
                    '</div>' +
                '</div>' +
                '<div style="flex:1;font-size:12px;color:#333;word-break:break-all;letter-spacing:0.2px;">' + line.text + '</div>' +
                '<button class="batch-adjust-btn" data-index="' + index + '" style="' +
                    'padding:5px 8px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                    'font-size:10px;cursor:pointer;white-space:nowrap;margin-left:8px;"' +
                    'title="从这句开始，所有后续歌词整体移动时间">此句后</button>' +
            '</div>';
        });
        
        return html;
    }
    
    const pageHtml = '<div class="music-app-container" style="min-height:100%;">' +
        '<div style="padding:16px 20px;">' +
            '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding:14px 16px;background:#fff;border-radius:6px;border:1px solid #e8e8e8;">' +
                '<div style="width:52px;height:52px;border-radius:4px;overflow:hidden;flex-shrink:0;">' + coverHtml + '</div>' +
                '<div style="flex:1;">' +
                    '<div style="font-size:14px;font-weight:600;color:#1a1a1a;letter-spacing:0.3px;">' + song.title + '</div>' +
                    '<div style="font-size:12px;color:#888;margin-top:4px;letter-spacing:0.2px;">' + song.artist + '</div>' +
                '</div>' +
            '</div>' +
            
            // 编辑模式切换
            '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
                '<button id="mode-text-btn" class="lyrics-mode-btn active" style="' +
                    'flex:1;padding:11px;border:1px solid #1a1a1a;border-radius:4px;font-size:13px;font-weight:500;' +
                    'cursor:pointer;transition:all 0.15s;background:#1a1a1a;color:#fff;letter-spacing:0.5px;">' +
                    '文本编辑</button>' +
                '<button id="mode-visual-btn" class="lyrics-mode-btn" style="' +
                    'flex:1;padding:11px;border:1px solid #e0e0e0;border-radius:4px;font-size:13px;font-weight:500;' +
                    'cursor:pointer;transition:all 0.15s;background:#fff;color:#666;letter-spacing:0.5px;">' +
                    '时间微调</button>' +
            '</div>' +
            
            // 文本编辑模式
            '<div id="text-edit-mode" style="background:#fff;border-radius:6px;padding:20px;border:1px solid #e8e8e8;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
                    '<div style="font-size:13px;font-weight:500;color:#333;letter-spacing:0.3px;">编辑歌词</div>' +
                    '<div style="font-size:11px;color:#999;letter-spacing:0.5px;">LRC格式</div>' +
                '</div>' +
                '<textarea id="song-lyrics-editor" placeholder="[00:00.00]歌曲开始&#10;[00:15.00]第一句歌词&#10;[00:20.00]第二句歌词&#10;&#10;支持格式：[mm:ss.xx] 或 [m:ss]" style="' +
                    'width:100%;height:200px;border:1px solid #ddd;' +
                    'border-radius:4px;padding:14px;font-size:12px;resize:none;outline:none;' +
                    'font-family:\'SF Mono\', Monaco, Consolas, monospace;box-sizing:border-box;' +
                    'line-height:1.9;background:#fafafa;color:#333;">' + currentLrcText + '</textarea>' +
                '<div style="display:flex;gap:8px;margin-top:14px;">' +
                    '<button id="import-lrc-btn" style="' +
                        'flex:1;padding:12px;background:#fff;color:#333;border:1px solid #ddd;' +
                        'border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;letter-spacing:0.3px;">' +
                        '导入LRC文件</button>' +
                    '<input type="file" id="lrc-file-input" accept=".lrc,.txt" style="display:none;">' +
                '</div>' +
                '<div style="display:flex;gap:8px;margin-top:8px;">' +
                    '<button id="preview-lyrics-btn" style="' +
                        'flex:1;padding:12px;background:#f7f7f7;color:#666;border:1px solid #e0e0e0;' +
                        'border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;letter-spacing:0.3px;">' +
                        '预览</button>' +
                    '<button id="save-lyrics-btn" data-song-id="' + song.id + '" style="' +
                        'flex:1;padding:12px;background:#1a1a1a;' +
                        'color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:500;' +
                        'cursor:pointer;letter-spacing:0.3px;">' +
                        '保存歌词</button>' +
                '</div>' +
                '<button id="clear-lyrics-btn" style="' +
                    'width:100%;padding:11px;background:#fff;color:#999;border:1px solid #e0e0e0;' +
                    'border-radius:4px;font-size:11px;cursor:pointer;margin-top:8px;letter-spacing:0.3px;">' +
                    '清除歌词（使用默认）</button>' +
            '</div>' +
            
            // 可视化时间微调模式
            '<div id="visual-edit-mode" style="display:none;">' +
                // 批量调整控制面板
                '<div style="background:#fff;border-radius:6px;padding:16px;border:1px solid #e8e8e8;margin-bottom:12px;">' +
                    '<div style="font-size:12px;font-weight:500;color:#333;margin-bottom:12px;letter-spacing:0.3px;">批量时间调整</div>' +
                    '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                        '<button class="batch-all-adjust-btn" data-delta="-1" style="' +
                            'padding:8px 12px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                            'font-size:11px;font-weight:500;cursor:pointer;">全部 -1秒</button>' +
                        '<button class="batch-all-adjust-btn" data-delta="-0.5" style="' +
                            'padding:8px 12px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                            'font-size:11px;font-weight:500;cursor:pointer;">全部 -0.5秒</button>' +
                        '<button class="batch-all-adjust-btn" data-delta="0.5" style="' +
                            'padding:8px 12px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                            'font-size:11px;font-weight:500;cursor:pointer;">全部 +0.5秒</button>' +
                        '<button class="batch-all-adjust-btn" data-delta="1" style="' +
                            'padding:8px 12px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                            'font-size:11px;font-weight:500;cursor:pointer;">全部 +1秒</button>' +
                    '</div>' +
                    '<div style="font-size:11px;color:#999;margin-top:10px;line-height:1.6;letter-spacing:0.2px;">' +
                        '提示：点击每行的「此句后」可以选择从该句开始批量移动所有后续歌词' +
                    '</div>' +
                '</div>' +
                
                // 可视化歌词列表
                '<div style="background:#fff;border-radius:6px;padding:16px;border:1px solid #e8e8e8;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
                        '<div style="font-size:12px;font-weight:500;color:#333;letter-spacing:0.3px;">歌词时间微调</div>' +
                        '<button id="save-visual-lyrics-btn" data-song-id="' + song.id + '" style="' +
                            'padding:7px 14px;background:#1a1a1a;' +
                            'color:#fff;border:none;border-radius:3px;font-size:11px;font-weight:500;' +
                            'cursor:pointer;letter-spacing:0.3px;">保存</button>' +
                    '</div>' +
                    '<div id="visual-lyrics-list" style="max-height:400px;overflow-y:auto;">' +
                        generateVisualLyricsList(song.lyrics && song.lyrics !== defaultLyrics ? song.lyrics : []) +
                    '</div>' +
                '</div>' +
            '</div>' +
            
            '<div id="lyrics-preview-container" style="display:none;margin-top:12px;background:#fff;border-radius:6px;padding:16px;border:1px solid #e8e8e8;">' +
                '<div style="font-size:12px;font-weight:500;color:#333;margin-bottom:12px;letter-spacing:0.3px;">歌词预览</div>' +
                '<div id="lyrics-preview-content" style="max-height:200px;overflow-y:auto;"></div>' +
            '</div>' +
        '</div>' +
    '</div>';
    
    const page = musicApp.openDetailPage(pageHtml, { enableHomeIndicator: true, background: '#f5f5f5' });
    
    if (page) {
        bindSongLyricsEditorEvents(page, song, generateVisualLyricsList);
    }
}

function bindSongLyricsEditorEvents(page, song, generateVisualLyricsList) {
    const saveBtn = page.querySelector('#save-lyrics-btn');
    const previewBtn = page.querySelector('#preview-lyrics-btn');
    const clearBtn = page.querySelector('#clear-lyrics-btn');
    const importBtn = page.querySelector('#import-lrc-btn');
    const fileInput = page.querySelector('#lrc-file-input');
    const editor = page.querySelector('#song-lyrics-editor');
    const previewContainer = page.querySelector('#lyrics-preview-container');
    const previewContent = page.querySelector('#lyrics-preview-content');
    
    // 模式切换按钮
    const modeTextBtn = page.querySelector('#mode-text-btn');
    const modeVisualBtn = page.querySelector('#mode-visual-btn');
    const textEditMode = page.querySelector('#text-edit-mode');
    const visualEditMode = page.querySelector('#visual-edit-mode');
    const visualLyricsList = page.querySelector('#visual-lyrics-list');
    
    // 临时存储当前编辑的歌词数据
    let currentEditingLyrics = song.lyrics && song.lyrics !== defaultLyrics ? JSON.parse(JSON.stringify(song.lyrics)) : [];
    
    // 模式切换
    if (modeTextBtn && modeVisualBtn) {
        modeTextBtn.onclick = function() {
            modeTextBtn.style.background = '#1a1a1a';
            modeTextBtn.style.color = '#fff';
            modeTextBtn.style.border = '1px solid #1a1a1a';
            modeVisualBtn.style.background = '#fff';
            modeVisualBtn.style.color = '#666';
            modeVisualBtn.style.border = '1px solid #e0e0e0';
            textEditMode.style.display = 'block';
            visualEditMode.style.display = 'none';
            previewContainer.style.display = 'none';
        };
        
        modeVisualBtn.onclick = function() {
            modeVisualBtn.style.background = '#1a1a1a';
            modeVisualBtn.style.color = '#fff';
            modeVisualBtn.style.border = '1px solid #1a1a1a';
            modeTextBtn.style.background = '#fff';
            modeTextBtn.style.color = '#666';
            modeTextBtn.style.border = '1px solid #e0e0e0';
            textEditMode.style.display = 'none';
            visualEditMode.style.display = 'block';
            previewContainer.style.display = 'none';
            
            // 解析当前文本框的歌词
            const lrcText = editor.value.trim();
            if (lrcText) {
                currentEditingLyrics = parseLrcFile(lrcText);
            }
            // 刷新可视化列表
            visualLyricsList.innerHTML = generateVisualLyricsList(currentEditingLyrics);
            bindVisualLyricsEvents();
        };
    }
    
    // 更新单行歌词时间显示
    function updateLyricTimeDisplay(index) {
        const item = visualLyricsList.querySelector('.lyrics-visual-item[data-index="' + index + '"]');
        if (item && currentEditingLyrics[index]) {
            const line = currentEditingLyrics[index];
            const mins = Math.floor(line.time / 60);
            const secs = Math.floor(line.time % 60);
            const ms = Math.floor((line.time % 1) * 100);
            const timeStr = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs + '.' + (ms < 10 ? '0' : '') + ms;
            const timeDisplay = item.querySelector('.lyrics-time-display');
            if (timeDisplay) {
                timeDisplay.textContent = timeStr;
                // 简洁的反馈效果
                timeDisplay.style.fontWeight = '600';
                setTimeout(function() {
                    timeDisplay.style.fontWeight = '500';
                }, 150);
            }
        }
    }
    
    // 同步歌词到文本编辑器
    function syncLyricsToTextEditor() {
        let lrcText = '';
        currentEditingLyrics.forEach(function(line) {
            const mins = Math.floor(line.time / 60);
            const secs = Math.floor(line.time % 60);
            const ms = Math.floor((line.time % 1) * 100);
            lrcText += '[' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs + '.' + (ms < 10 ? '0' : '') + ms + ']' + line.text + '\n';
        });
        editor.value = lrcText;
    }
    
    // 绑定可视化歌词列表的事件
    function bindVisualLyricsEvents() {
        // 单句时间调整按钮
        const timeAdjustBtns = visualLyricsList.querySelectorAll('.time-adjust-btn');
        timeAdjustBtns.forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                const delta = parseFloat(btn.dataset.delta);
                
                if (currentEditingLyrics[index]) {
                    currentEditingLyrics[index].time = Math.max(0, currentEditingLyrics[index].time + delta);
                    updateLyricTimeDisplay(index);
                    syncLyricsToTextEditor();
                }
            };
        });
        
        // 批量调整按钮（从某句开始）
        const batchAdjustBtns = visualLyricsList.querySelectorAll('.batch-adjust-btn');
        batchAdjustBtns.forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                const startIndex = parseInt(btn.dataset.index);
                showBatchAdjustMenu(btn, startIndex);
            };
        });
    }
    
    // 显示批量调整菜单
    function showBatchAdjustMenu(anchorBtn, startIndex) {
        // 移除已存在的菜单
        const existingMenu = page.querySelector('.batch-adjust-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const menu = document.createElement('div');
        menu.className = 'batch-adjust-menu';
        menu.style.cssText = 'position:absolute;background:#fff;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,0.1);' +
            'padding:12px;z-index:1000;min-width:180px;border:1px solid #e8e8e8;';
        
        menu.innerHTML = '<div style="font-size:11px;font-weight:500;color:#333;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #eee;letter-spacing:0.3px;">' +
            '从第 ' + (startIndex + 1) + ' 句开始调整</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:5px;">' +
                '<button class="batch-menu-btn" data-delta="-2" style="' +
                    'padding:7px 10px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                    'font-size:11px;font-weight:500;cursor:pointer;">-2秒</button>' +
                '<button class="batch-menu-btn" data-delta="-1" style="' +
                    'padding:7px 10px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                    'font-size:11px;font-weight:500;cursor:pointer;">-1秒</button>' +
                '<button class="batch-menu-btn" data-delta="-0.5" style="' +
                    'padding:7px 10px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                    'font-size:11px;font-weight:500;cursor:pointer;">-0.5秒</button>' +
                '<button class="batch-menu-btn" data-delta="0.5" style="' +
                    'padding:7px 10px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                    'font-size:11px;font-weight:500;cursor:pointer;">+0.5秒</button>' +
                '<button class="batch-menu-btn" data-delta="1" style="' +
                    'padding:7px 10px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                    'font-size:11px;font-weight:500;cursor:pointer;">+1秒</button>' +
                '<button class="batch-menu-btn" data-delta="2" style="' +
                    'padding:7px 10px;border:1px solid #ddd;border-radius:3px;background:#fff;color:#666;' +
                    'font-size:11px;font-weight:500;cursor:pointer;">+2秒</button>' +
            '</div>' +
            '<button class="batch-menu-close" style="' +
                'width:100%;padding:8px;margin-top:10px;border:1px solid #e0e0e0;border-radius:3px;background:#f7f7f7;' +
                'color:#666;font-size:11px;cursor:pointer;">取消</button>';
        
        // 定位菜单
        const rect = anchorBtn.getBoundingClientRect();
        const containerRect = visualLyricsList.getBoundingClientRect();
        menu.style.right = '10px';
        menu.style.top = (rect.bottom - containerRect.top + visualLyricsList.scrollTop + 5) + 'px';
        
        visualLyricsList.style.position = 'relative';
        visualLyricsList.appendChild(menu);
        
        // 绑定菜单事件
        menu.querySelectorAll('.batch-menu-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                const delta = parseFloat(btn.dataset.delta);
                
                // 调整从 startIndex 开始的所有歌词
                for (let i = startIndex; i < currentEditingLyrics.length; i++) {
                    currentEditingLyrics[i].time = Math.max(0, currentEditingLyrics[i].time + delta);
                    updateLyricTimeDisplay(i);
                }
                syncLyricsToTextEditor();
                menu.remove();
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '批量调整完成',
                    message: '从第' + (startIndex + 1) + '句开始，共调整' + (currentEditingLyrics.length - startIndex) + '句',
                    size: 'mini'
                });
            };
        });
        
        menu.querySelector('.batch-menu-close').onclick = function(e) {
            e.stopPropagation();
            menu.remove();
        };
        
        // 点击其他区域关闭菜单
        setTimeout(function() {
            const closeMenu = function(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 100);
    }
    
    // 全部歌词批量调整按钮
    const batchAllAdjustBtns = page.querySelectorAll('.batch-all-adjust-btn');
    batchAllAdjustBtns.forEach(function(btn) {
        btn.onclick = function(e) {
            e.stopPropagation();
            const delta = parseFloat(btn.dataset.delta);
            
            for (let i = 0; i < currentEditingLyrics.length; i++) {
                currentEditingLyrics[i].time = Math.max(0, currentEditingLyrics[i].time + delta);
                updateLyricTimeDisplay(i);
            }
            syncLyricsToTextEditor();
            
            PhoneCore.notifications.send({
                type: 'success',
                title: '全部歌词已调整',
                message: (delta > 0 ? '+' : '') + delta + '秒',
                size: 'mini'
            });
        };
    });
    
    // 可视化模式保存按钮
    const saveVisualBtn = page.querySelector('#save-visual-lyrics-btn');
    if (saveVisualBtn) {
        saveVisualBtn.onclick = function() {
            if (currentEditingLyrics.length > 0) {
                // 按时间排序
                currentEditingLyrics.sort(function(a, b) { return a.time - b.time; });
                song.lyrics = currentEditingLyrics;
                syncLyricsToTextEditor();
                
                // 持久化保存到 localStorage
                saveLyricsToStorage(song.id, currentEditingLyrics);
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '歌词已保存',
                    message: song.title,
                    size: 'mini'
                });
                
                // 如果当前正在播放这首歌，刷新播放页面
                if (MusicPlayerState.currentSong && MusicPlayerState.currentSong.id === song.id) {
                    MusicPlayerState.currentSong.lyrics = currentEditingLyrics;
                    refreshPlayerPage();
                }
            } else {
                PhoneCore.notifications.send({
                    type: 'warning',
                    title: '没有歌词可保存',
                    message: '请先添加歌词',
                    size: 'mini'
                });
            }
        };
    }
    
    // LRC文件导入功能
    if (importBtn && fileInput) {
        importBtn.onclick = function() {
            fileInput.click();
        };
        
        fileInput.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const content = event.target.result;
                    editor.value = content;
                    // 同时更新可视化编辑的数据
                    currentEditingLyrics = parseLrcFile(content);
                    
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: 'LRC文件已导入',
                        message: file.name,
                        size: 'mini'
                    });
                    // 自动预览
                    if (previewBtn) {
                        previewBtn.click();
                    }
                };
                reader.onerror = function() {
                    PhoneCore.notifications.send({
                        type: 'error',
                        title: '文件读取失败',
                        message: '请重试',
                        size: 'mini'
                    });
                };
                reader.readAsText(file, 'UTF-8');
            }
            // 重置文件输入，允许重复选择同一文件
            fileInput.value = '';
        };
    }
    
    if (saveBtn) {
        saveBtn.onclick = function() {
            const lrcText = editor.value.trim();
            if (lrcText) {
                const lyrics = parseLrcFile(lrcText);
                if (lyrics.length > 0) {
                    song.lyrics = lyrics;
                    currentEditingLyrics = JSON.parse(JSON.stringify(lyrics));
                    
                    // 持久化保存到 localStorage
                    saveLyricsToStorage(song.id, lyrics);
                    
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '歌词已保存',
                        message: song.title,
                        size: 'mini'
                    });
                    // 如果当前正在播放这首歌，刷新播放页面
                    if (MusicPlayerState.currentSong && MusicPlayerState.currentSong.id === song.id) {
                        MusicPlayerState.currentSong.lyrics = lyrics;
                        refreshPlayerPage();
                    }
                } else {
                    PhoneCore.notifications.send({
                        type: 'warning',
                        title: '歌词格式有误',
                        message: '请检查LRC格式',
                        size: 'mini'
                    });
                }
            }
        };
    }
    
    if (previewBtn) {
        previewBtn.onclick = function() {
            const lrcText = editor.value.trim();
            if (lrcText) {
                const lyrics = parseLrcFile(lrcText);
                if (lyrics.length > 0) {
                    let previewHtml = '';
                    lyrics.forEach(function(line, index) {
                        const timeStr = formatTime(line.time);
                        previewHtml += '<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">' +
                            '<span style="color:#666;font-size:11px;min-width:50px;font-family:monospace;">' + timeStr + '</span>' +
                            '<span style="font-size:12px;color:#333;flex:1;letter-spacing:0.2px;">' + line.text + '</span>' +
                        '</div>';
                    });
                    previewContent.innerHTML = previewHtml;
                    previewContainer.style.display = 'block';
                } else {
                    previewContent.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:12px;">无法解析歌词</div>';
                    previewContainer.style.display = 'block';
                }
            } else {
                previewContent.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:12px;">请先输入歌词</div>';
                previewContainer.style.display = 'block';
            }
        };
    }
    
    if (clearBtn) {
        clearBtn.onclick = function() {
            song.lyrics = defaultLyrics;
            editor.value = '';
            currentEditingLyrics = [];
            previewContainer.style.display = 'none';
            
            // 清除 localStorage 中保存的歌词
            clearSavedLyrics(song.id);
            
            PhoneCore.notifications.send({
                type: 'info',
                title: '已恢复默认歌词',
                message: song.title,
                size: 'mini'
            });
            // 如果当前正在播放这首歌，刷新
            if (MusicPlayerState.currentSong && MusicPlayerState.currentSong.id === song.id) {
                MusicPlayerState.currentSong.lyrics = defaultLyrics;
                refreshPlayerPage();
            }
        };
    }
    
    // 初始绑定可视化歌词事件（如果有歌词的话）
    if (currentEditingLyrics.length > 0) {
        bindVisualLyricsEvents();
    }
} 
 
function bindMainTabEvents(container) { 
    const songItems = container.querySelectorAll('.music-song-item'); 
    songItems.forEach(function(item) { 
        const songId = parseInt(item.dataset.id); 
        const song = MusicPlayerState.songs.find(s => s.id === songId); 
         
        item.onclick = function(e) { 
            if (e.target.closest('.like-btn')) { 
                e.stopPropagation(); 
                toggleLike(songId); 
                const likeBtn = item.querySelector('.like-btn'); 
                if (isLiked(songId)) { 
                    likeBtn.classList.add('liked'); 
                    likeBtn.innerHTML = SVGIcons.heart; 
                } else { 
                    likeBtn.classList.remove('liked'); 
                    likeBtn.innerHTML = SVGIcons.heartOutline; 
                } 
                return; 
            } 
             
            if (song) { 
                playSong(song); 
                openPlayerPage(song); 
            } 
        }; 
    }); 
     
    const addSongBtn = container.querySelector('.add-song-btn'); 
    if (addSongBtn) { 
        addSongBtn.onclick = function(e) { 
            e.stopPropagation(); 
            showAddSongModal(); 
        }; 
    } 
     
    const createPlaylistCard = container.querySelector('.create-playlist-card'); 
    if (createPlaylistCard) { 
        createPlaylistCard.onclick = function(e) { 
            e.stopPropagation(); 
            showCreatePlaylistModal(); 
        }; 
    } 
     
    const playlistCards = container.querySelectorAll('.music-playlist-card:not(.create-playlist-card)'); 
    playlistCards.forEach(function(card) { 
        card.onclick = function(e) { 
            e.stopPropagation(); 
            const playlistId = parseInt(card.dataset.id); 
            const playlist = MusicPlayerState.playlists.find(p => p.id === playlistId); 
            if (playlist) { 
                openPlaylistPage(playlist); 
            } 
        }; 
    }); 
} 
 
function bindMeTabEvents(container) { 
    const likedSongsMenu = container.querySelector('.liked-songs-menu'); 
    if (likedSongsMenu) { 
        likedSongsMenu.onclick = function(e) { 
            e.stopPropagation(); 
            openLikedSongsPage(); 
        }; 
    }
    
    // 歌词编辑入口
    const lyricsEditorMenu = container.querySelector('.lyrics-editor-menu');
    if (lyricsEditorMenu) {
        lyricsEditorMenu.onclick = function(e) {
            e.stopPropagation();
            openLyricsEditorPage();
        };
    }
}

// 发现页事件绑定
function bindDiscoverTabEvents(container) {
    const discoverCards = container.querySelectorAll('.music-discover-card');
    discoverCards.forEach(function(card, index) {
        card.onclick = function(e) {
            e.stopPropagation();
            // 根据卡片索引执行不同操作
            // 0: 排行榜, 1: 私人电台, 2: 精选歌单, 3: 最近播放(听歌回顾)
            if (index === 0) {
                showChartPage();
            } else if (index === 1) {
                showRadioPage();
            } else if (index === 2) {
                showRecommendPlaylistPage();
            } else if (index === 3) {
                showRecentPlayPage();
            }
        };
    });
    
    // 搜索栏事件
    const searchInput = container.querySelector('.music-search-bar input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    showSearchResultsPage(query);
                }
            }
        });
    }
}

// 显示排行榜页面
function showChartPage() {
    const sortedSongs = [...MusicPlayerState.songs].sort((a, b) => {
        const aPlays = a.playCount || 0;
        const bPlays = b.playCount || 0;
        return bPlays - aPlays;
    });
    
    let songsHtml = '';
    sortedSongs.slice(0, 20).forEach(function(song, idx) {
        const rankColors = ['#ff6b6b', '#ffa502', '#ffd700'];
        const rankColor = idx < 3 ? rankColors[idx] : '#999';
        const rankStyle = idx < 3 ? 'font-weight:700;font-size:18px;' : '';
        
        const coverHtml = song.cover 
            ? '<img src="' + song.cover + '" alt="">' 
            : '<div class="music-song-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>';
        
        songsHtml += '<div class="music-song-item" data-id="' + song.id + '">' +
            '<div style="width:30px;text-align:center;font-size:16px;color:' + rankColor + ';' + rankStyle + 'margin-right:12px;">' + (idx + 1) + '</div>' +
            '<div class="music-song-cover">' + coverHtml + '</div>' +
            '<div class="music-song-info">' +
                '<div class="music-song-name">' + song.title + '</div>' +
                '<div class="music-song-artist">' + song.artist + '</div>' +
            '</div>' +
        '</div>';
    });
    
    if (sortedSongs.length === 0) {
        songsHtml = '<div style="text-align:center;padding:60px 20px;color:#999;">' +
            '<div style="font-size:48px;margin-bottom:15px;">📊</div>' +
            '<div style="font-size:16px;">暂无排行数据</div>' +
            '<div style="font-size:14px;margin-top:8px;">播放更多歌曲来生成排行榜</div>' +
        '</div>';
    }
    
    const pageHtml = '<div class="music-app-container" style="padding-top:0;">' +
        '<div style="padding:15px 20px 10px;">' +
            '<div style="font-size:24px;font-weight:700;color:#1a1a1a;">🔥 热门排行榜</div>' +
            '<div style="font-size:13px;color:#888;margin-top:5px;">根据播放次数排序</div>' +
        '</div>' +
        '<div class="music-song-list" style="padding-bottom:20px;">' + songsHtml + '</div>' +
    '</div>';
    
    const page = musicApp.openDetailPage(pageHtml, { background: '#fff5f8' });
    bindChartPageEvents(page);
}

function bindChartPageEvents(page) {
    const songItems = page.querySelectorAll('.music-song-item');
    songItems.forEach(function(item) {
        item.onclick = function() {
            const songId = parseInt(item.dataset.id);
            const song = MusicPlayerState.songs.find(s => s.id === songId);
            if (song) {
                song.playCount = (song.playCount || 0) + 1;
                playSong(song);
                openPlayerPage(song);
            }
        };
    });
}

// 显示私人电台页面
function showRadioPage() {
    const shuffledSongs = [...MusicPlayerState.songs].sort(() => Math.random() - 0.5);
    
    let songsHtml = '';
    shuffledSongs.slice(0, 10).forEach(function(song) {
        const coverHtml = song.cover 
            ? '<img src="' + song.cover + '" alt="">' 
            : '<div class="music-song-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>';
        
        songsHtml += '<div class="music-song-item" data-id="' + song.id + '">' +
            '<div class="music-song-cover">' + coverHtml + '</div>' +
            '<div class="music-song-info">' +
                '<div class="music-song-name">' + song.title + '</div>' +
                '<div class="music-song-artist">' + song.artist + '</div>' +
            '</div>' +
            '<div class="music-song-play-btn">' + SVGIcons.play + '</div>' +
        '</div>';
    });
    
    if (shuffledSongs.length === 0) {
        songsHtml = '<div style="text-align:center;padding:60px 20px;color:#999;">' +
            '<div style="font-size:48px;margin-bottom:15px;">📻</div>' +
            '<div style="font-size:16px;">曲库为空</div>' +
            '<div style="font-size:14px;margin-top:8px;">添加歌曲后开始收听私人电台</div>' +
        '</div>';
    }
    
    const pageHtml = '<div class="music-app-container" style="padding-top:0;">' +
        '<div style="padding:15px 20px 10px;">' +
            '<div style="font-size:24px;font-weight:700;color:#1a1a1a;">📻 私人电台</div>' +
            '<div style="font-size:13px;color:#888;margin-top:5px;">为你随机推荐</div>' +
        '</div>' +
        '<div style="padding:0 20px 15px;">' +
            '<button class="refresh-radio-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#4ecdc4,#44bfb6);color:white;border:none;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 15px rgba(78,205,196,0.3);">' +
                '🔄 换一批推荐</button>' +
        '</div>' +
        '<div class="music-song-list" style="padding-bottom:20px;">' + songsHtml + '</div>' +
    '</div>';
    
    const page = musicApp.openDetailPage(pageHtml, { background: '#fff5f8' });
    bindRadioPageEvents(page);
}

function bindRadioPageEvents(page) {
    const songItems = page.querySelectorAll('.music-song-item');
    songItems.forEach(function(item) {
        item.onclick = function() {
            const songId = parseInt(item.dataset.id);
            const song = MusicPlayerState.songs.find(s => s.id === songId);
            if (song) {
                playSong(song);
                openPlayerPage(song);
            }
        };
    });
    
    const refreshBtn = page.querySelector('.refresh-radio-btn');
    if (refreshBtn) {
        refreshBtn.onclick = function(e) {
            e.stopPropagation();
            // 关闭当前页面并重新打开
            const backBtn = page.querySelector('.app-back-btn');
            if (backBtn) backBtn.click();
            setTimeout(showRadioPage, 350);
        };
    }
}

// 显示精选歌单页面
function showRecommendPlaylistPage() {
    let playlistsHtml = '';
    
    if (MusicPlayerState.playlists.length === 0) {
        playlistsHtml = '<div style="text-align:center;padding:60px 20px;color:#999;">' +
            '<div style="font-size:48px;margin-bottom:15px;">📁</div>' +
            '<div style="font-size:16px;">还没有歌单</div>' +
            '<div style="font-size:14px;margin-top:8px;">创建歌单来整理你的音乐</div>' +
            '<button class="create-playlist-btn" style="margin-top:20px;padding:12px 24px;background:linear-gradient(135deg,#a29bfe,#9388ee);color:white;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">+ 创建歌单</button>' +
        '</div>';
    } else {
        MusicPlayerState.playlists.forEach(function(playlist) {
            const coverHtml = playlist.cover 
                ? '<img src="' + playlist.cover + '" style="width:100%;height:100%;object-fit:cover;">' 
                : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#a29bfe,#9388ee);display:flex;align-items:center;justify-content:center;">' + SVGIcons.playlist + '</div>';
            
            playlistsHtml += '<div class="playlist-card-item" data-id="' + playlist.id + '" style="display:flex;align-items:center;padding:14px;background:white;border-radius:16px;margin-bottom:12px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.04);">' +
                '<div style="width:60px;height:60px;border-radius:12px;overflow:hidden;margin-right:14px;flex-shrink:0;">' + coverHtml + '</div>' +
                '<div style="flex:1;">' +
                    '<div style="font-size:16px;font-weight:600;color:#1a1a1a;">' + playlist.name + '</div>' +
                    '<div style="font-size:13px;color:#888;margin-top:4px;">' + playlist.songs.length + ' 首歌曲</div>' +
                '</div>' +
                '<div style="color:#ddd;font-size:20px;">›</div>' +
            '</div>';
        });
    }
    
    const pageHtml = '<div class="music-app-container" style="padding-top:0;">' +
        '<div style="padding:15px 20px 10px;">' +
            '<div style="font-size:24px;font-weight:700;color:#1a1a1a;">📁 精选歌单</div>' +
            '<div style="font-size:13px;color:#888;margin-top:5px;">你创建的所有歌单</div>' +
        '</div>' +
        '<div style="padding:0 20px 20px;">' + playlistsHtml + '</div>' +
    '</div>';
    
    const page = musicApp.openDetailPage(pageHtml, { background: '#fff5f8' });
    bindRecommendPlaylistPageEvents(page);
}

function bindRecommendPlaylistPageEvents(page) {
    const playlistCards = page.querySelectorAll('.playlist-card-item');
    playlistCards.forEach(function(card) {
        card.onclick = function() {
            const playlistId = parseInt(card.dataset.id);
            const playlist = MusicPlayerState.playlists.find(p => p.id === playlistId);
            if (playlist) {
                // 关闭当前页
                const backBtn = page.querySelector('.app-back-btn');
                if (backBtn) backBtn.click();
                setTimeout(function() {
                    openPlaylistPage(playlist);
                }, 350);
            }
        };
    });
    
    const createBtn = page.querySelector('.create-playlist-btn');
    if (createBtn) {
        createBtn.onclick = function(e) {
            e.stopPropagation();
            showCreatePlaylistModal();
        };
    }
}

// 显示最近播放页面（听歌回顾）
function showRecentPlayPage() {
    // 获取播放历史
    const recentSongs = MusicPlayerState.playHistory || [];
    
    let songsHtml = '';
    if (recentSongs.length === 0) {
        songsHtml = '<div style="text-align:center;padding:60px 20px;color:#999;">' +
            '<div style="font-size:48px;margin-bottom:15px;">🕐</div>' +
            '<div style="font-size:16px;">暂无播放记录</div>' +
            '<div style="font-size:14px;margin-top:8px;">播放音乐后会在这里显示</div>' +
        '</div>';
    } else {
        recentSongs.forEach(function(record, idx) {
            const song = MusicPlayerState.songs.find(s => s.id === record.songId);
            if (!song) return;
            
            const coverHtml = song.cover 
                ? '<img src="' + song.cover + '" alt="">' 
                : '<div class="music-song-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>';
            
            const playTime = record.playTime ? new Date(record.playTime).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : '';
            
            songsHtml += '<div class="music-song-item" data-id="' + song.id + '">' +
                '<div class="music-song-cover">' + coverHtml + '</div>' +
                '<div class="music-song-info">' +
                    '<div class="music-song-name">' + song.title + '</div>' +
                    '<div class="music-song-artist">' + song.artist + (playTime ? ' · ' + playTime : '') + '</div>' +
                '</div>' +
                '<div class="music-song-play-btn">' + SVGIcons.play + '</div>' +
            '</div>';
        });
    }
    
    // 统计信息
    const totalPlays = recentSongs.length;
    const uniqueSongs = [...new Set(recentSongs.map(r => r.songId))].length;
    
    const pageHtml = '<div class="music-app-container" style="padding-top:0;">' +
        '<div style="padding:15px 20px 10px;">' +
            '<div style="font-size:24px;font-weight:700;color:#1a1a1a;">🕐 听歌回顾</div>' +
            '<div style="font-size:13px;color:#888;margin-top:5px;">你的音乐足迹</div>' +
        '</div>' +
        '<div style="display:flex;gap:12px;padding:0 20px 15px;">' +
            '<div style="flex:1;background:linear-gradient(135deg,#fd79a8,#f06292);border-radius:14px;padding:16px;color:white;">' +
                '<div style="font-size:28px;font-weight:700;">' + totalPlays + '</div>' +
                '<div style="font-size:12px;opacity:0.9;margin-top:4px;">播放次数</div>' +
            '</div>' +
            '<div style="flex:1;background:linear-gradient(135deg,#a29bfe,#9388ee);border-radius:14px;padding:16px;color:white;">' +
                '<div style="font-size:28px;font-weight:700;">' + uniqueSongs + '</div>' +
                '<div style="font-size:12px;opacity:0.9;margin-top:4px;">不同歌曲</div>' +
            '</div>' +
        '</div>' +
        (recentSongs.length > 0 ? '<div style="padding:0 20px 10px;"><button class="clear-history-btn" style="width:100%;padding:12px;background:#fff5f5;color:#ff6b6b;border:none;border-radius:12px;font-size:14px;font-weight:500;cursor:pointer;">清空播放记录</button></div>' : '') +
        '<div class="music-song-list" style="padding-bottom:20px;">' + songsHtml + '</div>' +
    '</div>';
    
    const page = musicApp.openDetailPage(pageHtml, { background: '#fff5f8' });
    bindRecentPlayPageEvents(page);
}

function bindRecentPlayPageEvents(page) {
    const songItems = page.querySelectorAll('.music-song-item');
    songItems.forEach(function(item) {
        item.onclick = function() {
            const songId = parseInt(item.dataset.id);
            const song = MusicPlayerState.songs.find(s => s.id === songId);
            if (song) {
                playSong(song);
                openPlayerPage(song);
            }
        };
    });
    
    const clearBtn = page.querySelector('.clear-history-btn');
    if (clearBtn) {
        clearBtn.onclick = function(e) {
            e.stopPropagation();
            if (confirm('确定要清空播放记录吗？')) {
                MusicPlayerState.playHistory = [];
                // 刷新页面
                const backBtn = page.querySelector('.app-back-btn');
                if (backBtn) backBtn.click();
                setTimeout(showRecentPlayPage, 350);
            }
        };
    }
}

// 搜索结果页面
function showSearchResultsPage(query) {
    const lowerQuery = query.toLowerCase();
    const results = MusicPlayerState.songs.filter(function(song) {
        return song.title.toLowerCase().includes(lowerQuery) || 
               song.artist.toLowerCase().includes(lowerQuery);
    });
    
    let songsHtml = '';
    if (results.length === 0) {
        songsHtml = '<div style="text-align:center;padding:60px 20px;color:#999;">' +
            '<div style="font-size:48px;margin-bottom:15px;">🔍</div>' +
            '<div style="font-size:16px;">未找到 "' + query + '"</div>' +
            '<div style="font-size:14px;margin-top:8px;">试试其他关键词</div>' +
        '</div>';
    } else {
        results.forEach(function(song) {
            const coverHtml = song.cover 
                ? '<img src="' + song.cover + '" alt="">' 
                : '<div class="music-song-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>';
            
            songsHtml += '<div class="music-song-item" data-id="' + song.id + '">' +
                '<div class="music-song-cover">' + coverHtml + '</div>' +
                '<div class="music-song-info">' +
                    '<div class="music-song-name">' + song.title + '</div>' +
                    '<div class="music-song-artist">' + song.artist + '</div>' +
                '</div>' +
                '<div class="music-song-play-btn">' + SVGIcons.play + '</div>' +
            '</div>';
        });
    }
    
    const pageHtml = '<div class="music-app-container" style="padding-top:0;">' +
        '<div style="padding:15px 20px 10px;">' +
            '<div style="font-size:24px;font-weight:700;color:#1a1a1a;">🔍 搜索结果</div>' +
            '<div style="font-size:13px;color:#888;margin-top:5px;">找到 ' + results.length + ' 首 "' + query + '"</div>' +
        '</div>' +
        '<div class="music-song-list" style="padding-bottom:20px;">' + songsHtml + '</div>' +
    '</div>';
    
    const page = musicApp.openDetailPage(pageHtml, { background: '#fff5f8' });
    bindSearchResultsPageEvents(page);
}

function bindSearchResultsPageEvents(page) {
    const songItems = page.querySelectorAll('.music-song-item');
    songItems.forEach(function(item) {
        item.onclick = function() {
            const songId = parseInt(item.dataset.id);
            const song = MusicPlayerState.songs.find(s => s.id === songId);
            if (song) {
                playSong(song);
                openPlayerPage(song);
            }
        };
    });
}

// ============ 动态底部导航栏功能 ============
function initMusicTabBar(app) {
    if (!app.appWindow) return;
    
    const tabBar = app.appWindow.querySelector('.app-tab-bar');
    if (!tabBar || tabBar.classList.contains('music-dynamic-tabbar')) return;
    
    // 添加动态样式类
    tabBar.classList.add('music-dynamic-tabbar');
    tabBar.setAttribute('data-tab', '0');
    
    // 添加背景波浪效果
    const bgHtml = '<div class="music-tabbar-bg">' +
        '<div class="music-tabbar-wave"></div>' +
        '<div class="music-tabbar-wave"></div>' +
        '<div class="music-tabbar-wave"></div>' +
    '</div>';
    
    // 添加浮动音符
    const notesHtml = '<div class="music-tabbar-notes">' +
        '<span class="music-note" style="left:10%;animation-delay:0s;">♪</span>' +
        '<span class="music-note" style="left:30%;animation-delay:0.5s;">♫</span>' +
        '<span class="music-note" style="left:50%;animation-delay:1s;">♪</span>' +
        '<span class="music-note" style="left:70%;animation-delay:1.5s;">♫</span>' +
        '<span class="music-note" style="left:90%;animation-delay:2s;">♪</span>' +
    '</div>';
    
    // 添加指示器
    const indicatorHtml = '<div class="music-tab-indicator"><div class="music-tab-indicator-inner"></div></div>';
    
    tabBar.insertAdjacentHTML('afterbegin', bgHtml + notesHtml + indicatorHtml);
    
    // 计算并设置指示器位置
    updateTabIndicator(app, 0);
    
    // 重新绑定标签点击事件以添加波纹效果
    const tabItems = tabBar.querySelectorAll('.app-tab-item');
    tabItems.forEach(function(item, index) {
        item.addEventListener('click', function(e) {
            // 创建波纹效果
            createTabRipple(item, e);
            
            // 更新指示器
            setTimeout(function() {
                updateTabIndicator(app, index);
            }, 50);
        });
    });
    
    // 监听播放状态变化
    updateTabBarPlayingState(app);
}

function updateTabIndicator(app, tabIndex) {
    if (!app.appWindow) return;
    
    const tabBar = app.appWindow.querySelector('.app-tab-bar');
    const indicator = tabBar.querySelector('.music-tab-indicator');
    const tabItems = tabBar.querySelectorAll('.app-tab-item');
    
    if (!indicator || !tabItems[tabIndex]) return;
    
    const tabItem = tabItems[tabIndex];
    const tabRect = tabItem.getBoundingClientRect();
    const barRect = tabBar.getBoundingClientRect();
    
    const indicatorWidth = Math.min(tabRect.width - 16, 70);
    const indicatorLeft = tabRect.left - barRect.left + (tabRect.width - indicatorWidth) / 2;
    
    indicator.style.width = indicatorWidth + 'px';
    indicator.style.left = indicatorLeft + 'px';
    
    // 更新data-tab属性用于颜色变化
    tabBar.setAttribute('data-tab', tabIndex);
}

function createTabRipple(tabItem, event) {
    const ripple = document.createElement('span');
    ripple.className = 'music-tab-ripple';
    
    const rect = tabItem.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
    
    tabItem.appendChild(ripple);
    
    setTimeout(function() {
        ripple.remove();
    }, 600);
}

function updateTabBarPlayingState(app) {
    if (!app.appWindow) return;
    
    const tabBar = app.appWindow.querySelector('.app-tab-bar');
    if (!tabBar) return;
    
    if (MusicPlayerState.isPlaying) {
        tabBar.classList.add('playing');
    } else {
        tabBar.classList.remove('playing');
    }
}

function updateMusicTabBar(app) {
    if (!app.appWindow) return;
    
    const tabBar = app.appWindow.querySelector('.app-tab-bar');
    if (!tabBar) return;
    
    // 确保已初始化
    if (!tabBar.classList.contains('music-dynamic-tabbar')) {
        initMusicTabBar(app);
    }
    
    // 更新指示器位置
    updateTabIndicator(app, app.currentTabIndex || 0);
    
    // 更新播放状态
    updateTabBarPlayingState(app);
}

// 记录播放历史
function addToPlayHistory(songId) {
    if (!MusicPlayerState.playHistory) {
        MusicPlayerState.playHistory = [];
    }
    
    // 添加到历史记录开头
    MusicPlayerState.playHistory.unshift({
        songId: songId,
        playTime: Date.now()
    });
    
    // 限制历史记录数量为100条
    if (MusicPlayerState.playHistory.length > 100) {
        MusicPlayerState.playHistory = MusicPlayerState.playHistory.slice(0, 100);
    }
}

const musicApp = new MyBaseApp({
    id: 'music-app', 
    name: '音乐', 
    color: '#fff5f8', 
    barStyle: 'dark', 
    detailPageHomeIndicatorEnabled: true, 
     
    tabs: [ 
        {  
            name: '首页',  
            icon: SVGIcons.home,  
            content: generateRecommendTabContent() 
        }, 
        {  
            name: '一起听',  
            icon: SVGIcons.users || '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/></svg>',
            content: generateListenTogetherTabContent() 
        },
        {  
            name: '发现',  
            icon: SVGIcons.search,  
            content: generateDiscoverTabContent() 
        }, 
        {  
            name: '我的',  
            icon: SVGIcons.user,  
            content: generateMeTabContent() 
        }
    ], 
     
    island: { 
        state: MusicPlayerState, 
         
        render: function(mode, state, app) { 
            if (!state.currentSong) return ''; 
             
            const song = state.currentSong; 
             
            if (mode === 'quiet') { 
                const coverHtml = song.cover  
                    ? '<img src="' + song.cover + '" alt="">'  
                    : '<div class="island-music-quiet-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>'; 
                const waveClass = state.isPlaying ? 'playing' : ''; 
                 
                return '<div class="island-music-quiet">' + 
                    '<div class="island-music-quiet-cover">' + coverHtml + '</div>' + 
                    '<div class="island-music-quiet-wave ' + waveClass + '">' + 
                        '<span style="background:' + song.color + ';"></span>' +
                        '<span style="background:' + song.color + ';"></span>' +
                        '<span style="background:' + song.color + ';"></span>' + 
                    '</div>' + 
                '</div>'; 
            } 
             
            if (mode === 'medium') { 
                const coverHtml = song.cover  
                    ? '<img src="' + song.cover + '" alt="">'  
                    : '<div class="island-music-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>'; 
                const liked = isLiked(song.id); 
                const likeIcon = liked ? SVGIcons.heart : SVGIcons.heartOutline; 
                const likedClass = liked ? 'liked' : ''; 
                 
                return '<div class="island-music-medium">' + 
                    '<div class="island-music-header">' + 
                        '<div class="island-music-cover">' + coverHtml + '</div>' + 
                        '<div class="island-music-info">' + 
                            '<div class="island-music-title">' + song.title + '</div>' + 
                            '<div class="island-music-artist">' + song.artist + '</div>' + 
                        '</div>' + 
                    '</div>' + 
                    '<div class="island-music-progress">' + 
                        '<div class="island-music-progress-bar">' + 
                            '<div class="island-music-progress-fill" style="width:' + state.progress + '%;"></div>' + 
                        '</div>' + 
                    '</div>' + 
                    '<div class="island-music-controls">' + 
                        '<div class="island-music-side-btns">' + 
                            '<div class="island-music-btn island-like-btn ' + likedClass + '" data-id="' + song.id + '">' + likeIcon + '</div>' + 
                        '</div>' + 
                        '<div class="island-music-main-btns">' + 
                            '<div class="island-music-btn island-music-btn-skip island-prev-btn">' + SVGIcons.prev + '</div>' + 
                            '<div class="island-music-btn island-play-btn">' + (state.isPlaying ? SVGIcons.pause : SVGIcons.play) + '</div>' + 
                            '<div class="island-music-btn island-music-btn-skip island-next-btn">' + SVGIcons.next + '</div>' + 
                        '</div>' + 
                    '</div>' + 
                '</div>'; 
            } 
             
            if (mode === 'large') { 
                const coverHtml = song.cover  
                    ? '<img src="' + song.cover + '" alt="">'  
                    : '<div class="island-music-large-cover-placeholder" style="background:linear-gradient(135deg,' + song.color + ',' + song.color + '99);">' + SVGIcons.music + '</div>'; 
                const liked = isLiked(song.id); 
                const likeIcon = liked ? SVGIcons.heart : SVGIcons.heartOutline; 
                const likedClass = liked ? 'liked' : ''; 
                 
                const lyrics = song.lyrics || defaultLyrics; 
                let lyricsHtml = ''; 
                let activeIndex = 0; 
                for (let i = 0; i < lyrics.length; i++) { 
                    if (state.currentTime >= lyrics[i].time) { 
                        activeIndex = i; 
                    } 
                } 
                lyrics.forEach(function(line, index) { 
                    const activeClass = index === activeIndex ? 'active' : ''; 
                    lyricsHtml += '<div class="island-music-lyric-line ' + activeClass + '" data-index="' + index + '">' + line.text + '</div>'; 
                }); 
                 
                return '<div class="island-music-large">' + 
                    '<div class="island-music-large-header">' + 
                        '<div class="island-music-large-cover">' + coverHtml + '</div>' + 
                        '<div class="island-music-large-info">' + 
                            '<div class="island-music-large-title">' + song.title + '</div>' + 
                            '<div class="island-music-large-artist">' + song.artist + '</div>' + 
                        '</div>' + 
                        '<div class="island-music-btn island-like-btn ' + likedClass + '" data-id="' + song.id + '">' + likeIcon + '</div>' + 
                    '</div>' + 
                    '<div class="island-music-progress">' + 
                        '<div class="island-music-progress-bar">' + 
                            '<div class="island-music-progress-fill" style="width:' + state.progress + '%;"></div>' + 
                        '</div>' + 
                    '</div>' + 
                    '<div class="island-music-large-controls">' + 
                        '<div class="island-music-large-btn island-prev-btn">' + SVGIcons.prev + '</div>' + 
                        '<div class="island-music-large-btn island-music-large-btn-main island-play-btn">' + (state.isPlaying ? SVGIcons.pause : SVGIcons.play) + '</div>' + 
                        '<div class="island-music-large-btn island-next-btn">' + SVGIcons.next + '</div>' + 
                    '</div>' + 
                    '<div class="island-music-lyrics">' + lyricsHtml + '</div>' + 
                '</div>'; 
            } 
             
            return ''; 
        }, 
         
        bindEvents: function(container, state, app) { 
            const playBtns = container.querySelectorAll('.island-play-btn'); 
            playBtns.forEach(function(btn) { 
                btn.onclick = function(e) { 
                    e.stopPropagation(); 
                    togglePlay(); 
                }; 
            }); 
             
            const prevBtns = container.querySelectorAll('.island-prev-btn'); 
            prevBtns.forEach(function(btn) { 
                btn.onclick = function(e) { 
                    e.stopPropagation(); 
                    playPrevSong(); 
                }; 
            }); 
             
            const nextBtns = container.querySelectorAll('.island-next-btn'); 
            nextBtns.forEach(function(btn) { 
                btn.onclick = function(e) { 
                    e.stopPropagation(); 
                    playNextSong(); 
                }; 
            }); 
             
            const likeBtns = container.querySelectorAll('.island-like-btn'); 
            likeBtns.forEach(function(btn) { 
                btn.onclick = function(e) { 
                    e.stopPropagation(); 
                    const songId = parseInt(btn.dataset.id); 
                    toggleLike(songId); 
                    if (isLiked(songId)) { 
                        btn.classList.add('liked'); 
                        btn.innerHTML = SVGIcons.heart; 
                    } else { 
                        btn.classList.remove('liked'); 
                        btn.innerHTML = SVGIcons.heartOutline; 
                    } 
                }; 
            }); 
             
            const progressBars = container.querySelectorAll('.island-music-progress-bar'); 
            progressBars.forEach(function(bar) { 
                bar.onclick = function(e) { 
                    e.stopPropagation(); 
                    const rect = bar.getBoundingClientRect(); 
                    const percentage = ((e.clientX - rect.left) / rect.width) * 100; 
                    seekTo(Math.max(0, Math.min(100, percentage))); 
                }; 
            }); 
            
            // 灵动岛展开时自动滚动到当前播放歌词居中显示
            const lyricsContainer = container.querySelector('.island-music-lyrics');
            if (lyricsContainer) {
                const activeLine = lyricsContainer.querySelector('.island-music-lyric-line.active');
                if (activeLine) {
                    // 使用较长的延迟确保灵动岛展开动画完成后再滚动
                    setTimeout(function() {
                        // 使用scrollIntoView确保当前播放歌词滚动到可视区域中心
                        activeLine.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }, 150);
                }
            }
        }, 
         
        onAppReady: function(win, app) { 
            const contentArea = win.querySelector('#main-content-area'); 
            if (contentArea) { 
                bindMainTabEvents(contentArea); 
            }
            // 如果有正在播放或已暂停的歌曲，激活灵动岛
            if (MusicPlayerState.currentSong) {
                app.activateIsland();
            }
            
            // 初始化动态底部导航栏
            setTimeout(function() {
                initMusicTabBar(app);
            }, 100);
        }, 
         
        onTabChange: function(contentArea, app) { 
            if (app.currentTabIndex === 0) { 
                contentArea.innerHTML = generateRecommendTabContent(); 
                bindMainTabEvents(contentArea); 
            } else if (app.currentTabIndex === 1) {
                contentArea.innerHTML = generateListenTogetherTabContent();
                bindListenTogetherTabEvents(contentArea);
            } else if (app.currentTabIndex === 2) { 
                contentArea.innerHTML = generateDiscoverTabContent(); 
                bindDiscoverTabEvents(contentArea);
            } else if (app.currentTabIndex === 3) { 
                contentArea.innerHTML = generateMeTabContent(); 
                bindMeTabEvents(contentArea); 
            }
            
            // 更新底部导航栏动态效果
            updateMusicTabBar(app);
        } 
    } 
}); 
 
initAudio(); 
 