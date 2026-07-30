音乐 App 灵动岛相关代码整理

一、CSS（音乐灵动岛专属，来源：js/apps/music-app.js）

```js
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
        width: 100%; height: 7px; background-color: #404040; 
        border-radius: 3.5px; margin: 5px 0; position: relative; cursor: pointer; 
    } 
    .island-music-progress-bar { 
        width: 100%; 
        height: 7px; 
        background: #404040; 
        border-radius: 2px; 
        cursor: pointer; 
    } 
    .island-music-progress-fill { 
        width: 40%; height: 100%; background-color: #fb7299; 
        border-radius: 3.5px; position: relative; transition: width 0.1s linear; 
    } 
    .island-music-progress-fill::after { 
        content: ''; position: absolute; right: -5px; top: 50%; transform: translateY(-55%); 
        width: 12px; height: 12px; background-color: white; border-radius: 50%; 
        box-shadow: 0 0 4px rgba(0,0,0,0.3); 
    } 
    .island-music-controls { 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        margin-top: auto; 
    } 
    .island-music-side-btns { 
        display: flex; 
        gap: 10px; 
    } 
    .island-music-main-btns { 
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
```

二、HTML（音乐灵动岛内部渲染模板，来源：js/apps/music-app.js）

```js
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
    }
}
```

三、JS（音乐灵动岛交互逻辑，来源：js/apps/music-app.js）

```js
function injectMusicStyles() { 
    if (!document.getElementById('music-app-styles')) { 
        const style = document.createElement('style'); 
        style.id = 'music-app-styles'; 
        style.textContent = MusicAppCSS + MusicIslandCSS; 
        document.head.appendChild(style); 
    } 
}

MusicPlayerState.idleTimer = setTimeout(function() { 
    if (!MusicPlayerState.isPlaying) {
        if (DynamicIsland.activeApp === musicApp) { 
            DynamicIsland.clearApp(); 
        }
    }
}, MusicPlayerState.idleTimeout);

const islandProgress = document.querySelector('.island-music-progress-fill'); 
if (islandProgress) { 
    islandProgress.style.width = MusicPlayerState.progress + '%'; 
}

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

document.querySelectorAll('.music-lyric-line, .island-music-lyric-line').forEach(function(line, index) { 
    if (parseInt(line.dataset.index) === activeIndex) { 
        if (!line.classList.contains('active')) { 
            line.classList.add('active'); 
        }
    } else {
        line.classList.remove('active');
    }
});

musicApp.activateIsland();
```

```js
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
    
    const lyricsContainer = container.querySelector('.island-music-lyrics');
    if (lyricsContainer) {
        const activeLine = lyricsContainer.querySelector('.island-music-lyric-line.active');
        if (activeLine) {
            setTimeout(function() {
                activeLine.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 150);
        }
    }
}
```

四、全局灵动岛容器（音乐内容实际挂载位置，不在 music-app.js 内）

1）全局 CSS（来源：css/main.css）

```css
.dynamic-island {
    position: absolute;
    top: 15px;
    left: 50%;
}

.dynamic-island-content {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
}

.dynamic-island.active {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    transform: translateX(-50%) scale(1.05);
}

.dynamic-island.mini,
.dynamic-island.compact,
.dynamic-island.medium,
.dynamic-island.large {
    overflow: hidden;
}
```

2）全局 HTML（来源：html/index.html）

```html
<div class="dynamic-island" :class="[
    islandMode !== 'idle' ? islandSize : '',
    islandActive ? 'active' : '',
    islandMode === 'notification' ? 'notification' : '',
    islandMode === 'info' ? 'info' : ''
]" @click.stop="handleIslandClick">
    <div v-if="islandMode === 'info' && islandSize === 'mini'" class="dynamic-island-content flex items-center justify-center gap-[10px] !opacity-100">
        ...
    </div>

    <div v-if="islandMode === 'info' && islandSize === 'medium'" class="dynamic-island-content flex items-center !opacity-100">
        ...
    </div>

    <div v-if="islandMode === 'info' && islandSize === 'large'" class="dynamic-island-content !opacity-100 !pointer-events-auto">
        ...
    </div>
</div>
```

五、结论

- `music-app.js` 内部真正属于音乐灵动岛的核心内容是：`MusicIslandCSS`、`island.render(...)`、`island.bindEvents(...)`、`activateIsland / clearApp` 相关调用。
- 全局 `.dynamic-island` 容器和外层 HTML 不在 `music-app.js`，而是在 `css/main.css` 与 `html/index.html`。
- 如果你后面要“迁移灵动岛代码”，优先迁移第三部分和第一、二部分；第四部分是宿主外壳。
