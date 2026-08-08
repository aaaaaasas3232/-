// ==================== system-config-app.js ====================

(function(global) {
    'use strict';

    // ============ SVG图标定义 ============
    var SVG_ICONS = {
        // Tab栏图标
        person: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M128,120a44,44,0,1,1,44-44A44.05,44.05,0,0,1,128,120Zm0-72a28,28,0,1,0,28,28A28,28,0,0,0,128,48Zm94.4,152.77A8,8,0,0,1,216,212H40a8,8,0,0,1-6.4-12.77C52.65,172.05,86.35,156,128,156s75.35,16.05,94.4,43.23A8,8,0,0,1,222.4,200.77ZM203.77,196c-14.36-20.09-43.08-32-75.77-32s-61.41,11.91-75.77,32Z"/></svg>',
        globe: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm88,104a87.62,87.62,0,0,1-6.4,32.94l-44.7-27.49a15.92,15.92,0,0,0-6.24-2.23l-22.82-3.08a16.11,16.11,0,0,0-16,7.86h-8.72l-3.8-7.86a15.91,15.91,0,0,0-11-8.67l-8-1.73L96.14,104h16.71a16.06,16.06,0,0,0,7.73-2l12.25-6.76a16.62,16.62,0,0,0,3-2.14l26.91-24.34A15.93,15.93,0,0,0,168,57V40.93A88.11,88.11,0,0,1,216,128ZM40,128a87.53,87.53,0,0,1,8.54-37.8l11.34,30.27a16,16,0,0,0,11.62,10l21.43,4.61L96.74,143a16.09,16.09,0,0,0,14.4,9h1.48l-7.23,38.61A16,16,0,0,0,112,208c.53,0,1.08,0,1.6-.05l16-1.87a88.2,88.2,0,0,1-89.6-78Z"/></svg>',
        robot: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48Zm16,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V80A16,16,0,0,1,56,64H200a16,16,0,0,1,16,16Zm-36-56a12,12,0,1,1-12-12A12,12,0,0,1,180,136ZM88,136a12,12,0,1,1-12-12A12,12,0,0,1,88,136Zm16,24a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,160Z"/></svg>',
        gear: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z"/></svg>',
        
        // 功能图标
        user_avatar: '<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 33.75C36.2132 33.75 41.25 28.7132 41.25 22.5C41.25 16.2868 36.2132 11.25 30 11.25C23.7868 11.25 18.75 16.2868 18.75 22.5C18.75 28.7132 23.7868 33.75 30 33.75Z" fill="white"/><path d="M30 37.5C21.715 37.5 15 44.215 15 52.5C15 53.5718 15.4282 54 16.5 54H43.5C44.5718 54 45 53.5718 45 52.5C45 44.215 38.285 37.5 30 37.5Z" fill="white"/></svg>',
        sprout: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M232.7,50.48C229,45.7,221.84,40,209,40c-16.85,0-38.46,11.28-57.81,30.16A140.07,140.07,0,0,0,136,87.53V56a8,8,0,0,0-16,0V87.53a140.07,140.07,0,0,0-15.15-17.37C85.49,51.28,63.88,40,47,40,34.16,40,27,45.7,23.3,50.48c-6.82,8.77-12.18,24.08-.21,71.2,6.05,23.83,19.51,33,30.63,36.42A44,44,0,0,0,128,205.27a44,44,0,0,0,74.28-47.17c11.12-3.4,24.57-12.59,30.63-36.42C239.63,95.24,244.85,66.1,232.7,50.48Z"/></svg>',
        mask: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM92,152a12,12,0,1,1,12-12A12,12,0,0,1,92,152Zm72,0a12,12,0,1,1,12-12A12,12,0,0,1,164,152Z"/></svg>',
        card: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm0,16V88H32V64ZM32,192V104H224v88Z"/></svg>',
        save: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M219.31,72,184,36.69A15.86,15.86,0,0,0,172.69,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V83.31A15.86,15.86,0,0,0,219.31,72ZM168,208H88V152h80Zm40,0H184V152a16,16,0,0,0-16-16H88a16,16,0,0,0-16,16v56H48V48H172.69L208,83.31ZM160,72a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h56A8,8,0,0,1,160,72Z"/></svg>',
        database: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15.37,43.27,24.64,80,24.64s62.94-9.27,80-24.64Zm-21.61,58.92C170.93,195.35,150.19,200,128,200s-42.93-4.65-58.39-13.08C55.88,179.43,48,169.62,48,160V143.36c17.06,15.37,43.27,24.64,80,24.64s62.94-9.27,80-24.64V160C208,169.62,200.12,179.43,186.39,186.92ZM128,120c-44.18,0-80-17.91-80-40s35.82-40,80-40,80,17.91,80,40S172.18,120,128,120Z"/></svg>',
        location: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z"/></svg>',
        sword: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H152a8,8,0,0,0-5.66,2.34L100.8,79.88,79.5,67.2a16,16,0,0,0-20.08,2.44L36.69,92.37a16,16,0,0,0,0,22.63l29.17,29.17L52.5,157.5l-20,20a16,16,0,0,0,0,22.63l23.31,23.31a16,16,0,0,0,22.63,0l20-20,13.33-13.33,29.17,29.17a16,16,0,0,0,22.63,0l22.73-22.73a16,16,0,0,0,2.44-20.08l-12.68-21.3,45.54-45.54A8,8,0,0,0,224,104V40A8,8,0,0,0,216,32Z"/></svg>',
        users: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/></svg>',
        star: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z"/></svg>',
        sun: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/></svg>',
        smile: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM80,108a12,12,0,1,1,12,12A12,12,0,0,1,80,108Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,176,108Zm-1.07,48c-10.29,17.79-27.4,28-46.93,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.07-20a8,8,0,0,1,13.86,8Z"/></svg>',
        note: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M200,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H56V48H200ZM72,72h64a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16Zm0,32h112a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16Zm0,32h112a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16Zm0,32h64a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16Z"/></svg>',
        brain: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M248,124a56.11,56.11,0,0,0-32-50.61V72a48,48,0,0,0-88-26.49A48,48,0,0,0,40,72v1.39a56,56,0,0,0,0,101.2V176a48,48,0,0,0,88,26.49A48,48,0,0,0,216,176v-1.41A56.09,56.09,0,0,0,248,124ZM88,208a32,32,0,0,1-31.81-28.56A56,56,0,0,0,76,180h8a8,8,0,0,0,0-16H76A40,40,0,0,1,52,85.47,8,8,0,0,0,56,78V72a32,32,0,0,1,64,0v68.26A47.8,47.8,0,0,0,88,128a8,8,0,0,0,0,16,32,32,0,0,1,0,64Zm104-44h-8a8,8,0,0,0,0,16h8a56,56,0,0,0,19.81-.56A32,32,0,1,1,168,144a8,8,0,0,0,0-16,47.8,47.8,0,0,0-32,12.26V72a32,32,0,0,1,64,0v6a8,8,0,0,0,4,6.93A40,40,0,0,1,180,164Z"/></svg>',
        image: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.63,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"/></svg>',
        chart: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12L166.54,158a8,8,0,0,1-10.07.38L97.66,114.27,40,163.63V200H224A8,8,0,0,1,232,208Z"/></svg>',
        key: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A80,80,0,0,0,216.57,39.43ZM224,100a63.7,63.7,0,0,1-18.78,45.28l-2.88,2.88L183.67,128.5a8,8,0,0,0-11.31,11.31l18.66,18.66L168,181.51l-18.66-18.65a8,8,0,0,0-11.31,11.31l18.65,18.66-10,10H128a8,8,0,0,0-8,8v16H104a8,8,0,0,0-8,8v16H40V187.31l56-56L84.69,120A64,64,0,1,1,224,100Zm-56-20a12,12,0,1,1,12,12A12,12,0,0,1,168,80Z"/></svg>',
        folder: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,72H130.67L102.93,51.2a16.12,16.12,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V200a16,16,0,0,0,16,16H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72Zm0,128H40V64H93.33l27.74,20.8a16.12,16.12,0,0,0,9.6,3.2H216Z"/></svg>',
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>',
        arrow_right: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/></svg>',
        check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>',
        cross: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>',
        lock: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96Zm112,152H48V96H208V208Zm-80-96a28,28,0,0,0-8,54.83V176a8,8,0,0,0,16,0V142.83A28,28,0,0,0,128,112Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,128,152Z"/></svg>',
        block: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm88,104a87.56,87.56,0,0,1-20.41,56.28L71.72,60.41A88,88,0,0,1,216,128ZM40,128A87.56,87.56,0,0,1,60.41,71.72L184.28,195.59A88,88,0,0,1,40,128Z"/></svg>',
        up_arrow: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,149.66l-72,72a8,8,0,0,1-11.32,0l-72-72a8,8,0,0,1,11.32-11.32L120,196.69V40a8,8,0,0,1,16,0V196.69l58.34-58.35a8,8,0,0,1,11.32,11.32Z"/></svg>',
        calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-96-88v64a8,8,0,0,1-16,0V132.94l-4.42,2.22a8,8,0,0,1-7.16-14.32l16-8A8,8,0,0,1,112,120Zm59.16,30.45L152,176h16a8,8,0,0,1,0,16H136a8,8,0,0,1-6.4-12.8l28.78-38.37A8,8,0,1,0,145.07,132a8,8,0,1,1-13.85-8A24,24,0,0,1,176,136,23.76,23.76,0,0,1,171.16,150.45Z"/></svg>',
        clock: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>',
        copy: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/></svg>',
        wallpaper: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.63,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"/></svg>',
        blur: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M208,136a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H200A8,8,0,0,1,208,136Zm-8-40H56a8,8,0,0,0,0,16H200a8,8,0,0,0,0-16Zm0,64H56a8,8,0,0,0,0,16H200a8,8,0,0,0,0-16Z"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/></svg>',
        palette: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89ZM213.31,144.6a16,16,0,0,1-15.1,11.4H152a32,32,0,0,0-32,32,16,16,0,0,1-21.31,15.07C62.49,190.15,40,161.27,40,128A88,88,0,0,1,127.4,40h.67A88.38,88.38,0,0,1,216,127.33,89.14,89.14,0,0,1,213.31,144.6ZM140,76a12,12,0,1,1-12-12A12,12,0,0,1,140,76Zm-44,24a12,12,0,1,1-12-12A12,12,0,0,1,96,100Zm0,56a12,12,0,1,1-12-12A12,12,0,0,1,96,156Zm88-56a12,12,0,1,1-12-12A12,12,0,0,1,184,100Z"/></svg>',
        user: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M128,120a44,44,0,1,1,44-44A44.05,44.05,0,0,1,128,120Zm0-72a28,28,0,1,0,28,28A28,28,0,0,0,128,48Zm94.4,152.77A8,8,0,0,1,216,212H40a8,8,0,0,1-6.4-12.77C52.65,172.05,86.35,156,128,156s75.35,16.05,94.4,43.23A8,8,0,0,1,222.4,200.77ZM203.77,196c-14.36-20.09-43.08-32-75.77-32s-61.41,11.91-75.77,32Z"/></svg>',
        /* 时间表图标选择器用 */
        book: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M208,24H72A32,32,0,0,0,40,56V224a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16H56a16,16,0,0,1,16-16H208a8,8,0,0,0,8-8V32A8,8,0,0,0,208,24Zm0,128H72a16,16,0,0,1,0-32H208V96H72a16.12,16.12,0,0,0-16,16v24H208V152Z"/></svg>',
        briefcase: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M216,64H176V56a24,24,0,0,0-24-24H104A24,24,0,0,0,80,56v8H40A16,16,0,0,0,24,80V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V80A16,16,0,0,0,216,64ZM96,56a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM216,200H40V80H80v16h96V80h40Z"/></svg>',
        graduation: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M251.76,88.94l-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V240a8,8,0,0,0,16,0V198.51a115.63,115.63,0,0,0,27.94-22.42A15.91,15.91,0,0,0,224,166.29V117.87l28.24-14.81a8,8,0,0,0,0-14.12ZM128,200c-43.27,0-68.72-21.14-80-33.71V126.4l76.24,39.95a8,8,0,0,0,7.52,0L208,126.4v40.24C196.58,178.78,171.23,200,128,200ZM40,126.4,118.24,168,40,205.61Zm176,0v79.21L137.76,168Z"/></svg>',
        moon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-8,104.84,104.84,0,0,0,31.12,2.26,104,104,0,0,0,112-111.94,104.84,104.84,0,0,0,2.26-31.1A8,8,0,0,0,233.54,142.23Z"/></svg>',
        run: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M144,48a40,40,0,1,0-40,40A40,40,0,0,0,144,48Zm0-64a24,24,0,1,1-24,24A24,24,0,0,1,144-16Zm88,144H165.25L134.93,76.75l-8.49,25.47L152,152H96l-32-64H40v16l26.67,53.33L52,168v32H68V173.33L96,128h48l16,48h44a8,8,0,0,0,0-16Z"/></svg>',
        gamepad: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M176,112h24a8,8,0,0,0,0-16H176a8,8,0,0,0,0,16Zm-72,0H80a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Zm136-48H16A16,16,0,0,0,0,80v96a16,16,0,0,0,16,16H240a16,16,0,0,0,16-16V80A16,16,0,0,0,240,64ZM128,176a32,32,0,1,1,32-32A32,32,0,0,1,128,176Zm80-52a12,12,0,0,1-12,12H164V148a12,12,0,0,1,24,0v-12h32A12,12,0,0,1,208,124Z"/></svg>',
        computer: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M216,64H40A16,16,0,0,0,24,80v96a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V80A16,16,0,0,0,216,64Zm0,112H40V80H216v96Zm-16,24a8,8,0,0,1-8,8H64a8,8,0,0,1,0-16H192A8,8,0,0,1,200,200Z"/></svg>'
    };

    /** 时间表图标：emoji→key 兼容旧数据；key→SVG 用于渲染 */
    var SCHEDULE_ICON_EMOJI_TO_KEY = { '📅':'calendar', '📚':'book', '💼':'briefcase', '🎓':'graduation', '🌙':'moon', '☀️':'sun', '🏃':'run', '🎮':'gamepad', '💻':'computer', '🎨':'palette' };
    var SCHEDULE_ICON_KEYS = ['calendar', 'book', 'briefcase', 'graduation', 'moon', 'sun', 'run', 'gamepad', 'computer', 'palette'];

    /** 将 schedule.icon（key 或旧 emoji）转为用于显示的 HTML（SVG 或 emoji 字符） */
    function getScheduleIconHtml(iconVal, I) {
        if (!iconVal) return I.calendar;
        if (SCHEDULE_ICON_KEYS.indexOf(iconVal) >= 0) return I[iconVal] || I.calendar;
        return iconVal;
    }

    /** 用于 <option> 等仅支持文本处：返回图标对应的简短文案（key→中文，emoji→原样） */
    var SCHEDULE_ICON_KEY_LABELS = { calendar: '日历', book: '书', briefcase: '工作', graduation: '学业', moon: '夜', sun: '日', run: '运动', gamepad: '游戏', computer: '电脑', palette: '画' };
    function getScheduleIconLabel(iconVal) {
        if (!iconVal) return '日历';
        if (SCHEDULE_ICON_KEYS.indexOf(iconVal) >= 0) return SCHEDULE_ICON_KEY_LABELS[iconVal] || iconVal;
        return iconVal;
    }
    
    // ============ 样式类名（实际样式在 css/system-config.css，build 时内联进 手机版.html）============
    const STYLES = {
        pageWrap: 'sys-page-wrap',
        glassCard: 'sys-glass-card',
        glassCardAccent: 'sys-glass-card-accent',
        pageBackground: 'sys-page-bg',
        primaryButton: 'sys-btn-primary',
        secondaryButton: 'sys-btn-secondary',
        input: 'sys-input',
        divider: 'sys-divider',
        label: 'sys-label',
        configItem: 'sys-config-item',
        iconBtn: 'sys-icon-btn',
        progressTrack: 'sys-progress-track',
        progressIndicator: 'sys-progress-indicator',
        select: 'sys-select',
        avatarSection: 'sys-avatar-section',
        avatarCircle: 'sys-avatar-circle',
        avatarImg: 'sys-avatar-img'
    };

    function SystemConfigApp() {
        EnhancedApp.call(this, {
            id: 'system-config-app',
            name: '系统配置',
            color: 'linear-gradient(180deg,#FFF5F7 0%,#FFFFFF 100%)',
            barStyle: 'dark',
            tabs: [
                { name: '个人', icon: SVG_ICONS.person, content: '' },
                { name: '世界观', icon: SVG_ICONS.globe, content: '' },
                { name: 'AI设定', icon: SVG_ICONS.robot, content: '' },
                { name: 'API', icon: SVG_ICONS.gear, content: '' }
            ]
        });
        
        this.currentWorld = null;
        this.currentAI = null;
        this.SVG = SVG_ICONS;
        this.STYLES = STYLES;
    }

    SystemConfigApp.prototype = Object.create(EnhancedApp.prototype);
    SystemConfigApp.prototype.constructor = SystemConfigApp;

    // ============ 页面1: 个人信息 ============
    SystemConfigApp.prototype.renderPersonalPage = function() {
        var self = this;
        var user = PhoneCore.user;
        var mask = user.getCurrentMask();
        var S = this.STYLES;
        var I = this.SVG;
        
        var html = '<div class="' + S.pageWrap + '">';
        
        // 头像区域 - 粉白渐变（样式抽到 STYLES）
        html += `
        <div class="${S.avatarSection}">
            <div id="user-avatar-container" class="${S.avatarCircle}">
                ${user.avatar ? `<img src="${user.avatar}" class="${S.avatarImg}">` : I.user_avatar}
            </div>
        </div>
        `;

        // 实际信息卡片
        
        // 人设面具切换

        html += `
        <div class="config-card ${S.glassCard}">
            <div class="sys-mask-card-header">
                <div class="sys-mask-card-title"><span>临时情感代理</span></div>
                <button id="add-mask-btn" class="${S.secondaryButton} sys-btn-inline">${I.plus}新建</button>
            </div>
        `;
        var masks = Object.values(user.masks);
        if (masks.length === 0) {
            html += '<div class="sys-mask-empty-hint">暂无人设面具，点击新建</div>';
        } else {
            masks.forEach(function(m) {
                var isActive = user.currentMaskId === m.id;
                html += `
        <div class="mask-item sys-mask-item${isActive ? ' is-active' : ''}" data-mask-id="${m.id}">
            <div class="sys-mask-item-avatar-box">
                ${m.avatar ? `<img src="${m.avatar}" class="${S.avatarImg}">` : `<span class="sys-mask-item-avatar-icon">${I.mask}</span>`}
            </div>
            <div class="sys-mask-item-body">
                <div class="sys-mask-item-name">${m.name}</div>
                <div class="sys-mask-item-balance">余额: ¥${(m.balance || 0).toFixed(2)}</div>
            </div>
            ${isActive ? `<span class="sys-mask-item-current">${I.check} 当前</span>` : ''}
        </div>
        `;
            });
        }
        html += '</div>';
        
        // 银行卡显示 - 根据财富阶级显示不同颜色
        if (mask) {
            var wealthClass = PhoneCore.user.getMaskWealthClass ? PhoneCore.user.getMaskWealthClass(mask.id) : 'normal';
            var wealthLabels = {
                infinite: 'xx市首富！',
                wealthy: '对不起除了钱我什么都没有了',
                rich: '钱+钱',
                normal: '小富即安',
                poor: '我只是有钱的很不明显而已'
            };
            var displayBalance = wealthClass === 'infinite' ? '∞' : '¥ ' + (mask.balance || 0).toFixed(2);

            html += `
        <div class="config-card sys-bank-card">
            <div class="sys-bank-card-header">
                <div class="sys-bank-card-label">${I.card}银行卡</div>
                <div class="sys-bank-card-badge">${wealthLabels[wealthClass] || '普通'}</div>
            </div>
            <div class="sys-bank-card-balance">${displayBalance}</div>
            <div class="sys-bank-card-footer">${mask.name}の银行卡</div>
        </div>`;
        }
        
        // 保存按钮 - 粉色渐变
        html += `<button id="save-personal-btn" class="${S.primaryButton} sys-btn-block">保存设置</button>`;
        
        // 桌面壁纸设置
        var wallpaperSettings = PhoneCore.wallpaper || { image: '', blur: 0 };
        html += `
        <div class="config-card ${S.glassCard} sys-config-card-mt">
            <div class="sys-wallpaper-header">
                <span>${I.wallpaper}</span>
                <span>桌面壁纸</span>
            </div>
            <div id="wallpaper-preview-container" class="sys-wallpaper-preview-container">`;
        html += wallpaperSettings.image
            ? `<div id="wallpaper-preview" class="sys-wallpaper-preview" style="background-image:url(${wallpaperSettings.image});filter:blur(${wallpaperSettings.blur}px);"></div>
                <div class="sys-wallpaper-preview-label">预览效果</div>`
            : `
                <div class="sys-wallpaper-preview-empty">
                    <span class="sys-wallpaper-preview-empty-icon">${I.wallpaper}</span>
                    <span class="sys-wallpaper-preview-empty-text">点击下方按钮设置壁纸</span>
                </div>`;
        html += `
            </div>`;
        
        // 壁纸操作按钮
        html += `
            <div class="sys-wallpaper-toolbar">
                <button id="select-wallpaper-btn" class="sys-wallpaper-select-btn">${I.wallpaper}选择图片</button>`;
        html += wallpaperSettings.image ? 
                `<button id="remove-wallpaper-btn" class="sys-wallpaper-remove-btn">${I.trash}</button>` : '';
        html += `
            </div>
        `;
        
        // 模糊度调节
        var blurPct = wallpaperSettings.blur / 30 * 100;
        html += `
        <div class="sys-slider-block">
            <div class="sys-slider-header">
                <label class="sys-slider-label">${I.blur} 模糊度</label>
                <span id="blur-value" class="sys-slider-value">${wallpaperSettings.blur}px</span>
            </div>
            <input type="range"
                id="wallpaper-blur-slider"
                class="sys-range-track sys-range-track--blur-thumb"
                min="0"
                max="30"
                value="${wallpaperSettings.blur}"
                style="background:linear-gradient(to right,#FFB6C1 0%,#FFB6C1 ${blurPct}%,#e8e8e8 ${blurPct}%,#e8e8e8 100%);">
        </div>
        `;
        
        html += '</div>';
        
        // >>>>>>>>>>>【《*》桌面设置卡片】>>>>>>>>>>
        const desktopSettings = PhoneCore.desktopSettings || {
            showWeatherNotification: true,
            iconTextColor: '#ffffff',
            statusBarColor: 'auto',
            wallpaperBrightness: 100
        };

        html += `
        <div class="config-card ${S.glassCard} sys-config-card-mt">
            <div class="sys-desktop-section-header">
                <span class="sys-desktop-section-header-icon">${I.gear}</span>
                <span>桌面设置</span>
            </div>
        `;

        // 天气通知
        const weatherOn = desktopSettings.showWeatherNotification !== false;
        html += `
        <div class="sys-config-item">
            <div>
                <div class="sys-config-item-title">开启时显示天气</div>
                <div class="sys-config-item-desc">打开应用时弹出天气信息</div>
            </div>
            <label class="sys-toggle-wrap">
                <input type="checkbox" id="weather-notification-toggle" class="sys-toggle-input"${weatherOn ? ' checked' : ''}>
                <span class="sys-toggle-track" style="background:${weatherOn ? '#FF6B8A' : '#ccc'};"></span>
                <span class="sys-toggle-thumb" style="left:${weatherOn ? '23px' : '3px'};"></span>
            </label>
        </div>
        `;
        
        // 桌面图标文字颜色
        html += `
        <div class="sys-config-item">
            <div>
                <div class="sys-config-item-title">图标文字颜色</div>
                <div class="sys-config-item-desc">桌面App图标下方的文字颜色</div>
            </div>
            <div class="sys-config-item-actions">
                <input type="color" id="icon-text-color" class="sys-color-input" value="${desktopSettings.iconTextColor || '#ffffff'}">
                <button id="reset-icon-text-color" class="sys-reset-btn">重置</button>
            </div>
        </div>
        `;

        // 状态栏颜色
        html += `
        <div class="sys-config-item">
            <div>
                <div class="sys-config-item-title">状态栏颜色</div>
                <div class="sys-config-item-desc">桌面顶部时间/信号等的颜色</div>
            </div>
            <select id="status-bar-color" class="sys-config-select">
                <option value="auto"${desktopSettings.statusBarColor === 'auto' ? ' selected' : ''}>自动</option>
                <option value="light"${desktopSettings.statusBarColor === 'light' ? ' selected' : ''}>浅色（白字）</option>
                <option value="dark"${desktopSettings.statusBarColor === 'dark' ? ' selected' : ''}>深色（黑字）</option>
            </select>
        </div>
        `;
        
        // 壁纸明度
        const brightnessVal = desktopSettings.wallpaperBrightness || 100;
        const brightnessPct = ((brightnessVal - 30) / 1.2).toFixed(2);
        html += `
        <div class="sys-config-item-wrap">
            <div class="sys-config-item-row">
                <div>
                    <div class="sys-config-item-title">壁纸明度</div>
                    <div class="sys-config-item-desc">调整桌面壁纸的明暗程度</div>
                </div>
                <span id="brightness-value" class="sys-config-value">${brightnessVal}%</span>
            </div>
            <input type="range" id="wallpaper-brightness-slider" min="30" max="150" value="${brightnessVal}" class="sys-wallpaper-brightness-slider" style="background:linear-gradient(to right,#FFB6C1 0%,#FFB6C1 ${brightnessPct}%,#e8e8e8 ${brightnessPct}%,#e8e8e8 100%);">
        </div>
        `;

        // 电池颜色设置
        html += `
        <div class="sys-config-item">
            <div>
                <div class="sys-config-item-title">电池颜色</div>
                <div class="sys-config-item-desc">自定义状态栏电池图标颜色</div>
            </div>
            <div class="sys-config-item-actions">
                <input type="color" id="battery-color" class="sys-color-input" value="${desktopSettings.batteryColor || '#73AE52'}">
                <button id="reset-battery-color" class="sys-reset-btn">重置</button>
            </div>
        </div>
        `;
        
        html += '</div>'; 
        // >>>>>>>>>>>【《*》桌面设置卡片结束div】>>>>>>>>>>
        
        // >>>>>>>>>>>【《*》手机壳diy】>>>>>>>>>>
        const phoneCaseSettings = desktopSettings.phoneCase || { type: 'gradient', colors: ['#f6d3e0', '#b4d7f2'], angle: 135 };
        const previewBg = phoneCaseSettings.type === 'solid'
            ? (phoneCaseSettings.colors[0] || '#f6d3e0')
            : `linear-gradient(${phoneCaseSettings.angle || 135}deg, ${phoneCaseSettings.colors.join(',')})`;

        html += `
        <div class="config-card ${S.glassCard} sys-config-card-mt">
            <div class="sys-desktop-section-header">
                <span class="sys-desktop-section-header-icon">${I.palette}</span>
                <span>手机壳DIY</span>
            </div>

            <div class="sys-phone-case-preview-wrap">
                <div id="phone-case-preview" class="sys-phone-case-preview" style="background:${previewBg};"></div>
            </div>

            <div class="sys-phone-case-block">
                <div class="sys-phone-case-label">颜色类型</div>
                <div class="sys-phone-case-type-row">
                    <button class="phone-case-type-btn sys-phone-case-type-btn${phoneCaseSettings.type === 'solid' ? ' active' : ''}" data-type="solid">纯色</button>
                    <button class="phone-case-type-btn sys-phone-case-type-btn${phoneCaseSettings.type === 'gradient' ? ' active' : ''}" data-type="gradient">双色渐变</button>
                    <button class="phone-case-type-btn sys-phone-case-type-btn${phoneCaseSettings.type === 'multi' ? ' active' : ''}" data-type="multi">多色渐变</button>
                </div>
            </div>

            <div id="phone-case-colors-container">`;
        
        // 纯色模式
        html += `
        <div id="solid-color-section" style="display:${phoneCaseSettings.type === 'solid' ? 'block' : 'none'};">
            <div class="sys-phone-case-field-row">
                <div class="sys-phone-case-field-label">选择颜色</div>
                <input type="color" id="phone-case-solid-color" class="sys-phone-case-color-input" value="${phoneCaseSettings.colors[0] || '#f6d3e0'}">
            </div>
        </div>
        `;
        
        // 双色渐变模式
        html += `
        <div id="gradient-color-section" style="display:${phoneCaseSettings.type === 'gradient' ? 'block' : 'none'};">
            <div class="sys-phone-case-gradient-row">
                <div class="sys-phone-case-gradient-col">
                    <div class="sys-phone-case-gradient-label">起始色</div>
                    <input type="color" id="phone-case-gradient-start" class="sys-phone-case-gradient-color-input" value="${phoneCaseSettings.colors[0] || '#f6d3e0'}">
                </div>
                <div class="sys-phone-case-gradient-col">
                    <div class="sys-phone-case-gradient-label">结束色</div>
                    <input type="color" id="phone-case-gradient-end" class="sys-phone-case-gradient-color-input" value="${phoneCaseSettings.colors[1] || '#b4d7f2'}">
                </div>
            </div>
        </div>
        `;
        
        // 多色渐变模式
        const multiColors = phoneCaseSettings.type === 'multi' ? phoneCaseSettings.colors : ['#f6d3e0', '#ffd4a3', '#b4d7f2'];
        html += `
        <div id="multi-color-section" style="display:${phoneCaseSettings.type === 'multi' ? 'block' : 'none'};">
            <div id="multi-colors-list" class="sys-multi-colors-list">
                ${multiColors.map((color, idx) => `
                <div class="multi-color-item sys-multi-color-item">
                    <input type="color" class="multi-color-input sys-phone-case-color-input" data-index="${idx}" value="${color}">
                    <div class="sys-multi-color-label">颜色 ${idx + 1}</div>
                    ${idx >= 2 ? `<button class="remove-multi-color sys-remove-multi-color-btn" data-index="${idx}">x</button>` : ''}
                </div>
                `).join('')}
            </div>
            <button id="add-multi-color" class="sys-add-multi-color-btn">+ 添加颜色</button>
        </div>
        `;
        
        html += '</div>';
        
        // 渐变角度（非纯色模式显示）
        const angle = phoneCaseSettings.angle || 135;
        const anglePercent = angle / 3.6;
        html += `
        <div id="gradient-angle-section" class="sys-gradient-angle-section" style="display:${phoneCaseSettings.type !== 'solid' ? 'block' : 'none'};">
            <div class="sys-slider-header">
                <div class="sys-slider-label">渐变角度</div>
                <span id="angle-value" class="sys-slider-value">${angle} deg</span>
            </div>
            <input type="range" id="phone-case-angle" min="0" max="360" value="${angle}" class="sys-range-track sys-range-track--blur-thumb" style="background:linear-gradient(to right,#FFB6C1 0%,#FFB6C1 ${anglePercent}%,#e8e8e8 ${anglePercent}%,#e8e8e8 100%);">
        </div>
        `;
        
        // 预设配色方案
        const presetColors = [
            { name: '樱花粉蓝', colors: ['#f6d3e0', '#b4d7f2'], type: 'gradient' },
            { name: '日落橙紫', colors: ['#ff9a56', '#ff6b95', '#a855f7'], type: 'multi' },
            { name: '薄荷绿', colors: ['#a8e6cf', '#88d4ab'], type: 'gradient' },
            { name: '星空紫', colors: ['#667eea', '#764ba2'], type: 'gradient' },
            { name: '暖阳黄', colors: ['#f6d365', '#fda085'], type: 'gradient' },
            { name: '海洋蓝', colors: ['#4facfe', '#00f2fe'], type: 'gradient' },
            { name: '彩虹', colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'], type: 'multi' },
            { name: '纯白', colors: ['#ffffff'], type: 'solid' },
            { name: '纯黑', colors: ['#1a1a1a'], type: 'solid' },
            { name: '玫瑰金', colors: ['#f4c4c4', '#e8b4b8'], type: 'gradient' }
        ];
        html += `
        <div class="sys-preset-colors-section">
            <div class="sys-preset-colors-title">预设配色</div>
            <div class="sys-preset-colors-grid">
                ${presetColors.map(preset => {
                    const previewBg = preset.type === 'solid' ? preset.colors[0] : `linear-gradient(135deg,${preset.colors.join(',')})`;
                    return `<button class="preset-color-btn sys-preset-color-btn" data-colors="${preset.colors.join('|')}" data-type="${preset.type}" style="background:${previewBg};">${preset.name}</button>`;
                }).join('')}
            </div>
        </div>
        `;
        
        html += '</div>';
        
        // 时间表管理入口 - 毛玻璃效果
        html += `
        <div class="config-card ${S.glassCard} sys-schedule-entry-clickable" id="schedule-manager-entry">
            <div class="sys-schedule-entry-row">
                <div class="sys-schedule-entry-inner">
                    <div class="sys-schedule-entry-icon">
                        <span>${I.calendar}</span>
                    </div>
                    <div>
                        <div class="sys-schedule-entry-title">时间表管理</div>
                        <div class="sys-schedule-entry-desc">创建详细的每日时间安排</div>
                    </div>
                </div>
                <span class="sys-schedule-entry-arrow">${I.arrow_right}</span>
            </div>
        </div>
        `;

        // 备份与恢复 - 毛玻璃效果
        html += `
        <div class="config-card ${S.glassCard} sys-config-card-mt">
            <div class="sys-desktop-section-header">
                <span class="sys-desktop-section-header-icon">${I.save}</span>
                <span>备份与恢复</span>
            </div>
            <div class="sys-backup-btns-row">
                <button id="export-data-btn" class="sys-btn-export">导出数据</button>
                <button id="import-data-btn" class="sys-btn-import">导入数据</button>
            </div>
            <input type="file" id="import-file-input" class="sys-import-file-input" accept=".json">
        </div>
        `;

        // 数据管理 - 毛玻璃效果
        html += `
        <div class="config-card ${S.glassCard} sys-config-card-mt-sm">
            <div class="sys-desktop-section-header">
                <span class="sys-desktop-section-header-icon">${I.database}</span>
                <span>数据管理</span>
            </div>
            <button id="view-database-btn" class="sys-btn-view-database">查看数据库内容</button>
            <button id="clear-all-data-btn" class="sys-btn-clear-all">清除所有数据</button>
        </div>
        `;
        
        html += '</div>';
        
        return html;
    };

    SystemConfigApp.prototype.bindPersonalPageEvents = function(container) {
        var self = this;
        
        // 头像上传
        var avatarContainer = container.querySelector('#user-avatar-container');
        if (avatarContainer) {
            avatarContainer.onclick = function() {
                PhoneCore.resources.createImageInput(function(resource) {
                    PhoneCore.user.avatar = resource.data;
                    PhoneCore.saveUserProfile();
                    self.refreshCurrentTab();
                });
            };
        }
        
        // 保存个人信息
        var saveBtn = container.querySelector('#save-personal-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var city = container.querySelector('#real-city').value;
                var schedule = container.querySelector('#work-schedule').value;
                
                PhoneCore.user.setRealInfo({
                    city: city,
                    workSchedule: schedule
                });
                
                PhoneCore.saveUserProfile().then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '保存成功',
                        size: 'mini'
                    });
                });
            };
        }
        
        // 新建面具
        var addMaskBtn = container.querySelector('#add-mask-btn');
        if (addMaskBtn) {
            addMaskBtn.onclick = function() {
                self.openMaskEditor(null);
            };
        }
        
        // 面具项点击
        var maskItems = container.querySelectorAll('.mask-item');
        maskItems.forEach(function(item) {
            item.onclick = function() {
                var maskId = item.getAttribute('data-mask-id');
                self.openMaskDetail(maskId);
            };
        });
        
        // 导出数据
        var exportBtn = container.querySelector('#export-data-btn');
        if (exportBtn) {
            exportBtn.onclick = function() {
                PhoneCore.exportData().then(function(jsonString) {
                    var blob = new Blob([jsonString], { type: 'application/json' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'phone_backup_' + new Date().toISOString().slice(0, 10) + '.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '导出成功',
                        size: 'mini',
                        message: '数据已保存到文件',
                        icon: '📦',
                        duration: 2000
                    });
                });
            };
        }
        
        // 导入数据
        var importBtn = container.querySelector('#import-data-btn');
        var importInput = container.querySelector('#import-file-input');
        if (importBtn && importInput) {
            importBtn.onclick = function() {
                importInput.click();
            };
            
            importInput.onchange = function(e) {
                var file = e.target.files[0];
                if (file) {
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        PhoneCore.importData(e.target.result).then(function() {
                            PhoneCore.notifications.send({
                                type: 'success',
                                title: '导入成功',
                                size: 'mini',
                                message: '数据已恢复',
                                icon: '📥',
                                duration: 2000
                            });
                            self.refreshCurrentTab();
                        }).catch(function(err) {
                            PhoneCore.notifications.send({
                                type: 'error',
                                title: '导入失败',
                                size: 'mini',
                                message: err.message,
                                icon: '❌',
                                duration: 3000
                            });
                        });
                    };
                    reader.readAsText(file);
                }
            };
        }
        
        // 查看数据库
        var viewDbBtn = container.querySelector('#view-database-btn');
        if (viewDbBtn) {
            viewDbBtn.onclick = function() {
                self.openDatabaseViewer();
            };
        }
        
        // 清除数据
        var clearBtn = container.querySelector('#clear-all-data-btn');
        if (clearBtn) {
            clearBtn.onclick = function() {
                if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
                    PhoneCore.clearAllData().then(function() {
                        PhoneCore.notifications.send({
                            type: 'info',
                            title: '已清除',
                            size: 'mini',
                            icon: '🗑️',
                            duration: 2000
                        });
                        self.refreshCurrentTab();
                    });
                }
            };
        }
        
        // 时间表管理入口
        var scheduleEntry = container.querySelector('#schedule-manager-entry');
        if (scheduleEntry) {
            scheduleEntry.onclick = function() {
                self.openScheduleManager();
            };
        }
        
        // 桌面壁纸设置
        var selectWallpaperBtn = container.querySelector('#select-wallpaper-btn');
        if (selectWallpaperBtn) {
            selectWallpaperBtn.onclick = function() {
                PhoneCore.resources.createImageInput(function(resource) {
                    if (!PhoneCore.wallpaper) {
                        PhoneCore.wallpaper = { image: '', blur: 0 };
                    }
                    PhoneCore.wallpaper.image = resource.data;
                    PhoneCore.applyWallpaper();
                    PhoneCore.saveWallpaperSettings();
                    self.refreshCurrentTab();
                });
            };
        }
        
        // 移除壁纸
        var removeWallpaperBtn = container.querySelector('#remove-wallpaper-btn');
        if (removeWallpaperBtn) {
            removeWallpaperBtn.onclick = function() {
                PhoneCore.wallpaper = { image: '', blur: 0 };
                PhoneCore.applyWallpaper();
                PhoneCore.saveWallpaperSettings();
                self.refreshCurrentTab();
            };
        }
        
        // 模糊度滑块
        var blurSlider = container.querySelector('#wallpaper-blur-slider');
        var blurValue = container.querySelector('#blur-value');
        if (blurSlider) {
            blurSlider.oninput = function() {
                var value = parseInt(this.value);
                if (blurValue) blurValue.textContent = value + 'px';
                
                // 更新滑块背景
                var percent = (value / 30) * 100;
                this.style.background = 'linear-gradient(to right,#FFB6C1 0%,#FFB6C1 ' + percent + '%,#e8e8e8 ' + percent + '%,#e8e8e8 100%)';
                
                // 更新预览
                var preview = container.querySelector('#wallpaper-preview');
                if (preview) {
                    preview.style.filter = 'blur(' + value + 'px)';
                }
                
                // 实时应用到桌面
                if (!PhoneCore.wallpaper) {
                    PhoneCore.wallpaper = { image: '', blur: 0 };
                }
                PhoneCore.wallpaper.blur = value;
                PhoneCore.applyWallpaper();
            };
            
            blurSlider.onchange = function() {
                // 保存设置
                PhoneCore.saveWallpaperSettings();
            };
        }
        
        // === 桌面设置事件绑定 ===
        // 天气通知开关
        var weatherToggle = container.querySelector('#weather-notification-toggle');
        if (weatherToggle) {
            weatherToggle.onchange = function() {
                if (!PhoneCore.desktopSettings) {
                    PhoneCore.desktopSettings = {};
                }
                PhoneCore.desktopSettings.showWeatherNotification = this.checked;
                PhoneCore.saveDesktopSettings();
                
                // 更新开关样式
                var track = this.nextElementSibling;
                var thumb = track.nextElementSibling;
                if (this.checked) {
                    track.style.background = '#FF6B8A';
                    thumb.style.left = '23px';
                } else {
                    track.style.background = '#ccc';
                    thumb.style.left = '3px';
                }
            };
        }
        
        // 图标文字颜色
        var iconTextColor = container.querySelector('#icon-text-color');
        if (iconTextColor) {
            iconTextColor.onchange = function() {
                if (!PhoneCore.desktopSettings) {
                    PhoneCore.desktopSettings = {};
                }
                PhoneCore.desktopSettings.iconTextColor = this.value;
                PhoneCore.applyDesktopSettings();
                PhoneCore.saveDesktopSettings();
            };
        }
        
        // 重置图标文字颜色
        var resetIconTextColor = container.querySelector('#reset-icon-text-color');
        if (resetIconTextColor) {
            resetIconTextColor.onclick = function() {
                if (!PhoneCore.desktopSettings) {
                    PhoneCore.desktopSettings = {};
                }
                PhoneCore.desktopSettings.iconTextColor = '#ffffff';
                var colorInput = container.querySelector('#icon-text-color');
                if (colorInput) colorInput.value = '#ffffff';
                PhoneCore.applyDesktopSettings();
                PhoneCore.saveDesktopSettings();
            };
        }
        
        // 状态栏颜色
        var statusBarColor = container.querySelector('#status-bar-color');
        if (statusBarColor) {
            statusBarColor.onchange = function() {
                if (!PhoneCore.desktopSettings) {
                    PhoneCore.desktopSettings = {};
                }
                PhoneCore.desktopSettings.statusBarColor = this.value;
                PhoneCore.applyDesktopSettings();
                PhoneCore.saveDesktopSettings();
            };
        }
        
        // 壁纸明度滑块
        var brightnessSlider = container.querySelector('#wallpaper-brightness-slider');
        var brightnessValue = container.querySelector('#brightness-value');
        if (brightnessSlider) {
            brightnessSlider.oninput = function() {
                var value = parseInt(this.value);
                if (brightnessValue) brightnessValue.textContent = value + '%';
                
                // 更新滑块背景
                var percent = (value - 30) / 1.2;
                this.style.background = 'linear-gradient(to right,#FFB6C1 0%,#FFB6C1 ' + percent + '%,#e8e8e8 ' + percent + '%,#e8e8e8 100%)';
                
                // 实时应用到桌面
                if (!PhoneCore.desktopSettings) {
                    PhoneCore.desktopSettings = {};
                }
                PhoneCore.desktopSettings.wallpaperBrightness = value;
                PhoneCore.applyDesktopSettings();
            };
            
            brightnessSlider.onchange = function() {
                PhoneCore.saveDesktopSettings();
            };
        }
        
        // === 电池颜色设置 ===
        var batteryColorInput = container.querySelector('#battery-color');
        if (batteryColorInput) {
            batteryColorInput.onchange = function() {
                if (!PhoneCore.desktopSettings) {
                    PhoneCore.desktopSettings = {};
                }
                PhoneCore.desktopSettings.batteryColor = this.value;
                PhoneCore.applyBatteryColor();
                PhoneCore.saveDesktopSettings();
            };
        }
        
        // 重置电池颜色
        var resetBatteryColor = container.querySelector('#reset-battery-color');
        if (resetBatteryColor) {
            resetBatteryColor.onclick = function() {
                if (!PhoneCore.desktopSettings) {
                    PhoneCore.desktopSettings = {};
                }
                PhoneCore.desktopSettings.batteryColor = '#73AE52';
                var colorInput = container.querySelector('#battery-color');
                if (colorInput) colorInput.value = '#73AE52';
                PhoneCore.applyBatteryColor();
                PhoneCore.saveDesktopSettings();
            };
        }
        
        // === 手机壳DIY设置事件绑定 ===
        // 辅助函数：更新手机壳预览
        function updatePhoneCasePreview() {
            var preview = container.querySelector('#phone-case-preview');
            if (!preview) return;
            
            var settings = PhoneCore.desktopSettings && PhoneCore.desktopSettings.phoneCase;
            if (!settings) {
                settings = { type: 'gradient', colors: ['#f6d3e0', '#b4d7f2'], angle: 135 };
            }
            
            if (settings.type === 'solid') {
                preview.style.background = settings.colors[0] || '#f6d3e0';
            } else {
                preview.style.background = 'linear-gradient(' + (settings.angle || 135) + 'deg,' + settings.colors.join(',') + ')';
            }
        }
        
        // 辅助函数：更新手机壳设置并应用
        function updatePhoneCaseSettings(newSettings) {
            if (!PhoneCore.desktopSettings) {
                PhoneCore.desktopSettings = {};
            }
            PhoneCore.desktopSettings.phoneCase = newSettings;
            updatePhoneCasePreview();
            PhoneCore.applyPhoneCaseStyle();
            PhoneCore.saveDesktopSettings();
        }
        
        // 辅助函数：获取当前手机壳设置
        function getPhoneCaseSettings() {
            return (PhoneCore.desktopSettings && PhoneCore.desktopSettings.phoneCase) || 
                   { type: 'gradient', colors: ['#f6d3e0', '#b4d7f2'], angle: 135 };
        }
        
        // 颜色类型切换按钮
        var typeBtns = container.querySelectorAll('.phone-case-type-btn');
        typeBtns.forEach(function(btn) {
            btn.onclick = function() {
                var type = this.getAttribute('data-type');
                var settings = getPhoneCaseSettings();
                
                // 更新按钮样式
                typeBtns.forEach(function(b) {
                    var isActive = b.getAttribute('data-type') === type;
                    b.style.borderColor = isActive ? '#FF6B8A' : '#e0e0e0';
                    b.style.background = isActive ? 'rgba(255,107,138,0.08)' : '#fafafa';
                    b.style.color = isActive ? '#FF6B8A' : '#666';
                });
                
                // 显示对应的颜色区域
                var solidSection = container.querySelector('#solid-color-section');
                var gradientSection = container.querySelector('#gradient-color-section');
                var multiSection = container.querySelector('#multi-color-section');
                var angleSection = container.querySelector('#gradient-angle-section');
                
                if (solidSection) solidSection.style.display = type === 'solid' ? 'block' : 'none';
                if (gradientSection) gradientSection.style.display = type === 'gradient' ? 'block' : 'none';
                if (multiSection) multiSection.style.display = type === 'multi' ? 'block' : 'none';
                if (angleSection) angleSection.style.display = type !== 'solid' ? 'block' : 'none';
                
                // 更新设置
                if (type === 'solid') {
                    settings.colors = [settings.colors[0] || '#f6d3e0'];
                } else if (type === 'gradient') {
                    if (settings.colors.length < 2) {
                        settings.colors = ['#f6d3e0', '#b4d7f2'];
                    } else {
                        settings.colors = settings.colors.slice(0, 2);
                    }
                } else if (type === 'multi') {
                    if (settings.colors.length < 3) {
                        settings.colors = ['#f6d3e0', '#ffd4a3', '#b4d7f2'];
                    }
                }
                settings.type = type;
                updatePhoneCaseSettings(settings);
            };
        });
        
        // 纯色颜色选择
        var solidColorInput = container.querySelector('#phone-case-solid-color');
        if (solidColorInput) {
            solidColorInput.oninput = function() {
                var settings = getPhoneCaseSettings();
                settings.colors = [this.value];
                updatePhoneCaseSettings(settings);
            };
        }
        
        // 双色渐变起始色
        var gradientStart = container.querySelector('#phone-case-gradient-start');
        if (gradientStart) {
            gradientStart.oninput = function() {
                var settings = getPhoneCaseSettings();
                settings.colors[0] = this.value;
                if (!settings.colors[1]) settings.colors[1] = '#b4d7f2';
                updatePhoneCaseSettings(settings);
            };
        }
        
        // 双色渐变结束色
        var gradientEnd = container.querySelector('#phone-case-gradient-end');
        if (gradientEnd) {
            gradientEnd.oninput = function() {
                var settings = getPhoneCaseSettings();
                if (!settings.colors[0]) settings.colors[0] = '#f6d3e0';
                settings.colors[1] = this.value;
                updatePhoneCaseSettings(settings);
            };
        }
        
        // 多色渐变颜色输入
        var multiColorInputs = container.querySelectorAll('.multi-color-input');
        multiColorInputs.forEach(function(input) {
            input.oninput = function() {
                var idx = parseInt(this.getAttribute('data-index'));
                var settings = getPhoneCaseSettings();
                settings.colors[idx] = this.value;
                updatePhoneCaseSettings(settings);
            };
        });
        
        // 删除多色渐变颜色
        var removeMultiColorBtns = container.querySelectorAll('.remove-multi-color');
        removeMultiColorBtns.forEach(function(btn) {
            btn.onclick = function() {
                var idx = parseInt(this.getAttribute('data-index'));
                var settings = getPhoneCaseSettings();
                if (settings.colors.length > 2) {
                    settings.colors.splice(idx, 1);
                    updatePhoneCaseSettings(settings);
                    self.refreshCurrentTab();
                }
            };
        });
        
        // 添加多色渐变颜色
        var addMultiColorBtn = container.querySelector('#add-multi-color');
        if (addMultiColorBtn) {
            addMultiColorBtn.onclick = function() {
                var settings = getPhoneCaseSettings();
                if (settings.colors.length < 8) {
                    var randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                    settings.colors.push(randomColor);
                    updatePhoneCaseSettings(settings);
                    self.refreshCurrentTab();
                }
            };
        }
        
        // 渐变角度滑块
        var angleSlider = container.querySelector('#phone-case-angle');
        var angleValue = container.querySelector('#angle-value');
        if (angleSlider) {
            angleSlider.oninput = function() {
                var value = parseInt(this.value);
                if (angleValue) angleValue.textContent = value + ' deg';
                
                // 更新滑块背景
                var percent = value / 3.6;
                this.style.background = 'linear-gradient(to right,#FFB6C1 0%,#FFB6C1 ' + percent + '%,#e8e8e8 ' + percent + '%,#e8e8e8 100%)';
                
                var settings = getPhoneCaseSettings();
                settings.angle = value;
                updatePhoneCaseSettings(settings);
            };
        }
        
        // 预设配色方案
        var presetBtns = container.querySelectorAll('.preset-color-btn');
        presetBtns.forEach(function(btn) {
            btn.onclick = function() {
                var colors = this.getAttribute('data-colors').split('|');
                var type = this.getAttribute('data-type');
                var settings = {
                    type: type,
                    colors: colors,
                    angle: 135
                };
                
                // 更新类型按钮状态
                typeBtns.forEach(function(b) {
                    var isActive = b.getAttribute('data-type') === type;
                    b.style.borderColor = isActive ? '#FF6B8A' : '#e0e0e0';
                    b.style.background = isActive ? 'rgba(255,107,138,0.08)' : '#fafafa';
                    b.style.color = isActive ? '#FF6B8A' : '#666';
                });
                
                // 显示对应的颜色区域
                var solidSection = container.querySelector('#solid-color-section');
                var gradientSection = container.querySelector('#gradient-color-section');
                var multiSection = container.querySelector('#multi-color-section');
                var angleSection = container.querySelector('#gradient-angle-section');
                
                if (solidSection) solidSection.style.display = type === 'solid' ? 'block' : 'none';
                if (gradientSection) gradientSection.style.display = type === 'gradient' ? 'block' : 'none';
                if (multiSection) multiSection.style.display = type === 'multi' ? 'block' : 'none';
                if (angleSection) angleSection.style.display = type !== 'solid' ? 'block' : 'none';
                
                updatePhoneCaseSettings(settings);
                self.refreshCurrentTab();
            };
        });
    };

    // 面具编辑器
    SystemConfigApp.prototype.openMaskEditor = function(maskId) {
        const self = this;
        const S = this.STYLES;
        const I = this.SVG;
        const mask = maskId ? PhoneCore.user.masks[maskId] : null;
        const isNew = !mask;
        
        const avatarHtml = mask && mask.avatar
            ? `<img src="${mask.avatar}" class="sys-mask-avatar-img">`
            : `<span class="sys-mask-avatar-icon">${I.mask}</span>`;
        const worldOptions = Object.values(PhoneCore.worlds).map(function(world) {
            const selected = (mask && mask.worldId === world.id) ? ' selected' : '';
            return `<option value="${world.id}"${selected}>${world.name}</option>`;
        }).join('');
        
        let html = `
        <div class="${S.pageWrap}">
            <div class="sys-form-section-title">${isNew ? '编织新的身份' : '编织已有身份'}</div>
            <div class="config-card ${S.glassCard}">
                <div class="sys-mask-avatar-wrap">
                    <div id="mask-avatar" class="sys-mask-avatar-box">
                        ${avatarHtml}
                    </div>
                    <div class="sys-mask-avatar-hint">点击设置头像</div>
                </div>
                <div class="sys-form-field-mb">
                    <label class="${S.label}">名称</label>
                    <input type="text" id="mask-name" value="${mask ? mask.name : ''}" placeholder="输入人设名称" class="${S.input}">
                </div>
                <div class="sys-form-field-mb">
                    <label class="${S.label}">绑定世界观</label>
                    <select id="mask-world" class="${S.input}">
                        <option value="">不绑定</option>
                        ${worldOptions}
                    </select>
                </div>
            </div>
        `;
        
        // === 人设信息区块（发送给AI） ===
        const persona = (mask && mask.persona) ? mask.persona : {};
        html += `
        <div class="config-card ${S.glassCard} sys-card-mt-16">
            <div class="sys-mask-form-header">
                <span>人设信息（会发送给AI）</span>
            </div>
            <div class="sys-mask-form-grid">
                <div>
                    <label class="sys-mask-form-label">昵称/称呼</label>
                    <input type="text" id="mask-nickname" value="${persona.nickname || ''}" placeholder="AI怎么称呼你" class="${S.input} sys-input-padded">
                </div>
                <div>
                    <label class="sys-mask-form-label">性别</label>
                    <select id="mask-gender" class="${S.input} sys-input-padded">
                        <option value="">不设置</option>
                        <option value="女"${persona.gender === '女' ? ' selected' : ''}>女</option>
                        <option value="其他"${persona.gender === '其他' ? ' selected' : ''}>非二元性别</option>
                        <option value="男"${persona.gender === '男' ? ' selected' : ''}>男</option>
                    </select>
                </div>
            </div>
            <div class="sys-mask-form-grid">
                <div>
                    <label class="sys-mask-form-label">年龄</label>
                    <input type="text" id="mask-age" value="${persona.age || ''}" placeholder="如：22岁" class="${S.input} sys-input-padded">
                </div>
                <div>
                    <label class="sys-mask-form-label">生日</label>
                    <input type="text" id="mask-birthday" value="${persona.birthday || ''}" placeholder="如：3月15日" class="${S.input} sys-input-padded">
                </div>
            </div>
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">职业</label>
                <input type="text" id="mask-occupation" value="${persona.occupation || ''}" placeholder="如：大学生、程序员" class="${S.input}">
            </div>
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">学校（如果是学生）</label>
                <input type="text" id="mask-school" value="${persona.school || ''}" placeholder="如：XX大学" class="${S.input}">
            </div>
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">爱好</label>
                <input type="text" id="mask-hobbies" value="${persona.hobbies || ''}" placeholder="如：游戏、看电影、摄影" class="${S.input}">
            </div>
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">性格描述</label>
                <textarea id="mask-personality" placeholder="简单描述你的性格..." class="${S.input} sys-input-textarea-sm">${persona.personality || ''}</textarea>
            </div>
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">与AI的关系设定</label>
                <input type="text" id="mask-relationship" value="${persona.relationship || ''}" placeholder="如：朋友、恋人、同学" class="${S.input}">
            </div>
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">背景故事</label>
                <textarea id="mask-backstory" placeholder="你的背景故事..." class="${S.input} sys-input-textarea-md">${persona.backstory || ''}</textarea>
            </div>
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">自定义信息（会原样发给AI）</label>
                <textarea id="mask-custom" placeholder="任何你想让AI知道的额外信息..." class="${S.input} sys-input-textarea-sm">${persona.customInfo || ''}</textarea>
            </div>
        </div>
        `;
        
        // === 城市与天气 ===
        html += `
        <div class="config-card ${S.glassCard} sys-card-mt-16">
            <div class="sys-mask-form-header">
                <span>城市与天气</span>
            </div>
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">所在城市（AI可读取此城市天气）</label>
                <input type="text" id="mask-city" value="${mask ? (mask.city || '') : ''}" placeholder="如：北京、上海" class="${S.input}">
                <div class="sys-weather-hint">绑定城市后，和AI聊天时AI可以获取到你所在城市的天气</div>
            </div>
        </div>
        `;
        
        // === 财产设置 ===
        html += `
        <div class="config-card ${S.glassCard} sys-card-mt-16">
            <div class="sys-mask-form-header">
                <span>财产设置</span>
            </div>
        `;
        
        // 财富阶级
        const wealthClasses = [
            { value: 'poor', label: '拮据' },
            { value: 'normal', label: '普通' },
            { value: 'rich', label: '富裕' },
            { value: 'wealthy', label: '富豪' },
            { value: 'infinite', label: '无限' }
        ];
        const currentWealth = (mask && mask.wealthClass) ? mask.wealthClass : 'normal';
        const wealthOptions = wealthClasses.map(function(wc) {
            const sel = currentWealth === wc.value ? ' selected' : '';
            return `<option value="${wc.value}"${sel}>${wc.label}</option>`;
        }).join('');
        
        const balanceBlock = (isNew || !mask.balanceLocked)
            ? `<div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">初始余额（设定后锁定不可修改）</label>
                <input type="number" id="mask-balance" value="${mask ? mask.balance : 0}" placeholder="0" class="${S.input}">
            </div>`
            : `<div class="sys-balance-locked">
                <span class="sys-balance-locked-icon">${I.lock}</span>
                <span class="sys-balance-locked-text">余额已锁定：¥${mask.balance.toFixed(2)}</span>
            </div>`;
        
        const salary = (mask && mask.salary) ? mask.salary : {};
        html += `
            <div class="sys-mask-form-mb">
                <label class="sys-mask-form-label">财富阶级</label>
                <select id="mask-wealth-class" class="${S.input}">
                    ${wealthOptions}
                </select>
            </div>
            ${balanceBlock}
            <div class="sys-salary-section">
                <div class="sys-salary-title">工资设置</div>
                <div class="sys-mask-form-grid">
                    <div>
                        <label class="sys-mask-form-label">月薪金额</label>
                        <input type="number" id="mask-salary-amount" value="${salary.amount || 0}" class="${S.input} sys-input-padded">
                    </div>
                    <div>
                        <label class="sys-mask-form-label">发薪日（每月几号）</label>
                        <input type="number" id="mask-salary-payday" value="${salary.payday || 1}" min="1" max="31" class="${S.input} sys-input-padded">
                    </div>
                </div>
                <div class="sys-salary-field-mt">
                    <label class="sys-mask-form-label">工资来源</label>
                    <input type="text" id="mask-salary-source" value="${salary.source || ''}" placeholder="如：XX公司" class="${S.input}">
                </div>
            </div>
        </div>
        <div class="sys-mask-actions-row">
            ${!isNew ? `<button id="delete-mask-btn" class="sys-delete-mask-btn">删除</button>` : ''}
            <button id="save-mask-btn" class="${S.primaryButton} sys-btn-flex-2">保存</button>
        </div>
        </div>
        `;
        
        const page = this.openDetailPage(html);
        let maskAvatarData = mask ? mask.avatar : '';
        
        // 绑定事件
        const maskAvatar = page.querySelector('#mask-avatar');
        if (maskAvatar) {
            maskAvatar.onclick = function() {
                PhoneCore.resources.createImageInput(function(resource) {
                    maskAvatarData = resource.data;
                    maskAvatar.innerHTML = `<img src="${resource.data}" class="sys-mask-avatar-img">`;
                });
            };
        }
        
        const saveBtn = page.querySelector('#save-mask-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                const name = page.querySelector('#mask-name').value.trim();
                if (!name) {
                    PhoneCore.notifications.send({ type: 'error', title: '请输入名称', icon: '✕', size: 'mini' });
                    return;
                }
                
                const worldId = page.querySelector('#mask-world').value;
                const balanceInput = page.querySelector('#mask-balance');
                const cityInput = page.querySelector('#mask-city');
                const wealthClassSelect = page.querySelector('#mask-wealth-class');
                
                // 收集人设信息
                const personaData = {
                    nickname: (page.querySelector('#mask-nickname') || {}).value || '',
                    gender: (page.querySelector('#mask-gender') || {}).value || '',
                    age: (page.querySelector('#mask-age') || {}).value || '',
                    birthday: (page.querySelector('#mask-birthday') || {}).value || '',
                    occupation: (page.querySelector('#mask-occupation') || {}).value || '',
                    school: (page.querySelector('#mask-school') || {}).value || '',
                    hobbies: (page.querySelector('#mask-hobbies') || {}).value || '',
                    personality: (page.querySelector('#mask-personality') || {}).value || '',
                    relationship: (page.querySelector('#mask-relationship') || {}).value || '',
                    backstory: (page.querySelector('#mask-backstory') || {}).value || '',
                    customInfo: (page.querySelector('#mask-custom') || {}).value || ''
                };
                
                // 收集工资信息
                const salaryData = {
                    amount: parseFloat((page.querySelector('#mask-salary-amount') || {}).value) || 0,
                    payday: parseInt((page.querySelector('#mask-salary-payday') || {}).value) || 1,
                    source: (page.querySelector('#mask-salary-source') || {}).value || '',
                    payTime: '10:00',
                    lastPayDate: null
                };
                
                if (isNew) {
                    const newMask = PhoneCore.user.createMask({
                        name: name,
                        worldId: worldId || null,
                        avatar: maskAvatarData,
                        city: cityInput ? cityInput.value.trim() : '',
                        wealthClass: wealthClassSelect ? wealthClassSelect.value : 'normal',
                        persona: personaData,
                        salary: salaryData
                    });
                    
                    if (balanceInput) {
                        const balance = parseFloat(balanceInput.value) || 0;
                        PhoneCore.user.setMaskBalance(newMask.id, balance);
                    }
                } else {
                    mask.name = name;
                    mask.worldId = worldId || null;
                    mask.avatar = maskAvatarData;
                    mask.city = cityInput ? cityInput.value.trim() : '';
                    mask.wealthClass = wealthClassSelect ? wealthClassSelect.value : 'normal';
                    mask.persona = personaData;
                    mask.salary = salaryData;
                    
                    if (balanceInput && !mask.balanceLocked) {
                        const balance = parseFloat(balanceInput.value) || 0;
                        PhoneCore.user.setMaskBalance(mask.id, balance);
                    }
                }
                
                PhoneCore.saveUserProfile().then(function() {
                    PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                });
            };
        }
        
        const deleteBtn = page.querySelector('#delete-mask-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此人设面具？')) {
                    PhoneCore.user.deleteMask(maskId);
                    PhoneCore.saveUserProfile().then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.refreshCurrentTab();
                    });
                }
            };
        }
    };

    // 面具详情
    SystemConfigApp.prototype.openMaskDetail = function(maskId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var mask = PhoneCore.user.masks[maskId];
        if (!mask) return;
        
        var html = '<div style="padding:20px;">';
        
        // 头像和名称
        html += '<div style="text-align:center;margin-bottom:30px;">';
        html += '<div style="width:100px;height:100px;border-radius:25px;background:#f0f0f0;margin:0 auto 15px;overflow:hidden;">';
        if (mask.avatar) {
            html += '<img src="' + mask.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#D8456C;">' + I.mask + '</div>';
        }
        html += '</div>';
        html += '<div style="font-size:24px;font-weight:600;">' + mask.name + '</div>';
        if (mask.worldId) {
            var world = PhoneCore.getWorld(mask.worldId);
            if (world) {
                html += '<div style="font-size:14px;color:#666;margin-top:5px;">🌍 ' + world.name + '</div>';
            }
        }
        html += '</div>';
        
        // 余额卡片
        html += '<div style="background: #91ddfb;border-radius: 20px;padding: 25px;color: white;margin-bottom: 20px;box-shadow: 0px 0px 9px 3px #c5d0e3;">';
        html += '<div style="font-size:14px;opacity:0.8;margin-bottom:10px;">当前余额</div>';
        html += '<div style="font-size:36px;font-weight:600;">¥ ' + (mask.balance || 0).toFixed(2) + '</div>';
        if (mask.balanceLocked) {
            html += '<div style="font-size:12px;opacity:0.6;margin-top:10px;">余额已锁定</div>';
        }
        html += '</div>';
        
        // 操作按钮
        html += '<div style="display:flex;gap:10px;margin-bottom:20px;">';
        html += '<button id="switch-mask-btn" style="flex:1;padding:15px;background: #ffb4bb;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">' + (PhoneCore.user.currentMaskId === maskId ? '当前使用中' : '切换到此身份') + '</button>';
        html += '<button id="edit-mask-btn" style="flex:1;padding:15px;background: #a4cbf5;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">编辑</button>';
        html += '</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        var switchBtn = page.querySelector('#switch-mask-btn');
        if (switchBtn && PhoneCore.user.currentMaskId !== maskId) {
            switchBtn.onclick = function() {
                PhoneCore.user.switchMask(maskId);
                PhoneCore.saveUserProfile().then(function() {
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                });
            };
        }
        
        var editBtn = page.querySelector('#edit-mask-btn');
        if (editBtn) {
            editBtn.onclick = function() {
                page.querySelector('.app-back-btn').click();
                setTimeout(function() {
                    self.openMaskEditor(maskId);
                }, 350);
            };
        }
    };

    // 数据库查看器
    SystemConfigApp.prototype.openDatabaseViewer = function() {
        var self = this;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">数据库内容</div>';
        html += '<div id="db-content" style="font-size:12px;">加载中...</div>';
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        PhoneCore.exportData().then(function(jsonString) {
            var data = JSON.parse(jsonString);
            var contentDiv = page.querySelector('#db-content');
            
            var html = '';
            Object.keys(data).forEach(function(storeName) {
                var items = data[storeName];
                html += '<div class="config-card" style="background:white;border-radius:12px;padding:15px;margin-bottom:15px;">';
                html += '<div style="font-weight:600;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">';
                html += '<span>📁 ' + storeName + ' (' + items.length + ')</span>';
                html += '<button class="clear-store-btn" data-store="' + storeName + '" style="padding:5px 10px;background:#FF3B30;color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;">清空</button>';
                html += '</div>';
                
                if (items.length > 0) {
                    html += '<div style="max-height:200px;overflow-y:auto;">';
                    items.forEach(function(item, index) {
                        html += '<div class="db-item" style="padding:8px;background:#f8f8f8;border-radius:8px;margin-bottom:5px;font-size:11px;word-break:break-all;">';
                        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                        html += '<span style="color:#666;">#' + (index + 1) + ' - ' + (item.id || item.name || 'item') + '</span>';
                        html += '<button class="delete-item-btn" data-store="' + storeName + '" data-id="' + item.id + '" style="padding:2px 6px;background:#FF3B30;color:white;border:none;border-radius:4px;font-size:10px;cursor:pointer;">删除</button>';
                        html += '</div>';
                        html += '</div>';
                    });
                    html += '</div>';
                } else {
                    html += '<div style="color:#999;text-align:center;padding:10px;">空</div>';
                }
                
                html += '</div>';
            });
            
            contentDiv.innerHTML = html;
            
            // 清空存储
            contentDiv.querySelectorAll('.clear-store-btn').forEach(function(btn) {
                btn.onclick = function() {
                    var storeName = btn.getAttribute('data-store');
                    if (confirm('确定清空 ' + storeName + ' ?')) {
                        PhoneCore.db.clear(storeName).then(function() {
                            self.openDatabaseViewer();
                        });
                    }
                };
            });
            
            // 删除单项
            contentDiv.querySelectorAll('.delete-item-btn').forEach(function(btn) {
                btn.onclick = function(e) {
                    e.stopPropagation();
                    var storeName = btn.getAttribute('data-store');
                    var itemId = btn.getAttribute('data-id');
                    PhoneCore.db.delete(storeName, itemId).then(function() {
                        btn.closest('.db-item').remove();
                    });
                };
            });
        });
    };

    // ============ 页面2: 世界观配置 ============
    SystemConfigApp.prototype.renderWorldPage = function() {
        const S = this.STYLES;
        const I = this.SVG;
        let html = `<div class="${S.pageWrap}">`;

        html += `
        <div class="sys-world-header-row">
            <div class="sys-world-header-title">世界观</div>
            <button id="add-world-btn" class="${S.primaryButton} sys-btn-flex-6 sys-btn-add">${I.plus} 新建</button>
        </div>
        `;

        const worlds = Object.values(PhoneCore.worlds);

        if (worlds.length === 0) {
            html += `
        <div class="sys-world-empty-wrap">
            <div class="sys-world-empty-icon">
                <span class="sys-world-empty-icon-inner">${I.globe}</span>
            </div>
            <div class="sys-world-empty-hint">暂无世界观，点击新建开始创作</div>
        </div>
        `;
        } else {
            // 多巴胺色系 - 柔和渐变
            const colors = [
                ['#FF9AA2', '#FFB7B2'],  // 珊瑚粉
                ['#B5EAD7', '#98D8C8'],  // 薄荷绿
                ['#C7CEEA', '#B8C5E2'],  // 薰衣草紫
                ['#FFDAC1', '#FFD1A9'],  // 杏色
                ['#E2F0CB', '#D4E8B4'],  // 抹茶绿
                ['#F6C3E5', '#EDAAD7'],  // 樱花粉
                ['#A2D2FF', '#90C8F8']   // 天空蓝
            ];

            worlds.forEach(function(world, index) {
                const colorPair = colors[index % colors.length];
                const desc = (world.description || '暂无描述').substring(0, 80) + (world.description && world.description.length > 80 ? '...' : '');
                html += `
                    <div class="world-card sys-world-card" data-world-id="${world.id}" style="background:linear-gradient(135deg,${colorPair[0]},${colorPair[1]});box-shadow:0 8px 24px ${colorPair[0]}40;">
                        <div class="sys-world-card-title">${world.name}</div>
                        <div class="sys-world-card-desc">${desc}</div>
                        <div class="sys-world-card-stats">
                            <span class="sys-world-card-stat-badge">${I.location} ${Object.keys(world.locations).length}</span>
                            <span class="sys-world-card-stat-badge">${I.users} ${world.boundAIs.length}</span>
                        </div>
                    </div>
                    `;
            });
        }
        
        // 表情包管理入口
        html += `
        <div class="config-card ${S.glassCard} sys-card-mt-24 sys-card-clickable" id="sticker-manager-entry">
            <div class="sys-schedule-entry-row">
                <div class="sys-schedule-entry-inner">
                    <div class="sys-entry-icon-warm">
                        <span class="sys-entry-icon-warm-inner">${I.smile}</span>
                    </div>
                    <div>
                        <div class="sys-schedule-entry-title">表情包管理</div>
                        <div class="sys-schedule-entry-desc">管理AI使用的表情包</div>
                    </div>
                </div>
                <span class="sys-schedule-entry-arrow">${I.arrow_right}</span>
            </div>
        </div>
        `;
        
        // 头像库入口
        html += `
        <div class="config-card ${S.glassCard} sys-card-mt-12 sys-card-clickable" id="avatar-library-entry">
            <div class="sys-schedule-entry-row">
                <div class="sys-schedule-entry-inner">
                    <div class="sys-entry-icon-avatar">
                        <span class="sys-entry-icon-avatar-inner">${I.user}</span>
                    </div>
                    <div>
                        <div class="sys-schedule-entry-title">头像库</div>
                        <div class="sys-schedule-entry-desc">管理AI可用的头像资源</div>
                    </div>
                </div>
                <span class="sys-schedule-entry-arrow">${I.arrow_right}</span>
            </div>
        </div>
        `;
        
        // 背景库入口
        html += `
        <div class="config-card ${S.glassCard} sys-card-mt-12 sys-card-clickable" id="background-library-entry">
            <div class="sys-schedule-entry-row">
                <div class="sys-schedule-entry-inner">
                    <div class="sys-entry-icon-bg">
                        <span class="sys-entry-icon-bg-inner">${I.image}</span>
                    </div>
                    <div>
                        <div class="sys-schedule-entry-title">背景库</div>
                        <div class="sys-schedule-entry-desc">管理AI可用的背景图片</div>
                    </div>
                </div>
                <span class="sys-schedule-entry-arrow">${I.arrow_right}</span>
            </div>
        </div>
        `;
        
        return html;
    };

    SystemConfigApp.prototype.bindWorldPageEvents = function(container) {
        var self = this;
        
        var addBtn = container.querySelector('#add-world-btn');
        if (addBtn) {
            addBtn.onclick = function() {
                self.openWorldEditor(null);
            };
        }
        
        container.querySelectorAll('.world-card').forEach(function(card) {
            card.onclick = function() {
                var worldId = card.getAttribute('data-world-id');
                self.openWorldDetail(worldId);
            };
        });
        
        var stickerEntry = container.querySelector('#sticker-manager-entry');
        if (stickerEntry) {
            stickerEntry.onclick = function() {
                self.openStickerManager();
            };
        }
        
        // 头像库入口
        var avatarLibEntry = container.querySelector('#avatar-library-entry');
        if (avatarLibEntry) {
            avatarLibEntry.onclick = function() {
                self.openAvatarLibrary();
            };
        }
        
        // 背景库入口
        var bgLibEntry = container.querySelector('#background-library-entry');
        if (bgLibEntry) {
            bgLibEntry.onclick = function() {
                self.openBackgroundLibrary();
            };
        }
    };

    // 世界观编辑器
    SystemConfigApp.prototype.openWorldEditor = function(worldId) {
        const self = this;
        const S = this.STYLES;
        const I = this.SVG;
        const world = worldId ? PhoneCore.getWorld(worldId) : null;
        const isNew = !world;

        let html = `
        <div class="${S.pageWrap}">
            <div class="sys-form-section-title">${isNew ? '新建世界观' : '编辑世界观'}</div>
            <div class="config-card ${S.glassCard}">
                <div class="sys-form-field-mb">
                    <label class="${S.label}">名称</label>
                    <input type="text" id="world-name" value="${world ? world.name : ''}" placeholder="如：赛博朋克2077" class="${S.input}">
                </div>
                <div class="sys-form-field-mb">
                    <label class="${S.label}">世界观描述</label>
                    <textarea id="world-description" placeholder="描述这个世界的背景设定..." class="${S.input} sys-input-textarea-lg">${world ? world.description : ''}</textarea>
                </div>
            </div>
            <button id="save-world-btn" class="${S.primaryButton} sys-btn-full">保存</button>
            ${!isNew ? `<button id="delete-world-btn" class="sys-delete-btn">删除世界观</button>` : ''}
        </div>
        `;

        const page = this.openDetailPage(html);

        const saveBtn = page.querySelector('#save-world-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = page.querySelector('#world-name').value.trim();
                const description = page.querySelector('#world-description').value.trim();
                if (!name) {
                    alert('请输入名称');
                    return;
                }
                if (isNew) {
                    PhoneCore.saveWorld(new World({ name, description }));
                } else {
                    world.name = name;
                    world.description = description;
                    world.updatedAt = Date.now();
                    PhoneCore.saveWorld(world);
                }
                PhoneCore.notifications.send({ type: 'success', title: '保存成功', size: 'mini' });
                page.querySelector('.app-back-btn').click();
                self.refreshCurrentTab();
            };
        }
        const deleteBtn = page.querySelector('#delete-world-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (confirm('确定删除此世界观？相关AI绑定将被解除。')) {
                    PhoneCore.deleteWorld(worldId);
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                }
            };
        }
    };

    // 世界观详情
    SystemConfigApp.prototype.openWorldDetail = function(worldId) {
        const self = this;
        const S = this.STYLES;
        const I = this.SVG;
        const world = PhoneCore.getWorld(worldId);
        if (!world) return;

        const locations = Object.values(world.locations);
        const factions = Object.values(world.factions);
        const boundAIs = world.boundAIs.map((aiId) => PhoneCore.getAI(aiId)).filter((ai) => !!ai);

        const html = `
        <div class="sys-world-detail-wrap">
            <div class="sys-world-detail-header">
                <div class="sys-world-detail-title">${world.name}</div>
                <div class="sys-world-detail-desc">${world.description ?? '暂无描述'}</div>
            </div>

            <button id="edit-world-btn" class="sys-world-detail-edit-btn">编辑世界观</button>

            <div class="config-card sys-world-detail-card">
                <div class="sys-world-detail-card-header">
                    <span class="sys-world-detail-card-title">${I.location} 重要地点</span>
                    <button id="add-location-btn" class="sys-world-detail-add-loc">+ 添加</button>
                </div>
                ${locations.length === 0
                    ? '<div class="sys-world-detail-empty">暂无地点</div>'
                    : locations.map((loc) => `
                <div class="location-item sys-world-detail-item" data-location-id="${loc.id}">
                    <div class="sys-world-detail-item-row">
                        <div>
                            <div class="sys-world-detail-item-name">${loc.name}</div>
                            <div class="sys-world-detail-item-desc">${(loc.description ?? '').substring(0, 50)}</div>
                            ${loc.realCityMapping ? `<div class="sys-world-detail-item-weather">天气: ${loc.realCityMapping}</div>` : ''}
                        </div>
                        <span class="sys-world-detail-item-arrow">›</span>
                    </div>
                </div>
                `).join('')}
            </div>

            <div class="config-card sys-world-detail-card sys-world-detail-faction-card">
                <div class="sys-world-detail-card-header sys-world-detail-faction-header">
                    <span class="sys-world-detail-faction-title">⚔️ 势力/阵营</span>
                    <button id="add-faction-btn" class="sys-world-detail-add-faction">+ 添加</button>
                </div>
                ${factions.length === 0
                    ? '<div class="sys-world-detail-empty">暂无势力</div>'
                    : factions.map((faction) => `
                <div class="faction-item sys-world-detail-item" data-faction-id="${faction.id}">
                    <div class="sys-world-detail-item-name">${faction.name}</div>
                    <div class="sys-world-detail-item-desc">${(faction.description ?? '').substring(0, 50)}</div>
                </div>
                `).join('')}
            </div>

            <div class="config-card sys-world-detail-card">
                <div class="sys-world-detail-card-header">
                    <span class="sys-world-detail-card-title">${I.robot} 绑定的AI</span>
                    <button id="bind-ai-btn" class="sys-world-detail-add-ai">+ 绑定</button>
                </div>
                ${boundAIs.length === 0
                    ? '<div class="sys-world-detail-empty">暂无绑定的AI</div>'
                    : boundAIs.map((ai) => `
                <div class="bound-ai-item sys-world-detail-bound-ai-item" data-ai-id="${ai.id}">
                    <div class="sys-world-detail-ai-avatar">
                        ${ai.avatar ? `<img src="${ai.avatar}" class="${S.avatarImg}">` : `<div class="sys-world-detail-ai-avatar-placeholder">${I.robot}</div>`}
                    </div>
                    <div class="sys-world-detail-ai-body">
                        <div class="sys-world-detail-ai-name">${ai.name}</div>
                        <div class="sys-world-detail-ai-type">${ai.type === 'main' ? '主角色' : ai.type === 'supporting' ? '配角' : 'NPC'}</div>
                    </div>
                    <button class="unbind-ai-btn sys-world-detail-unbind-btn" data-ai-id="${ai.id}">解绑</button>
                </div>
                `).join('')}
            </div>

            <div class="config-card sys-world-detail-card">
                <div class="sys-world-detail-weather-header">${I.sun} 天气映射</div>
                <div class="sys-world-detail-weather-desc">将虚构地点的天气映射到现实城市</div>
                ${locations.length === 0
                    ? '<div class="sys-world-detail-empty-sm">请先添加地点</div>'
                    : locations.map((loc) => `
                <div class="sys-world-detail-weather-row">
                    <span class="sys-world-detail-weather-label">${loc.name}</span>
                    <input type="text" class="weather-mapping-input sys-world-detail-weather-input" data-location-id="${loc.id}" value="${loc.realCityMapping ?? ''}" placeholder="现实城市名">
                </div>
                `).join('') + `
                <button id="save-weather-mapping-btn" class="sys-world-detail-save-btn">保存映射</button>
                `}
            </div>
        </div>
        `;

        const page = this.openDetailPage(html);

        const editBtn = page.querySelector('#edit-world-btn');
        if (editBtn) {
            editBtn.onclick = () => {
                page.querySelector('.app-back-btn').click();
                setTimeout(() => self.openWorldEditor(worldId), 350);
            };
        }

        const addLocBtn = page.querySelector('#add-location-btn');
        if (addLocBtn) {
            addLocBtn.onclick = () => self.openLocationEditor(worldId, null);
        }

        page.querySelectorAll('.location-item').forEach((item) => {
            item.onclick = () => {
                const locId = item.getAttribute('data-location-id');
                self.openLocationEditor(worldId, locId);
            };
        });

        const addFactionBtn = page.querySelector('#add-faction-btn');
        if (addFactionBtn) {
            addFactionBtn.onclick = () => self.openFactionEditor(worldId, null);
        }

        page.querySelectorAll('.faction-item').forEach((item) => {
            item.onclick = () => {
                const factionId = item.getAttribute('data-faction-id');
                self.openFactionEditor(worldId, factionId);
            };
        });

        const bindAIBtn = page.querySelector('#bind-ai-btn');
        if (bindAIBtn) {
            bindAIBtn.onclick = () => self.openAIBindingSelector(worldId);
        }

        page.querySelectorAll('.unbind-ai-btn').forEach((btn) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const aiId = btn.getAttribute('data-ai-id');
                if (confirm('确定解除绑定？')) {
                    world.unbindAI(aiId);
                    const ai = PhoneCore.getAI(aiId);
                    if (ai) {
                        ai.worldId = null;
                        ai.locationId = null;
                        PhoneCore.saveAI(ai);
                    }
                    PhoneCore.saveWorld(world);
                    btn.closest('.bound-ai-item').remove();
                }
            };
        });

        const saveWeatherBtn = page.querySelector('#save-weather-mapping-btn');
        if (saveWeatherBtn) {
            saveWeatherBtn.onclick = () => {
                page.querySelectorAll('.weather-mapping-input').forEach((input) => {
                    const locId = input.getAttribute('data-location-id');
                    const city = input.value.trim();
                    if (world.locations[locId]) {
                        world.locations[locId].realCityMapping = city;
                        world.setWeatherMapping(locId, city);
                    }
                });
                PhoneCore.saveWorld(world).then(() => {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '保存成功',
                        size: 'mini'
                    });
                });
            };
        }
    };

    // 地点编辑器
    SystemConfigApp.prototype.openLocationEditor = function(worldId, locationId) {
        const S = this.STYLES;
        const world = PhoneCore.getWorld(worldId);
        if (!world) return;

        const location = locationId ? world.locations[locationId] : null;
        const isNew = !location;

        const html = `
        <div class="${S.pageWrap}">
            <div class="sys-form-header">${isNew ? '添加地点' : '编辑地点'}</div>
            <div class="config-card ${S.glassCard}">
                <div class="sys-form-field-mb15">
                    <label class="${S.label}">地点名称</label>
                    <input type="text" id="location-name" value="${location?.name ?? ''}" placeholder="如：夜之城" class="${S.input}">
                </div>
                <div class="sys-form-field-mb15">
                    <label class="${S.label}">地点描述</label>
                    <textarea id="location-description" placeholder="描述这个地点的特点..." class="${S.input} sys-input-textarea-md">${location?.description ?? ''}</textarea>
                </div>
                <div class="sys-form-field-mb15">
                    <label class="${S.label}">天气映射（现实城市）</label>
                    <input type="text" id="location-weather-city" value="${location?.realCityMapping ?? ''}" placeholder="如：上海" class="${S.input}">
                </div>
            </div>
            <button id="save-location-btn" class="${S.primaryButton} sys-btn-full">保存</button>
            ${!isNew ? `<button id="delete-location-btn" class="sys-delete-btn">删除地点</button>` : ''}
        </div>
        `;

        const page = this.openDetailPage(html);

        const saveBtn = page.querySelector('#save-location-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = page.querySelector('#location-name').value.trim();
                const description = page.querySelector('#location-description').value.trim();
                const weatherCity = page.querySelector('#location-weather-city').value.trim();

                if (!name) {
                    alert('请输入地点名称');
                    return;
                }

                if (isNew) {
                    world.addLocation({
                        id: 'loc_' + Date.now(),
                        name,
                        description,
                        realCityMapping: weatherCity
                    });
                } else {
                    location.name = name;
                    location.description = description;
                    location.realCityMapping = weatherCity;
                    world.setWeatherMapping(locationId, weatherCity);
                }

                PhoneCore.saveWorld(world).then(() => {
                    PhoneCore.notifications.send({ type: 'success', title: '保存成功', size: 'mini' });
                    page.querySelector('.app-back-btn')?.click();
                });
            };
        }

        const deleteBtn = page.querySelector('#delete-location-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (confirm('确定删除此地点？')) {
                    world.removeLocation(locationId);
                    PhoneCore.saveWorld(world).then(() => {
                        page.querySelector('.app-back-btn')?.click();
                    });
                }
            };
        }
    };

    // 势力编辑器
    SystemConfigApp.prototype.openFactionEditor = function(worldId, factionId) {
        const S = this.STYLES;
        const world = PhoneCore.getWorld(worldId);
        if (!world) return;

        const faction = factionId ? world.factions[factionId] : null;
        const isNew = !faction;

        const html = `
        <div class="${S.pageWrap}">
            <div class="sys-form-header">${isNew ? '添加势力' : '编辑势力'}</div>
            <div class="config-card ${S.glassCard}">
                <div class="sys-form-field-mb15">
                    <label class="${S.label}">势力名称</label>
                    <input type="text" id="faction-name" value="${faction ? faction.name : ''}" placeholder="如：荒坂公司" class="${S.input}">
                </div>
                <div class="sys-form-field-mb15">
                    <label class="${S.label}">势力描述</label>
                    <textarea id="faction-description" placeholder="描述这个势力的特点..." class="${S.input} sys-input-textarea-md">${faction ? (faction.description || '') : ''}</textarea>
                </div>
            </div>
            <button id="save-faction-btn" class="${S.primaryButton} sys-btn-full">保存</button>
            ${!isNew ? `<button id="delete-faction-btn" class="sys-delete-btn">删除势力</button>` : ''}
        </div>
        `;

        const page = this.openDetailPage(html);

        const saveBtn = page.querySelector('#save-faction-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = page.querySelector('#faction-name').value.trim();
                const description = page.querySelector('#faction-description').value.trim();

                if (!name) {
                    alert('请输入势力名称');
                    return;
                }

                if (isNew) {
                    world.addFaction({
                        id: 'faction_' + Date.now(),
                        name,
                        description
                    });
                } else {
                    faction.name = name;
                    faction.description = description;
                }

                PhoneCore.saveWorld(world).then(() => {
                    PhoneCore.notifications.send({ type: 'success', title: '保存成功', size: 'mini' });
                    page.querySelector('.app-back-btn')?.click();
                });
            };
        }

        const deleteBtn = page.querySelector('#delete-faction-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (confirm('确定删除此势力？')) {
                    delete world.factions[factionId];
                    world.updatedAt = Date.now();
                    PhoneCore.saveWorld(world).then(() => {
                        page.querySelector('.app-back-btn')?.click();
                    });
                }
            };
        }
    };

    // AI绑定选择器
    SystemConfigApp.prototype.openAIBindingSelector = function(worldId) {
        const S = this.STYLES;
        const I = this.SVG;
        const world = PhoneCore.getWorld(worldId);
        if (!world) return;
        
        const allAIs = Object.values(PhoneCore.ais);
        const unboundAIs = allAIs.filter(ai => !world.boundAIs.includes(ai.id));
        
        const html = `
        <div class="sys-ai-binding-page">
            <div class="sys-ai-binding-title">选择要绑定的AI</div>
            ${unboundAIs.length === 0 ? `
            <div class="sys-ai-binding-empty">
                <div class="sys-ai-binding-empty-icon">${I.robot}</div>
                <div class="sys-ai-binding-empty-text">没有可绑定的AI，请先创建AI角色</div>
            </div>
            ` : unboundAIs.map(ai => `
            <div class="sys-ai-select-item ai-select-item" data-ai-id="${ai.id}">
                <div class="sys-ai-select-avatar">
                    ${ai.avatar ? `<img src="${ai.avatar}" class="${S.avatarImg}">` : `<span class="sys-ai-select-placeholder">${I.robot}</span>`}
                </div>
                <div class="sys-ai-select-body">
                    <div class="sys-ai-select-name">${ai.name}</div>
                    <div class="sys-ai-select-type">${ai.type === 'main' ? '主角色' : ai.type === 'supporting' ? '配角' : 'NPC'}</div>
                </div>
                <span class="sys-ai-select-plus">${I.plus}</span>
            </div>
            `).join('')}
        </div>
        `;
        
        const page = this.openDetailPage(html);
        
        page.querySelectorAll('.ai-select-item').forEach(item => {
            item.onclick = function() {
                const aiId = item.getAttribute('data-ai-id');
                const ai = PhoneCore.getAI(aiId);
                
                world.bindAI(aiId);
                if (ai) {
                    ai.worldId = worldId;
                    PhoneCore.saveAI(ai);
                }
                PhoneCore.saveWorld(world).then(() => {
                    page.querySelector('.app-back-btn').click();
                });
            };
        });
    };

    // 表情包管理器
    /* 【三层表情包管理系统】
       第一层 StickerLibrary：用户分类名（AI不读取）
       第二层 StickerPack：情绪/场景名（AI读取，如"开心"、"生气"）
       第三层 Sticker：具体表情图片 */
    SystemConfigApp.prototype.openStickerManager = function() {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">表情包管理</div>';
        html += '<button id="add-sticker-library-btn" class="' + S.primaryButton + ' sys-btn-flex-6 sys-btn-add">' + I.plus + ' 新建库</button>';
        html += '</div>';
        
        html += '<div style="font-size:13px;color:#666;margin-bottom:24px;line-height:1.6;">';
        html += '三层结构：<br>';
        html += '• <strong>表情库</strong>：分类名（用户看，AI不读）<br>';
        html += '• <strong>表情包</strong>：情绪名（AI读取，如"开心"、"伤心"）<br>';
        html += '• <strong>表情</strong>：具体图片（随机发送）';
        html += '</div>';
        
        html += '<div id="sticker-libraries-container">加载中...</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 使用新的StickerManager加载数据
        var manager = PhoneCore.stickerManager;
        var container = page.querySelector('#sticker-libraries-container');
        
        // 确保manager已初始化并加载数据
        if (!manager) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#999;">表情包管理器未初始化</div>';
            return;
        }
        
        // 确保数据已加载 - 始终从数据库重新加载以确保数据一致性
        console.log('[表情包管理] 开始加载...');
        
        var loadPromise;
        try {
            loadPromise = manager.load();
        } catch (syncErr) {
            console.error('[表情包管理] load()同步错误:', syncErr);
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#f66;">同步错误: ' + syncErr.message + '</div>';
            return;
        }
        
        if (!loadPromise || typeof loadPromise.then !== 'function') {
            console.error('[表情包管理] load()没有返回有效的Promise');
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#f66;">加载方法返回无效</div>';
            return;
        }
        
        loadPromise.then(function() {
            console.log('[表情包管理] 加载成功');
            var libraries = Object.values(manager.libraries || {});
            
            if (libraries.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
                    '<div style="width:80px;height:80px;margin:0 auto 20px;background:linear-gradient(135deg,rgba(255,182,193,0.2),rgba(255,218,233,0.3));border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
                    '<span style="font-size:40px;">😀</span>' +
                    '</div>' +
                    '<div style="color:#999;font-size:15px;">暂无表情库，点击新建开始</div>' +
                    '</div>';
            } else {
                var listHtml = '';
                libraries.forEach(function(lib) {
                    // 统计包数和表情数 - 确保packIds是数组
                    var packIds = Array.isArray(lib.packIds) ? lib.packIds : [];
                    var packCount = packIds.length;
                    var stickerCount = 0;
                    packIds.forEach(function(packId) {
                        var pack = manager.packs[packId];
                        var stickerIds = pack && Array.isArray(pack.stickerIds) ? pack.stickerIds : [];
                        if (pack) stickerCount += stickerIds.length;
                    });
                    
                    // 获取预览表情
                    var previewStickers = [];
                    for (var i = 0; i < packIds.length && previewStickers.length < 4; i++) {
                        var pack = manager.packs[packIds[i]];
                        if (pack) {
                            var stickerIds = Array.isArray(pack.stickerIds) ? pack.stickerIds : [];
                            for (var j = 0; j < stickerIds.length && previewStickers.length < 4; j++) {
                                var sticker = manager.stickers[stickerIds[j]];
                                if (sticker && sticker.resourceId) {
                                    previewStickers.push(sticker.resourceId);
                                }
                            }
                        }
                    }
                    
                    listHtml += '<div class="sticker-library-card ' + S.glassCard + ' sys-card-clickable" data-library-id="' + lib.id + '" style="margin-bottom:16px;">';
                    listHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
                    listHtml += '<div style="font-weight:600;font-size:16px;color:#333;">' + lib.name + '</div>';
                    listHtml += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
                    listHtml += '</div>';
                    
                    if (lib.description) {
                        listHtml += '<div style="font-size:13px;color:#888;margin-bottom:12px;">' + lib.description + '</div>';
                    }
                    
                    listHtml += '<div style="display:flex;gap:10px;font-size:12px;color:#666;margin-bottom:12px;">';
                    listHtml += '<span style="background:rgba(255,182,193,0.15);padding:4px 10px;border-radius:12px;">' + packCount + ' 个包</span>';
                    listHtml += '<span style="background:rgba(102,187,106,0.15);padding:4px 10px;border-radius:12px;">' + stickerCount + ' 个表情</span>';
                    listHtml += '</div>';
                    
                    // 预览表情
                    if (previewStickers.length > 0) {
                        listHtml += '<div style="display:flex;gap:6px;">';
                        previewStickers.forEach(function(resourceId) {
                            PhoneCore.resources.get(resourceId).then(function(resource) {
                                var img = page.querySelector('img[data-resource-id="' + resourceId + '"]');
                                if (img && resource) {
                                    img.src = resource.data;
                                }
                            });
                            listHtml += '<img data-resource-id="' + resourceId + '" style="width:44px;height:44px;border-radius:10px;object-fit:cover;background:#f0f0f0;">';
                        });
                        listHtml += '</div>';
                    }
                    
                    listHtml += '</div>';
                });
                container.innerHTML = listHtml;
                
                // 绑定点击事件
                container.querySelectorAll('.sticker-library-card').forEach(function(card) {
                    card.onclick = function() {
                        var libraryId = card.getAttribute('data-library-id');
                        self.openStickerLibraryDetail(libraryId);
                    };
                });
            }
        }).catch(function(err) {
            console.error('[表情包管理] 加载失败:', err);
            var errMsg = err ? (err.message || err.toString()) : '未知错误';
            
            container.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
                '<div style="color:#f66;margin-bottom:15px;font-size:14px;">加载失败</div>' +
                '<div style="color:#999;margin-bottom:20px;font-size:12px;word-break:break-all;">' + errMsg + '</div>' +
                '<button id="retry-sticker-btn" class="' + S.primaryButton + ' sys-btn-full sys-btn-mb10">重试</button>' +
                '<button id="clear-sticker-data-btn" class="' + S.secondaryButton + ' sys-btn-full sys-btn-mb10">清空表情数据</button>' +
                '<button id="clear-all-resources-btn" style="width:100%;padding:12px;background:transparent;color:#f66;border:1px solid #f66;border-radius:12px;font-size:13px;cursor:pointer;">清空所有资源（含图片）</button>' +
                '<div style="font-size:11px;color:#aaa;margin-top:10px;">如GIF导致问题，尝试清空所有资源</div>' +
                '</div>';
            
            // 重试按钮
            var retryBtn = container.querySelector('#retry-sticker-btn');
            if (retryBtn) {
                retryBtn.onclick = function() {
                    self.openStickerManager();
                };
            }
            
            // 清空数据按钮
            var clearBtn = container.querySelector('#clear-sticker-data-btn');
            if (clearBtn) {
                clearBtn.onclick = function() {
                    if (!confirm('确定清空所有表情数据？此操作不可恢复。')) return;
                    clearBtn.disabled = true;
                    clearBtn.textContent = '正在清空...';
                    // 清空三个表情相关的数据库表
                    Promise.all([
                        PhoneCore.db.clear('sticker_libraries'),
                        PhoneCore.db.clear('sticker_packs'),
                        PhoneCore.db.clear('stickers')
                    ]).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '已清空表情数据',  size: 'mini' });
                        // 重新加载
                        self.openStickerManager();
                    }).catch(function(clearErr) {
                        console.error('[表情包管理] 清空失败:', clearErr);
                        clearBtn.disabled = false;
                        clearBtn.textContent = '清空失败，再试一次';
                    });
                };
            }
            
            // 清空所有资源按钮（包括图片）
            var clearAllBtn = container.querySelector('#clear-all-resources-btn');
            if (clearAllBtn) {
                clearAllBtn.onclick = function() {
                    if (!confirm('确定清空所有表情数据和图片资源？\n\n注意：这会删除所有上传的表情图片，此操作不可恢复！')) return;
                    clearAllBtn.disabled = true;
                    clearAllBtn.textContent = '正在清空...';
                    // 清空表情相关的表和资源表
                    Promise.all([
                        PhoneCore.db.clear('sticker_libraries'),
                        PhoneCore.db.clear('sticker_packs'),
                        PhoneCore.db.clear('stickers'),
                        PhoneCore.db.clear('resources')
                    ]).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '已清空所有数据',  size: 'mini' });
                        self.openStickerManager();
                    }).catch(function(clearErr) {
                        console.error('[表情包管理] 清空失败:', clearErr);
                        clearAllBtn.disabled = false;
                        clearAllBtn.textContent = '清空失败，再试一次';
                    });
                };
            }
        });
        
        // 新建库
        var addBtn = page.querySelector('#add-sticker-library-btn');
        if (addBtn) {
            addBtn.onclick = function() {
                self.openStickerLibraryEditor(null);
            };
        }
    };
    
    /* 【表情库编辑器】 */
    SystemConfigApp.prototype.openStickerLibraryEditor = function(libraryId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var manager = PhoneCore.stickerManager;
        var lib = libraryId ? manager.libraries[libraryId] : null;
        var isNew = !lib;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">' + (isNew ? '新建表情库' : '编辑表情库') + '</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">库名称 <span style="color:#999;font-weight:400;">(用户看，AI不读取)</span></label>';
        html += '<input type="text" id="library-name" value="' + (lib ? lib.name : '') + '" placeholder="如：冷酷人设专用" class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">描述</label>';
        html += '<textarea id="library-description" placeholder="描述这个表情库的用途..." class="' + S.input + ' sys-input-textarea-md">' + (lib ? lib.description : '') + '</textarea>';
        html += '</div>';
        
        html += '</div>';
        
        html += '<button id="save-library-btn" class="' + S.primaryButton + ' sys-btn-full">保存</button>';
        
        if (!isNew) {
            html += '<button id="delete-library-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:14px;font-size:15px;font-weight:500;cursor:pointer;margin-top:12px;">删除表情库</button>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 保存
        var saveBtn = page.querySelector('#save-library-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var name = page.querySelector('#library-name').value.trim();
                var description = page.querySelector('#library-description').value.trim();
                
                if (!name) {
                    PhoneCore.notifications.send({ type: 'error', title: '请输入名称', icon: '❌', size: 'mini' });
                    return;
                }
                
                if (isNew) {
                    manager.createLibrary({ name: name, description: description }).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openStickerManager();
                    });
                } else {
                    lib.name = name;
                    lib.description = description;
                    lib.updatedAt = Date.now();
                    PhoneCore.db.put('sticker_libraries', lib.toJSON()).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openStickerManager();
                    });
                }
            };
        }
        
        // 删除
        var deleteBtn = page.querySelector('#delete-library-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此表情库？所有包含的表情包和表情都将被删除。')) {
                    manager.deleteLibrary(libraryId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.openStickerManager();
                    });
                }
            };
        }
    };
    
    /* 【表情库详情】 */
    SystemConfigApp.prototype.openStickerLibraryDetail = function(libraryId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var manager = PhoneCore.stickerManager;
        var lib = manager.libraries[libraryId];
        if (!lib) return;
        
        // 确保packIds是数组
        var packIds = Array.isArray(lib.packIds) ? lib.packIds : [];
        
        var html = '<div class="' + S.pageWrap + '">';
        
        // 库信息
        html += '<div style="margin-bottom:24px;">';
        html += '<div style="font-size:24px;font-weight:700;color:#333;margin-bottom:8px;">' + lib.name + '</div>';
        if (lib.description) {
            html += '<div style="font-size:14px;color:#666;line-height:1.6;">' + lib.description + '</div>';
        }
        html += '</div>';
        
        html += '<div style="display:flex;gap:10px;margin-bottom:24px;">';
        html += '<button id="edit-library-btn" class="' + S.secondaryButton + '" style="flex:1;">编辑信息</button>';
        html += '<button id="add-pack-btn" class="' + S.primaryButton + ' sys-btn-add-pack" style="flex:1;">' + I.plus + ' 添加表情包</button>';
        html += '</div>';
        
        // 表情包列表
        html += '<div style="font-size:16px;font-weight:600;color:#333;margin-bottom:16px;">表情包 (' + packIds.length + ')</div>';
        
        if (packIds.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty">暂无表情包，点击添加</div>';
        } else {
            packIds.forEach(function(packId) {
                var pack = manager.packs[packId];
                if (!pack) return;
                
                // 确保stickerIds是数组
                var stickerIds = Array.isArray(pack.stickerIds) ? pack.stickerIds : [];
                
                html += '<div class="sticker-pack-card ' + S.glassCard + ' sys-card-clickable" data-pack-id="' + packId + '" style="margin-bottom:12px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
                html += '<div>';
                html += '<div style="font-weight:600;font-size:15px;color:#333;">' + pack.name + '</div>';
                html += '<div style="font-size:12px;color:#FF6B8A;margin-top:3px;">AI会读取此名称</div>';
                html += '</div>';
                html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
                html += '</div>';
                
                if (pack.description) {
                    html += '<div style="font-size:12px;color:#888;margin-bottom:8px;">' + pack.description + '</div>';
                }
                
                html += '<div style="font-size:12px;color:#666;">' + stickerIds.length + ' 个表情</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 编辑库信息
        var editBtn = page.querySelector('#edit-library-btn');
        if (editBtn) {
            editBtn.onclick = function() {
                self.openStickerLibraryEditor(libraryId);
            };
        }
        
        // 添加表情包
        var addPackBtn = page.querySelector('#add-pack-btn');
        if (addPackBtn) {
            addPackBtn.onclick = function() {
                self.openStickerPackEditorV2(libraryId, null);
            };
        }
        
        // 点击表情包
        page.querySelectorAll('.sticker-pack-card').forEach(function(card) {
            card.onclick = function() {
                var packId = card.getAttribute('data-pack-id');
                self.openStickerPackDetail(libraryId, packId);
            };
        });
    };
    
    /* 【表情包编辑器V2】适配三层结构 */
    SystemConfigApp.prototype.openStickerPackEditorV2 = function(libraryId, packId) {
        var self = this;
        var S = this.STYLES;
        var manager = PhoneCore.stickerManager;
        var pack = packId ? manager.packs[packId] : null;
        var isNew = !pack;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">' + (isNew ? '新建表情包' : '编辑表情包') + '</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">情绪/场景名称 <span style="color:#FF6B8A;font-weight:400;">(AI会读取)</span></label>';
        html += '<input type="text" id="pack-name" value="' + (pack ? pack.name : '') + '" placeholder="如：开心、生气、伤心、耍酷..." class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">描述 <span style="color:#999;font-weight:400;">(用户看，AI不读取)</span></label>';
        html += '<textarea id="pack-description" placeholder="描述这组表情的特点..." class="' + S.input + ' sys-input-textarea-sm">' + (pack ? pack.description : '') + '</textarea>';
        html += '</div>';
        
        html += '</div>';
        
        html += '<button id="save-pack-btn" class="' + S.primaryButton + ' sys-btn-full">保存</button>';
        
        if (!isNew) {
            html += '<button id="delete-pack-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:14px;font-size:15px;font-weight:500;cursor:pointer;margin-top:12px;">删除表情包</button>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 保存
        var saveBtn = page.querySelector('#save-pack-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var name = page.querySelector('#pack-name').value.trim();
                var description = page.querySelector('#pack-description').value.trim();
                
                if (!name) {
                    PhoneCore.notifications.send({ type: 'error', title: '请输入名称', icon: '❌', size: 'mini' });
                    return;
                }
                
                if (isNew) {
                    manager.createPack({ 
                        libraryId: libraryId, 
                        name: name, 
                        description: description 
                    }).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openStickerLibraryDetail(libraryId);
                    });
                } else {
                    pack.name = name;
                    pack.description = description;
                    pack.updatedAt = Date.now();
                    PhoneCore.db.put('sticker_packs', pack.toJSON()).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openStickerLibraryDetail(libraryId);
                    });
                }
            };
        }
        
        // 删除
        var deleteBtn = page.querySelector('#delete-pack-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此表情包？所有包含的表情都将被删除。')) {
                    manager.deletePack(packId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.openStickerLibraryDetail(libraryId);
                    });
                }
            };
        }
    };
    
    /* 【表情包详情】 */
    SystemConfigApp.prototype.openStickerPackDetail = function(libraryId, packId) {
        const self = this;
        const S = this.STYLES;
        const I = this.SVG;
        const manager = PhoneCore.stickerManager;
        const pack = manager.packs[packId];
        if (!pack) return;

        // 确保stickerIds是数组
        const stickerIds = Array.isArray(pack.stickerIds) ? pack.stickerIds : [];

        let html = `
        <div class="${S.pageWrap}">
            <div class="sys-detail-header">
                <div class="sys-detail-title">${pack.name}</div>
                <div class="sys-detail-type-badge">AI会读取此情绪名称来选择表情</div>
                ${pack.description ? `<div class="sys-detail-desc">${pack.description}</div>` : ''}
            </div>
            <div class="sys-detail-btns-row">
                <button id="edit-pack-btn" class="${S.secondaryButton} sys-detail-btn-flex">编辑信息</button>
                <button id="add-sticker-btn" class="${S.primaryButton} sys-btn-add-pack sys-detail-btn-flex">${I.plus} 添加表情</button>
            </div>
            <div class="sys-section-title">表情 (${stickerIds.length})</div>
            <div id="stickers-grid" class="sys-sticker-grid">
                ${stickerIds.length === 0 ? `<div class="${S.glassCard} sys-card-grid-empty">暂无表情，点击添加</div>` : ''}
            </div>
        </div>
        `;

        const page = this.openDetailPage(html);

        // 加载表情图片
        const grid = page.querySelector('#stickers-grid');
        stickerIds.forEach((stickerId) => {
            const sticker = manager.stickers[stickerId];
            if (!sticker) return;

            const stickerHtml = `
            <div class="sticker-item sys-sticker-item" data-sticker-id="${stickerId}">
                <img data-resource-id="${sticker.resourceId}" class="sys-sticker-img">
                ${sticker.name
                    ? `<div class="sticker-name-label sys-sticker-name-label">${sticker.name}</div>`
                    : `<div class="sticker-name-label sys-sticker-name-label sys-sticker-name-label--empty">点击命名</div>`
                }
                <button class="delete-sticker-btn sys-sticker-delete-btn">×</button>
            </div>
            `;

            grid.insertAdjacentHTML('beforeend', stickerHtml);

            // 加载图片
            if (sticker.resourceId) {
                PhoneCore.resources.get(sticker.resourceId).then((resource) => {
                    const img = grid.querySelector(`img[data-resource-id="${sticker.resourceId}"]`);
                    if (img && resource) {
                        img.src = resource.data;
                    }
                });
            }
        });

        // 绑定点击编辑名称事件
        grid.querySelectorAll('.sticker-item').forEach((item) => {
            item.onclick = (e) => {
                if (e.target.classList.contains('delete-sticker-btn')) return;

                const stickerId = item.getAttribute('data-sticker-id');
                const sticker = manager.stickers[stickerId];
                if (!sticker) return;

                const newName = prompt('请输入表情名称（AI可以读取此名称）：', sticker.name || '');
                if (newName !== null) {
                    sticker.name = newName.trim();
                    PhoneCore.db.put('stickers', sticker.toJSON()).then(() => {
                        // 刷新页面
                        self.openStickerPackDetail(libraryId, packId);
                    });
                }
            };
        });

        // 绑定删除事件
        grid.querySelectorAll('.delete-sticker-btn').forEach((btn) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const item = btn.closest('.sticker-item');
                const stickerId = item.getAttribute('data-sticker-id');

                if (confirm('确定删除此表情？')) {
                    manager.deleteSticker(stickerId).then(() => {
                        item.remove();
                    });
                }
            };
        });

        // 编辑包信息
        const editBtn = page.querySelector('#edit-pack-btn');
        editBtn?.addEventListener('click', () => {
            self.openStickerPackEditorV2(libraryId, packId);
        });

        // 添加表情
        const addStickerBtn = page.querySelector('#add-sticker-btn');
        addStickerBtn?.addEventListener('click', () => {
            PhoneCore.resources.createImageInput((resource) => {
                // 让用户输入表情名称
                const stickerName = prompt('请输入表情名称（可选，AI可以读取此名称）：', '');

                manager.createSticker({
                    packId: packId,
                    resourceId: resource.id,
                    name: stickerName ? stickerName.trim() : ''
                }).then(() => {
                    // 刷新页面
                    self.openStickerPackDetail(libraryId, packId);
                });
            });
        });
    };

    // 表情包编辑器
    SystemConfigApp.prototype.openStickerPackEditor = function(packId) {
        const self = this;

        PhoneCore.db.getAll('app_data').then((appDataList) => {
            let stickerData = appDataList.find(d => d.appId === 'sticker_packs') || { appId: 'sticker_packs', packs: [] };
            let pack = packId ? stickerData.packs.find(p => p.id === packId) : null;
            const isNew = !pack;

            if (isNew) {
                pack = {
                    id: 'pack_' + Date.now(),
                    name: '',
                    personality: '',
                    stickers: []
                };
            }

            const stickersHtml = pack.stickers?.length
                ? pack.stickers.map((sticker, index) => `
                    <div class="sticker-item sys-sticker-item-legacy" data-index="${index}">
                        <img src="${sticker.data}" class="sys-sticker-item-img">
                        <div class="sticker-delete sys-sticker-item-delete" data-index="${index}">×</div>
                        <div class="sys-sticker-item-name">${sticker.name || (index + 1)}</div>
                    </div>
                `).join('')
                : '';

            const html = `
            <div class="sys-sticker-editor-wrap">
                <div class="sys-sticker-editor-title">${isNew ? '新建表情包' : '编辑表情包'}</div>
                <div class="config-card sys-sticker-editor-card">
                    <div class="sys-sticker-editor-field">
                        <label class="sys-sticker-editor-label">分组名称（AI可见）</label>
                        <input type="text" id="pack-name" value="${pack.name}" placeholder="如：开心、难过、生气" class="sys-sticker-editor-input">
                    </div>
                    <div class="sys-sticker-editor-field">
                        <label class="sys-sticker-editor-label">适用人设（AI不可见）</label>
                        <input type="text" id="pack-personality" value="${pack.personality ?? ''}" placeholder="如：冷酷的人、活泼的人" class="sys-sticker-editor-input">
                    </div>
                </div>
                <div class="sys-sticker-list-header">
                    <span class="sys-sticker-list-title">表情列表</span>
                    <button id="add-sticker-btn" class="sys-sticker-add-btn">+ 添加表情</button>
                </div>
                <div id="stickers-grid" class="sys-sticker-grid-legacy">
                    ${stickersHtml}
                </div>
                ${!pack.stickers?.length ? `<div id="no-stickers-hint" class="sys-sticker-empty-hint">点击添加表情开始</div>` : ''}
                <button id="save-pack-btn" class="sys-sticker-save-btn">保存</button>
                ${!isNew ? `<button id="delete-pack-btn" class="sys-sticker-delete-pack-btn">删除此表情包</button>` : ''}
            </div>
            `;

            const page = self.openDetailPage(html);
            const currentStickers = pack.stickers ? pack.stickers.slice() : [];

            // 添加表情
            const addStickerBtn = page.querySelector('#add-sticker-btn');
            if (addStickerBtn) {
                addStickerBtn.onclick = () => {
                    PhoneCore.resources.createImageInput((resource) => {
                        const stickerName = prompt('请输入表情名称（可选，留空则使用序号）：', '');

                        currentStickers.push({
                            id: 'sticker_' + Date.now(),
                            name: stickerName || '',
                            data: resource.data
                        });

                        self.updateStickersGrid(page, currentStickers);
                    });
                };
            }

            // 删除表情
            self.bindStickerDeleteEvents(page, currentStickers);

            // 保存
            const saveBtn = page.querySelector('#save-pack-btn');
            if (saveBtn) {
                saveBtn.onclick = () => {
                    const name = page.querySelector('#pack-name').value.trim();
                    const personality = page.querySelector('#pack-personality').value.trim();

                    if (!name) {
                        alert('请输入分组名称');
                        return;
                    }

                    pack.name = name;
                    pack.personality = personality;
                    pack.stickers = currentStickers;

                    if (isNew) {
                        stickerData.packs.push(pack);
                    } else {
                        const index = stickerData.packs.findIndex(p => p.id === packId);
                        if (index !== -1) {
                            stickerData.packs[index] = pack;
                        }
                    }

                    PhoneCore.db.put('app_data', stickerData).then(() => {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功', size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                    });
                };
            }

            // 删除表情包
            const deleteBtn = page.querySelector('#delete-pack-btn');
            if (deleteBtn) {
                deleteBtn.onclick = () => {
                    if (confirm('确定删除此表情包？')) {
                        stickerData.packs = stickerData.packs.filter(p => p.id !== packId);
                        PhoneCore.db.put('app_data', stickerData).then(() => {
                            page.querySelector('.app-back-btn').click();
                        });
                    }
                };
            }
        });
    };

    SystemConfigApp.prototype.updateStickersGrid = function(page, stickers) {
        var grid = page.querySelector('#stickers-grid');
        var hint = page.querySelector('#no-stickers-hint');
        
        var html = '';
        stickers.forEach(function(sticker, index) {
            html += '<div class="sticker-item" data-index="' + index + '" style="position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#FFF0F5,#FFE4E1);box-shadow:0 2px 8px rgba(255,182,193,0.2);">';
            html += '<img src="' + sticker.data + '" style="width:100%;height:100%;object-fit:cover;">';
            html += '<div class="sticker-delete" data-index="' + index + '" style="position:absolute;top:4px;right:4px;width:22px;height:22px;background:rgba(255,59,48,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;cursor:pointer;box-shadow:0 2px 6px rgba(255,59,48,0.3);">×</div>';
            html += '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));color:white;font-size:11px;padding:12px 6px 6px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (sticker.name || (index + 1)) + '</div>';
            html += '</div>';
        });
        
        // 使用insertAdjacentHTML替代innerHTML
        while (grid.firstChild) {
            grid.removeChild(grid.firstChild);
        }
        grid.insertAdjacentHTML('afterbegin', html);
        
        if (hint) {
            hint.style.display = stickers.length > 0 ? 'none' : 'block';
        }
        
        this.bindStickerDeleteEvents(page, stickers);
    };

    SystemConfigApp.prototype.bindStickerDeleteEvents = function(page, stickers) {
        var self = this;
        page.querySelectorAll('.sticker-delete').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var index = parseInt(btn.getAttribute('data-index'));
                stickers.splice(index, 1);
                self.updateStickersGrid(page, stickers);
            };
        });
    };

    // ============ 头像库管理系统 ============
    
    /**
     * 初始化头像库数据结构
     */
    SystemConfigApp.prototype.initAvatarLibraryData = function() {
        if (!PhoneCore.data.avatarLibrary) {
            PhoneCore.data.avatarLibrary = {
                categories: [],  // 分类列表
                avatars: []      // 头像列表
            };
        }
        return PhoneCore.data.avatarLibrary;
    };
    
    /**
     * 打开头像库管理页面
     */
    SystemConfigApp.prototype.openAvatarLibrary = function() {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        
        this.initAvatarLibraryData();
        var data = PhoneCore.data.avatarLibrary;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">头像库</div>';
        html += '<button id="add-avatar-btn" class="' + S.primaryButton + ' sys-btn-flex-6 sys-btn-add">' + I.plus + ' 上传头像</button>';
        html += '</div>';
        
        html += '<div style="font-size:13px;color:#666;margin-bottom:24px;line-height:1.6;">';
        html += '管理AI可使用的头像资源，支持分类和命名<br>';
        html += '• AI可从头像库中选择头像到专属头像库';
        html += '</div>';
        
        // 分类管理
        html += '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">';
        html += '<button class="avatar-category-btn active" data-category="all" style="padding:8px 16px;border-radius:20px;border:none;background:#007AFF;color:white;font-size:13px;cursor:pointer;">全部</button>';
        
        data.categories.forEach(function(cat) {
            html += '<button class="avatar-category-btn" data-category="' + cat.id + '" style="padding:8px 16px;border-radius:20px;border:1px solid #ddd;background:white;color:#666;font-size:13px;cursor:pointer;">' + cat.name + '</button>';
        });
        
        html += '<button id="manage-avatar-categories-btn" style="padding:8px 16px;border-radius:20px;border:1px dashed #ccc;background:transparent;color:#999;font-size:13px;cursor:pointer;">' + I.plus + ' 管理分类</button>';
        html += '</div>';
        
        // 头像网格
        html += '<div id="avatar-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">';
        
        if (data.avatars.length === 0) {
            html += '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;">';
            html += '<div style="width:80px;height:80px;margin:0 auto 20px;background:linear-gradient(135deg,rgba(168,230,207,0.3),rgba(136,216,176,0.2));border-radius:50%;display:flex;align-items:center;justify-content:center;">';
            html += '<span style="color:#2D8B4E;transform:scale(1.5);">' + I.user + '</span>';
            html += '</div>';
            html += '<div style="color:#999;font-size:15px;">暂无头像，点击上传开始</div>';
            html += '</div>';
        } else {
            data.avatars.forEach(function(avatar, index) {
                html += '<div class="avatar-item" data-index="' + index + '" style="position:relative;aspect-ratio:1;border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
                html += '<img src="' + avatar.data + '" style="width:100%;height:100%;object-fit:cover;">';
                html += '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:8px 6px 6px;color:white;font-size:11px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (avatar.name || '未命名') + '</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 上传头像
        var addBtn = page.querySelector('#add-avatar-btn');
        if (addBtn) {
            addBtn.onclick = function() {
                self.openAvatarUploader();
            };
        }
        
        // 分类筛选
        page.querySelectorAll('.avatar-category-btn').forEach(function(btn) {
            btn.onclick = function() {
                page.querySelectorAll('.avatar-category-btn').forEach(function(b) {
                    b.style.background = 'white';
                    b.style.color = '#666';
                    b.style.border = '1px solid #ddd';
                    b.classList.remove('active');
                });
                btn.style.background = '#007AFF';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.classList.add('active');
                
                var category = btn.getAttribute('data-category');
                self.filterAvatarGrid(page, category);
            };
        });
        
        // 管理分类
        var manageCatBtn = page.querySelector('#manage-avatar-categories-btn');
        if (manageCatBtn) {
            manageCatBtn.onclick = function() {
                self.openAvatarCategoryManager();
            };
        }
        
        // 头像点击编辑
        page.querySelectorAll('.avatar-item').forEach(function(item) {
            item.onclick = function() {
                var index = parseInt(item.getAttribute('data-index'));
                self.openAvatarEditor(index);
            };
        });
    };
    
    /**
     * 筛选头像网格
     */
    SystemConfigApp.prototype.filterAvatarGrid = function(page, category) {
        var data = PhoneCore.data.avatarLibrary;
        var grid = page.querySelector('#avatar-grid');
        var I = this.SVG;
        
        var filteredAvatars = category === 'all' ? data.avatars : data.avatars.filter(function(a) {
            return a.categoryId === category;
        });
        
        if (filteredAvatars.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">该分类下暂无头像</div>';
        } else {
            var html = '';
            filteredAvatars.forEach(function(avatar) {
                var originalIndex = data.avatars.indexOf(avatar);
                html += '<div class="avatar-item" data-index="' + originalIndex + '" style="position:relative;aspect-ratio:1;border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
                html += '<img src="' + avatar.data + '" style="width:100%;height:100%;object-fit:cover;">';
                html += '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:8px 6px 6px;color:white;font-size:11px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (avatar.name || '未命名') + '</div>';
                html += '</div>';
            });
            grid.innerHTML = html;
            
            var self = this;
            grid.querySelectorAll('.avatar-item').forEach(function(item) {
                item.onclick = function() {
                    var index = parseInt(item.getAttribute('data-index'));
                    self.openAvatarEditor(index);
                };
            });
        }
    };
    
    /**
     * 打开头像上传器
     */
    SystemConfigApp.prototype.openAvatarUploader = function() {
        var self = this;
        var S = this.STYLES;
        var data = PhoneCore.data.avatarLibrary;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">上传头像</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        // 预览区域
        html += '<div style="margin-bottom:20px;">';
        html += '<div id="avatar-preview" style="width:120px;height:120px;margin:0 auto;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;overflow:hidden;border:3px solid #e0e0e0;">';
        html += '<span style="color:#ccc;font-size:14px;">点击选择</span>';
        html += '</div>';
        html += '<input type="file" id="avatar-file-input" accept="image/*" style="display:none;">';
        html += '</div>';
        
        // 名称
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">头像名称</label>';
        html += '<input type="text" id="avatar-name" placeholder="给头像起个名字..." class="' + S.input + '">';
        html += '</div>';
        
        // 分类选择
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">选择分类</label>';
        html += '<select id="avatar-category" class="' + S.input + '">';
        html += '<option value="">未分类</option>';
        data.categories.forEach(function(cat) {
            html += '<option value="' + cat.id + '">' + cat.name + '</option>';
        });
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        
        html += '<button id="save-avatar-btn" class="' + S.primaryButton + ' sys-btn-full" disabled>保存头像</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        var preview = page.querySelector('#avatar-preview');
        var fileInput = page.querySelector('#avatar-file-input');
        var saveBtn = page.querySelector('#save-avatar-btn');
        var avatarData = null;
        
        preview.onclick = function() {
            fileInput.click();
        };
        
        fileInput.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            
            var reader = new FileReader();
            reader.onload = function(ev) {
                avatarData = ev.target.result;
                preview.innerHTML = '<img src="' + avatarData + '" style="width:100%;height:100%;object-fit:cover;">';
                saveBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        };
        
        saveBtn.onclick = function() {
            if (!avatarData) return;
            
            var name = page.querySelector('#avatar-name').value.trim();
            var categoryId = page.querySelector('#avatar-category').value;
            
            var newAvatar = {
                id: 'avatar_' + Date.now(),
                name: name || '未命名头像',
                data: avatarData,
                categoryId: categoryId,
                createdAt: Date.now()
            };
            
            data.avatars.push(newAvatar);
            PhoneCore.save && PhoneCore.save();
            
            PhoneCore.notifications.send({ type: 'success', title: '头像已保存', size: 'mini' });
            page.querySelector('.app-back-btn').click();
            self.openAvatarLibrary();
        };
    };
    
    /**
     * 打开头像编辑器
     */
    SystemConfigApp.prototype.openAvatarEditor = function(index) {
        var self = this;
        var S = this.STYLES;
        var data = PhoneCore.data.avatarLibrary;
        var avatar = data.avatars[index];
        if (!avatar) return;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">编辑头像</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        // 预览
        html += '<div style="width:120px;height:120px;margin:0 auto 20px;border-radius:50%;overflow:hidden;border:3px solid #e0e0e0;">';
        html += '<img src="' + avatar.data + '" style="width:100%;height:100%;object-fit:cover;">';
        html += '</div>';
        
        // 名称
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">头像名称</label>';
        html += '<input type="text" id="avatar-name" value="' + (avatar.name || '') + '" placeholder="给头像起个名字..." class="' + S.input + '">';
        html += '</div>';
        
        // 分类选择
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">选择分类</label>';
        html += '<select id="avatar-category" class="' + S.input + '">';
        html += '<option value="">未分类</option>';
        data.categories.forEach(function(cat) {
            var selected = avatar.categoryId === cat.id ? ' selected' : '';
            html += '<option value="' + cat.id + '"' + selected + '>' + cat.name + '</option>';
        });
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        
        html += '<button id="save-avatar-btn" class="' + S.primaryButton + ' sys-btn-full">保存修改</button>';
        html += '<button id="delete-avatar-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:14px;font-size:15px;font-weight:500;cursor:pointer;margin-top:12px;">删除头像</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 保存
        var saveBtn = page.querySelector('#save-avatar-btn');
        saveBtn.onclick = function() {
            avatar.name = page.querySelector('#avatar-name').value.trim() || '未命名头像';
            avatar.categoryId = page.querySelector('#avatar-category').value;
            PhoneCore.save && PhoneCore.save();
            
            PhoneCore.notifications.send({ type: 'success', title: '已保存', size: 'mini' });
            page.querySelector('.app-back-btn').click();
            self.openAvatarLibrary();
        };
        
        // 删除
        var deleteBtn = page.querySelector('#delete-avatar-btn');
        deleteBtn.onclick = function() {
            if (confirm('确定删除此头像？')) {
                data.avatars.splice(index, 1);
                PhoneCore.save && PhoneCore.save();
                
                PhoneCore.notifications.send({ type: 'success', title: '已删除', size: 'mini' });
                page.querySelector('.app-back-btn').click();
                self.openAvatarLibrary();
            }
        };
    };
    
    /**
     * 打开头像分类管理器
     */
    SystemConfigApp.prototype.openAvatarCategoryManager = function() {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var data = PhoneCore.data.avatarLibrary;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">分类管理</div>';
        html += '<button id="add-category-btn" class="' + S.primaryButton + ' sys-btn-add">' + I.plus + ' 新建</button>';
        html += '</div>';
        
        html += '<div id="category-list">';
        if (data.categories.length === 0) {
            html += '<div style="text-align:center;padding:40px;color:#999;">暂无分类</div>';
        } else {
            data.categories.forEach(function(cat, index) {
                html += '<div class="category-item ' + S.glassCard + ' sys-category-item">';
                html += '<span style="font-weight:500;">' + cat.name + '</span>';
                html += '<button class="delete-category-btn" data-index="' + index + '" style="padding:6px 12px;background:#FF3B30;color:white;border:none;border-radius:8px;font-size:12px;cursor:pointer;">删除</button>';
                html += '</div>';
            });
        }
        html += '</div>';
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 新建分类
        var addBtn = page.querySelector('#add-category-btn');
        addBtn.onclick = function() {
            var name = prompt('请输入分类名称：');
            if (name && name.trim()) {
                data.categories.push({
                    id: 'cat_' + Date.now(),
                    name: name.trim()
                });
                PhoneCore.save && PhoneCore.save();
                self.openAvatarCategoryManager();
            }
        };
        
        // 删除分类
        page.querySelectorAll('.delete-category-btn').forEach(function(btn) {
            btn.onclick = function() {
                var index = parseInt(btn.getAttribute('data-index'));
                if (confirm('确定删除此分类？分类下的头像将变为未分类。')) {
                    var catId = data.categories[index].id;
                    data.categories.splice(index, 1);
                    // 清除该分类下头像的分类ID
                    data.avatars.forEach(function(avatar) {
                        if (avatar.categoryId === catId) {
                            avatar.categoryId = '';
                        }
                    });
                    PhoneCore.save && PhoneCore.save();
                    self.openAvatarCategoryManager();
                }
            };
        });
    };
    
    // ============ 背景库管理系统 ============
    
    /**
     * 初始化背景库数据结构
     */
    SystemConfigApp.prototype.initBackgroundLibraryData = function() {
        if (!PhoneCore.data.backgroundLibrary) {
            PhoneCore.data.backgroundLibrary = {
                categories: [],  // 分类列表
                backgrounds: []  // 背景列表
            };
        }
        return PhoneCore.data.backgroundLibrary;
    };
    
    /**
     * 打开背景库管理页面
     */
    SystemConfigApp.prototype.openBackgroundLibrary = function() {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        
        this.initBackgroundLibraryData();
        var data = PhoneCore.data.backgroundLibrary;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">背景库</div>';
        html += '<button id="add-bg-btn" class="' + S.primaryButton + ' sys-btn-flex-6 sys-btn-add">' + I.plus + ' 上传背景</button>';
        html += '</div>';
        
        html += '<div style="font-size:13px;color:#666;margin-bottom:24px;line-height:1.6;">';
        html += '管理AI可使用的背景图片资源<br>';
        html += '• 用于AI社交账号主页背景等场景';
        html += '</div>';
        
        // 分类管理
        html += '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">';
        html += '<button class="bg-category-btn active" data-category="all" style="padding:8px 16px;border-radius:20px;border:none;background:#7C3AED;color:white;font-size:13px;cursor:pointer;">全部</button>';
        
        data.categories.forEach(function(cat) {
            html += '<button class="bg-category-btn" data-category="' + cat.id + '" style="padding:8px 16px;border-radius:20px;border:1px solid #ddd;background:white;color:#666;font-size:13px;cursor:pointer;">' + cat.name + '</button>';
        });
        
        html += '<button id="manage-bg-categories-btn" style="padding:8px 16px;border-radius:20px;border:1px dashed #ccc;background:transparent;color:#999;font-size:13px;cursor:pointer;">' + I.plus + ' 管理分类</button>';
        html += '</div>';
        
        // 背景网格
        html += '<div id="bg-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">';
        
        if (data.backgrounds.length === 0) {
            html += '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;">';
            html += '<div style="width:80px;height:80px;margin:0 auto 20px;background:linear-gradient(135deg,rgba(221,214,254,0.3),rgba(196,181,253,0.2));border-radius:50%;display:flex;align-items:center;justify-content:center;">';
            html += '<span style="color:#7C3AED;transform:scale(1.5);">' + I.image + '</span>';
            html += '</div>';
            html += '<div style="color:#999;font-size:15px;">暂无背景，点击上传开始</div>';
            html += '</div>';
        } else {
            data.backgrounds.forEach(function(bg, index) {
                html += '<div class="bg-item" data-index="' + index + '" style="position:relative;aspect-ratio:16/9;border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
                html += '<img src="' + bg.data + '" style="width:100%;height:100%;object-fit:cover;">';
                html += '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:12px 10px 8px;color:white;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (bg.name || '未命名') + '</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 上传背景
        var addBtn = page.querySelector('#add-bg-btn');
        if (addBtn) {
            addBtn.onclick = function() {
                self.openBackgroundUploader();
            };
        }
        
        // 分类筛选
        page.querySelectorAll('.bg-category-btn').forEach(function(btn) {
            btn.onclick = function() {
                page.querySelectorAll('.bg-category-btn').forEach(function(b) {
                    b.style.background = 'white';
                    b.style.color = '#666';
                    b.style.border = '1px solid #ddd';
                    b.classList.remove('active');
                });
                btn.style.background = '#7C3AED';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.classList.add('active');
                
                var category = btn.getAttribute('data-category');
                self.filterBackgroundGrid(page, category);
            };
        });
        
        // 管理分类
        var manageCatBtn = page.querySelector('#manage-bg-categories-btn');
        if (manageCatBtn) {
            manageCatBtn.onclick = function() {
                self.openBackgroundCategoryManager();
            };
        }
        
        // 背景点击编辑
        page.querySelectorAll('.bg-item').forEach(function(item) {
            item.onclick = function() {
                var index = parseInt(item.getAttribute('data-index'));
                self.openBackgroundEditor(index);
            };
        });
    };
    
    /**
     * 筛选背景网格
     */
    SystemConfigApp.prototype.filterBackgroundGrid = function(page, category) {
        var self = this;
        var data = PhoneCore.data.backgroundLibrary;
        var grid = page.querySelector('#bg-grid');
        
        var filteredBgs = category === 'all' ? data.backgrounds : data.backgrounds.filter(function(bg) {
            return bg.categoryId === category;
        });
        
        if (filteredBgs.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">该分类下暂无背景</div>';
        } else {
            var html = '';
            filteredBgs.forEach(function(bg) {
                var originalIndex = data.backgrounds.indexOf(bg);
                html += '<div class="bg-item" data-index="' + originalIndex + '" style="position:relative;aspect-ratio:16/9;border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
                html += '<img src="' + bg.data + '" style="width:100%;height:100%;object-fit:cover;">';
                html += '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:12px 10px 8px;color:white;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (bg.name || '未命名') + '</div>';
                html += '</div>';
            });
            grid.innerHTML = html;
            
            grid.querySelectorAll('.bg-item').forEach(function(item) {
                item.onclick = function() {
                    var index = parseInt(item.getAttribute('data-index'));
                    self.openBackgroundEditor(index);
                };
            });
        }
    };
    
    /**
     * 打开背景上传器
     */
    SystemConfigApp.prototype.openBackgroundUploader = function() {
        var self = this;
        var S = this.STYLES;
        var data = PhoneCore.data.backgroundLibrary;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">上传背景</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        // 预览区域
        html += '<div style="margin-bottom:20px;">';
        html += '<div id="bg-preview" style="width:100%;aspect-ratio:16/9;border-radius:12px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px dashed #ddd;cursor:pointer;">';
        html += '<span style="color:#999;font-size:14px;">点击选择背景图片</span>';
        html += '</div>';
        html += '<input type="file" id="bg-file-input" accept="image/*" style="display:none;">';
        html += '</div>';
        
        // 名称
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">背景名称</label>';
        html += '<input type="text" id="bg-name" placeholder="给背景起个名字..." class="' + S.input + '">';
        html += '</div>';
        
        // 分类选择
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">选择分类</label>';
        html += '<select id="bg-category" class="' + S.input + '">';
        html += '<option value="">未分类</option>';
        data.categories.forEach(function(cat) {
            html += '<option value="' + cat.id + '">' + cat.name + '</option>';
        });
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        
        html += '<button id="save-bg-btn" class="' + S.primaryButton + ' sys-btn-full" disabled>保存背景</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        var preview = page.querySelector('#bg-preview');
        var fileInput = page.querySelector('#bg-file-input');
        var saveBtn = page.querySelector('#save-bg-btn');
        var bgData = null;
        
        preview.onclick = function() {
            fileInput.click();
        };
        
        fileInput.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            
            var reader = new FileReader();
            reader.onload = function(ev) {
                bgData = ev.target.result;
                preview.innerHTML = '<img src="' + bgData + '" style="width:100%;height:100%;object-fit:cover;">';
                preview.style.border = 'none';
                saveBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        };
        
        saveBtn.onclick = function() {
            if (!bgData) return;
            
            var name = page.querySelector('#bg-name').value.trim();
            var categoryId = page.querySelector('#bg-category').value;
            
            var newBg = {
                id: 'bg_' + Date.now(),
                name: name || '未命名背景',
                data: bgData,
                categoryId: categoryId,
                createdAt: Date.now()
            };
            
            data.backgrounds.push(newBg);
            PhoneCore.save && PhoneCore.save();
            
            PhoneCore.notifications.send({ type: 'success', title: '背景已保存', size: 'mini' });
            page.querySelector('.app-back-btn').click();
            self.openBackgroundLibrary();
        };
    };
    
    /**
     * 打开背景编辑器
     */
    SystemConfigApp.prototype.openBackgroundEditor = function(index) {
        var self = this;
        var S = this.STYLES;
        var data = PhoneCore.data.backgroundLibrary;
        var bg = data.backgrounds[index];
        if (!bg) return;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">编辑背景</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        // 预览
        html += '<div style="width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden;margin-bottom:20px;">';
        html += '<img src="' + bg.data + '" style="width:100%;height:100%;object-fit:cover;">';
        html += '</div>';
        
        // 名称
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">背景名称</label>';
        html += '<input type="text" id="bg-name" value="' + (bg.name || '') + '" placeholder="给背景起个名字..." class="' + S.input + '">';
        html += '</div>';
        
        // 分类选择
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">选择分类</label>';
        html += '<select id="bg-category" class="' + S.input + '">';
        html += '<option value="">未分类</option>';
        data.categories.forEach(function(cat) {
            var selected = bg.categoryId === cat.id ? ' selected' : '';
            html += '<option value="' + cat.id + '"' + selected + '>' + cat.name + '</option>';
        });
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        
        html += '<button id="save-bg-btn" class="' + S.primaryButton + ' sys-btn-full">保存修改</button>';
        html += '<button id="delete-bg-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:14px;font-size:15px;font-weight:500;cursor:pointer;margin-top:12px;">删除背景</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 保存
        var saveBtn = page.querySelector('#save-bg-btn');
        saveBtn.onclick = function() {
            bg.name = page.querySelector('#bg-name').value.trim() || '未命名背景';
            bg.categoryId = page.querySelector('#bg-category').value;
            PhoneCore.save && PhoneCore.save();
            
            PhoneCore.notifications.send({ type: 'success', title: '已保存', size: 'mini' });
            page.querySelector('.app-back-btn').click();
            self.openBackgroundLibrary();
        };
        
        // 删除
        var deleteBtn = page.querySelector('#delete-bg-btn');
        deleteBtn.onclick = function() {
            if (confirm('确定删除此背景？')) {
                data.backgrounds.splice(index, 1);
                PhoneCore.save && PhoneCore.save();
                
                PhoneCore.notifications.send({ type: 'success', title: '已删除', size: 'mini' });
                page.querySelector('.app-back-btn').click();
                self.openBackgroundLibrary();
            }
        };
    };
    
    /**
     * 打开背景分类管理器
     */
    SystemConfigApp.prototype.openBackgroundCategoryManager = function() {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var data = PhoneCore.data.backgroundLibrary;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">分类管理</div>';
        html += '<button id="add-category-btn" class="' + S.primaryButton + ' sys-btn-add">' + I.plus + ' 新建</button>';
        html += '</div>';
        
        html += '<div id="category-list">';
        if (data.categories.length === 0) {
            html += '<div style="text-align:center;padding:40px;color:#999;">暂无分类</div>';
        } else {
            data.categories.forEach(function(cat, index) {
                html += '<div class="category-item ' + S.glassCard + ' sys-category-item">';
                html += '<span style="font-weight:500;">' + cat.name + '</span>';
                html += '<button class="delete-category-btn" data-index="' + index + '" style="padding:6px 12px;background:#FF3B30;color:white;border:none;border-radius:8px;font-size:12px;cursor:pointer;">删除</button>';
                html += '</div>';
            });
        }
        html += '</div>';
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 新建分类
        var addBtn = page.querySelector('#add-category-btn');
        addBtn.onclick = function() {
            var name = prompt('请输入分类名称：');
            if (name && name.trim()) {
                data.categories.push({
                    id: 'bgcat_' + Date.now(),
                    name: name.trim()
                });
                PhoneCore.save && PhoneCore.save();
                self.openBackgroundCategoryManager();
            }
        };
        
        // 删除分类
        page.querySelectorAll('.delete-category-btn').forEach(function(btn) {
            btn.onclick = function() {
                var index = parseInt(btn.getAttribute('data-index'));
                if (confirm('确定删除此分类？分类下的背景将变为未分类。')) {
                    var catId = data.categories[index].id;
                    data.categories.splice(index, 1);
                    // 清除该分类下背景的分类ID
                    data.backgrounds.forEach(function(bg) {
                        if (bg.categoryId === catId) {
                            bg.categoryId = '';
                        }
                    });
                    PhoneCore.save && PhoneCore.save();
                    self.openBackgroundCategoryManager();
                }
            };
        });
    };

    // ============ AI专属资源库管理（头像库+背景库）============
    
    /**
     * 打开AI专属资源库管理页面（整合头像库和背景库）
     * @param {string} aiId - AI的ID
     */
    SystemConfigApp.prototype.openExclusiveAvatarManager = function(aiId) {
        this.openAIResourceManager(aiId, 'avatar');
    };
    
    /**
     * 打开AI专属背景库管理页面
     * @param {string} aiId - AI的ID
     */
    SystemConfigApp.prototype.openExclusiveBackgroundManager = function(aiId) {
        this.openAIResourceManager(aiId, 'background');
    };
    
    /**
     * 通用AI资源库管理页面
     * @param {string} aiId - AI的ID
     * @param {string} resourceType - 资源类型: 'avatar' 或 'background'
     */
    SystemConfigApp.prototype.openAIResourceManager = function(aiId, resourceType) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var isAvatar = resourceType === 'avatar';
        var resourceLabel = isAvatar ? '头像' : '背景';
        var exclusiveKey = isAvatar ? 'exclusiveAvatars' : 'exclusiveBackgrounds';
        
        // 初始化专属资源数组
        if (!ai[exclusiveKey]) {
            ai[exclusiveKey] = [];
        }
        
        // 初始化总库
        if (isAvatar) {
            this.initAvatarLibraryData();
        } else {
            this.initBackgroundLibraryData();
        }
        
        var libraryData = isAvatar ? PhoneCore.data.avatarLibrary : PhoneCore.data.backgroundLibrary;
        var allResources = isAvatar ? (libraryData.avatars || []) : (libraryData.backgrounds || []);
        var categories = libraryData.categories || [];
        
        var html = '<div class="' + S.pageWrap + '">';
        
        // 标题和切换Tab
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">' + ai.name + ' 的专属库</div>';
        html += '</div>';
        
        // Tab切换：头像库 / 背景库
        html += '<div style="display:flex;gap:8px;margin-bottom:20px;">';
        html += '<button class="resource-tab-btn' + (isAvatar ? ' active' : '') + '" data-type="avatar" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid ' + (isAvatar ? '#FF6B8A' : '#e0e0e0') + ';background:' + (isAvatar ? 'rgba(255,107,138,0.1)' : '#fafafa') + ';font-size:14px;font-weight:500;cursor:pointer;color:' + (isAvatar ? '#FF6B8A' : '#666') + ';">头像库</button>';
        html += '<button class="resource-tab-btn' + (!isAvatar ? ' active' : '') + '" data-type="background" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid ' + (!isAvatar ? '#4ECDC4' : '#e0e0e0') + ';background:' + (!isAvatar ? 'rgba(78,205,196,0.1)' : '#fafafa') + ';font-size:14px;font-weight:500;cursor:pointer;color:' + (!isAvatar ? '#4ECDC4' : '#666') + ';">背景库</button>';
        html += '</div>';
        
        // 当前专属资源
        html += '<div style="margin-bottom:24px;">';
        html += '<div style="font-size:15px;font-weight:600;color:#333;margin-bottom:12px;">已选' + resourceLabel + ' (' + ai[exclusiveKey].length + ')</div>';
        
        if (ai[exclusiveKey].length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty-padded">暂未选择' + resourceLabel + '</div>';
        } else {
            html += '<div style="display:grid;grid-template-columns:repeat(' + (isAvatar ? '4' : '3') + ',1fr);gap:10px;">';
            ai[exclusiveKey].forEach(function(resourceId, index) {
                var resource = allResources.find(function(r) { return r.id === resourceId; });
                if (resource) {
                    html += '<div class="exclusive-resource-item" data-index="' + index + '" style="position:relative;aspect-ratio:' + (isAvatar ? '1' : '16/9') + ';border-radius:12px;overflow:hidden;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.1);">';
                    html += '<img src="' + resource.data + '" style="width:100%;height:100%;object-fit:cover;">';
                    html += '<div style="position:absolute;top:4px;right:4px;width:20px;height:20px;background:rgba(255,59,48,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;">×</div>';
                    html += '</div>';
                }
            });
            html += '</div>';
        }
        html += '</div>';
        
        // 分类筛选
        html += '<div style="margin-bottom:16px;">';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
        html += '<button class="resource-category-btn active" data-category="all" style="padding:6px 14px;border-radius:16px;border:none;background:' + (isAvatar ? '#FF6B8A' : '#4ECDC4') + ';color:white;font-size:12px;cursor:pointer;">全部</button>';
        categories.forEach(function(cat) {
            html += '<button class="resource-category-btn" data-category="' + cat.id + '" style="padding:6px 14px;border-radius:16px;border:1px solid #ddd;background:white;color:#666;font-size:12px;cursor:pointer;">' + cat.name + '</button>';
        });
        html += '</div>';
        html += '</div>';
        
        // 总库（可选择）
        html += '<div>';
        html += '<div style="font-size:15px;font-weight:600;color:#333;margin-bottom:12px;">从' + resourceLabel + '库选择</div>';
        
        if (allResources.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty-padded">';
            html += resourceLabel + '库为空，请先在世界观-' + resourceLabel + '库中上传' + resourceLabel;
            html += '</div>';
        } else {
            html += '<div id="resource-grid" style="display:grid;grid-template-columns:repeat(' + (isAvatar ? '4' : '3') + ',1fr);gap:10px;">';
            allResources.forEach(function(resource) {
                var isSelected = ai[exclusiveKey].indexOf(resource.id) !== -1;
                html += '<div class="library-resource-item" data-resource-id="' + resource.id + '" data-category="' + (resource.categoryId || '') + '" style="position:relative;aspect-ratio:' + (isAvatar ? '1' : '16/9') + ';border-radius:12px;overflow:hidden;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.1);' + (isSelected ? 'opacity:0.5;' : '') + '">';
                html += '<img src="' + resource.data + '" style="width:100%;height:100%;object-fit:cover;">';
                if (isSelected) {
                    html += '<div style="position:absolute;inset:0;background:rgba(45,139,78,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:20px;">✓</div>';
                }
                html += '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));padding:6px 4px 4px;color:white;font-size:10px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (resource.name || '未命名') + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }
        html += '</div>';
        
        // AI智能选择区域
        html += '<div style="margin-top:24px;padding:16px;background:rgba(255,255,255,0.7);backdrop-filter:blur(10px);border-radius:16px;border:1px solid rgba(255,182,193,0.3);">';
        html += '<div style="font-size:14px;font-weight:600;color:#FF6B8A;margin-bottom:14px;display:flex;align-items:center;gap:8px;">';
        html += '<span style="width:28px;height:28px;background:linear-gradient(135deg,#FFE4EC,#FFD0DC);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#FF6B8A;">' + I.robot + '</span>';
        html += '<span>AI智能选择</span>';
        html += '</div>';
        
        // 选项行（分类+API横向排列）
        html += '<div style="display:flex;gap:10px;margin-bottom:14px;">';
        
        // 分类选择
        html += '<div style="flex:1;">';
        html += '<label style="font-size:11px;color:#888;display:block;margin-bottom:5px;">分类</label>';
        html += '<select id="ai-select-category" style="width:100%;padding:9px 10px;border:1px solid rgba(255,182,193,0.4);border-radius:10px;font-size:12px;background:#fff;color:#333;outline:none;">';
        html += '<option value="all">全部</option>';
        categories.forEach(function(cat) {
            html += '<option value="' + cat.id + '">' + cat.name + '</option>';
        });
        html += '</select>';
        html += '</div>';
        
        // API选择
        html += '<div style="flex:1;">';
        html += '<label style="font-size:11px;color:#888;display:block;margin-bottom:5px;">API</label>';
        html += '<select id="ai-select-api" style="width:100%;padding:9px 10px;border:1px solid rgba(255,182,193,0.4);border-radius:10px;font-size:12px;background:#fff;color:#333;outline:none;">';
        html += '<option value="">默认</option>';
        var apiConfigs = PhoneCore.api ? Object.values(PhoneCore.api.configs || {}) : [];
        apiConfigs.forEach(function(config) {
            html += '<option value="' + config.id + '">' + config.name + '</option>';
        });
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        
        // AI自动选择按钮
        html += '<button id="ai-auto-select-btn" style="width:100%;padding:11px 16px;background:#FF6B8A;color:white;border:none;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">';
        html += I.robot + ' 让AI选择喜欢的' + resourceLabel;
        html += '</button>';
        html += '<div style="font-size:10px;color:#aaa;text-align:center;margin-top:6px;">根据AI性格智能选择</div>';
        html += '</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // Tab切换事件
        page.querySelectorAll('.resource-tab-btn').forEach(function(btn) {
            btn.onclick = function() {
                var type = btn.getAttribute('data-type');
                self.openAIResourceManager(aiId, type);
            };
        });
        
        // 分类筛选事件
        page.querySelectorAll('.resource-category-btn').forEach(function(btn) {
            btn.onclick = function() {
                page.querySelectorAll('.resource-category-btn').forEach(function(b) {
                    b.style.background = 'white';
                    b.style.color = '#666';
                    b.style.border = '1px solid #ddd';
                    b.classList.remove('active');
                });
                btn.style.background = isAvatar ? '#FF6B8A' : '#4ECDC4';
                btn.style.color = 'white';
                btn.style.border = 'none';
                btn.classList.add('active');
                
                var category = btn.getAttribute('data-category');
                self.filterResourceGrid(page, category, ai[exclusiveKey]);
            };
        });
        
        // 移除已选资源
        page.querySelectorAll('.exclusive-resource-item').forEach(function(item) {
            item.onclick = function() {
                var index = parseInt(item.getAttribute('data-index'));
                if (confirm('确定移除此' + resourceLabel + '？')) {
                    ai[exclusiveKey].splice(index, 1);
                    PhoneCore.saveAI(ai);
                    self.openAIResourceManager(aiId, resourceType);
                }
            };
        });
        
        // 从库中选择资源
        page.querySelectorAll('.library-resource-item').forEach(function(item) {
            item.onclick = function() {
                var resourceId = item.getAttribute('data-resource-id');
                var existingIndex = ai[exclusiveKey].indexOf(resourceId);
                
                if (existingIndex !== -1) {
                    ai[exclusiveKey].splice(existingIndex, 1);
                } else {
                    ai[exclusiveKey].push(resourceId);
                }
                
                PhoneCore.saveAI(ai);
                self.openAIResourceManager(aiId, resourceType);
            };
        });
        
        // AI自动选择
        var autoSelectBtn = page.querySelector('#ai-auto-select-btn');
        if (autoSelectBtn) {
            autoSelectBtn.onclick = function() {
                var selectedCategory = page.querySelector('#ai-select-category').value;
                var selectedApiId = page.querySelector('#ai-select-api').value;
                self.triggerAIResourceSelection(aiId, resourceType, selectedCategory, selectedApiId, page);
            };
        }
    };
    
    /**
     * 筛选资源网格
     */
    SystemConfigApp.prototype.filterResourceGrid = function(page, category, selectedIds) {
        page.querySelectorAll('.library-resource-item').forEach(function(item) {
            var itemCategory = item.getAttribute('data-category');
            if (category === 'all' || itemCategory === category) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    };
    
    /**
     * 触发AI自动选择资源（通用函数，支持头像和背景）
     * @param {string} aiId - AI的ID
     * @param {string} resourceType - 资源类型: 'avatar' 或 'background'
     * @param {string} categoryId - 分类ID，'all'表示全部
     * @param {string} apiConfigId - API配置ID，空则使用AI默认API
     * @param {Element} page - 当前页面元素
     */
    SystemConfigApp.prototype.triggerAIResourceSelection = function(aiId, resourceType, categoryId, apiConfigId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var isAvatar = resourceType === 'avatar';
        var resourceLabel = isAvatar ? '头像' : '背景';
        var exclusiveKey = isAvatar ? 'exclusiveAvatars' : 'exclusiveBackgrounds';
        
        var libraryData = isAvatar ? PhoneCore.data.avatarLibrary : PhoneCore.data.backgroundLibrary;
        var allResources = isAvatar ? (libraryData.avatars || []) : (libraryData.backgrounds || []);
        
        // 根据分类筛选资源
        var filteredResources = categoryId === 'all' ? allResources : allResources.filter(function(r) {
            return r.categoryId === categoryId;
        });
        
        if (filteredResources.length === 0) {
            PhoneCore.notifications.send({ type: 'error', title: '该分类下没有' + resourceLabel, size: 'mini' });
            return;
        }
        
        var btn = page.querySelector('#ai-auto-select-btn');
        btn.disabled = true;
        btn.innerHTML = '<span style="animation:spin 1s linear infinite;">⏳</span> AI正在选择中...';
        btn.style.opacity = '0.7';
        
        // 构建资源描述列表
        var resourceDescriptions = filteredResources.map(function(resource, index) {
            return (index + 1) + '. ' + (resource.name || '未命名' + resourceLabel);
        }).join('\n');
        
        var categoryName = '全部';
        if (categoryId !== 'all') {
            var cat = (libraryData.categories || []).find(function(c) { return c.id === categoryId; });
            if (cat) categoryName = cat.name;
        }
        
        var prompt = '你是' + ai.name + '，性格特点：' + (ai.personality || '普通') + '\n\n' +
            '以下是【' + categoryName + '】分类中可选的' + resourceLabel + '列表：\n' + resourceDescriptions + '\n\n' +
            '请根据你的性格喜好，选择3-5个你最喜欢的' + resourceLabel + '。\n' +
            '只需要回复你选择的' + resourceLabel + '编号，用逗号分隔，例如：1,3,5';
        
        // 构建API调用选项
        var apiOptions = { aiId: aiId };
        if (apiConfigId && apiConfigId !== '') {
            apiOptions.apiConfigId = apiConfigId;
        }
        
        // 调用API
        PhoneCore.api.call(prompt, apiOptions).then(function(response) {
            // 解析AI的选择
            var selectedIndices = [];
            var matches = response.match(/\d+/g);
            if (matches) {
                matches.forEach(function(m) {
                    var index = parseInt(m) - 1;
                    if (index >= 0 && index < filteredResources.length) {
                        selectedIndices.push(index);
                    }
                });
            }
            
            if (selectedIndices.length > 0) {
                // 追加到AI的专属库（而不是替换）
                var newIds = selectedIndices.map(function(i) {
                    return filteredResources[i].id;
                });
                
                // 去重合并
                newIds.forEach(function(id) {
                    if (ai[exclusiveKey].indexOf(id) === -1) {
                        ai[exclusiveKey].push(id);
                    }
                });
                
                PhoneCore.saveAI(ai);
                
                PhoneCore.notifications.send({ 
                    type: 'success', 
                    title: ai.name + '选择了' + selectedIndices.length + '个' + resourceLabel, 
                    size: 'mini' 
                });
                
                self.openAIResourceManager(aiId, resourceType);
            } else {
                PhoneCore.notifications.send({ type: 'error', title: 'AI选择失败，请重试', size: 'mini' });
                btn.disabled = false;
                btn.innerHTML = '<span>' + self.SVG.robot + '</span> 让AI自己选择喜欢的' + resourceLabel;
                btn.style.opacity = '1';
            }
        }).catch(function(err) {
            console.error('[AI选择' + resourceLabel + '] 失败:', err);
            PhoneCore.notifications.send({ type: 'error', title: '选择失败: ' + err.message, size: 'mini' });
            btn.disabled = false;
            btn.innerHTML = '<span>' + self.SVG.robot + '</span> 让AI自己选择喜欢的' + resourceLabel;
            btn.style.opacity = '1';
        });
    };
    
    /**
     * 触发AI自动选择头像（兼容旧接口）
     */
    SystemConfigApp.prototype.triggerAIAvatarSelection = function(aiId, page) {
        this.triggerAIResourceSelection(aiId, 'avatar', 'all', '', page);
    };

    // ============ 时间表管理系统 ============
    
    // 时间表管理器主页面
    SystemConfigApp.prototype.openScheduleManager = function() {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">时间表管理</div>';
        html += '<button id="add-schedule-btn" class="' + S.primaryButton + ' sys-btn-flex-6 sys-btn-add">' + I.plus + ' 新建</button>';
        html += '</div>';
        
        // 时间表列表
        var schedules = PhoneCore.getAllSchedules();
        
        if (schedules.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty-schedule">';
            html += '<div style="width:64px;height:64px;margin:0 auto 16px;background:linear-gradient(135deg,rgba(102,126,234,0.2),rgba(118,75,162,0.2));border-radius:50%;display:flex;align-items:center;justify-content:center;">';
            html += '<span style="color:#667eea;transform:scale(1.5);">' + I.calendar + '</span>';
            html += '</div>';
            html += '<div style="color:#999;font-size:14px;">暂无时间表</div>';
            html += '<div style="color:#CCC;font-size:12px;margin-top:8px;">点击上方「新建」按钮创建时间表</div>';
            html += '</div>';
        } else {
            schedules.forEach(function(schedule) {
                var overview = schedule.getTodayOverview();
                var bindingCount = (schedule.bindings.users.length || 0) + 
                                   (schedule.bindings.masks.length || 0) + 
                                   (schedule.bindings.ais.length || 0);
                
                html += '<div class="schedule-card ' + S.glassCard + ' sys-schedule-card" data-schedule-id="' + schedule.id + '" style="border-left:4px solid ' + (schedule.color || '#667eea') + ';">';
                html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
                html += '<div style="flex:1;">';
                html += '<div style="display:flex;align-items:center;gap:8px;">';
                html += '<span class="sys-schedule-icon-sm">' + getScheduleIconHtml(schedule.icon, I) + '</span>';
                html += '<span style="font-weight:600;font-size:16px;color:#333;">' + schedule.name + '</span>';
                html += '</div>';
                html += '<div style="font-size:12px;color:#888;margin-top:6px;">' + (schedule.description || '暂无描述') + '</div>';
                html += '<div style="display:flex;gap:12px;margin-top:10px;font-size:11px;color:#888;">';
                html += '<span>' + I.clock + ' 今日 ' + overview.totalSlots + ' 个安排</span>';
                if (bindingCount > 0) {
                    html += '<span>🔗 ' + bindingCount + ' 个绑定</span>';
                }
                html += '</div>';
                html += '</div>';
                html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
                html += '</div>';
                
                // 当前活动预览
                if (overview.current) {
                    var catColor = Schedule.ACTIVITY_CATEGORIES[overview.current.category]?.color || '#C7C7CC';
                    html += '<div style="margin-top:12px;padding:10px 12px;background:' + catColor + '15;border-radius:10px;display:flex;align-items:center;gap:10px;">';
                    html += '<span style="font-size:18px;">' + overview.current.icon + '</span>';
                    html += '<div style="flex:1;">';
                    html += '<div style="font-size:13px;font-weight:500;color:#333;">正在进行: ' + overview.current.activity + '</div>';
                    html += '<div style="font-size:11px;color:#888;">' + overview.current.start + ' - ' + overview.current.end + '</div>';
                    html += '</div>';
                    html += '</div>';
                }
                
                html += '</div>';
            });
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 新建时间表
        var addBtn = page.querySelector('#add-schedule-btn');
        if (addBtn) {
            addBtn.onclick = function() {
                self.openScheduleEditor(null);
            };
        }
        
        // 时间表卡片点击
        page.querySelectorAll('.schedule-card').forEach(function(card) {
            card.onclick = function() {
                var scheduleId = card.getAttribute('data-schedule-id');
                self.openScheduleDetail(scheduleId);
            };
        });
    };

    // 时间表详情页
    SystemConfigApp.prototype.openScheduleDetail = function(scheduleId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var schedule = PhoneCore.getSchedule(scheduleId);
        if (!schedule) return;
        
        var html = '<div class="' + S.pageWrap + '">';
        
        // 头部信息
        html += '<div style="text-align:center;margin-bottom:24px;">';
        html += '<div style="width:80px;height:80px;margin:0 auto 12px;background:linear-gradient(135deg,' + (schedule.color || '#667eea') + '20,' + (schedule.color || '#764ba2') + '30);border-radius:24px;display:flex;align-items:center;justify-content:center;">';
        html += '<span class="sys-schedule-icon-md">' + getScheduleIconHtml(schedule.icon, I) + '</span>';
        html += '</div>';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">' + schedule.name + '</div>';
        html += '<div style="font-size:13px;color:#888;margin-top:6px;">' + (schedule.description || '暂无描述') + '</div>';
        html += '</div>';
        
        // 操作按钮
        html += '<div style="display:flex;gap:10px;margin-bottom:20px;">';
        html += '<button id="edit-schedule-btn" style="flex:1;padding:12px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:14px;cursor:pointer;">编辑</button>';
        html += '<button id="bind-schedule-btn" style="flex:1;padding:12px;background:#34C759;color:white;border:none;border-radius:12px;font-size:14px;cursor:pointer;">绑定</button>';
        html += '</div>';
        
        // 今日概览
        var overview = schedule.getTodayOverview();
        html += '<div class="config-card ' + S.glassCard + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<span style="color:#FF8FAB;">' + I.clock + '</span>';
        html += '<span style="font-weight:600;font-size:15px;color:#333;">今日安排 (' + overview.weekday + ')</span>';
        html += '</div>';
        html += '<span style="font-size:12px;color:#888;">' + overview.totalSlots + ' 个时段</span>';
        html += '</div>';
        
        if (overview.slots.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:#999;">今日暂无安排</div>';
        } else {
            var now = new Date();
            var currentMinutes = now.getHours() * 60 + now.getMinutes();
            
            overview.slots.forEach(function(slot) {
                var catInfo = Schedule.ACTIVITY_CATEGORIES[slot.category] || Schedule.ACTIVITY_CATEGORIES.other;
                var slotStart = schedule.parseTime(slot.start);
                var slotEnd = schedule.parseTime(slot.end);
                var isPast = slotEnd < currentMinutes;
                var isCurrent = currentMinutes >= slotStart && currentMinutes < slotEnd;
                
                var opacity = isPast ? '0.5' : '1';
                var bgColor = isCurrent ? catInfo.color + '20' : 'transparent';
                
                html += '<div style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;background:' + bgColor + ';border-radius:12px;opacity:' + opacity + ';border-left:3px solid ' + (isCurrent ? catInfo.color : 'transparent') + ';">';
                html += '<div style="width:60px;font-size:11px;color:#888;flex-shrink:0;">' + slot.start + '<br>' + slot.end + '</div>';
                html += '<span style="font-size:22px;">' + slot.icon + '</span>';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:14px;font-weight:500;color:#333;">' + slot.activity + '</div>';
                if (slot.description) {
                    html += '<div style="font-size:11px;color:#888;margin-top:2px;">' + slot.description + '</div>';
                }
                html += '</div>';
                if (isCurrent) {
                    html += '<div style="width:8px;height:8px;background:' + catInfo.color + ';border-radius:50%;"></div>';
                }
                html += '</div>';
            });
        }
        html += '</div>';
        
        // 周概览
        html += '<div class="config-card ' + S.glassCard + '" style="margin-top:16px;">';
        html += '<div style="font-weight:600;font-size:15px;color:#333;margin-bottom:16px;display:flex;align-items:center;gap:8px;">';
        html += '<span style="color:#667eea;">' + I.calendar + '</span>';
        html += '<span>周概览</span>';
        html += '</div>';
        
        var weekOverview = schedule.getWeekOverview();
        html += '<div style="display:flex;gap:6px;">';
        WEEKDAY_KEYS.forEach(function(key, index) {
            var dayData = weekOverview[key];
            var isToday = index === new Date().getDay();
            var hasSlots = dayData.slots.length > 0;
            
            html += '<div style="flex:1;text-align:center;padding:10px 4px;background:' + (isToday ? '#FF8FAB20' : '#F5F5F5') + ';border-radius:10px;' + (isToday ? 'border:1.5px solid #FF8FAB;' : '') + '">';
            html += '<div style="font-size:11px;color:' + (isToday ? '#FF8FAB' : '#888') + ';font-weight:' + (isToday ? '600' : '400') + ';">' + WEEKDAYS[index].substring(1) + '</div>';
            html += '<div style="font-size:14px;font-weight:600;color:' + (hasSlots ? '#333' : '#CCC') + ';margin-top:4px;">' + dayData.slots.length + '</div>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
        
        // 绑定关系
        html += '<div class="config-card ' + S.glassCard + '" style="margin-top:16px;">';
        html += '<div style="font-weight:600;font-size:15px;color:#333;margin-bottom:16px;">🔗 绑定关系</div>';
        
        var hasBindings = false;
        
        // 用户真实身份
        if (PhoneCore.user && PhoneCore.user.realInfo.scheduleId === scheduleId) {
            hasBindings = true;
            html += '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#F0F0F0;border-radius:10px;margin-bottom:8px;">';
            html += '<span style="font-size:18px;">👤</span>';
            html += '<span style="font-size:13px;color:#333;">我的真实身份</span>';
            html += '<button class="unbind-btn" data-type="user" style="margin-left:auto;padding:4px 10px;background:#FF3B30;color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;">解绑</button>';
            html += '</div>';
        }
        
        // 面具身份
        if (PhoneCore.user && PhoneCore.user.masks) {
            Object.values(PhoneCore.user.masks).forEach(function(mask) {
                if (mask.scheduleId === scheduleId) {
                    hasBindings = true;
                    html += '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#F8F8F8;border-radius:10px;margin-bottom:8px;">';
                    html += '<span style="color:#D8456C;">' + I.mask + '</span>';
                    html += '<span style="font-size:13px;color:#1D1B20;">' + mask.name + '</span>';
                    html += '<button class="unbind-btn" data-type="mask" data-id="' + mask.id + '" style="margin-left:auto;padding:4px 10px;background:#D8456C;color:white;border:none;border-radius:8px;font-size:11px;cursor:pointer;">解绑</button>';
                    html += '</div>';
                }
            });
        }
        
        // AI角色
        Object.values(PhoneCore.ais).forEach(function(ai) {
            if (ai.scheduleId === scheduleId) {
                hasBindings = true;
                html += '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#F8F8F8;border-radius:10px;margin-bottom:8px;">';
                html += '<div style="width:28px;height:28px;border-radius:8px;background:#E8E8E8;overflow:hidden;display:flex;align-items:center;justify-content:center;">';
                if (ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += '<span style="color:#999;">' + I.robot + '</span>';
                }
                html += '</div>';
                html += '<span style="font-size:13px;color:#1D1B20;">' + ai.name + '</span>';
                html += '<span style="font-size:11px;color:#746B6E;">' + (ai.type === 'main' ? '主角色' : ai.type === 'supporting' ? '配角' : 'NPC') + '</span>';
                html += '<button class="unbind-btn" data-type="ai" data-id="' + ai.id + '" style="margin-left:auto;padding:4px 10px;background:#D8456C;color:white;border:none;border-radius:8px;font-size:11px;cursor:pointer;">解绑</button>';
                html += '</div>';
            }
        });
        
        if (!hasBindings) {
            html += '<div style="text-align:center;padding:15px;color:#999;font-size:13px;">暂无绑定</div>';
        }
        
        html += '</div>';
        
        // 删除按钮
        html += '<button id="delete-schedule-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:14px;font-size:15px;font-weight:500;cursor:pointer;margin-top:20px;">删除时间表</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 编辑按钮
        var editBtn = page.querySelector('#edit-schedule-btn');
        if (editBtn) {
            editBtn.onclick = function() {
                page.querySelector('.app-back-btn').click();
                setTimeout(function() {
                    self.openScheduleEditor(scheduleId);
                }, 350);
            };
        }
        
        // 绑定按钮
        var bindBtn = page.querySelector('#bind-schedule-btn');
        if (bindBtn) {
            bindBtn.onclick = function() {
                self.openScheduleBindingSelector(scheduleId);
            };
        }
        
        // 解绑按钮
        page.querySelectorAll('.unbind-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var type = btn.getAttribute('data-type');
                var entityId = btn.getAttribute('data-id');
                
                if (confirm('确定解除绑定？')) {
                    if (type === 'user') {
                        PhoneCore.user.unbindSchedule();
                        PhoneCore.saveUserProfile();
                    } else if (type === 'mask') {
                        PhoneCore.user.unbindMaskSchedule(entityId);
                        PhoneCore.saveUserProfile();
                    } else if (type === 'ai') {
                        var ai = PhoneCore.getAI(entityId);
                        if (ai) {
                            ai.unbindSchedule();
                            PhoneCore.saveAI(ai);
                        }
                    }
                    
                    schedule.unbindFrom(type === 'user' ? 'users' : type === 'mask' ? 'masks' : 'ais', entityId || 'user');
                    PhoneCore.saveSchedule(schedule);
                    
                    btn.closest('div[style*="padding:10px"]').remove();
                }
            };
        });
        
        // 删除时间表
        var deleteBtn = page.querySelector('#delete-schedule-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此时间表？相关绑定将被解除。')) {
                    PhoneCore.deleteSchedule(scheduleId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        PhoneCore.notifications.send({
                            type: 'info',
                            title: '已删除',
                            size: 'mini',
                            message: '时间表已删除',
                            icon: '🗑️',
                            duration: 2000
                        });
                    });
                }
            };
        }
    };

    // 时间表编辑器
    SystemConfigApp.prototype.openScheduleEditor = function(scheduleId) {
        const self = this;
        const S = this.STYLES;
        const I = this.SVG;
        let schedule = scheduleId ? PhoneCore.getSchedule(scheduleId) : null;
        const isNew = !schedule;

        if (isNew) {
            schedule = new Schedule({ name: '', description: '' });
        }

        const iconKey = SCHEDULE_ICON_EMOJI_TO_KEY[schedule.icon] || (SCHEDULE_ICON_KEYS.indexOf(schedule.icon) >= 0 ? schedule.icon : 'calendar');
        const colors = ['#FF8FAB', '#667eea', '#34C759', '#FF9500', '#AF52DE', '#5E5CE6', '#00C7BE', '#FF2D55'];

        let html = `
        <div class="${S.pageWrap}">
            <div class="sys-schedule-editor-title">${isNew ? '新建时间表' : '编辑时间表'}</div>

            <div class="config-card ${S.glassCard}">
                <div class="sys-schedule-card-header">
                    <span class="sys-schedule-card-header-icon">${I.note}</span>
                    <span>基本信息</span>
                </div>

                <div class="sys-schedule-field">
                    <label class="${S.label}">时间表名称</label>
                    <input type="text" id="schedule-name" value="${schedule.name.replace(/"/g, '&quot;')}" placeholder="如：我的课表" class="${S.input}">
                </div>

                <div class="sys-schedule-field">
                    <label class="${S.label}">描述</label>
                    <input type="text" id="schedule-desc" value="${(schedule.description || '').replace(/"/g, '&quot;')}" placeholder="简短描述" class="${S.input}">
                </div>

                <div class="sys-schedule-field">
                    <label class="${S.label}">图标</label>
                    <div class="sys-schedule-icon-row">
                        ${SCHEDULE_ICON_KEYS.map(function(key) {
                            const selected = iconKey === key;
                            const svg = I[key] || I.calendar;
                            return `<button type="button" class="sys-schedule-icon-btn icon-btn ${selected ? 'selected' : ''}" data-icon="${key}">${svg}</button>`;
                        }).join('')}
                    </div>
                    <input type="hidden" id="schedule-icon" value="${iconKey}">
                </div>

                <div class="sys-schedule-field">
                    <label class="${S.label}">主题色</label>
                    <div class="sys-schedule-color-row">
                        ${colors.map(function(color) {
                            const selected = schedule.color === color;
                            return `<button type="button" class="sys-schedule-color-btn color-btn ${selected ? 'selected' : ''}" data-color="${color}" style="background:${color};"></button>`;
                        }).join('')}
                    </div>
                    <input type="hidden" id="schedule-color" value="${schedule.color || '#FF8FAB'}">
                </div>
            </div>

            <div class="config-card ${S.glassCard} sys-schedule-week-card">
                <div class="sys-schedule-card-header">
                    <span class="sys-schedule-card-header-icon">${I.calendar}</span>
                    <span>周时间表</span>
                </div>

                <div id="weekday-tabs" class="sys-weekday-tabs">
                    ${WEEKDAY_KEYS.map(function(key, index) {
                        const slots = schedule.weeklySchedule[key] || [];
                        const isActive = index === 1;
                        const dayLabel = WEEKDAYS[index].substring(1);
                        const badge = slots.length > 0 ? `<span class="sys-weekday-badge">${slots.length}</span>` : '';
                        return `<button type="button" class="sys-weekday-tab weekday-tab ${isActive ? 'active' : ''}" data-day="${key}">${dayLabel}${badge}</button>`;
                    }).join('')}
                </div>

                <div id="slots-container"></div>

                <button type="button" id="add-slot-btn" class="sys-add-slot-btn">${I.plus} 添加时间段</button>

                <div class="sys-schedule-quick-actions">
                    <div class="sys-schedule-quick-actions-title">快速操作</div>
                    <div class="sys-schedule-quick-actions-btns">
                        <button type="button" id="copy-to-weekdays-btn" class="sys-copy-weekdays-btn">${I.copy} 复制到工作日</button>
                        <button type="button" id="copy-to-all-btn" class="sys-copy-all-btn">${I.copy} 复制到全部</button>
                    </div>
                </div>
            </div>

            <button type="button" id="save-schedule-btn" class="${S.primaryButton} sys-btn-save-mt">保存</button>
        </div>
        `;

        const page = this.openDetailPage(html);
        let currentDay = 'mon';
        const scheduleData = JSON.parse(JSON.stringify(schedule.weeklySchedule));

        function renderSlots() {
            const container = page.querySelector('#slots-container');
            const slots = scheduleData[currentDay] || [];

            if (slots.length === 0) {
                container.innerHTML = '<div class="sys-slots-empty">暂无时间段，点击下方按钮添加</div>';
                return;
            }

            const slotHtml = slots.map(function(slot, index) {
                const catInfo = Schedule.ACTIVITY_CATEGORIES[slot.category] || Schedule.ACTIVITY_CATEGORIES.other;
                const catOptions = Object.keys(Schedule.ACTIVITY_CATEGORIES).map(function(catKey) {
                    const cat = Schedule.ACTIVITY_CATEGORIES[catKey];
                    return `<option value="${catKey}"${slot.category === catKey ? ' selected' : ''}>${cat.name}</option>`;
                }).join('');
                return `
                <div class="sys-slot-item slot-item" data-index="${index}">
                    <div class="sys-slot-time-row">
                        <input type="time" class="slot-start sys-slot-time" value="${slot.start}" title="开始时间">
                        <span class="sys-slot-time-sep">–</span>
                        <input type="time" class="slot-end sys-slot-time" value="${slot.end}" title="结束时间">
                        <button type="button" class="delete-slot-btn sys-delete-slot-btn" data-index="${index}" title="删除">${I.cross}</button>
                    </div>
                    <div class="sys-slot-main-row">
                        <input type="text" class="slot-activity sys-slot-activity" value="${(slot.activity || '').replace(/"/g, '&quot;')}" placeholder="活动名称">
                        <select class="slot-category sys-slot-category-select">${catOptions}</select>
                    </div>
                </div>`;
            }).join('');

            container.innerHTML = slotHtml;
            bindSlotEvents();
        }
        
        // 绑定时间段事件
        function bindSlotEvents() {
            const container = page.querySelector('#slots-container');

            container.querySelectorAll('.slot-start, .slot-end').forEach(function(input) {
                input.onchange = function() {
                    const item = input.closest('.slot-item');
                    const index = parseInt(item.getAttribute('data-index'), 10);
                    const isStart = input.classList.contains('slot-start');
                    scheduleData[currentDay][index][isStart ? 'start' : 'end'] = input.value;
                };
            });

            container.querySelectorAll('.slot-activity').forEach(function(input) {
                input.onchange = function() {
                    const item = input.closest('.slot-item');
                    const index = parseInt(item.getAttribute('data-index'), 10);
                    scheduleData[currentDay][index].activity = input.value;
                };
            });

            container.querySelectorAll('.slot-category').forEach(function(select) {
                select.onchange = function() {
                    const item = select.closest('.slot-item');
                    const index = parseInt(item.getAttribute('data-index'), 10);
                    const catKey = select.value;
                    const cat = Schedule.ACTIVITY_CATEGORIES[catKey];
                    scheduleData[currentDay][index].category = catKey;
                    scheduleData[currentDay][index].icon = cat.icon;
                    renderSlots();
                };
            });

            container.querySelectorAll('.delete-slot-btn').forEach(function(btn) {
                btn.onclick = function() {
                    const index = parseInt(btn.getAttribute('data-index'), 10);
                    scheduleData[currentDay].splice(index, 1);
                    renderSlots();
                    updateTabBadges();
                };
            });
        }
        
        function updateTabBadges() {
            page.querySelectorAll('.weekday-tab').forEach(function(tab) {
                const day = tab.getAttribute('data-day');
                const slots = scheduleData[day] || [];
                let badge = tab.querySelector('.sys-weekday-badge');
                if (slots.length > 0) {
                    if (!badge) {
                        tab.insertAdjacentHTML('beforeend', `<span class="sys-weekday-badge">${slots.length}</span>`);
                    } else {
                        badge.textContent = slots.length;
                    }
                } else if (badge) {
                    badge.remove();
                }
            });
        }

        page.querySelectorAll('.weekday-tab').forEach(function(tab) {
            tab.onclick = function() {
                page.querySelectorAll('.weekday-tab').forEach(function(t) {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                currentDay = tab.getAttribute('data-day');
                renderSlots();
            };
        });
        
        const addSlotBtn = page.querySelector('#add-slot-btn');
        if (addSlotBtn) {
            addSlotBtn.onclick = function() {
                if (!scheduleData[currentDay]) {
                    scheduleData[currentDay] = [];
                }
                scheduleData[currentDay].push({
                    id: 'slot_' + Date.now(),
                    start: '09:00',
                    end: '10:00',
                    activity: '',
                    icon: '',
                    category: 'other',
                    description: ''
                });
                renderSlots();
                updateTabBadges();
                
                // 自动聚焦到新添加项的活动名称输入框
                setTimeout(function() {
                    var container = page.querySelector('#slots-container');
                    var lastItem = container.querySelector('.slot-item:last-child .slot-activity');
                    if (lastItem) {
                        lastItem.focus();
                        lastItem.placeholder = '输入活动名称...';
                    }
                }, 50);
            };
        }
        
        const copyWeekdaysBtn = page.querySelector('#copy-to-weekdays-btn');
        if (copyWeekdaysBtn) {
            copyWeekdaysBtn.onclick = function() {
                const sourceSlots = scheduleData[currentDay] || [];
                ['mon', 'tue', 'wed', 'thu', 'fri'].forEach(function(day) {
                    if (day !== currentDay) {
                        scheduleData[day] = sourceSlots.map(function(slot) {
                            return Object.assign({}, slot, { id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) });
                        });
                    }
                });
                updateTabBadges();
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '已复制',
                    message: '已复制到周一至周五',
                    icon: I.copy,
                    size: 'mini',
                    duration: 2000
                });
            };
        }

        const copyAllBtn = page.querySelector('#copy-to-all-btn');
        if (copyAllBtn) {
            copyAllBtn.onclick = function() {
                const sourceSlots = scheduleData[currentDay] || [];
                WEEKDAY_KEYS.forEach(function(day) {
                    if (day !== currentDay) {
                        scheduleData[day] = sourceSlots.map(function(slot) {
                            return Object.assign({}, slot, { id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) });
                        });
                    }
                });
                updateTabBadges();
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '已复制',
                    message: '已复制到所有天',
                    icon: I.copy,
                    size: 'mini',
                    duration: 2000
                });
            };
        }
        
        page.querySelectorAll('.icon-btn').forEach(function(btn) {
            btn.onclick = function() {
                page.querySelectorAll('.icon-btn').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                page.querySelector('#schedule-icon').value = btn.getAttribute('data-icon');
            };
        });

        page.querySelectorAll('.color-btn').forEach(function(btn) {
            btn.onclick = function() {
                page.querySelectorAll('.color-btn').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                page.querySelector('#schedule-color').value = btn.getAttribute('data-color');
            };
        });

        const saveBtn = page.querySelector('#save-schedule-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                const name = page.querySelector('#schedule-name').value.trim();
                if (!name) {
                    alert('请输入时间表名称');
                    return;
                }
                schedule.name = name;
                schedule.description = page.querySelector('#schedule-desc').value.trim();
                schedule.icon = page.querySelector('#schedule-icon').value;
                schedule.color = page.querySelector('#schedule-color').value;
                schedule.weeklySchedule = scheduleData;
                schedule.updatedAt = Date.now();
                PhoneCore.saveSchedule(schedule).then(function() {
                    page.querySelector('.app-back-btn').click();
                    PhoneCore.notifications.send({ type: 'success', title: '保存成功', size: 'mini' });
                });
            };
        }
        
        // 初始渲染
        renderSlots();
    };

    // 时间表绑定选择器
    SystemConfigApp.prototype.openScheduleBindingSelector = function(scheduleId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var schedule = PhoneCore.getSchedule(scheduleId);
        if (!schedule) return;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:8px;color:#333;">绑定时间表</div>';
        html += '<div style="font-size:13px;color:#888;margin-bottom:24px;">选择要使用此时间表的身份或AI</div>';
        
        // 用户真实身份
        html += '<div class="config-card ' + S.glassCard + '">';
        html += '<div style="font-weight:600;font-size:15px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">';
        html += '<span>👤</span><span>我的真实身份</span>';
        html += '</div>';
        
        var userBound = PhoneCore.user && PhoneCore.user.realInfo.scheduleId === scheduleId;
        html += '<div class="bind-item" data-type="user" style="display:flex;align-items:center;gap:12px;padding:12px;background:' + (userBound ? '#E8F5E9' : '#F8F8F8') + ';border-radius:12px;cursor:pointer;">';
        html += '<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#FFB6C1,#FFC0CB);display:flex;align-items:center;justify-content:center;overflow:hidden;">';
        if (PhoneCore.user && PhoneCore.user.avatar) {
            html += '<img src="' + PhoneCore.user.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<span style="color:white;font-size:18px;">👤</span>';
        }
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:14px;font-weight:500;color:#333;">我的真实身份</div>';
        html += '<div style="font-size:12px;color:#888;">' + (PhoneCore.user && PhoneCore.user.realInfo.city ? PhoneCore.user.realInfo.city : '未设置城市') + '</div>';
        html += '</div>';
        if (userBound) {
            html += '<span style="color:#34C759;font-size:12px;font-weight:600;">已绑定</span>';
        } else {
            html += '<span style="color:#007AFF;font-size:12px;">点击绑定</span>';
        }
        html += '</div>';
        html += '</div>';
        
        // 面具身份
        if (PhoneCore.user && Object.keys(PhoneCore.user.masks).length > 0) {
            html += '<div class="config-card ' + S.glassCard + '" style="margin-top:16px;">';
            html += '<div style="font-weight:500;font-size:14px;margin-bottom:14px;display:flex;align-items:center;gap:8px;color:#49454F;">';
            html += '<span style="color:#D8456C;">' + I.mask + '</span><span>人设面具</span>';
            html += '</div>';
            
            Object.values(PhoneCore.user.masks).forEach(function(mask) {
                var maskBound = mask.scheduleId === scheduleId;
                html += '<div class="bind-item" data-type="mask" data-id="' + mask.id + '" style="display:flex;align-items:center;gap:12px;padding:12px;background:' + (maskBound ? '#E8F5E9' : '#F8F8F8') + ';border-radius:12px;margin-bottom:10px;cursor:pointer;">';
                html += '<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#FFE4E1,#FFF0F5);display:flex;align-items:center;justify-content:center;overflow:hidden;">';
                if (mask.avatar) {
                    html += '<img src="' + mask.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += '<span style="color:#D8456C;">' + I.mask + '</span>';
                }
                html += '</div>';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:14px;font-weight:500;color:#333;">' + mask.name + '</div>';
                html += '</div>';
                if (maskBound) {
                    html += '<span style="color:#34C759;font-size:12px;font-weight:600;">已绑定</span>';
                } else {
                    html += '<span style="color:#007AFF;font-size:12px;">点击绑定</span>';
                }
                html += '</div>';
            });
            html += '</div>';
        }
        
        // AI角色
        var allAIs = Object.values(PhoneCore.ais);
        if (allAIs.length > 0) {
            html += '<div class="config-card ' + S.glassCard + '" style="margin-top:16px;">';
            html += '<div style="font-weight:500;font-size:14px;margin-bottom:14px;display:flex;align-items:center;gap:8px;color:#49454F;">';
            html += '<span style="color:#D8456C;">' + I.robot + '</span><span>AI角色</span>';
            html += '</div>';
            
            allAIs.forEach(function(ai) {
                var aiBound = ai.scheduleId === scheduleId;
                html += '<div class="bind-item" data-type="ai" data-id="' + ai.id + '" style="display:flex;align-items:center;gap:10px;padding:12px;background:' + (aiBound ? 'rgba(76,175,80,0.08)' : '#F8F8F8') + ';border-radius:12px;margin-bottom:8px;cursor:pointer;border:1px solid ' + (aiBound ? 'rgba(76,175,80,0.2)' : 'transparent') + ';">';
                html += '<div style="width:36px;height:36px;border-radius:10px;background:#E8E8E8;display:flex;align-items:center;justify-content:center;overflow:hidden;">';
                if (ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += '<span style="color:#999;">' + I.robot + '</span>';
                }
                html += '</div>';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:13px;font-weight:500;color:#1D1B20;">' + ai.name + '</div>';
                html += '<div style="font-size:11px;color:#746B6E;">' + (ai.type === 'main' ? '主角色' : ai.type === 'supporting' ? '配角' : 'NPC') + '</div>';
                html += '</div>';
                if (aiBound) {
                    html += '<span style="display:flex;align-items:center;gap:4px;color:#4CAF50;font-size:11px;font-weight:500;">' + I.check + ' 已绑定</span>';
                } else {
                    html += '<span style="color:#D8456C;font-size:11px;">点击绑定</span>';
                }
                html += '</div>';
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 绑定点击事件
        page.querySelectorAll('.bind-item').forEach(function(item) {
            item.onclick = function() {
                var type = item.getAttribute('data-type');
                var entityId = item.getAttribute('data-id');
                
                if (type === 'user') {
                    // 如果已绑定其他时间表，先解绑
                    if (PhoneCore.user.realInfo.scheduleId && PhoneCore.user.realInfo.scheduleId !== scheduleId) {
                        var oldSchedule = PhoneCore.getSchedule(PhoneCore.user.realInfo.scheduleId);
                        if (oldSchedule) {
                            oldSchedule.unbindFrom('users', 'user');
                            PhoneCore.saveSchedule(oldSchedule);
                        }
                    }
                    
                    if (PhoneCore.user.realInfo.scheduleId === scheduleId) {
                        // 解绑
                        PhoneCore.user.unbindSchedule();
                        schedule.unbindFrom('users', 'user');
                    } else {
                        // 绑定
                        PhoneCore.user.bindSchedule(scheduleId);
                        schedule.bindTo('users', 'user');
                    }
                    PhoneCore.saveUserProfile();
                    
                } else if (type === 'mask') {
                    var mask = PhoneCore.user.masks[entityId];
                    if (mask) {
                        // 解绑旧的
                        if (mask.scheduleId && mask.scheduleId !== scheduleId) {
                            var oldSchedule = PhoneCore.getSchedule(mask.scheduleId);
                            if (oldSchedule) {
                                oldSchedule.unbindFrom('masks', entityId);
                                PhoneCore.saveSchedule(oldSchedule);
                            }
                        }
                        
                        if (mask.scheduleId === scheduleId) {
                            PhoneCore.user.unbindMaskSchedule(entityId);
                            schedule.unbindFrom('masks', entityId);
                        } else {
                            PhoneCore.user.bindMaskSchedule(entityId, scheduleId);
                            schedule.bindTo('masks', entityId);
                        }
                        PhoneCore.saveUserProfile();
                    }
                    
                } else if (type === 'ai') {
                    var ai = PhoneCore.getAI(entityId);
                    if (ai) {
                        // 解绑旧的
                        if (ai.scheduleId && ai.scheduleId !== scheduleId) {
                            var oldSchedule = PhoneCore.getSchedule(ai.scheduleId);
                            if (oldSchedule) {
                                oldSchedule.unbindFrom('ais', entityId);
                                PhoneCore.saveSchedule(oldSchedule);
                            }
                        }
                        
                        if (ai.scheduleId === scheduleId) {
                            ai.unbindSchedule();
                            schedule.unbindFrom('ais', entityId);
                        } else {
                            ai.bindSchedule(scheduleId);
                            schedule.bindTo('ais', entityId);
                        }
                        PhoneCore.saveAI(ai);
                    }
                }
                
                PhoneCore.saveSchedule(schedule);
                
                // 刷新页面
                page.querySelector('.app-back-btn').click();
                setTimeout(function() {
                    self.openScheduleBindingSelector(scheduleId);
                }, 350);
            };
        });
    };

    // ============ 页面3: AI设定 ============
    SystemConfigApp.prototype.renderAIPage = function() {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var html = '<div class="' + S.pageWrap + '">';
        
        // 主角色AI
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<span style="color:#FFD700;">' + I.star + '</span>';
        html += '<span style="font-size:17px;font-weight:700;color:#333;">主角色AI</span>';
        html += '</div>';
        html += '<button id="add-main-ai-btn" class="' + S.secondaryButton + ' sys-btn-flex">' + I.plus + ' 创建</button>';
        html += '</div>';
        
        var mainAIs = PhoneCore.getAIsByType('main');
        if (mainAIs.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty">暂无主角色AI</div>';
        } else {
            mainAIs.forEach(function(ai) {
                html += '<div class="ai-card main-ai-card" data-ai-id="' + ai.id + '" style="' +
                        'background:linear-gradient(135deg,rgba(255,215,0,0.08),rgba(255,182,193,0.12));' +
                        'border:2px solid rgba(255,215,0,0.3);border-radius:20px;padding:18px;margin-bottom:12px;cursor:pointer;' +
                        'backdrop-filter:blur(10px);transition:all 0.2s ease;">';
                html += '<div style="display:flex;align-items:center;">';
                html += '<div style="width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,#FFE4E1,#FFF0F5);margin-right:14px;overflow:hidden;box-shadow:0 4px 12px rgba(255,182,193,0.2);">';
                if (ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#FFD700;">' + I.star + '</div>';
                }
                html += '</div>';
                html += '<div style="flex:1;">';
                html += '<div style="font-weight:600;font-size:16px;color:#333;">' + ai.name + '</div>';
                html += '<div style="font-size:12px;color:#888;margin-top:4px;">' + (ai.status || '空闲') + '</div>';
                html += '</div>';
                html += '<div style="text-align:right;">';
                html += '<div style="font-size:11px;color:#888;display:flex;align-items:center;gap:4px;">' + I.chart + ' ' + (ai.tokensUsed.total || 0) + '</div>';
                if (ai.isBlocked) {
                    html += '<div style="font-size:11px;color:#FF3B30;margin-top:4px;display:flex;align-items:center;gap:2px;">' + I.block + ' 已拉黑</div>';
                }
                html += '</div>';
                html += '</div>';
                html += '</div>';
            });
        }
        
        // 配角AI
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;margin-top:28px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<span style="color:#4ECDC4;">' + I.users + '</span>';
        html += '<span style="font-size:17px;font-weight:700;color:#333;">配角AI</span>';
        html += '</div>';
        html += '<button id="add-supporting-ai-btn" style="background:rgba(78,205,196,0.15);color:#4ECDC4;border:none;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;">' + I.plus + ' 创建</button>';
        html += '</div>';
        
        var supportingAIs = PhoneCore.getAIsByType('supporting');
        if (supportingAIs.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty">暂无配角AI</div>';
        } else {
            supportingAIs.forEach(function(ai) {
                html += '<div class="ai-card supporting-ai-card ' + S.glassCard + ' sys-card-clickable" data-ai-id="' + ai.id + '" style="margin-bottom:10px;">';
                html += '<div style="display:flex;align-items:center;">';
                html += '<div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#E0F7FA,#B2EBF2);margin-right:14px;overflow:hidden;">';
                if (ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#4ECDC4;">' + I.users + '</div>';
                }
                html += '</div>';
                html += '<div style="flex:1;">';
                html += '<div style="font-weight:600;font-size:15px;color:#333;">' + ai.name + '</div>';
                html += '</div>';
                html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
                html += '</div>';
                html += '</div>';
            });
        }
        
        // NPC AI
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;margin-top:28px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<span style="color:#DDA0DD;">' + I.mask + '</span>';
        html += '<span style="font-size:17px;font-weight:700;color:#333;">NPC AI</span>';
        html += '</div>';
        html += '</div>';
        
        var npcAIs = PhoneCore.getAIsByType('npc');
        if (npcAIs.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty" style="font-size:14px;">暂无NPC AI（NPC由系统自动生成）</div>';
        } else {
            npcAIs.forEach(function(ai) {
                html += '<div class="ai-card npc-ai-card" data-ai-id="' + ai.id + '" style="background:rgba(221,160,221,0.1);border-radius:18px;padding:16px;margin-bottom:10px;cursor:pointer;border:1px solid rgba(221,160,221,0.2);">';
                html += '<div style="display:flex;align-items:center;">';
                html += '<div style="width:42px;height:42px;border-radius:50%;background:' + self.getRandomColor(ai.id) + ';margin-right:12px;display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,0.1);">' + ai.name.charAt(0) + '</div>';
                html += '<div style="flex:1;">';
                html += '<div style="font-weight:600;font-size:14px;color:#333;">' + ai.name + '</div>';
                html += '<div style="font-size:11px;color:#999;margin-top:3px;">NPC · 聊天 ' + (ai.chatHistory ? ai.chatHistory.length : 0) + ' 条</div>';
                html += '</div>';
                html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
                html += '</div>';
                html += '</div>';
            });
        }
        
        // 提示词库管理
        html += '<div class="config-card ' + S.glassCard + ' sys-card-mt-28 sys-card-clickable" id="prompt-library-entry">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
        html += '<div style="display:flex;align-items:center;gap:14px;">';
        html += '<div style="width:44px;height:44px;background:linear-gradient(135deg,#E8F5E9,#C8E6C9);border-radius:12px;display:flex;align-items:center;justify-content:center;">';
        html += '<span style="color:#66BB6A;">' + I.note + '</span>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:600;font-size:15px;color:#333;">提示词库</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:3px;">管理和复用AI提示词</div>';
        html += '</div>';
        html += '</div>';
        html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
        html += '</div>';
        html += '</div>';
        
        // NPC设定管理
        html += '<div class="config-card ' + S.glassCard + ' sys-card-mt-12 sys-card-clickable" id="npc-settings-entry">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
        html += '<div style="display:flex;align-items:center;gap:14px;">';
        html += '<div style="width:44px;height:44px;background:linear-gradient(135deg,#FFF3E0,#FFE0B2);border-radius:12px;display:flex;align-items:center;justify-content:center;">';
        html += '<span style="color:#FF9800;">' + I.gear + '</span>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:600;font-size:15px;color:#333;">NPC生成设置</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:3px;">配置各App的NPC提示词</div>';
        html += '</div>';
        html += '</div>';
        html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
        html += '</div>';
        html += '</div>';
        
        // AI可见信息设置
        html += '<div class="config-card ' + S.glassCard + ' sys-card-mt-12 sys-card-clickable" id="ai-visibility-settings-entry">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
        html += '<div style="display:flex;align-items:center;gap:14px;">';
        html += '<div style="width:44px;height:44px;background:linear-gradient(135deg,#FCE4EC,#F8BBD9);border-radius:12px;display:flex;align-items:center;justify-content:center;">';
        html += '<span style="color:#E91E63;">&#128065;</span>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:600;font-size:15px;color:#333;">AI可见信息</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:3px;">控制AI可以查看的用户信息</div>';
        html += '</div>';
        html += '</div>';
        html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
        html += '</div>';
        html += '</div>';
        
        // 私生饭事件设置
        html += '<div class="config-card ' + S.glassCard + ' sys-card-mt-12 sys-card-clickable" id="sasaeng-settings-entry">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
        html += '<div style="display:flex;align-items:center;gap:14px;">';
        html += '<div style="width:44px;height:44px;background:linear-gradient(135deg,#FFEBEE,#FFCDD2);border-radius:12px;display:flex;align-items:center;justify-content:center;">';
        html += '<span style="font-size:20px;">⚠️</span>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:600;font-size:15px;color:#333;">私生饭事件</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:3px;">设置私生饭骚扰事件触发和强度</div>';
        html += '</div>';
        html += '</div>';
        html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        return html;
    };

    SystemConfigApp.prototype.getRandomColor = function(seed) {
        // 多巴胺色系 - 柔和明亮
        var colors = [
            '#FF9AA2',  // 珊瑚粉
            '#4ECDC4',  // 薄荷绿
            '#C7CEEA',  // 薰衣草紫
            '#FFDAC1',  // 杏色
            '#B5EAD7',  // 抹茶绿
            '#F6C3E5',  // 樱花粉
            '#A2D2FF',  // 天空蓝
            '#FFB7B2',  // 蜜桃粉
            '#E2F0CB',  // 嫩绿
            '#DDA0DD'   // 梅子紫
        ];
        var index = 0;
        for (var i = 0; i < seed.length; i++) {
            index += seed.charCodeAt(i);
        }
        return colors[index % colors.length];
    };

    SystemConfigApp.prototype.bindAIPageEvents = function(container) {
        var self = this;
        
        // 创建主角色AI
        var addMainBtn = container.querySelector('#add-main-ai-btn');
        if (addMainBtn) {
            addMainBtn.onclick = function() {
                self.openAIEditor(null, 'main');
            };
        }
        
        // 创建配角AI
        var addSupportingBtn = container.querySelector('#add-supporting-ai-btn');
        if (addSupportingBtn) {
            addSupportingBtn.onclick = function() {
                self.openAIEditor(null, 'supporting');
            };
        }
        
        // AI卡片点击
        container.querySelectorAll('.ai-card').forEach(function(card) {
            card.onclick = function() {
                var aiId = card.getAttribute('data-ai-id');
                self.openAIDetail(aiId);
            };
        });
        
        // 提示词库
        var promptEntry = container.querySelector('#prompt-library-entry');
        if (promptEntry) {
            promptEntry.onclick = function() {
                self.openPromptLibrary();
            };
        }
        
        // NPC设置
        var npcEntry = container.querySelector('#npc-settings-entry');
        if (npcEntry) {
            npcEntry.onclick = function() {
                self.openNPCSettings();
            };
        }
        
        // AI可见信息设置
        var aiVisibilityEntry = container.querySelector('#ai-visibility-settings-entry');
        if (aiVisibilityEntry) {
            aiVisibilityEntry.onclick = function() {
                self.openAIVisibilitySettings();
            };
        }
        
        // 私生饭事件设置
        var sasaengEntry = container.querySelector('#sasaeng-settings-entry');
        if (sasaengEntry) {
            sasaengEntry.onclick = function() {
                self.openSasaengSettings();
            };
        }
    };

    // AI编辑器
    SystemConfigApp.prototype.openAIEditor = function(aiId, defaultType) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var ai = aiId ? PhoneCore.getAI(aiId) : null;
        var isNew = !ai;
        var aiType = ai ? ai.type : (defaultType || 'main');
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">' + (isNew ? '创建AI角色' : '编辑AI角色') + '</div>';
        
        // 头像
        html += '<div style="text-align:center;margin-bottom:20px;">';
        html += '<div id="ai-avatar-container" style="width:88px;height:88px;border-radius:22px;background:linear-gradient(135deg,#F5F5F5,#E8E8E8);margin:0 auto 8px;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">';
        if (ai && ai.avatar) {
            html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<span style="color:#999;">' + I.robot + '</span>';
        }
        html += '</div>';
        html += '<div style="font-size:11px;color:#746B6E;">点击设置头像</div>';
        html += '</div>';
        
        // 基本信息
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div style="font-weight:600;margin-bottom:15px;">基本信息</div>';
        
        html += '<div style="margin-bottom:15px;">';
        html += '<label class="' + S.label + '">名字</label>';
        html += '<input type="text" id="ai-name" value="' + (ai ? ai.name : '') + '" placeholder="AI的名字" class="' + S.input + '">';
        html += '</div>';
        
        if (aiType !== 'npc') {
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">类型</label>';
            html += '<select id="ai-type" class="' + S.select + '">';
            html += '<option value="main"' + (aiType === 'main' ? ' selected' : '') + '>主角色</option>';
            html += '<option value="supporting"' + (aiType === 'supporting' ? ' selected' : '') + '>配角</option>';
            html += '</select>';
            html += '</div>';
        }
        
        html += '<div style="margin-bottom:15px;">';
        html += '<label class="' + S.label + '">性格设定</label>';
        html += '<textarea id="ai-personality" placeholder="描述AI的性格特点..." class="' + S.input + ' sys-input-textarea-70">' + (ai ? (ai.personality || '') : '') + '</textarea>';
        html += '</div>';
        
        html += '<div style="margin-bottom:15px;">';
        html += '<label class="' + S.label + '">背景故事</label>';
        html += '<textarea id="ai-story" placeholder="AI的背景故事..." class="' + S.input + ' sys-input-textarea-70">' + (ai ? (ai.story || '') : '') + '</textarea>';
        html += '</div>';
        
        html += '</div>';
        
        // 主角色特有设置
        if (aiType === 'main' || (ai && ai.type === 'main')) {
            // === 工作与身份 ===
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;" id="main-ai-settings">';
            html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:14px;color:#49454F;"><span style="color:#D8456C;">' + I.card + '</span><span>工作与身份</span></div>';
            
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">职业/身份</label>';
            html += '<input type="text" id="ai-job" value="' + (ai ? (ai.job || '') : '') + '" placeholder="如：大学生、程序员、自由职业者" class="' + S.input + '">';
            html += '</div>';
            
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">工作地点</label>';
            html += '<input type="text" id="ai-workplace" value="' + (ai ? (ai.workplace || '') : '') + '" placeholder="如：XX公司、XX大学" class="' + S.input + '">';
            html += '</div>';
            
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">学历/学校</label>';
            html += '<input type="text" id="ai-education" value="' + (ai ? (ai.education || '') : '') + '" placeholder="如：XX大学本科" class="' + S.input + '">';
            html += '</div>';
            
            html += '</div>';
            
            // === 财产系统 ===
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:14px;color:#49454F;"><span style="color:#D8456C;">' + I.chart + '</span><span>财产设定</span></div>';
            
            // 财富阶级
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">财富阶级</label>';
            html += '<select id="ai-wealth-class" class="' + S.select + '">';
            var wealthClasses = [
                { value: 'poor', label: '拮据 - 生活紧张' },
                { value: 'normal', label: '普通 - 正常收支' },
                { value: 'rich', label: '富裕 - 生活优渥' },
                { value: 'wealthy', label: '富豪 - 非常有钱' },
                { value: 'infinite', label: '无限 - 不用算钱' }
            ];
            wealthClasses.forEach(function(wc) {
                var selected = (ai && ai.wealthClass === wc.value) ? ' selected' : '';
                html += '<option value="' + wc.value + '"' + selected + '>' + wc.label + '</option>';
            });
            html += '</select>';
            html += '<div style="font-size:11px;color:#999;margin-top:5px;">选择"无限"则AI不用计算收支，适合设定为富二代等人设</div>';
            html += '</div>';
            
            // 资产设置（非无限时显示）
            html += '<div id="ai-assets-section">';
            if (!ai || !ai.assetsLocked) {
                html += '<div style="margin-bottom:15px;">';
                html += '<label style="display:block;font-size:14px;color:#666;margin-bottom:5px;">初始资产（设定后锁定，不可人为修改）</label>';
                html += '<input type="number" id="ai-assets" value="' + (ai ? (ai.assets || 0) : 0) + '" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:10px;font-size:14px;box-sizing:border-box;">';
                html += '</div>';
            } else {
                html += '<div style="margin-bottom:15px;padding:12px;background:#f8f8f8;border-radius:10px;">';
                html += '<span style="color:#666;">资产已锁定：¥' + (ai.assets || 0).toFixed(2) + '</span>';
                html += '</div>';
            }
            html += '</div>';
            
            // 工资设定
            html += '<div style="border-top:1px solid #f0f0f0;padding-top:15px;margin-top:15px;">';
            html += '<div style="font-size:13px;font-weight:500;color:#49454F;margin-bottom:12px;">工资设定</div>';
            
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">月薪金额</label>';
            html += '<input type="number" id="ai-salary-amount" value="' + (ai && ai.salary ? ai.salary.amount : 0) + '" placeholder="0" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">发薪日（每月几号）</label>';
            html += '<input type="number" id="ai-salary-payday" value="' + (ai && ai.salary ? ai.salary.payday : 1) + '" min="1" max="31" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '</div>';
            
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">发薪时间</label>';
            html += '<input type="time" id="ai-salary-time" value="' + (ai && ai.salary ? ai.salary.payTime : '10:00') + '" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '</div>';
            
            // 生活开支
            html += '<div style="border-top:1px solid #f0f0f0;padding-top:15px;margin-top:15px;">';
            html += '<div style="font-size:13px;font-weight:500;color:#49454F;margin-bottom:12px;">每月开支</div>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">房租</label>';
            html += '<input type="number" id="ai-expense-rent" value="' + (ai && ai.expenses ? ai.expenses.rent : 0) + '" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">餐饮</label>';
            html += '<input type="number" id="ai-expense-food" value="' + (ai && ai.expenses ? ai.expenses.food : 0) + '" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">娱乐</label>';
            html += '<input type="number" id="ai-expense-entertainment" value="' + (ai && ai.expenses ? ai.expenses.entertainment : 0) + '" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">其他</label>';
            html += '<input type="number" id="ai-expense-other" value="' + (ai && ai.expenses ? ai.expenses.other : 0) + '" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            
            html += '</div>';
            
            // === 喜好与习惯 ===
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:14px;color:#49454F;"><span style="color:#D8456C;">' + I.star + '</span><span>喜好与习惯</span></div>';
            
            var prefs = ai && ai.preferences ? ai.preferences : {};
            
            // 社交倾向
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">社交倾向</label>';
            html += '<select id="ai-social-level" class="' + S.select + '">';
            html += '<option value="introvert"' + (prefs.socialLevel === 'introvert' ? ' selected' : '') + '>内向 - 不喜欢主动</option>';
            html += '<option value="normal"' + (prefs.socialLevel === 'normal' || !prefs.socialLevel ? ' selected' : '') + '>正常 - 普通社交</option>';
            html += '<option value="extrovert"' + (prefs.socialLevel === 'extrovert' ? ' selected' : '') + '>外向 - 喜欢交流</option>';
            html += '</select>';
            html += '</div>';
            
            // 作息时间
            html += '<div style="margin-bottom:15px;">';
            html += '<div style="font-size:13px;font-weight:500;color:#49454F;margin-bottom:10px;">作息时间</div>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">起床时间</label>';
            html += '<input type="time" id="ai-wake-time" value="' + (prefs.wakeUpTime || '08:00') + '" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">睡觉时间</label>';
            html += '<input type="time" id="ai-sleep-time" value="' + (prefs.sleepTime || '23:00') + '" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            
            // 回复速度（延迟回复模式专用）
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">回复延迟基础时间</label>';
            html += '<div style="font-size:11px;color:#888;margin-bottom:8px;">仅在聊天应用开启「延迟回复模式」时生效</div>';
            html += '<select id="ai-reply-delay-base" class="' + S.select + '">';
            html += '<option value="30"' + (prefs.replyDelayBase === 30 ? ' selected' : '') + '>30秒</option>';
            html += '<option value="60"' + ((prefs.replyDelayBase === 60 || !prefs.replyDelayBase) ? ' selected' : '') + '>60秒（推荐）</option>';
            html += '<option value="90"' + (prefs.replyDelayBase === 90 ? ' selected' : '') + '>90秒</option>';
            html += '<option value="120"' + (prefs.replyDelayBase === 120 ? ' selected' : '') + '>120秒</option>';
            html += '<option value="180"' + (prefs.replyDelayBase === 180 ? ' selected' : '') + '>180秒</option>';
            html += '<option value="300"' + (prefs.replyDelayBase === 300 ? ' selected' : '') + '>300秒（5分钟）</option>';
            html += '</select>';
            html += '</div>';
            
            // 回复延迟随机浮动
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">回复延迟随机浮动</label>';
            html += '<select id="ai-reply-delay-random" class="' + S.select + '">';
            html += '<option value="0"' + (prefs.replyDelayRandom === 0 ? ' selected' : '') + '>无浮动</option>';
            html += '<option value="10"' + (prefs.replyDelayRandom === 10 ? ' selected' : '') + '>±10秒</option>';
            html += '<option value="20"' + ((prefs.replyDelayRandom === 20 || !prefs.replyDelayRandom) ? ' selected' : '') + '>±20秒</option>';
            html += '<option value="30"' + (prefs.replyDelayRandom === 30 ? ' selected' : '') + '>±30秒</option>';
            html += '<option value="60"' + (prefs.replyDelayRandom === 60 ? ' selected' : '') + '>±60秒</option>';
            html += '</select>';
            html += '</div>';
            
            // 能力设定
            html += '<div style="margin-bottom:15px;">';
            html += '<div style="font-size:13px;font-weight:500;color:#49454F;margin-bottom:10px;">能力设定</div>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#888;margin-bottom:4px;">游戏能力</label>';
            html += '<select id="ai-gaming-skill" class="' + S.select + ' sys-select-padded">';
            html += '<option value="noob"' + (prefs.gamingSkill === 'noob' ? ' selected' : '') + '>新手</option>';
            html += '<option value="low"' + (prefs.gamingSkill === 'low' ? ' selected' : '') + '>较弱</option>';
            html += '<option value="medium"' + (prefs.gamingSkill === 'medium' || !prefs.gamingSkill ? ' selected' : '') + '>一般</option>';
            html += '<option value="high"' + (prefs.gamingSkill === 'high' ? ' selected' : '') + '>较强</option>';
            html += '<option value="pro"' + (prefs.gamingSkill === 'pro' ? ' selected' : '') + '>高手</option>';
            html += '</select>';
            html += '</div>';
            html += '<div>';
            html += '<label style="display:block;font-size:12px;color:#746B6E;margin-bottom:4px;">烹饪能力</label>';
            html += '<select id="ai-cooking-skill" class="' + S.select + ' sys-select-padded">';
            html += '<option value="noob"' + (prefs.cookingSkill === 'noob' ? ' selected' : '') + '>黑暗料理</option>';
            html += '<option value="low"' + (prefs.cookingSkill === 'low' ? ' selected' : '') + '>简单菜</option>';
            html += '<option value="medium"' + (prefs.cookingSkill === 'medium' || !prefs.cookingSkill ? ' selected' : '') + '>还不错</option>';
            html += '<option value="high"' + (prefs.cookingSkill === 'high' ? ' selected' : '') + '>很棒</option>';
            html += '<option value="pro"' + (prefs.cookingSkill === 'pro' ? ' selected' : '') + '>大厨级</option>';
            html += '</select>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            
            // 频率设定（滑块）
            html += '<div style="margin-bottom:15px;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
            html += '<div style="font-size:13px;font-weight:500;color:#49454F;">行为频率控制</div>';
            html += '<label style="position:relative;width:44px;height:24px;flex-shrink:0;">';
            html += '<input type="checkbox" id="ai-freq-control-enabled" ' + (prefs.frequencyControlEnabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
            html += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (prefs.frequencyControlEnabled ? '#34C759' : '#ccc') + ';border-radius:24px;transition:0.3s;"></span>';
            html += '<span style="position:absolute;height:18px;width:18px;left:' + (prefs.frequencyControlEnabled ? '23px' : '3px') + ';bottom:3px;background-color:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
            html += '</label>';
            html += '</div>';
            html += '<div style="font-size:11px;color:#888;margin-bottom:10px;">开启后按频率概率决定是否告知AI可用动作，关闭则每次都告知全部动作</div>';
            
            var frequencies = [
                { id: 'call', label: '接电话', value: prefs.callFrequency || 0.1 },
                { id: 'video', label: '打视频', value: prefs.videoFrequency || 0.05 },
                { id: 'message', label: '主动发消息', value: prefs.messageFrequency || 0.3 },
                { id: 'invite', label: '主动邀请（一起听/游戏）', value: prefs.inviteFrequency || 0.15 },
                { id: 'takeout', label: '点外卖', value: prefs.takeoutFrequency || 0.2 }
            ];
            
            frequencies.forEach(function(freq) {
                html += '<div style="margin-bottom:12px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
                html += '<label style="font-size:12px;color:#666;">' + freq.label + '</label>';
                html += '<span id="ai-freq-' + freq.id + '-value" style="font-size:12px;color:#FF6B8A;font-weight:500;">' + Math.round(freq.value * 100) + '%</span>';
                html += '</div>';
                html += '<input type="range" id="ai-freq-' + freq.id + '" min="0" max="100" value="' + Math.round(freq.value * 100) + '" style="width:100%;accent-color:#FF8FAB;">';
                html += '</div>';
            });
            
            html += '</div>';
            
            html += '</div>';
            
            // === 自动发消息 ===
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:14px;color:#49454F;"><span style="color:#D8456C;">' + I.note + '</span><span>自动发消息</span></div>';
            
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<span>启用自动发消息</span>';
            html += '<label style="position:relative;width:50px;height:28px;">';
            html += '<input type="checkbox" id="ai-auto-message" ' + (ai && ai.autoMessageEnabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
            html += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (ai && ai.autoMessageEnabled ? '#34C759' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
            html += '<span style="position:absolute;height:22px;width:22px;left:' + (ai && ai.autoMessageEnabled ? '25px' : '3px') + ';bottom:3px;background-color:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
            html += '</label>';
            html += '</div>';
            html += '<div style="font-size:11px;color:#999;margin-top:8px;">开启后AI会根据时间、状态等主动发消息，会消耗tokens</div>';
            
            html += '</div>';
            
            // === 认知系统 ===
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:14px;color:#49454F;"><span style="color:#D8456C;">' + I.brain + '</span><span>认知系统（可手动编辑）</span></div>';
            html += '<div style="font-size:11px;color:#888;margin-bottom:15px;">AI对自己、用户、他人的认知理解，会影响聊天行为</div>';
            
            var cognition = ai && ai.cognition ? ai.cognition : {};
            
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="display:block;font-size:12px;color:#E65100;margin-bottom:5px;font-weight:500;">自我认知</label>';
            html += '<textarea id="ai-cognition-self" placeholder="AI怎么看待自己..." class="' + S.input + ' sys-input-textarea-cognition">' + (cognition.self || (ai && ai.selfPerception) || '') + '</textarea>';
            html += '</div>';
            
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="display:block;font-size:12px;color:#1565C0;margin-bottom:5px;font-weight:500;">对用户的认知</label>';
            html += '<textarea id="ai-cognition-user" placeholder="AI怎么看待用户..." class="' + S.input + ' sys-input-textarea-cognition">' + (cognition.user || (ai && ai.userPerception) || '') + '</textarea>';
            html += '</div>';
            
            html += '<div style="margin-bottom:12px;">';
            html += '<label style="display:block;font-size:12px;color:#2E7D32;margin-bottom:5px;font-weight:500;">对他人的认知</label>';
            html += '<textarea id="ai-cognition-others" placeholder="AI怎么看待周围的人/世界..." class="' + S.input + ' sys-input-textarea-cognition">' + (cognition.others || (ai && ai.othersPerception) || '') + '</textarea>';
            html += '</div>';
            
            html += '</div>';
            
            // === 最近故事状态 ===
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:14px;color:#49454F;"><span style="color:#D8456C;">' + I.note + '</span><span>最近故事状态</span></div>';
            html += '<div style="font-size:11px;color:#746B6E;margin-bottom:10px;">AI当前的生活状态，会影响聊天时的背景描述</div>';
            html += '<textarea id="ai-recent-story" placeholder="AI最近在做什么、有什么事情发生..." class="' + S.input + ' sys-input-textarea-70" style="font-size:13px;">' + (ai && ai.recentStory ? ai.recentStory : '') + '</textarea>';
            html += '</div>';
        }
        
        // 世界观绑定
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div style="font-weight:600;margin-bottom:15px;">世界观绑定</div>';
        
        html += '<select id="ai-world" class="' + S.select + '">';
        html += '<option value="">不绑定世界观</option>';
        Object.values(PhoneCore.worlds).forEach(function(world) {
            var selected = (ai && ai.worldId === world.id) ? ' selected' : '';
            html += '<option value="' + world.id + '"' + selected + '>' + world.name + '</option>';
        });
        html += '</select>';
        
        html += '<div id="location-select-container" style="margin-top:15px;' + ((ai && ai.worldId) ? '' : 'display:none;') + '">';
        html += '<label class="' + S.label + '">所在地点</label>';
        html += '<select id="ai-location" class="' + S.select + '">';
        html += '<option value="">不指定地点</option>';
        if (ai && ai.worldId) {
            var world = PhoneCore.getWorld(ai.worldId);
            if (world) {
                Object.values(world.locations).forEach(function(loc) {
                    var selected = (ai.locationId === loc.id) ? ' selected' : '';
                    html += '<option value="' + loc.id + '"' + selected + '>' + loc.name + '</option>';
                });
            }
        }
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        
        // API配置
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div style="font-weight:600;margin-bottom:15px;">API配置</div>';
        
        var apiConfigs = Object.values(PhoneCore.api.configs);
        var apiGroups = Object.values(PhoneCore.api.groups);
        
        html += '<select id="ai-api-config" class="' + S.select + '">';
        html += '<option value="">使用默认配置</option>';
        
        if (apiConfigs.length > 0) {
            html += '<optgroup label="单个配置">';
            apiConfigs.forEach(function(config) {
                var selected = (ai && ai.apiConfigId === config.id) ? ' selected' : '';
                html += '<option value="' + config.id + '"' + selected + '>' + config.name + '</option>';
            });
            html += '</optgroup>';
        }
        
        if (apiGroups.length > 0) {
            html += '<optgroup label="配置组">';
            apiGroups.forEach(function(group) {
                var selected = (ai && ai.apiConfigId === group.id) ? ' selected' : '';
                html += '<option value="' + group.id + '"' + selected + '>' + group.name + '</option>';
            });
            html += '</optgroup>';
        }
        
        html += '</select>';
        html += '</div>';
        
        // 时间表绑定
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:14px;color:#49454F;"><span style="color:#D8456C;">' + I.calendar + '</span><span>时间表绑定</span></div>';
        html += '<div style="font-size:12px;color:#888;margin-bottom:10px;">绑定时间表后，AI将根据时间表调整回复行为</div>';
        
        var allSchedules = PhoneCore.getAllSchedules();
        html += '<select id="ai-schedule" class="' + S.select + '">';
        html += '<option value="">不绑定时间表</option>';
        allSchedules.forEach(function(schedule) {
            var selected = (ai && ai.scheduleId === schedule.id) ? ' selected' : '';
            html += '<option value="' + schedule.id + '"' + selected + '>' + getScheduleIconLabel(schedule.icon) + ' ' + schedule.name + '</option>';
        });
        html += '</select>';
        
        // 显示当前时间表状态
        if (ai && ai.scheduleId) {
            var currentSchedule = PhoneCore.getSchedule(ai.scheduleId);
            if (currentSchedule) {
                var currentActivity = currentSchedule.getCurrentActivity();
                if (currentActivity) {
                    html += '<div style="margin-top:12px;padding:10px;background:#E8F5E9;border-radius:10px;font-size:12px;">';
                    html += '<span style="color:#34C759;font-weight:500;">当前活动：</span>';
                    html += '<span>' + currentActivity.icon + ' ' + currentActivity.activity + ' (' + currentActivity.start + '-' + currentActivity.end + ')</span>';
                    html += '</div>';
                }
            }
        }
        
        html += '</div>';
        
        // 专属资源库（仅编辑已存在的AI时显示）
        if (!isNew) {
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:10px;color:#49454F;"><span style="color:#667eea;">' + I.robot + '</span><span>AI专属资源库</span></div>';
            html += '<div style="font-size:12px;color:#888;margin-bottom:14px;">AI可从总库调取头像和背景到自己的专属库，通过API智能选择</div>';
            
            // 专属头像库
            var exclusiveAvatars = ai.exclusiveAvatars || [];
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(255,107,138,0.06);border-radius:10px;margin-bottom:10px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;">';
            html += '<span style="color:#FF6B8A;">' + I.user + '</span>';
            html += '<span style="font-size:13px;color:#333;">头像库</span>';
            html += '<span style="font-size:12px;color:#888;">(' + exclusiveAvatars.length + '个)</span>';
            html += '</div>';
            html += '<button id="manage-exclusive-avatars-btn" style="padding:6px 14px;background:linear-gradient(135deg,#FF8FAB,#FF6B8A);color:white;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">管理</button>';
            html += '</div>';
            
            // 专属背景库
            var exclusiveBackgrounds = ai.exclusiveBackgrounds || [];
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(78,205,196,0.06);border-radius:10px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;">';
            html += '<span style="color:#4ECDC4;">' + I.image + '</span>';
            html += '<span style="font-size:13px;color:#333;">背景库</span>';
            html += '<span style="font-size:12px;color:#888;">(' + exclusiveBackgrounds.length + '个)</span>';
            html += '</div>';
            html += '<button id="manage-exclusive-backgrounds-btn" style="padding:6px 14px;background:linear-gradient(135deg,#5ED9CE,#4ECDC4);color:white;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">管理</button>';
            html += '</div>';
            
            html += '</div>';
        }
        
        // 保存和删除按钮
        html += '<button id="save-ai-btn" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">保存</button>';
        
        if (!isNew) {
            html += '<button id="delete-ai-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:12px;font-size:16px;cursor:pointer;margin-top:10px;">删除此AI</button>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        var avatarData = ai ? ai.avatar : '';
        
        // 头像上传
        var avatarContainer = page.querySelector('#ai-avatar-container');
        if (avatarContainer) {
            avatarContainer.onclick = function() {
                PhoneCore.resources.createImageInput(function(resource) {
                    avatarData = resource.data;
                    avatarContainer.innerHTML = '<img src="' + resource.data + '" style="width:100%;height:100%;object-fit:cover;">';
                });
            };
        }
        
        // 世界观选择联动地点
        var worldSelect = page.querySelector('#ai-world');
        var locationContainer = page.querySelector('#location-select-container');
        var locationSelect = page.querySelector('#ai-location');
        
        if (worldSelect) {
            worldSelect.onchange = function() {
                var worldId = worldSelect.value;
                if (worldId) {
                    var world = PhoneCore.getWorld(worldId);
                    if (world) {
                        var locations = Object.values(world.locations);
                        var html = '<option value="">不指定地点</option>';
                        locations.forEach(function(loc) {
                            html += '<option value="' + loc.id + '">' + loc.name + '</option>';
                        });
                        locationSelect.innerHTML = html;
                        locationContainer.style.display = 'block';
                    }
                } else {
                    locationContainer.style.display = 'none';
                }
            };
        }
        
        // 自动发消息开关
        var autoMessageCheckbox = page.querySelector('#ai-auto-message');
        if (autoMessageCheckbox) {
            autoMessageCheckbox.onchange = function() {
                var toggle = autoMessageCheckbox.parentElement;
                var slider = toggle.querySelector('span:last-child');
                var track = toggle.querySelector('span:first-of-type');
                
                if (autoMessageCheckbox.checked) {
                    track.style.backgroundColor = '#34C759';
                    slider.style.left = '25px';
                } else {
                    track.style.backgroundColor = '#ccc';
                    slider.style.left = '3px';
                }
            };
        }
        
        // 频率控制开关事件
        var freqControlCheckbox = page.querySelector('#ai-freq-control-enabled');
        if (freqControlCheckbox) {
            freqControlCheckbox.onchange = function() {
                var toggle = freqControlCheckbox.parentElement;
                var slider = toggle.querySelector('span:last-child');
                var track = toggle.querySelector('span:first-of-type');
                
                if (freqControlCheckbox.checked) {
                    track.style.backgroundColor = '#34C759';
                    slider.style.left = '23px';
                } else {
                    track.style.backgroundColor = '#ccc';
                    slider.style.left = '3px';
                }
            };
        }
        
        // 频率滑块事件
        ['call', 'video', 'message', 'invite', 'takeout'].forEach(function(freqId) {
            var slider = page.querySelector('#ai-freq-' + freqId);
            var valueSpan = page.querySelector('#ai-freq-' + freqId + '-value');
            if (slider && valueSpan) {
                slider.oninput = function() {
                    valueSpan.textContent = slider.value + '%';
                };
            }
        });
        
        // 财富阶级选择联动资产输入框显示
        var wealthClassSelect = page.querySelector('#ai-wealth-class');
        var assetsSection = page.querySelector('#ai-assets-section');
        if (wealthClassSelect && assetsSection) {
            wealthClassSelect.onchange = function() {
                if (wealthClassSelect.value === 'infinite') {
                    assetsSection.style.opacity = '0.5';
                    assetsSection.style.pointerEvents = 'none';
                } else {
                    assetsSection.style.opacity = '1';
                    assetsSection.style.pointerEvents = 'auto';
                }
            };
            // 初始化状态
            if (wealthClassSelect.value === 'infinite') {
                assetsSection.style.opacity = '0.5';
                assetsSection.style.pointerEvents = 'none';
            }
        }
        
        // 专属头像库管理按钮
        var exclusiveAvatarsBtn = page.querySelector('#manage-exclusive-avatars-btn');
        if (exclusiveAvatarsBtn && aiId) {
            exclusiveAvatarsBtn.onclick = function() {
                self.openExclusiveAvatarManager(aiId);
            };
        }
        
        // 专属背景库管理按钮
        var exclusiveBackgroundsBtn = page.querySelector('#manage-exclusive-backgrounds-btn');
        if (exclusiveBackgroundsBtn && aiId) {
            exclusiveBackgroundsBtn.onclick = function() {
                self.openExclusiveBackgroundManager(aiId);
            };
        }
        
        // 保存
        var saveBtn = page.querySelector('#save-ai-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var name = page.querySelector('#ai-name').value.trim();
                if (!name) {
                    alert('请输入AI名字');
                    return;
                }
                
                var personality = page.querySelector('#ai-personality').value.trim();
                var story = page.querySelector('#ai-story').value.trim();
                var worldId = page.querySelector('#ai-world').value;
                var locationId = page.querySelector('#ai-location') ? page.querySelector('#ai-location').value : '';
                var apiConfigId = page.querySelector('#ai-api-config').value;
                
                var typeSelect = page.querySelector('#ai-type');
                var type = typeSelect ? typeSelect.value : aiType;
                
                var scheduleSelect = page.querySelector('#ai-schedule');
                var newScheduleId = scheduleSelect ? scheduleSelect.value : '';
                
                var aiData = {
                    name: name,
                    type: type,
                    avatar: avatarData,
                    personality: personality,
                    story: story,
                    worldId: worldId || null,
                    locationId: locationId || null,
                    apiConfigId: apiConfigId || null,
                    scheduleId: newScheduleId || null
                };
                
                // 主角色特有字段
                if (type === 'main') {
                    var jobInput = page.querySelector('#ai-job');
                    var workplaceInput = page.querySelector('#ai-workplace');
                    var educationInput = page.querySelector('#ai-education');
                    var autoMessageInput = page.querySelector('#ai-auto-message');
                    var assetsInput = page.querySelector('#ai-assets');
                    var wealthClassSelect = page.querySelector('#ai-wealth-class');
                    
                    if (jobInput) aiData.job = jobInput.value.trim();
                    if (workplaceInput) aiData.workplace = workplaceInput.value.trim();
                    if (educationInput) aiData.education = educationInput.value.trim();
                    if (autoMessageInput) aiData.autoMessageEnabled = autoMessageInput.checked;
                    if (wealthClassSelect) aiData.wealthClass = wealthClassSelect.value;
                    
                    // 资产设置
                    if (assetsInput && (!ai || !ai.assetsLocked)) {
                        var assets = parseFloat(assetsInput.value) || 0;
                        aiData.assets = assets;
                        aiData.assetsLocked = true;
                    }
                    
                    // 工资设定
                    var salaryAmountInput = page.querySelector('#ai-salary-amount');
                    var salaryPaydayInput = page.querySelector('#ai-salary-payday');
                    var salaryTimeInput = page.querySelector('#ai-salary-time');
                    aiData.salary = {
                        amount: salaryAmountInput ? parseFloat(salaryAmountInput.value) || 0 : 0,
                        payday: salaryPaydayInput ? parseInt(salaryPaydayInput.value) || 1 : 1,
                        payTime: salaryTimeInput ? salaryTimeInput.value : '10:00',
                        lastPayDate: ai && ai.salary ? ai.salary.lastPayDate : null,
                        autoDeposit: true
                    };
                    
                    // 生活开支
                    var expenseRentInput = page.querySelector('#ai-expense-rent');
                    var expenseFoodInput = page.querySelector('#ai-expense-food');
                    var expenseEntInput = page.querySelector('#ai-expense-entertainment');
                    var expenseOtherInput = page.querySelector('#ai-expense-other');
                    aiData.expenses = {
                        rent: expenseRentInput ? parseFloat(expenseRentInput.value) || 0 : 0,
                        food: expenseFoodInput ? parseFloat(expenseFoodInput.value) || 0 : 0,
                        entertainment: expenseEntInput ? parseFloat(expenseEntInput.value) || 0 : 0,
                        other: expenseOtherInput ? parseFloat(expenseOtherInput.value) || 0 : 0,
                        paymentDay: 1
                    };
                    
                    // 喜好设定
                    var socialLevelSelect = page.querySelector('#ai-social-level');
                    var replyDelayBaseSelect = page.querySelector('#ai-reply-delay-base');
                    var replyDelayRandomSelect = page.querySelector('#ai-reply-delay-random');
                    var gamingSkillSelect = page.querySelector('#ai-gaming-skill');
                    var cookingSkillSelect = page.querySelector('#ai-cooking-skill');
                    var wakeTimeInput = page.querySelector('#ai-wake-time');
                    var sleepTimeInput = page.querySelector('#ai-sleep-time');
                    var freqControlEnabled = page.querySelector('#ai-freq-control-enabled');
                    var freqCallInput = page.querySelector('#ai-freq-call');
                    var freqVideoInput = page.querySelector('#ai-freq-video');
                    var freqMsgInput = page.querySelector('#ai-freq-message');
                    var freqInviteInput = page.querySelector('#ai-freq-invite');
                    var freqTakeoutInput = page.querySelector('#ai-freq-takeout');
                    
                    aiData.preferences = {
                        socialLevel: socialLevelSelect ? socialLevelSelect.value : 'normal',
                        replyDelayBase: replyDelayBaseSelect ? parseInt(replyDelayBaseSelect.value) : 60,
                        replyDelayRandom: replyDelayRandomSelect ? parseInt(replyDelayRandomSelect.value) : 20,
                        gamingSkill: gamingSkillSelect ? gamingSkillSelect.value : 'medium',
                        cookingSkill: cookingSkillSelect ? cookingSkillSelect.value : 'medium',
                        wakeUpTime: wakeTimeInput ? wakeTimeInput.value : '08:00',
                        sleepTime: sleepTimeInput ? sleepTimeInput.value : '23:00',
                        frequencyControlEnabled: freqControlEnabled ? freqControlEnabled.checked : false,
                        callFrequency: freqCallInput ? parseInt(freqCallInput.value) / 100 : 0.1,
                        videoFrequency: freqVideoInput ? parseInt(freqVideoInput.value) / 100 : 0.05,
                        messageFrequency: freqMsgInput ? parseInt(freqMsgInput.value) / 100 : 0.3,
                        inviteFrequency: freqInviteInput ? parseInt(freqInviteInput.value) / 100 : 0.15,
                        takeoutFrequency: freqTakeoutInput ? parseInt(freqTakeoutInput.value) / 100 : 0.2
                    };
                    
                    // 认知系统
                    var cognitionSelfInput = page.querySelector('#ai-cognition-self');
                    var cognitionUserInput = page.querySelector('#ai-cognition-user');
                    var cognitionOthersInput = page.querySelector('#ai-cognition-others');
                    aiData.cognition = {
                        self: cognitionSelfInput ? cognitionSelfInput.value.trim() : '',
                        user: cognitionUserInput ? cognitionUserInput.value.trim() : '',
                        others: cognitionOthersInput ? cognitionOthersInput.value.trim() : '',
                        lastUpdated: Date.now()
                    };
                    // 同步到兼容字段
                    aiData.selfPerception = aiData.cognition.self;
                    aiData.userPerception = aiData.cognition.user;
                    aiData.othersPerception = aiData.cognition.others;
                    
                    // 最近故事状态
                    var recentStoryInput = page.querySelector('#ai-recent-story');
                    aiData.recentStory = recentStoryInput ? recentStoryInput.value.trim() : '';
                    
                }
                
                // 处理时间表绑定变更
                if (!isNew && ai.scheduleId !== newScheduleId) {
                    // 解绑旧的
                    if (ai.scheduleId) {
                        var oldSchedule = PhoneCore.getSchedule(ai.scheduleId);
                        if (oldSchedule) {
                            oldSchedule.unbindFrom('ais', ai.id);
                            PhoneCore.saveSchedule(oldSchedule);
                        }
                    }
                    // 绑定新的
                    if (newScheduleId) {
                        var newSchedule = PhoneCore.getSchedule(newScheduleId);
                        if (newSchedule) {
                            newSchedule.bindTo('ais', ai.id);
                            PhoneCore.saveSchedule(newSchedule);
                        }
                    }
                }
                
                if (isNew) {
                    var newAI = new AICharacter(aiData);
                    PhoneCore.saveAI(newAI).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.refreshCurrentTab();
                    });
                } else {
                    Object.assign(ai, aiData);
                    ai.updatedAt = Date.now();
                    PhoneCore.saveAI(ai).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.refreshCurrentTab();
                    });
                }
            };
        }
        
        // 删除
        var deleteBtn = page.querySelector('#delete-ai-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此AI？所有相关数据将被清除。')) {
                    PhoneCore.deleteAI(aiId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.refreshCurrentTab();
                    });
                }
            };
        }
    };

    // AI详情页
    SystemConfigApp.prototype.openAIDetail = function(aiId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var html = '<div style="padding:20px;">';
        
        // 头像和基本信息
        html += '<div style="text-align:center;margin-bottom:20px;">';
        html += '<div style="width:88px;height:88px;border-radius:22px;background:linear-gradient(135deg,#F5F5F5,#E8E8E8);margin:0 auto 12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;">';
        if (ai.avatar) {
            html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            html += '<span style="color:#999;">' + I.robot + '</span>';
        }
        html += '</div>';
        html += '<div style="font-size:22px;font-weight:600;color:#1D1B20;">' + ai.name + '</div>';
        html += '<div style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:500;' + (ai.type === 'main' ? 'background:rgba(255,215,0,0.15);color:#B8860B;' : ai.type === 'supporting' ? 'background:rgba(102,126,234,0.12);color:#5C6BC0;' : 'background:rgba(158,158,158,0.12);color:#757575;') + '">';
        html += (ai.type === 'main' ? I.star : ai.type === 'supporting' ? I.users : I.mask) + ' ' + (ai.type === 'main' ? '主角色' : ai.type === 'supporting' ? '配角' : 'NPC');
        html += '</div>';
        if (ai.isBlocked) {
            html += '<div style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#FF3B30;margin-top:8px;">' + I.block + ' 已拉黑</div>';
        }
        html += '</div>';
        
        // 状态卡片
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">';
        html += '<div style="background:white;border-radius:12px;padding:15px;text-align:center;">';
        html += '<div style="font-size:24px;font-weight:600;color:#007AFF;">' + (ai.tokensUsed.total || 0) + '</div>';
        html += '<div style="font-size:12px;color:#666;margin-top:5px;">Tokens消耗</div>';
        html += '</div>';
        html += '<div style="background:white;border-radius:12px;padding:15px;text-align:center;">';
        html += '<div style="font-size:24px;font-weight:600;color:#34C759;">¥' + (ai.assets || 0).toFixed(0) + '</div>';
        html += '<div style="font-size:12px;color:#666;margin-top:5px;">资产</div>';
        html += '</div>';
        html += '</div>';
        
        // 操作按钮
        html += '<div style="display:flex;gap:10px;margin-bottom:20px;">';
        html += '<button id="edit-ai-btn" style="flex:1;padding:12px;background:#007AFF;color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;">编辑</button>';
        if (ai.type === 'main') {
            html += '<button id="toggle-block-btn" style="flex:1;padding:12px;background:' + (ai.isBlocked ? '#34C759' : '#FF3B30') + ';color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;">' + (ai.isBlocked ? '解除拉黑' : '拉黑') + '</button>';
        }
        html += '</div>';
        
        // 升级选项（NPC和配角）- Material 3 风格
        if (ai.type === 'npc' || ai.type === 'supporting') {
            var chatCount = ai.chatHistory ? ai.chatHistory.length : 0;
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
            html += '<div style="display:flex;align-items:center;gap:8px;font-weight:500;font-size:14px;margin-bottom:12px;color:#49454F;">';
            html += '<span style="display:flex;align-items:center;color:#D8456C;">' + I.up_arrow + '</span>';
            html += '<span>角色升级</span>';
            html += '</div>';
            
            if (ai.type === 'npc') {
                var npcProgress = Math.min(100, chatCount);
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
                html += '<span style="font-size:12px;color:#746B6E;">升级为配角</span>';
                html += '<span style="font-size:12px;color:#D8456C;font-weight:500;">' + chatCount + ' / 100</span>';
                html += '</div>';
                html += '<div class="' + S.progressTrack + '">';
                html += '<div class="' + S.progressIndicator + '" style="width:' + npcProgress + '%;background:linear-gradient(90deg,#4CAF50,#66BB6A);"></div>';
                html += '</div>';
                if (chatCount >= 100) {
                    html += '<button id="upgrade-to-supporting-btn" style="width:100%;padding:10px;background:#4CAF50;color:white;border:none;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;margin-top:12px;">升级为配角</button>';
                }
            } else if (ai.type === 'supporting') {
                var supportProgress = Math.min(100, chatCount / 2.5);
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
                html += '<span style="font-size:12px;color:#746B6E;">升级为主角色</span>';
                html += '<span style="font-size:12px;color:#D8456C;font-weight:500;">' + chatCount + ' / 250</span>';
                html += '</div>';
                html += '<div class="' + S.progressTrack + '">';
                html += '<div class="' + S.progressIndicator + '" style="width:' + supportProgress + '%;background:linear-gradient(90deg,#667eea,#764ba2);"></div>';
                html += '</div>';
                if (chatCount >= 250) {
                    html += '<button id="upgrade-to-main-btn" style="width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;margin-top:12px;">升级为主角色</button>';
                }
            }
            html += '</div>';
        }
        
        // 性格设定（可折叠）
        var personalityText = ai.personality || '暂无设定';
        var personalityNeedFold = personalityText.length > 80;
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div class="collapsible-header" data-target="personality-content" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">';
        html += '<span style="font-weight:600;">性格设定</span>';
        if (personalityNeedFold) {
            html += '<span class="collapse-icon" style="font-size:12px;color:#999;transition:transform 0.2s;">▼</span>';
        }
        html += '</div>';
        html += '<div id="personality-content" class="collapsible-content" style="font-size:14px;color:#666;line-height:1.6;margin-top:10px;' + (personalityNeedFold ? 'max-height:60px;overflow:hidden;' : '') + '">' + personalityText + '</div>';
        if (personalityNeedFold) {
            html += '<div class="collapse-fade" style="height:20px;background:linear-gradient(transparent, white);margin-top:-20px;position:relative;pointer-events:none;"></div>';
        }
        html += '</div>';
        
        // 背景故事（可折叠）
        var storyText = ai.story || '暂无故事';
        var storyNeedFold = storyText.length > 80;
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div class="collapsible-header" data-target="story-content" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">';
        html += '<span style="font-weight:600;">背景故事</span>';
        if (storyNeedFold) {
            html += '<span class="collapse-icon" style="font-size:12px;color:#999;transition:transform 0.2s;">▼</span>';
        }
        html += '</div>';
        html += '<div id="story-content" class="collapsible-content" style="font-size:14px;color:#666;line-height:1.6;margin-top:10px;' + (storyNeedFold ? 'max-height:60px;overflow:hidden;' : '') + '">' + storyText + '</div>';
        if (storyNeedFold) {
            html += '<div class="collapse-fade" style="height:20px;background:linear-gradient(transparent, white);margin-top:-20px;position:relative;pointer-events:none;"></div>';
        }
        html += '</div>';
        
        // 主角色特有功能
        if (ai.type === 'main') {
            // 【记忆库】总结式记忆系统
            html += '<div class="config-card ' + S.glassCard + '">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">';
            html += '<span style="font-weight:600;color:#333;">记忆库</span>';
            html += '<button id="manage-memory-btn" class="' + S.primaryButton + '" style="padding:6px 14px;font-size:12px;">管理</button>';
            html += '</div>';
            
            // 新的总结式记忆统计
            var memorySummaries = ai.memorySummaries || {};
            var chatEnabled = memorySummaries.chat && memorySummaries.chat.enabled;
            var weiboEnabled = memorySummaries.weibo && memorySummaries.weibo.enabled;
            var shopEnabled = memorySummaries.shop && memorySummaries.shop.enabled;
            var manualData = memorySummaries.manualMemory || {};
            var manualCount = (manualData.items ? manualData.items.length : 0) + (manualData.summary ? 1 : 0);
            // 兼容旧数据
            if (!manualCount && memorySummaries.manual) manualCount = memorySummaries.manual.length;
            var enabledCount = (chatEnabled ? 1 : 0) + (weiboEnabled ? 1 : 0) + (shopEnabled ? 1 : 0);
            
            html += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
            // 聊天记忆
            html += '<div style="flex:1;min-width:80px;background:' + (chatEnabled ? 'linear-gradient(135deg,#b8e0f7,#8ecae6)' : '#f0f0f0') + ';border-radius:10px;padding:12px;text-align:center;">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + (chatEnabled ? 'white' : '#999') + '" style="margin-bottom:4px;"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
            html += '<div style="font-size:11px;color:' + (chatEnabled ? 'white' : '#999') + ';">聊天</div>';
            html += '</div>';
            // 微博记忆
            html += '<div style="flex:1;min-width:80px;background:' + (weiboEnabled ? 'linear-gradient(135deg,#FF6B6B,#E8454A)' : '#f0f0f0') + ';border-radius:10px;padding:12px;text-align:center;">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + (weiboEnabled ? 'white' : '#999') + '" style="margin-bottom:4px;"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>';
            html += '<div style="font-size:11px;color:' + (weiboEnabled ? 'white' : '#999') + ';">微博</div>';
            html += '</div>';
            // 购物记忆
            html += '<div style="flex:1;min-width:80px;background:' + (shopEnabled ? 'linear-gradient(135deg,#A8E6CF,#7DD3B0)' : '#f0f0f0') + ';border-radius:10px;padding:12px;text-align:center;">';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + (shopEnabled ? 'white' : '#999') + '" style="margin-bottom:4px;"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>';
            html += '<div style="font-size:11px;color:' + (shopEnabled ? 'white' : '#999') + ';">小剧场</div>';
            html += '</div>';
            html += '</div>';
            
            // 记忆摘要
            html += '<div style="margin-top:12px;font-size:12px;color:#888;">';
            html += '已启用 ' + enabledCount + ' 项记忆总结';
            if (manualData.summary) {
                html += '，已有手动记忆总结';
                if (manualData.items && manualData.items.length > 0) {
                    html += '（+' + manualData.items.length + '条待总结）';
                }
            } else if (manualData.items && manualData.items.length > 0) {
                html += '，' + manualData.items.length + ' 条待总结记忆';
            }
            html += '</div>';
            html += '</div>';
            
            // 【社交账户】
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">';
            html += '<span style="font-weight:600;">社交账户</span>';
            html += '<button id="manage-social-accounts-btn" style="background:#007AFF;color:white;border:none;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;">管理</button>';
            html += '</div>';
            
            var socialAccounts = ai.socialAccounts || {};
            var accountKeys = Object.keys(socialAccounts);
            if (accountKeys.length > 0) {
                html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
                accountKeys.forEach(function(appId) {
                    var acc = socialAccounts[appId];
                    html += '<div style="background:#f0f0f0;padding:6px 12px;border-radius:15px;font-size:12px;">';
                    html += '<span style="color:#666;">' + appId + ':</span> ';
                    html += '<span style="color:#333;font-weight:500;">@' + (acc.networkId || ai.name) + '</span>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += '<div style="text-align:center;padding:10px;color:#999;font-size:13px;">暂未配置</div>';
            }
            html += '</div>';
            
            // 【关系圈】
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">';
            html += '<div>';
            html += '<span style="font-weight:600;">关系圈</span>';
            var socialCircleCount = ai.socialCircle ? ai.socialCircle.length : 0;
            if (socialCircleCount > 0) {
                html += '<span style="font-size:11px;color:#2196F3;margin-left:8px;background:rgba(33,150,243,0.1);padding:2px 8px;border-radius:10px;">' + socialCircleCount + '位朋友圈好友</span>';
            }
            html += '</div>';
            html += '<div style="display:flex;gap:8px;">';
            html += '<button id="view-relationship-graph-btn" style="background:#f0f0f0;color:#333;border:none;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;">关系图</button>';
            html += '<button id="manage-relationships-btn" style="background:#007AFF;color:white;border:none;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;">管理</button>';
            html += '</div>';
            html += '</div>';
            
            var relationships = ai.relationships || {};
            var relKeys = Object.keys(relationships);
            if (relKeys.length > 0) {
                html += '<div style="display:flex;flex-direction:column;gap:8px;">';
                relKeys.forEach(function(relAiId) {
                    var rel = relationships[relAiId];
                    var relAi = PhoneCore.getAI(relAiId);
                    if (relAi) {
                        var relTypeNames = { friend: '朋友', family: '家人', lover: '恋人', colleague: '同事', stranger: '认识' };
                        var relTypeColors = { friend: '#4CAF50', family: '#FF9800', lover: '#E91E63', colleague: '#2196F3', stranger: '#9E9E9E' };
                        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#f8f8f8;border-radius:10px;">';
                        html += '<div style="width:36px;height:36px;border-radius:50%;background:#e0e0e0;overflow:hidden;">';
                        if (relAi.avatar) {
                            html += '<img src="' + relAi.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                        } else {
                            html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;color:#999;">AI</div>';
                        }
                        html += '</div>';
                        html += '<div style="flex:1;">';
                        html += '<div style="font-size:13px;font-weight:500;">' + relAi.name + '</div>';
                        html += '<div style="font-size:11px;color:' + (relTypeColors[rel.type] || '#666') + ';">' + (relTypeNames[rel.type] || rel.type) + ' · 亲密度 ' + (rel.level || 0) + '</div>';
                        html += '</div>';
                        html += '</div>';
                    }
                });
                html += '</div>';
            } else {
                html += '<div style="text-align:center;padding:10px;color:#999;font-size:13px;">暂无关系</div>';
            }
            html += '</div>';
            
            // 【微博设置】
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:20px;cursor:pointer;" id="weibo-settings-entry">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div style="display:flex;align-items:center;gap:10px;">';
            html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#FFE0B2,#FFCC80);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
            html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="#FF9800"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>';
            html += '</div>';
            html += '<div>';
            html += '<div style="font-weight:500;font-size:14px;color:#333;">微博设置</div>';
            html += '<div style="font-size:11px;color:#888;margin-top:2px;">设置AI自动发帖频率和风格</div>';
            html += '</div>';
            html += '</div>';
            html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
            html += '</div>';
            html += '</div>';
        }
        
        // 互动时长统计
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
        html += '<span style="display:flex;align-items:center;gap:6px;font-weight:500;font-size:14px;color:#49454F;">' + I.clock + ' 互动时长</span>';
        html += '<span id="refresh-activity-stats" style="color:#D8456C;font-size:12px;cursor:pointer;">刷新</span>';
        html += '</div>';
        html += '<div id="activity-stats-container" style="color:#999;text-align:center;padding:10px;">加载中...</div>';
        html += '</div>';
        
        // Tokens消耗详情
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
        html += '<span style="display:flex;align-items:center;gap:6px;font-weight:500;font-size:14px;color:#49454F;">' + I.chart + ' Tokens详情</span>';
        html += '<button id="tokens-detail-btn" style="background:#D8456C;color:white;border:none;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;">查看详情</button>';
        html += '</div>';
        
        var byApp = ai.tokensUsed.byApp || {};
        var appIds = Object.keys(byApp);
        
        if (appIds.length === 0) {
            html += '<div style="text-align:center;padding:15px;color:#999;font-size:13px;">暂无消耗记录</div>';
        } else {
            // 显示前3个App的消耗
            appIds.slice(0, 3).forEach(function(appId) {
                var tokens = byApp[appId];
                var percentage = ai.tokensUsed.total > 0 ? (tokens / ai.tokensUsed.total * 100).toFixed(1) : 0;
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">';
                html += '<span style="font-size:14px;">' + appId + '</span>';
                html += '<span style="font-size:14px;color:#666;">' + tokens + ' (' + percentage + '%)</span>';
                html += '</div>';
            });
            if (appIds.length > 3) {
                html += '<div style="text-align:center;padding:10px;color:#888;font-size:12px;">还有 ' + (appIds.length - 3) + ' 个App...</div>';
            }
        }
        html += '</div>';
        
        // 上下文查看
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;cursor:pointer;" id="context-viewer-entry">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#E8F5E9,#C8E6C9);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="#4CAF50"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:500;font-size:14px;color:#333;">上下文查看</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:2px;">查看发送给AI的内容和提示词</div>';
        html += '</div>';
        html += '</div>';
        html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 编辑按钮
        var editBtn = page.querySelector('#edit-ai-btn');
        if (editBtn) {
            editBtn.onclick = function() {
                page.querySelector('.app-back-btn').click();
                setTimeout(function() {
                    self.openAIEditor(aiId);
                }, 350);
            };
        }
        
        // 拉黑/解除拉黑
        var toggleBlockBtn = page.querySelector('#toggle-block-btn');
        if (toggleBlockBtn) {
            toggleBlockBtn.onclick = function() {
                if (ai.isBlocked) {
                    ai.unblock();
                } else {
                    ai.block();
                }
                PhoneCore.saveAI(ai).then(function() {
                    page.querySelector('.app-back-btn').click();
                    setTimeout(function() {
                        self.openAIDetail(aiId);
                    }, 350);
                });
            };
        }
        
        // 升级为配角
        var upgradeToSupportingBtn = page.querySelector('#upgrade-to-supporting-btn');
        if (upgradeToSupportingBtn) {
            upgradeToSupportingBtn.onclick = function() {
                ai.type = 'supporting';
                ai.updatedAt = Date.now();
                PhoneCore.saveAI(ai).then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '升级成功',
                        message: ai.name + ' 已升级为配角',
                        size: 'mini',
                        duration: 2000
                    });
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                });
            };
        }
        
        // 升级为主角色
        var upgradeToMainBtn = page.querySelector('#upgrade-to-main-btn');
        if (upgradeToMainBtn) {
            upgradeToMainBtn.onclick = function() {
                ai.type = 'main';
                ai.updatedAt = Date.now();
                PhoneCore.saveAI(ai).then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '升级成功',
                        message: ai.name + ' 已升级为主角色',
                        size: 'mini',
                        duration: 2000
                    });
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                });
            };
        }
        
        // 记忆管理
        var manageMemoryBtn = page.querySelector('#manage-memory-btn');
        if (manageMemoryBtn) {
            manageMemoryBtn.onclick = function() {
                self.openMemoryManager(aiId);
            };
        }
        
        
        // 【折叠展开功能】
        page.querySelectorAll('.collapsible-header').forEach(function(header) {
            var targetId = header.getAttribute('data-target');
            var content = page.querySelector('#' + targetId);
            var icon = header.querySelector('.collapse-icon');
            var fade = header.parentElement.querySelector('.collapse-fade');
            if (!content || !icon) return;
            
            var isCollapsed = true;
            header.onclick = function() {
                isCollapsed = !isCollapsed;
                if (isCollapsed) {
                    content.style.maxHeight = '60px';
                    content.style.overflow = 'hidden';
                    icon.style.transform = 'rotate(0deg)';
                    if (fade) fade.style.display = 'block';
                } else {
                    content.style.maxHeight = 'none';
                    content.style.overflow = 'visible';
                    icon.style.transform = 'rotate(180deg)';
                    if (fade) fade.style.display = 'none';
                }
            };
        });
        
        // 【随机心情按钮】
        var randomMoodBtn = page.querySelector('#random-mood-btn');
        if (randomMoodBtn) {
            randomMoodBtn.onclick = function() {
                self.randomizeMood(aiId, page);
            };
        }
        
        // 【查看关系图按钮】
        var viewRelGraphBtn = page.querySelector('#view-relationship-graph-btn');
        if (viewRelGraphBtn) {
            viewRelGraphBtn.onclick = function() {
                self.openRelationshipGraph(aiId);
            };
        }
        
        // 【微博设置入口】
        var weiboSettingsEntry = page.querySelector('#weibo-settings-entry');
        if (weiboSettingsEntry) {
            weiboSettingsEntry.onclick = function() {
                self.openAIWeiboSettings(aiId);
            };
        }
        
        // 【社交账户管理按钮】
        var manageSocialBtn = page.querySelector('#manage-social-accounts-btn');
        if (manageSocialBtn) {
            manageSocialBtn.onclick = function() {
                self.openSocialAccountsManager(aiId);
            };
        }
        
        // 【关系圈管理按钮】
        var manageRelBtn = page.querySelector('#manage-relationships-btn');
        if (manageRelBtn) {
            manageRelBtn.onclick = function() {
                self.openRelationshipsManager(aiId);
            };
        }
        
        // 【Tokens详情按钮】
        var tokensDetailBtn = page.querySelector('#tokens-detail-btn');
        if (tokensDetailBtn) {
            tokensDetailBtn.onclick = function() {
                self.openTokensDetailPage(aiId);
            };
        }
        
        // 【上下文查看按钮】
        var contextViewerEntry = page.querySelector('#context-viewer-entry');
        if (contextViewerEntry) {
            contextViewerEntry.onclick = function() {
                self.openContextViewer(aiId);
            };
        }
        
        // 加载活动统计
        self.loadActivityStats(page, aiId);
        
        // 刷新活动统计
        var refreshStatsBtn = page.querySelector('#refresh-activity-stats');
        if (refreshStatsBtn) {
            refreshStatsBtn.onclick = function() {
                self.loadActivityStats(page, aiId);
            };
        }
    };
    
    // 【加载AI活动统计】
    SystemConfigApp.prototype.loadActivityStats = function(page, aiId) {
        var container = page.querySelector('#activity-stats-container');
        if (!container) return;
        
        if (!PhoneCore.activity) {
            container.innerHTML = '<div style="text-align:center;color:#999;font-size:13px;">活动追踪未启用</div>';
            return;
        }
        
        // 获取活动统计
        PhoneCore.activity.getAIActivityStats(aiId).then(function(stats) {
            var html = '';
            
            if (stats.totalCount === 0) {
                html = '<div style="text-align:center;color:#999;font-size:13px;">暂无互动记录</div>';
            } else {
                // 格式化时长
                function formatDuration(ms) {
                    if (ms < 60000) return Math.round(ms / 1000) + '秒';
                    if (ms < 3600000) return Math.round(ms / 60000) + '分钟';
                    return (ms / 3600000).toFixed(1) + '小时';
                }
                
                html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:15px;">';
                
                // 聊天统计
                var chatStats = stats.byType['chatting'] || { count: 0, duration: 0 };
                html += '<div style="background:#E3F2FD;border-radius:12px;padding:12px;text-align:center;">';
                html += '<div style="font-size:18px;font-weight:600;color:#1976D2;">' + chatStats.count + '</div>';
                html += '<div style="font-size:11px;color:#666;margin-top:4px;">聊天次数</div>';
                html += '</div>';
                
                // 听音乐统计
                var musicStats = stats.byType['listening_music'] || { count: 0, duration: 0 };
                html += '<div style="background:#FCE4EC;border-radius:12px;padding:12px;text-align:center;">';
                html += '<div style="font-size:18px;font-weight:600;color:#C2185B;">' + formatDuration(musicStats.duration) + '</div>';
                html += '<div style="font-size:11px;color:#666;margin-top:4px;">一起听</div>';
                html += '</div>';
                
                // 游戏统计
                var gameStats = stats.byType['playing_game'] || { count: 0, duration: 0 };
                html += '<div style="background:#E8F5E9;border-radius:12px;padding:12px;text-align:center;">';
                html += '<div style="font-size:18px;font-weight:600;color:#388E3C;">' + formatDuration(gameStats.duration) + '</div>';
                html += '<div style="font-size:11px;color:#666;margin-top:4px;">游戏时长</div>';
                html += '</div>';
                
                html += '</div>';
                
                // 总计
                html += '<div style="display:flex;justify-content:space-between;padding:12px;background:#f8f8f8;border-radius:10px;font-size:13px;">';
                html += '<span style="color:#666;">总互动时长</span>';
                html += '<span style="font-weight:600;color:#333;">' + formatDuration(stats.totalDuration) + '</span>';
                html += '</div>';
            }
            
            container.innerHTML = html;
        }).catch(function(err) {
            console.error('加载活动统计失败:', err);
            container.innerHTML = '<div style="text-align:center;color:#999;font-size:13px;">加载失败</div>';
        });
    };

    // 记忆管理器 - 按App来源的总结式记忆系统
    SystemConfigApp.prototype.openMemoryManager = function(aiId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 初始化新的记忆结构
        if (!ai.memorySummaries) {
            ai.memorySummaries = {
                chat: { enabled: true, summary: '', lastUpdated: null, apiConfigId: null },
                weibo: { enabled: false, userSummary: '', aiSummary: '', lastUpdated: null, apiConfigId: null },
                shop: { enabled: false, summary: '', lastUpdated: null, apiConfigId: null }
            };
        }
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:8px;color:#333;">' + ai.name + ' 的记忆库</div>';
        html += '<div style="font-size:13px;color:#888;margin-bottom:20px;line-height:1.5;">总结超出上下文的内容，开启后将作为背景信息注入聊天</div>';
        
        // 聊天记忆总结
        var chatMemory = ai.memorySummaries.chat || { enabled: true, summary: '', lastUpdated: null };
        var chatHistory = ai.chatHistory || [];
        var contextLength = ai.contextLength || 20;
        var overflowCount = Math.max(0, chatHistory.length - contextLength);
        
        html += '<div class="config-card ' + S.glassCard + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#b8e0f7,#8ecae6);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:600;font-size:14px;color:#333;">聊天记忆</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:2px;">总 ' + chatHistory.length + ' 条 / 上下文 ' + contextLength + ' 条 / 溢出 ' + overflowCount + ' 条</div>';
        html += '</div>';
        html += '</div>';
        html += self.renderMemorySwitch('chat-memory-toggle', chatMemory.enabled);
        html += '</div>';
        
        // 总结内容
        if (chatMemory.summary) {
            html += '<div style="background:#f8f9fa;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;color:#555;line-height:1.6;max-height:120px;overflow-y:auto;">' + self.escapeHtml(chatMemory.summary) + '</div>';
            if (chatMemory.lastUpdated) {
                html += '<div style="font-size:11px;color:#aaa;margin-bottom:12px;">上次总结: ' + new Date(chatMemory.lastUpdated).toLocaleString() + '</div>';
            }
        } else {
            html += '<div style="background:#f8f9fa;border-radius:10px;padding:20px;margin-bottom:12px;text-align:center;color:#999;font-size:13px;">暂无总结内容</div>';
        }
        
        // API选择和操作按钮
        html += '<div style="display:flex;gap:10px;align-items:center;">';
        html += '<select id="chat-memory-api" class="' + S.select + ' sys-select-flex" style="flex:1;">';
        html += '<option value="">使用默认API</option>';
        var apiConfigs = PhoneCore.apiConfigs || {};
        Object.keys(apiConfigs).forEach(function(configId) {
            var config = apiConfigs[configId];
            var selected = chatMemory.apiConfigId === configId ? ' selected' : '';
            html += '<option value="' + configId + '"' + selected + '>' + (config.name || configId) + '</option>';
        });
        html += '</select>';
        html += '<button id="summarize-chat-btn" class="' + S.primaryButton + ' sys-btn-summarize" ' + (overflowCount < 10 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : '') + '>总结</button>';
        html += '</div>';
        if (overflowCount < 10) {
            html += '<div style="font-size:11px;color:#FF6B8A;margin-top:8px;">溢出消息不足10条，暂不需要总结</div>';
        }
        html += '</div>';
        
        // 微博记忆总结
        var weiboMemory = ai.memorySummaries.weibo || { enabled: false, userSummary: '', aiSummary: '', lastUpdated: null };
        html += '<div class="config-card ' + S.glassCard + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#FF6B6B,#E8454A);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:600;font-size:14px;color:#333;">微博记忆</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:2px;">总结用户和AI发布的微博内容</div>';
        html += '</div>';
        html += '</div>';
        html += self.renderMemorySwitch('weibo-memory-toggle', weiboMemory.enabled);
        html += '</div>';
        
        // 微博总结内容
        if (weiboMemory.userSummary || weiboMemory.aiSummary) {
            if (weiboMemory.userSummary) {
                html += '<div style="margin-bottom:8px;"><span style="font-size:11px;color:#888;">用户微博总结:</span></div>';
                html += '<div style="background:#f8f9fa;border-radius:10px;padding:12px;margin-bottom:10px;font-size:13px;color:#555;line-height:1.6;max-height:80px;overflow-y:auto;">' + self.escapeHtml(weiboMemory.userSummary) + '</div>';
            }
            if (weiboMemory.aiSummary) {
                html += '<div style="margin-bottom:8px;"><span style="font-size:11px;color:#888;">AI微博总结:</span></div>';
                html += '<div style="background:#f8f9fa;border-radius:10px;padding:12px;margin-bottom:10px;font-size:13px;color:#555;line-height:1.6;max-height:80px;overflow-y:auto;">' + self.escapeHtml(weiboMemory.aiSummary) + '</div>';
            }
            if (weiboMemory.lastUpdated) {
                html += '<div style="font-size:11px;color:#aaa;margin-bottom:12px;">上次总结: ' + new Date(weiboMemory.lastUpdated).toLocaleString() + '</div>';
            }
        } else {
            html += '<div style="background:#f8f9fa;border-radius:10px;padding:20px;margin-bottom:12px;text-align:center;color:#999;font-size:13px;">暂无微博总结</div>';
        }
        
        html += '<div style="display:flex;gap:10px;align-items:center;">';
        html += '<select id="weibo-memory-api" class="' + S.select + ' sys-select-flex" style="flex:1;">';
        html += '<option value="">使用默认API</option>';
        Object.keys(apiConfigs).forEach(function(configId) {
            var config = apiConfigs[configId];
            var selected = weiboMemory.apiConfigId === configId ? ' selected' : '';
            html += '<option value="' + configId + '"' + selected + '>' + (config.name || configId) + '</option>';
        });
        html += '</select>';
        html += '<button id="summarize-weibo-btn" class="' + S.primaryButton + ' sys-btn-summarize">总结</button>';
        html += '</div>';
        html += '</div>';
        
        // 购物小剧场记忆总结
        var shopMemory = ai.memorySummaries.shop || { enabled: false, summary: '', lastUpdated: null };
        html += '<div class="config-card ' + S.glassCard + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#A8E6CF,#7DD3B0);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:600;font-size:14px;color:#333;">购物小剧场记忆</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:2px;">总结购物App中的小剧场剧情</div>';
        html += '</div>';
        html += '</div>';
        html += self.renderMemorySwitch('shop-memory-toggle', shopMemory.enabled);
        html += '</div>';
        
        if (shopMemory.summary) {
            html += '<div style="background:#f8f9fa;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;color:#555;line-height:1.6;max-height:120px;overflow-y:auto;">' + self.escapeHtml(shopMemory.summary) + '</div>';
            if (shopMemory.lastUpdated) {
                html += '<div style="font-size:11px;color:#aaa;margin-bottom:12px;">上次总结: ' + new Date(shopMemory.lastUpdated).toLocaleString() + '</div>';
            }
        } else {
            html += '<div style="background:#f8f9fa;border-radius:10px;padding:20px;margin-bottom:12px;text-align:center;color:#999;font-size:13px;">暂无小剧场总结</div>';
        }
        
        html += '<div style="display:flex;gap:10px;align-items:center;">';
        html += '<select id="shop-memory-api" class="' + S.select + ' sys-select-flex" style="flex:1;">';
        html += '<option value="">使用默认API</option>';
        Object.keys(apiConfigs).forEach(function(configId) {
            var config = apiConfigs[configId];
            var selected = shopMemory.apiConfigId === configId ? ' selected' : '';
            html += '<option value="' + configId + '"' + selected + '>' + (config.name || configId) + '</option>';
        });
        html += '</select>';
        html += '<button id="summarize-shop-btn" class="' + S.primaryButton + ' sys-btn-summarize">总结</button>';
        html += '</div>';
        html += '</div>';
        
        // 手动记忆系统
        var manualData = ai.memorySummaries.manualMemory || { items: [], summary: '', lastUpdated: null, apiConfigId: null };
        // 兼容旧数据
        if (ai.memorySummaries.manual && ai.memorySummaries.manual.length > 0 && (!manualData.items || manualData.items.length === 0)) {
            manualData.items = ai.memorySummaries.manual;
        }
        
        html += '<div class="config-card ' + S.glassCard + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<div style="width:36px;height:36px;background:linear-gradient(135deg,#FFB4BB,#FF8FA3);border-radius:10px;display:flex;align-items:center;justify-content:center;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
        html += '</div>';
        html += '<div>';
        html += '<div style="font-weight:600;font-size:14px;color:#333;">手动记忆</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:2px;">添加重要信息让AI记住</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        
        // 已总结的记忆
        if (manualData.summary) {
            html += '<div style="margin-bottom:14px;">';
            html += '<div style="font-size:12px;color:#888;margin-bottom:6px;">已总结的记忆</div>';
            html += '<div style="background:linear-gradient(135deg,#FFF0F3,#FFE4E8);border-radius:10px;padding:12px;font-size:13px;color:#555;line-height:1.6;max-height:120px;overflow-y:auto;">' + self.escapeHtml(manualData.summary) + '</div>';
            if (manualData.lastUpdated) {
                html += '<div style="font-size:11px;color:#aaa;margin-top:6px;">上次总结: ' + new Date(manualData.lastUpdated).toLocaleString() + '</div>';
            }
            html += '</div>';
        }
        
        // 待总结的记忆列表
        var pendingItems = manualData.items || [];
        html += '<div style="margin-bottom:14px;">';
        html += '<div style="font-size:12px;color:#888;margin-bottom:8px;">待总结的记忆 (' + pendingItems.length + ')</div>';
        html += '<div id="manual-memory-list">';
        if (pendingItems.length > 0) {
            pendingItems.forEach(function(mem, idx) {
                html += '<div class="manual-memory-item" data-index="' + idx + '" style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;">';
                html += '<div style="flex:1;font-size:13px;color:#555;line-height:1.5;cursor:pointer;" class="memory-content-display">' + self.escapeHtml(mem.content) + '</div>';
                html += '<button class="edit-manual-memory" data-index="' + idx + '" style="width:28px;height:28px;background:#007AFF;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;flex-shrink:0;">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
                html += '</button>';
                html += '<button class="delete-manual-memory" data-index="' + idx + '" style="width:28px;height:28px;background:#FF3B30;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;flex-shrink:0;">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
                html += '</button>';
                html += '</div>';
            });
        } else {
            html += '<div style="text-align:center;padding:20px;color:#999;font-size:13px;background:#f8f9fa;border-radius:8px;">暂无待总结的记忆</div>';
        }
        html += '</div>';
        html += '</div>';
        
        // 添加新记忆
        html += '<div style="margin-bottom:14px;">';
        html += '<textarea id="manual-memory-input" placeholder="输入需要AI记住的内容..." class="' + S.input + ' sys-input-textarea-sm sys-input-mb8"></textarea>';
        html += '<button id="add-manual-memory-btn" class="' + S.secondaryButton + ' sys-btn-full" style="padding:10px;">添加记忆</button>';
        html += '</div>';
        
        // API选择和总结按钮
        html += '<div style="display:flex;gap:10px;align-items:center;">';
        html += '<select id="manual-memory-api" class="' + S.select + ' sys-select-flex" style="flex:1;">';
        html += '<option value="">使用默认API</option>';
        Object.keys(apiConfigs).forEach(function(configId) {
            var config = apiConfigs[configId];
            var selected = manualData.apiConfigId === configId ? ' selected' : '';
            html += '<option value="' + configId + '"' + selected + '>' + (config.name || configId) + '</option>';
        });
        html += '</select>';
        html += '<button id="summarize-manual-btn" class="' + S.primaryButton + ' sys-btn-summarize" ' + (pendingItems.length === 0 && !manualData.summary ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : '') + '>总结记忆</button>';
        html += '</div>';
        if (pendingItems.length > 0 || manualData.summary) {
            html += '<div style="font-size:11px;color:#888;margin-top:8px;">总结后，待总结记忆将与已有总结合并生成新的总结</div>';
        }
        html += '</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 绑定开关事件
        self.bindMemorySwitchEvents(page, ai, aiId);
        
        // 聊天记忆总结按钮
        var summarizeChatBtn = page.querySelector('#summarize-chat-btn');
        if (summarizeChatBtn && !summarizeChatBtn.disabled) {
            summarizeChatBtn.onclick = function() {
                self.summarizeChatMemory(aiId, page);
            };
        }
        
        // 微博记忆总结按钮
        var summarizeWeiboBtn = page.querySelector('#summarize-weibo-btn');
        if (summarizeWeiboBtn) {
            summarizeWeiboBtn.onclick = function() {
                self.summarizeWeiboMemory(aiId, page);
            };
        }
        
        // 购物记忆总结按钮
        var summarizeShopBtn = page.querySelector('#summarize-shop-btn');
        if (summarizeShopBtn) {
            summarizeShopBtn.onclick = function() {
                self.summarizeShopMemory(aiId, page);
            };
        }
        
        // 初始化手动记忆数据结构
        if (!ai.memorySummaries.manualMemory) {
            ai.memorySummaries.manualMemory = { items: [], summary: '', lastUpdated: null, apiConfigId: null };
            // 迁移旧数据
            if (ai.memorySummaries.manual && ai.memorySummaries.manual.length > 0) {
                ai.memorySummaries.manualMemory.items = ai.memorySummaries.manual;
                delete ai.memorySummaries.manual;
                PhoneCore.saveAI(ai);
            }
        }
        
        // 手动添加记忆按钮
        var addManualBtn = page.querySelector('#add-manual-memory-btn');
        if (addManualBtn) {
            addManualBtn.onclick = function() {
                var input = page.querySelector('#manual-memory-input');
                var content = input.value.trim();
                if (!content) {
                    PhoneCore.notifications.send({ type: 'warning', title: '请输入记忆内容', size: 'mini' });
                    return;
                }
                ai.memorySummaries.manualMemory.items.push({
                    id: 'manual_' + Date.now(),
                    content: content,
                    createdAt: Date.now()
                });
                PhoneCore.saveAI(ai).then(function() {
                    PhoneCore.notifications.send({ type: 'success', title: '记忆已添加', size: 'mini' });
                    page.querySelector('.app-back-btn').click();
                    setTimeout(function() { self.openMemoryManager(aiId); }, 350);
                });
            };
        }
        
        // 编辑手动记忆按钮
        page.querySelectorAll('.edit-manual-memory').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var idx = parseInt(btn.getAttribute('data-index'));
                var item = ai.memorySummaries.manualMemory.items[idx];
                if (!item) return;
                
                self.openEditManualMemoryDialog(aiId, idx, item.content, page);
            };
        });
        
        // 删除手动记忆按钮
        page.querySelectorAll('.delete-manual-memory').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var idx = parseInt(btn.getAttribute('data-index'));
                if (ai.memorySummaries.manualMemory.items && ai.memorySummaries.manualMemory.items[idx]) {
                    ai.memorySummaries.manualMemory.items.splice(idx, 1);
                    PhoneCore.saveAI(ai).then(function() {
                        btn.closest('.manual-memory-item').remove();
                        // 更新计数
                        var countEl = page.querySelector('#manual-memory-list').previousElementSibling;
                        if (countEl) {
                            countEl.textContent = '待总结的记忆 (' + ai.memorySummaries.manualMemory.items.length + ')';
                        }
                    });
                }
            };
        });
        
        // API选择
        var manualApiSelect = page.querySelector('#manual-memory-api');
        if (manualApiSelect) {
            manualApiSelect.onchange = function() {
                ai.memorySummaries.manualMemory.apiConfigId = manualApiSelect.value || null;
                PhoneCore.saveAI(ai);
            };
        }
        
        // 总结手动记忆按钮
        var summarizeManualBtn = page.querySelector('#summarize-manual-btn');
        if (summarizeManualBtn && !summarizeManualBtn.disabled) {
            summarizeManualBtn.onclick = function() {
                self.summarizeManualMemory(aiId, page);
            };
        }
    };
    
    // 编辑手动记忆对话框
    SystemConfigApp.prototype.openEditManualMemoryDialog = function(aiId, idx, content, parentPage) {
        var self = this;
        var S = this.STYLES;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">编辑记忆</div>';
        html += '<div class="config-card ' + S.glassCard + '">';
        html += '<textarea id="edit-memory-content" class="' + S.input + ' sys-input-textarea-xl">' + self.escapeHtml(content) + '</textarea>';
        html += '</div>';
        html += '<button id="save-edit-memory-btn" class="' + S.primaryButton + ' sys-btn-save-mt15">保存</button>';
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        var saveBtn = page.querySelector('#save-edit-memory-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var newContent = page.querySelector('#edit-memory-content').value.trim();
                if (!newContent) {
                    PhoneCore.notifications.send({ type: 'warning', title: '内容不能为空', size: 'mini' });
                    return;
                }
                
                ai.memorySummaries.manualMemory.items[idx].content = newContent;
                ai.memorySummaries.manualMemory.items[idx].updatedAt = Date.now();
                
                PhoneCore.saveAI(ai).then(function() {
                    PhoneCore.notifications.send({ type: 'success', title: '已保存', size: 'mini' });
                    page.querySelector('.app-back-btn').click();
                    setTimeout(function() {
                        parentPage.querySelector('.app-back-btn').click();
                        setTimeout(function() { self.openMemoryManager(aiId); }, 350);
                    }, 350);
                });
            };
        }
    };
    
    // 总结手动记忆
    SystemConfigApp.prototype.summarizeManualMemory = function(aiId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai || !ai.memorySummaries.manualMemory) return;
        
        var manualData = ai.memorySummaries.manualMemory;
        var pendingItems = manualData.items || [];
        var existingSummary = manualData.summary || '';
        
        if (pendingItems.length === 0 && !existingSummary) {
            PhoneCore.notifications.send({ type: 'warning', title: '没有需要总结的内容', size: 'mini' });
            return;
        }
        
        PhoneCore.notifications.send({ type: 'info', title: '正在总结记忆...', size: 'mini' });
        
        // 构建总结提示词
        var summaryPrompt = '请将以下内容整合成简洁的记忆总结，保留所有重要信息，去除重复内容，用要点形式输出，不超过400字。\n\n';
        
        if (existingSummary) {
            summaryPrompt += '【已有的记忆总结】\n' + existingSummary + '\n\n';
        }
        
        if (pendingItems.length > 0) {
            summaryPrompt += '【新增的记忆内容】\n';
            pendingItems.forEach(function(item, idx) {
                summaryPrompt += (idx + 1) + '. ' + item.content + '\n';
            });
        }
        
        summaryPrompt += '\n请输出整合后的记忆总结：';
        
        var apiConfigId = manualData.apiConfigId || ai.apiConfigId || null;
        
        if (PhoneCore && PhoneCore.api) {
            PhoneCore.api.call(summaryPrompt, apiConfigId, { aiId: 'memory-summarizer', maxTokens: 600 })
                .then(function(response) {
                    ai.memorySummaries.manualMemory.summary = response.content;
                    ai.memorySummaries.manualMemory.lastUpdated = Date.now();
                    ai.memorySummaries.manualMemory.items = []; // 清空待总结列表
                    
                    PhoneCore.saveAI(ai).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '记忆总结完成', size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        setTimeout(function() { self.openMemoryManager(aiId); }, 350);
                    });
                })
                .catch(function(err) {
                    PhoneCore.notifications.send({ type: 'error', title: '总结失败', message: err.message, size: 'mini' });
                });
        } else {
            PhoneCore.notifications.send({ type: 'error', title: 'API未就绪', size: 'mini' });
        }
    };
    
    // 渲染记忆开关
    SystemConfigApp.prototype.renderMemorySwitch = function(id, enabled) {
        var html = '<label style="position:relative;width:48px;height:28px;flex-shrink:0;">';
        html += '<input type="checkbox" id="' + id + '" ' + (enabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
        html += '<span class="switch-track" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (enabled ? '#FF6B8A' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
        html += '<span class="switch-thumb" style="position:absolute;height:22px;width:22px;left:' + (enabled ? '23px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
        html += '</label>';
        return html;
    };
    
    // 绑定记忆开关事件
    SystemConfigApp.prototype.bindMemorySwitchEvents = function(page, ai, aiId) {
        var self = this;
        var switches = ['chat', 'weibo', 'shop'];
        switches.forEach(function(type) {
            var toggle = page.querySelector('#' + type + '-memory-toggle');
            if (toggle) {
                toggle.onchange = function() {
                    var track = toggle.parentElement.querySelector('.switch-track');
                    var thumb = toggle.parentElement.querySelector('.switch-thumb');
                    if (!ai.memorySummaries[type]) ai.memorySummaries[type] = {};
                    ai.memorySummaries[type].enabled = toggle.checked;
                    track.style.background = toggle.checked ? '#FF6B8A' : '#ccc';
                    thumb.style.left = toggle.checked ? '23px' : '3px';
                    PhoneCore.saveAI(ai);
                };
            }
            // API选择
            var apiSelect = page.querySelector('#' + type + '-memory-api');
            if (apiSelect) {
                apiSelect.onchange = function() {
                    if (!ai.memorySummaries[type]) ai.memorySummaries[type] = {};
                    ai.memorySummaries[type].apiConfigId = apiSelect.value || null;
                    PhoneCore.saveAI(ai);
                };
            }
        });
    };
    
    // 聊天记忆总结
    SystemConfigApp.prototype.summarizeChatMemory = function(aiId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var chatHistory = ai.chatHistory || [];
        var contextLength = ai.contextLength || 20;
        var overflowMessages = chatHistory.slice(0, -contextLength);
        
        if (overflowMessages.length < 10) {
            PhoneCore.notifications.send({ type: 'warning', title: '消息不足', message: '溢出消息不足10条', size: 'mini' });
            return;
        }
        
        PhoneCore.notifications.send({ type: 'info', title: '正在总结...', size: 'mini' });
        
        // 构建总结提示词
        var summaryPrompt = '请总结以下聊天记录的关键信息，包括：重要事件、用户偏好、约定的事情、情感变化等。用简洁的要点形式输出，不超过300字。\n\n聊天记录：\n';
        overflowMessages.slice(-50).forEach(function(msg) {
            var role = msg.role === 'user' ? '用户' : 'AI';
            var content = msg.content || '';
            if (typeof content === 'object') content = JSON.stringify(content);
            summaryPrompt += role + ': ' + content.substring(0, 200) + '\n';
        });
        
        var apiConfigId = ai.memorySummaries.chat.apiConfigId || ai.apiConfigId || null;
        
        if (PhoneCore && PhoneCore.api) {
            PhoneCore.api.call(summaryPrompt, apiConfigId, { aiId: 'memory-summarizer', maxTokens: 500 })
                .then(function(response) {
                    ai.memorySummaries.chat.summary = response.content;
                    ai.memorySummaries.chat.lastUpdated = Date.now();
                    PhoneCore.saveAI(ai).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '总结完成', size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        setTimeout(function() { self.openMemoryManager(aiId); }, 350);
                    });
                })
                .catch(function(err) {
                    PhoneCore.notifications.send({ type: 'error', title: '总结失败', message: err.message, size: 'mini' });
                });
        } else {
            PhoneCore.notifications.send({ type: 'error', title: 'API未就绪', size: 'mini' });
        }
    };
    
    // 微博记忆总结
    SystemConfigApp.prototype.summarizeWeiboMemory = function(aiId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 获取微博数据
        var weiboApp = PhoneCore.apps && PhoneCore.apps['weibo-app'];
        var userPosts = [];
        var aiPosts = [];
        
        if (weiboApp && weiboApp.posts) {
            var mask = PhoneCore.user.getCurrentMask ? PhoneCore.user.getCurrentMask() : null;
            var userId = mask ? mask.id : 'user';
            weiboApp.posts.forEach(function(post) {
                if (post.authorId === userId) {
                    userPosts.push(post);
                } else if (post.authorId === aiId) {
                    aiPosts.push(post);
                }
            });
        }
        
        if (userPosts.length === 0 && aiPosts.length === 0) {
            PhoneCore.notifications.send({ type: 'warning', title: '暂无微博内容', size: 'mini' });
            return;
        }
        
        PhoneCore.notifications.send({ type: 'info', title: '正在总结微博...', size: 'mini' });
        
        var summaryPrompt = '请分别总结以下用户微博和AI微博的内容特点、兴趣爱好、情绪状态等。用简洁要点输出。\n\n';
        
        if (userPosts.length > 0) {
            summaryPrompt += '【用户微博】\n';
            userPosts.slice(-20).forEach(function(post) {
                summaryPrompt += '- ' + (post.content || '').substring(0, 100) + '\n';
            });
        }
        
        if (aiPosts.length > 0) {
            summaryPrompt += '\n【AI微博】\n';
            aiPosts.slice(-20).forEach(function(post) {
                summaryPrompt += '- ' + (post.content || '').substring(0, 100) + '\n';
            });
        }
        
        var apiConfigId = ai.memorySummaries.weibo.apiConfigId || ai.apiConfigId || null;
        
        if (PhoneCore && PhoneCore.api) {
            PhoneCore.api.call(summaryPrompt, apiConfigId, { aiId: 'memory-summarizer', maxTokens: 500 })
                .then(function(response) {
                    var content = response.content || '';
                    // 简单分割用户和AI总结
                    ai.memorySummaries.weibo.userSummary = userPosts.length > 0 ? content : '';
                    ai.memorySummaries.weibo.aiSummary = aiPosts.length > 0 ? content : '';
                    ai.memorySummaries.weibo.lastUpdated = Date.now();
                    PhoneCore.saveAI(ai).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '微博总结完成', size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        setTimeout(function() { self.openMemoryManager(aiId); }, 350);
                    });
                })
                .catch(function(err) {
                    PhoneCore.notifications.send({ type: 'error', title: '总结失败', message: err.message, size: 'mini' });
                });
        }
    };
    
    // 购物小剧场记忆总结
    SystemConfigApp.prototype.summarizeShopMemory = function(aiId, page) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 获取购物小剧场数据
        var shopApp = PhoneCore.apps && PhoneCore.apps['shop-app'];
        var theatreHistory = [];
        
        if (shopApp && shopApp.theatreHistory) {
            theatreHistory = shopApp.theatreHistory.filter(function(h) {
                return h.aiId === aiId;
            });
        }
        
        if (theatreHistory.length === 0) {
            PhoneCore.notifications.send({ type: 'warning', title: '暂无小剧场记录', size: 'mini' });
            return;
        }
        
        PhoneCore.notifications.send({ type: 'info', title: '正在总结小剧场...', size: 'mini' });
        
        var summaryPrompt = '请总结以下购物小剧场的剧情发展、关键情节、角色互动等。用简洁要点输出，不超过300字。\n\n【小剧场记录】\n';
        theatreHistory.slice(-30).forEach(function(h) {
            summaryPrompt += '- ' + (h.content || '').substring(0, 150) + '\n';
        });
        
        var apiConfigId = ai.memorySummaries.shop.apiConfigId || ai.apiConfigId || null;
        
        if (PhoneCore && PhoneCore.api) {
            PhoneCore.api.call(summaryPrompt, apiConfigId, { aiId: 'memory-summarizer', maxTokens: 500 })
                .then(function(response) {
                    ai.memorySummaries.shop.summary = response.content;
                    ai.memorySummaries.shop.lastUpdated = Date.now();
                    PhoneCore.saveAI(ai).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '小剧场总结完成', size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        setTimeout(function() { self.openMemoryManager(aiId); }, 350);
                    });
                })
                .catch(function(err) {
                    PhoneCore.notifications.send({ type: 'error', title: '总结失败', message: err.message, size: 'mini' });
                });
        }
    };
    
    // 【已废弃】旧版渲染单条记忆 - 保留兼容但不再使用
    SystemConfigApp.prototype.renderMemoryItem = function(mem, type, bgColor) {
        var content = typeof mem === 'string' ? mem : (mem.content || mem.summary || mem);
        var memId = mem.id || ('mem_' + Math.random().toString(36).substr(2, 9));
        
        var html = '<div class="memory-item" style="padding:12px;background:' + bgColor + ';border-radius:10px;margin-bottom:8px;">';
        html += '<div style="font-size:13px;line-height:1.5;color:#333;">' + content + '</div>';
        html += '</div>';
        return html;
    };

    // 头像库管理
    SystemConfigApp.prototype.openAvatarLibraryManager = function(aiId) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">' + ai.name + ' 的头像库</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:15px;">AI可以根据头像名称切换表情。如命名为"开心"，AI在开心时会切换到这个头像。</div>';
        
        // 【AI读取头像名称开关】
        html += '<div style="background:white;border-radius:12px;padding:15px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div>';
        html += '<div style="font-weight:500;font-size:14px;">AI读取头像名称</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:4px;">关闭后AI将随机换头像，不根据名称判断</div>';
        html += '</div>';
        html += '<label style="position:relative;width:50px;height:28px;">';
        html += '<input type="checkbox" id="avatar-library-enabled" ' + (ai.avatarLibraryEnabled !== false ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
        html += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (ai.avatarLibraryEnabled !== false ? '#34C759' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
        html += '<span style="position:absolute;height:22px;width:22px;left:' + (ai.avatarLibraryEnabled !== false ? '25px' : '3px') + ';bottom:3px;background-color:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
        html += '</label>';
        html += '</div>';
        html += '</div>';
        
        // 设为主头像提示
        html += '<div style="font-size:12px;color:#FF6B8A;margin-bottom:15px;padding:10px;background:rgba(255,107,138,0.1);border-radius:8px;">提示：点击头像可设为当前主头像</div>';
        
        html += '<button id="add-avatar-btn" style="width:100%;padding:12px;background:#007AFF;color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;margin-bottom:20px;">+ 添加头像</button>';
        
        html += '<div id="avatar-library-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;">';
        
        if (!ai.avatarLibrary || ai.avatarLibrary.length === 0) {
            html += '<div style="grid-column:span 3;text-align:center;padding:30px;color:#999;">暂无头像，点击添加</div>';
        } else {
            ai.avatarLibrary.forEach(function(avatar, index) {
                html += '<div class="avatar-lib-item" data-index="' + index + '" style="position:relative;aspect-ratio:1;border-radius:16px;overflow:hidden;background:#f0f0f0;">';
                html += '<img src="' + avatar.url + '" style="width:100%;height:100%;object-fit:cover;">';
                html += '<div class="avatar-delete" data-index="' + index + '" style="position:absolute;top:5px;right:5px;width:24px;height:24px;background:rgba(255,59,48,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;cursor:pointer;">×</div>';
                html += '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:white;font-size:12px;padding:8px;text-align:center;">';
                html += '<input type="text" class="avatar-name-input" data-index="' + index + '" value="' + (avatar.name || '') + '" placeholder="命名..." style="width:100%;background:transparent;border:none;color:white;text-align:center;font-size:12px;outline:none;">';
                html += '</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        
        html += '<button id="save-avatar-names-btn" style="width:100%;padding:12px;background:#34C759;color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;margin-top:20px;">保存名称修改</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 【AI读取头像名称开关】
        var avatarEnabledCheckbox = page.querySelector('#avatar-library-enabled');
        if (avatarEnabledCheckbox) {
            avatarEnabledCheckbox.onchange = function() {
                var toggle = avatarEnabledCheckbox.parentElement;
                var slider = toggle.querySelector('span:last-child');
                var track = toggle.querySelector('span:first-of-type');
                
                if (avatarEnabledCheckbox.checked) {
                    track.style.backgroundColor = '#34C759';
                    slider.style.left = '25px';
                    ai.avatarLibraryEnabled = true;
                } else {
                    track.style.backgroundColor = '#ccc';
                    slider.style.left = '3px';
                    ai.avatarLibraryEnabled = false;
                }
                PhoneCore.saveAI(ai);
            };
        }
        
        // 添加头像
        var addAvatarBtn = page.querySelector('#add-avatar-btn');
        if (addAvatarBtn) {
            addAvatarBtn.onclick = function() {
                PhoneCore.resources.createImageInput(function(resource) {
                    var avatarName = prompt('请输入头像名称（AI可见，如"开心"、"难过"、"撒娇"）：', '');
                    
                    if (!ai.avatarLibrary) {
                        ai.avatarLibrary = [];
                    }
                    
                    ai.avatarLibrary.push({
                        id: 'avatar_' + Date.now(),
                        url: resource.data,
                        name: avatarName || '',
                        description: ''
                    });
                    
                    PhoneCore.saveAI(ai).then(function() {
                        // 刷新页面
                        page.querySelector('.app-back-btn').click();
                        setTimeout(function() {
                            self.openAvatarLibraryManager(aiId);
                        }, 350);
                    });
                });
            };
        }
        
        // 点击头像设为主头像
        page.querySelectorAll('.avatar-lib-item').forEach(function(item) {
            item.onclick = function(e) {
                if (e.target.classList.contains('avatar-delete') || e.target.classList.contains('avatar-name-input')) return;
                var index = parseInt(item.getAttribute('data-index'));
                var avatar = ai.avatarLibrary[index];
                if (avatar) {
                    ai.avatar = avatar.url;
                    PhoneCore.saveAI(ai).then(function() {
                        PhoneCore.notifications.send({
                            type: 'success',
                            title: '已更换头像',
                            message: avatar.name ? '切换为：' + avatar.name : '已设为主头像',
                            icon: '🖼️',
                            size: 'mini',
                            duration: 2000
                        });
                    });
                }
            };
        });
        
        // 删除头像
        page.querySelectorAll('.avatar-delete').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var index = parseInt(btn.getAttribute('data-index'));
                
                if (confirm('确定删除此头像？')) {
                    ai.avatarLibrary.splice(index, 1);
                    PhoneCore.saveAI(ai).then(function() {
                        btn.closest('.avatar-lib-item').remove();
                    });
                }
            };
        });
        
        // 保存名称修改
        var saveNamesBtn = page.querySelector('#save-avatar-names-btn');
        if (saveNamesBtn) {
            saveNamesBtn.onclick = function() {
                page.querySelectorAll('.avatar-name-input').forEach(function(input) {
                    var index = parseInt(input.getAttribute('data-index'));
                    if (ai.avatarLibrary[index]) {
                        ai.avatarLibrary[index].name = input.value.trim();
                    }
                });
                
                PhoneCore.saveAI(ai).then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '保存成功',
                        message: '头像名称已更新',
                        icon: '✅',
                        size: 'mini',
                        duration: 2000
                    });
                });
            };
        }
    };
    
    // 【随机心情】
    SystemConfigApp.prototype.randomizeMood = function(aiId, detailPage) {
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var moods = [
            { name: '开心', level: 85 },
            { name: '平静', level: 50 },
            { name: '无聊', level: 35 },
            { name: '疲惫', level: 25 },
            { name: '期待', level: 75 },
            { name: '焦虑', level: 30 },
            { name: '满足', level: 70 },
            { name: '思念', level: 55 },
            { name: '烦躁', level: 20 },
            { name: '兴奋', level: 90 }
        ];
        
        var randomMood = moods[Math.floor(Math.random() * moods.length)];
        ai.currentMood = randomMood;
        
        PhoneCore.saveAI(ai).then(function() {
            // 刷新页面
            detailPage.querySelector('.app-back-btn').click();
            setTimeout(function() {
                PhoneCore.getApp('system-config')?.openAIDetail(aiId);
            }, 350);
        });
    };
    
    // 【关系图可视化】
    SystemConfigApp.prototype.openRelationshipGraph = function(aiId) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var relationships = ai.relationships || {};
        var relKeys = Object.keys(relationships);
        
        var html = '<div style="padding:20px;min-height:400px;">';
        html += '<div style="font-size:18px;font-weight:600;margin-bottom:20px;">' + ai.name + ' 的关系图</div>';
        
        if (relKeys.length === 0) {
            html += '<div style="text-align:center;padding:60px;color:#999;">暂无关系</div>';
        } else {
            // 关系图容器
            html += '<div id="relationship-graph" style="position:relative;width:100%;height:350px;background:#f8f8f8;border-radius:16px;overflow:hidden;">';
            
            // 中心节点（当前AI）
            html += '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);box-shadow:0 4px 15px rgba(102,126,234,0.4);display:flex;align-items:center;justify-content:center;overflow:hidden;z-index:10;">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="color:white;font-weight:600;font-size:14px;">' + ai.name.substring(0, 2) + '</div>';
            }
            html += '</div>';
            
            // 计算关系节点位置
            var angleStep = (2 * Math.PI) / relKeys.length;
            var radius = 120;
            
            relKeys.forEach(function(relAiId, idx) {
                var rel = relationships[relAiId];
                var relAi = PhoneCore.getAI(relAiId);
                if (!relAi) return;
                
                var angle = angleStep * idx - Math.PI / 2;
                var x = 50 + (radius / 3.5) * Math.cos(angle);
                var y = 50 + (radius / 3.5) * Math.sin(angle);
                
                var relTypeColors = { friend: '#4CAF50', family: '#FF9800', lover: '#E91E63', colleague: '#2196F3', stranger: '#9E9E9E' };
                var color = relTypeColors[rel.type] || '#666';
                
                // 连线
                html += '<svg style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;">';
                html += '<line x1="50%" y1="50%" x2="' + x + '%" y2="' + y + '%" stroke="' + color + '" stroke-width="2" stroke-dasharray="5,3" opacity="0.6"/>';
                // 箭头（从中心指向节点）
                var midX = (50 + x) / 2;
                var midY = (50 + y) / 2;
                html += '</svg>';
                
                // 节点
                html += '<div class="rel-graph-node" data-rel-ai-id="' + relAiId + '" style="position:absolute;left:' + x + '%;top:' + y + '%;transform:translate(-50%,-50%);cursor:pointer;">';
                html += '<div style="width:55px;height:55px;border-radius:50%;background:white;border:3px solid ' + color + ';box-shadow:0 3px 12px rgba(0,0,0,0.1);overflow:hidden;">';
                if (relAi.avatar) {
                    html += '<img src="' + relAi.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;font-size:12px;color:#666;">' + relAi.name.substring(0, 2) + '</div>';
                }
                html += '</div>';
                html += '<div style="text-align:center;margin-top:6px;font-size:11px;color:#333;font-weight:500;">' + relAi.name + '</div>';
                html += '</div>';
            });
            
            html += '</div>';
            
            // 关系详情面板
            html += '<div id="rel-detail-panel" style="margin-top:20px;padding:15px;background:white;border-radius:12px;display:none;">';
            html += '<div style="font-weight:600;margin-bottom:10px;">关系详情</div>';
            html += '<div id="rel-detail-content"></div>';
            html += '</div>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 节点点击事件
        page.querySelectorAll('.rel-graph-node').forEach(function(node) {
            node.onclick = function() {
                var relAiId = node.getAttribute('data-rel-ai-id');
                var rel = relationships[relAiId];
                var relAi = PhoneCore.getAI(relAiId);
                if (!relAi || !rel) return;
                
                var panel = page.querySelector('#rel-detail-panel');
                var content = page.querySelector('#rel-detail-content');
                if (panel && content) {
                    panel.style.display = 'block';
                    
                    var relTypeNames = { friend: '朋友', family: '家人', lover: '恋人', colleague: '同事', stranger: '认识的人' };
                    
                    var detailHtml = '';
                    detailHtml += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
                    detailHtml += '<div style="width:45px;height:45px;border-radius:50%;overflow:hidden;background:#f0f0f0;">';
                    if (relAi.avatar) {
                        detailHtml += '<img src="' + relAi.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                    }
                    detailHtml += '</div>';
                    detailHtml += '<div>';
                    detailHtml += '<div style="font-weight:600;">' + relAi.name + '</div>';
                    detailHtml += '<div style="font-size:12px;color:#666;">' + (relTypeNames[rel.type] || rel.type) + '</div>';
                    detailHtml += '</div>';
                    detailHtml += '</div>';
                    
                    detailHtml += '<div style="margin-bottom:10px;">';
                    detailHtml += '<div style="font-size:12px;color:#888;margin-bottom:4px;">亲密度</div>';
                    detailHtml += '<div style="height:6px;background:#e0e0e0;border-radius:3px;">';
                    detailHtml += '<div style="height:100%;width:' + (rel.level || 0) + '%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:3px;"></div>';
                    detailHtml += '</div>';
                    detailHtml += '<div style="font-size:11px;color:#666;text-align:right;margin-top:2px;">' + (rel.level || 0) + '/100</div>';
                    detailHtml += '</div>';
                    
                    // 双向认知
                    detailHtml += '<div style="margin-bottom:10px;">';
                    detailHtml += '<div style="font-size:11px;color:#746B6E;margin-bottom:6px;">' + ai.name + ' 对 ' + relAi.name + ' 的认知</div>';
                    detailHtml += '<textarea id="rel-cognition-from" class="' + S.input + ' sys-input-resize-none" style="height:48px;font-size:12px;">' + (rel.cognitionFrom || '') + '</textarea>';
                    detailHtml += '</div>';
                    
                    detailHtml += '<div style="margin-bottom:10px;">';
                    detailHtml += '<div style="font-size:11px;color:#746B6E;margin-bottom:6px;">' + relAi.name + ' 对 ' + ai.name + ' 的认知</div>';
                    detailHtml += '<textarea id="rel-cognition-to" class="' + S.input + ' sys-input-resize-none" style="height:48px;font-size:12px;">' + (rel.cognitionTo || '') + '</textarea>';
                    detailHtml += '</div>';
                    
                    detailHtml += '<button id="save-rel-cognition-btn" data-rel-ai-id="' + relAiId + '" style="width:100%;padding:10px;background:#007AFF;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer;">保存认知</button>';
                    
                    content.innerHTML = detailHtml;
                    
                    // 保存认知按钮
                    var saveBtn = content.querySelector('#save-rel-cognition-btn');
                    if (saveBtn) {
                        saveBtn.onclick = function() {
                            var fromInput = content.querySelector('#rel-cognition-from');
                            var toInput = content.querySelector('#rel-cognition-to');
                            
                            if (ai.relationships[relAiId]) {
                                ai.relationships[relAiId].cognitionFrom = fromInput ? fromInput.value.trim() : '';
                                ai.relationships[relAiId].cognitionTo = toInput ? toInput.value.trim() : '';
                                
                                PhoneCore.saveAI(ai).then(function() {
                                    PhoneCore.notifications.send({
                                        type: 'success',
                                        title: '认知已保存',
                                        size: 'mini'
                                    });
                                });
                            }
                        };
                    }
                }
            };
        });
    };
    
    // 【AI微博设置页面】
    SystemConfigApp.prototype.openAIWeiboSettings = function(aiId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 获取微博App实例和设置
        var weiboApp = PhoneCore.getApp('weibo');
        var settings = weiboApp ? weiboApp.getAIPostSettings() : {
            enabled: true,
            frequency: 3,
            timePreference: 'random',
            contentStyle: 'normal'
        };
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:18px;font-weight:600;margin-bottom:20px;">' + ai.name + ' 的微博设置</div>';
        
        // 设置说明卡片
        html += '<div style="background:linear-gradient(135deg,#FF9800,#FFB74D);border-radius:16px;padding:20px;margin-bottom:20px;color:white;">';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
        html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>';
        html += '<span style="font-size:16px;font-weight:600;">AI自动发帖</span>';
        html += '</div>';
        html += '<div style="font-size:13px;opacity:0.9;">设置AI在微博的自动发帖行为，包括发帖频率、时间偏好和内容风格。</div>';
        html += '</div>';
        
        // 设置表单
        html += '<div style="background:white;border-radius:16px;padding:20px;">';
        
        // 启用开关
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:15px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<div>';
        html += '<div style="font-size:15px;font-weight:500;color:#333;">启用自动发帖</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:4px;">开启后AI会自动发布微博</div>';
        html += '</div>';
        html += '<label style="position:relative;display:inline-block;width:50px;height:28px;">';
        html += '<input type="checkbox" id="weibo-enabled" ' + (settings.enabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
        html += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (settings.enabled ? '#4CAF50' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
        html += '<span style="position:absolute;content:\'\';height:22px;width:22px;left:' + (settings.enabled ? '25px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
        html += '</label>';
        html += '</div>';
        
        // 每天发帖数
        html += '<div style="padding:15px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
        html += '<div style="font-size:15px;font-weight:500;color:#333;">每天发帖数量</div>';
        html += '<span id="frequency-value" style="font-size:14px;color:#FF9800;font-weight:600;">' + settings.frequency + ' 条/天</span>';
        html += '</div>';
        html += '<input type="range" id="weibo-frequency" min="1" max="10" value="' + settings.frequency + '" style="width:100%;accent-color:#FF9800;">';
        html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#999;margin-top:5px;">';
        html += '<span>1条</span><span>5条</span><span>10条</span>';
        html += '</div>';
        html += '</div>';
        
        // 发帖时间偏好
        html += '<div style="padding:15px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<div style="font-size:15px;font-weight:500;color:#333;margin-bottom:12px;">发帖时间偏好</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">';
        
        var timeOptions = [
            { value: 'morning', label: '上午', desc: '7:00-12:00', icon: '🌅' },
            { value: 'afternoon', label: '下午', desc: '12:00-18:00', icon: '☀️' },
            { value: 'evening', label: '晚上', desc: '18:00-23:00', icon: '🌙' },
            { value: 'random', label: '随机', desc: '8:00-22:00', icon: '🎲' }
        ];
        
        timeOptions.forEach(function(opt) {
            var isSelected = settings.timePreference === opt.value;
            html += '<div class="time-option" data-value="' + opt.value + '" style="' +
                'padding:12px;border-radius:12px;text-align:center;cursor:pointer;transition:all 0.2s;' +
                'background:' + (isSelected ? 'linear-gradient(135deg,#FFF3E0,#FFE0B2)' : '#f8f8f8') + ';' +
                'border:2px solid ' + (isSelected ? '#FF9800' : 'transparent') + ';">';
            html += '<div style="font-size:20px;margin-bottom:6px;">' + opt.icon + '</div>';
            html += '<div style="font-size:14px;font-weight:500;color:' + (isSelected ? '#E65100' : '#333') + ';">' + opt.label + '</div>';
            html += '<div style="font-size:11px;color:#888;margin-top:3px;">' + opt.desc + '</div>';
            html += '</div>';
        });
        html += '</div>';
        html += '<input type="hidden" id="weibo-time-preference" value="' + settings.timePreference + '">';
        html += '</div>';
        
        html += '</div>';
        
        // 微博数据同步设置
        var weiboDataSettings = PhoneCore.data.weiboDataSource || {
            allowAIReadUserPosts: true,
            readRange: 'recent10',
            syncAIPostsToContext: true
        };
        
        html += '<div style="background:white;border-radius:16px;padding:20px;margin-top:16px;">';
        html += '<div style="font-size:16px;font-weight:600;color:#333;margin-bottom:16px;display:flex;align-items:center;gap:8px;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="#1976D2"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';
        html += '数据同步设置';
        html += '</div>';
        
        // 允许AI读取用户微博
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<div>';
        html += '<div style="font-size:14px;font-weight:500;color:#333;">允许读取用户微博</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:3px;">AI可在对话中参考你发布的微博</div>';
        html += '</div>';
        html += '<label style="position:relative;width:44px;height:24px;">';
        html += '<input type="checkbox" id="sync-allow-read" ' + (weiboDataSettings.allowAIReadUserPosts ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
        html += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (weiboDataSettings.allowAIReadUserPosts ? '#34C759' : '#ccc') + ';border-radius:24px;transition:0.3s;"></span>';
        html += '<span style="position:absolute;height:18px;width:18px;left:' + (weiboDataSettings.allowAIReadUserPosts ? '23px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>';
        html += '</label>';
        html += '</div>';
        
        // 读取范围
        html += '<div style="padding:12px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<div style="font-size:14px;font-weight:500;color:#333;margin-bottom:10px;">读取范围</div>';
        html += '<select id="sync-read-range" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;">';
        html += '<option value="recent5"' + (weiboDataSettings.readRange === 'recent5' ? ' selected' : '') + '>最近5条</option>';
        html += '<option value="recent10"' + (weiboDataSettings.readRange === 'recent10' ? ' selected' : '') + '>最近10条</option>';
        html += '<option value="all"' + (weiboDataSettings.readRange === 'all' ? ' selected' : '') + '>全部微博</option>';
        html += '<option value="mentioned"' + (weiboDataSettings.readRange === 'mentioned' ? ' selected' : '') + '>仅@提及的</option>';
        html += '</select>';
        html += '</div>';
        
        // 同步AI微博到上下文
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">';
        html += '<div>';
        html += '<div style="font-size:14px;font-weight:500;color:#333;">同步AI微博到上下文</div>';
        html += '<div style="font-size:11px;color:#888;margin-top:3px;">AI发布的微博作为对话参考</div>';
        html += '</div>';
        html += '<label style="position:relative;width:44px;height:24px;">';
        html += '<input type="checkbox" id="sync-ai-context" ' + (weiboDataSettings.syncAIPostsToContext ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
        html += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (weiboDataSettings.syncAIPostsToContext ? '#34C759' : '#ccc') + ';border-radius:24px;transition:0.3s;"></span>';
        html += '<span style="position:absolute;height:18px;width:18px;left:' + (weiboDataSettings.syncAIPostsToContext ? '23px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>';
        html += '</label>';
        html += '</div>';
        
        html += '</div>';
        
        // 保存按钮
        html += '<button id="save-weibo-settings-btn" style="' +
            'width:100%;padding:15px;margin-top:20px;' +
            'background:linear-gradient(135deg,#FF9800,#F57C00);' +
            'color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">';
        html += '保存设置</button>';
        
        // 立即发帖按钮
        html += '<button id="force-post-btn" style="' +
            'width:100%;padding:15px;margin-top:12px;' +
            'background:white;color:#FF9800;border:2px solid #FF9800;' +
            'border-radius:12px;font-size:15px;font-weight:500;cursor:pointer;">';
        html += '让 ' + ai.name + ' 立即发一条微博</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 绑定事件
        
        // 启用开关
        var enabledCheckbox = page.querySelector('#weibo-enabled');
        if (enabledCheckbox) {
            enabledCheckbox.onchange = function() {
                var toggle = this.parentElement;
                var slider = toggle.querySelector('span:nth-child(2)');
                var dot = toggle.querySelector('span:nth-child(3)');
                if (this.checked) {
                    slider.style.background = '#4CAF50';
                    dot.style.left = '25px';
                } else {
                    slider.style.background = '#ccc';
                    dot.style.left = '3px';
                }
            };
        }
        
        // 频率滑块
        var frequencySlider = page.querySelector('#weibo-frequency');
        var frequencyValue = page.querySelector('#frequency-value');
        if (frequencySlider && frequencyValue) {
            frequencySlider.oninput = function() {
                frequencyValue.textContent = this.value + ' 条/天';
            };
        }
        
        // 时间偏好选择
        var timeOptions = page.querySelectorAll('.time-option');
        var timePrefInput = page.querySelector('#weibo-time-preference');
        timeOptions.forEach(function(opt) {
            opt.onclick = function() {
                // 清除所有选中状态
                timeOptions.forEach(function(o) {
                    o.style.background = '#f8f8f8';
                    o.style.border = '2px solid transparent';
                    o.querySelector('div:nth-child(2)').style.color = '#333';
                });
                // 设置当前选中
                this.style.background = 'linear-gradient(135deg,#FFF3E0,#FFE0B2)';
                this.style.border = '2px solid #FF9800';
                this.querySelector('div:nth-child(2)').style.color = '#E65100';
                timePrefInput.value = this.getAttribute('data-value');
            };
        });
        
        // 数据同步开关事件
        var syncAllowReadCheckbox = page.querySelector('#sync-allow-read');
        if (syncAllowReadCheckbox) {
            syncAllowReadCheckbox.onchange = function() {
                var toggle = this.parentElement;
                var track = toggle.querySelector('span:first-of-type');
                var thumb = toggle.querySelector('span:last-of-type');
                if (this.checked) {
                    track.style.background = '#34C759';
                    thumb.style.left = '23px';
                } else {
                    track.style.background = '#ccc';
                    thumb.style.left = '3px';
                }
            };
        }
        
        var syncAIContextCheckbox = page.querySelector('#sync-ai-context');
        if (syncAIContextCheckbox) {
            syncAIContextCheckbox.onchange = function() {
                var toggle = this.parentElement;
                var track = toggle.querySelector('span:first-of-type');
                var thumb = toggle.querySelector('span:last-of-type');
                if (this.checked) {
                    track.style.background = '#34C759';
                    thumb.style.left = '23px';
                } else {
                    track.style.background = '#ccc';
                    thumb.style.left = '3px';
                }
            };
        }
        
        // 保存按钮
        var saveBtn = page.querySelector('#save-weibo-settings-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var newSettings = {
                    enabled: enabledCheckbox.checked,
                    frequency: parseInt(frequencySlider.value),
                    timePreference: timePrefInput.value
                };
                
                if (weiboApp) {
                    weiboApp.updateAIPostSettings(newSettings);
                }
                
                // 保存数据同步设置
                var syncAllowRead = page.querySelector('#sync-allow-read');
                var syncReadRange = page.querySelector('#sync-read-range');
                var syncAIContext = page.querySelector('#sync-ai-context');
                
                var syncSettings = {
                    allowAIReadUserPosts: syncAllowRead ? syncAllowRead.checked : true,
                    readRange: syncReadRange ? syncReadRange.value : 'recent10',
                    syncAIPostsToContext: syncAIContext ? syncAIContext.checked : true
                };
                
                if (!PhoneCore.data) PhoneCore.data = {};
                PhoneCore.data.weiboDataSource = syncSettings;
                
                // 同步到weibo.aiVisibility
                if (!PhoneCore.data.weibo) PhoneCore.data.weibo = {};
                var aiVisibilityMode = 'recent';
                var aiVisibilityCount = 10;
                
                if (!syncSettings.allowAIReadUserPosts) {
                    aiVisibilityMode = 'none';
                } else {
                    switch (syncSettings.readRange) {
                        case 'recent5': aiVisibilityMode = 'recent'; aiVisibilityCount = 5; break;
                        case 'recent10': aiVisibilityMode = 'recent'; aiVisibilityCount = 10; break;
                        case 'all': aiVisibilityMode = 'all'; break;
                        case 'mentioned': aiVisibilityMode = 'mentioned'; break;
                    }
                }
                
                PhoneCore.data.weibo.aiVisibility = {
                    mode: aiVisibilityMode,
                    recentCount: aiVisibilityCount
                };
                
                PhoneCore.save && PhoneCore.save();
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '设置已保存',
                    message: 'AI微博设置已更新',
                    size: 'mini',
                    duration: 2000
                });
            };
        }
        
        // 立即发帖按钮
        var forcePostBtn = page.querySelector('#force-post-btn');
        if (forcePostBtn) {
            forcePostBtn.onclick = function() {
                forcePostBtn.disabled = true;
                forcePostBtn.textContent = '发布中...';
                
                if (weiboApp) {
                    var post = weiboApp.forceAIPost(aiId);
                    if (post) {
                        PhoneCore.notifications.send({
                            type: 'success',
                            title: '发帖成功',
                            message: ai.name + ' 发布了一条新微博',
                            size: 'mini',
                            duration: 2000
                        });
                    } else {
                        PhoneCore.notifications.send({
                            type: 'error',
                            title: '发帖失败',
                            message: '请稍后再试',
                            size: 'mini',
                            duration: 2000
                        });
                    }
                }
                
                setTimeout(function() {
                    forcePostBtn.disabled = false;
                    forcePostBtn.textContent = '让 ' + ai.name + ' 立即发一条微博';
                }, 1000);
            };
        }
    };

    // 【更新AI认知】通过API让AI生成对自己、用户、他人的认知（旧函数保留兼容）
    SystemConfigApp.prototype.updateAICognition = function(aiId, detailPage) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var btn = detailPage.querySelector('#update-cognition-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '生成中...';
        }
        
        // 构建认知生成提示词
        var prompt = '你是' + ai.name + '。请基于以下信息，分别写出你的：\n';
        prompt += '1. 自我认知（你怎么看待自己，50字以内）\n';
        prompt += '2. 对用户的认知（你怎么看待与你聊天的用户，50字以内）\n';
        prompt += '3. 对他人的认知（你怎么看待周围的人或世界，50字以内）\n\n';
        prompt += '【你的性格】\n' + (ai.personality || '暂无') + '\n';
        prompt += '【你的背景】\n' + (ai.story || '暂无') + '\n';
        prompt += '【你的职业】\n' + (ai.job || '暂无') + '\n';
        if (ai.chatHistory && ai.chatHistory.length > 0) {
            prompt += '【最近聊天片段】\n';
            ai.chatHistory.slice(-10).forEach(function(msg) {
                prompt += (msg.role === 'user' ? '用户：' : '你：') + msg.content.substring(0, 100) + '\n';
            });
        }
        prompt += '\n请用JSON格式回复：{"self":"...","user":"...","others":"..."}';
        
        PhoneCore.api.call({
            messages: [{ role: 'user', content: prompt }],
            aiId: aiId,
            appId: 'config-app'
        }).then(function(response) {
            try {
                // 尝试解析JSON
                var jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    var cognition = JSON.parse(jsonMatch[0]);
                    ai.cognition = {
                        self: cognition.self || '',
                        user: cognition.user || '',
                        others: cognition.others || '',
                        lastUpdated: Date.now()
                    };
                    // 同步到兼容字段
                    ai.selfPerception = cognition.self || '';
                    ai.userPerception = cognition.user || '';
                    ai.othersPerception = cognition.others || '';
                    
                    PhoneCore.saveAI(ai).then(function() {
                        // 更新显示
                        var selfText = detailPage.querySelector('#cognition-self-text');
                        var userText = detailPage.querySelector('#cognition-user-text');
                        var othersText = detailPage.querySelector('#cognition-others-text');
                        if (selfText) selfText.innerHTML = cognition.self || '<span style="color:#999;">暂无</span>';
                        if (userText) userText.innerHTML = cognition.user || '<span style="color:#999;">暂无</span>';
                        if (othersText) othersText.innerHTML = cognition.others || '<span style="color:#999;">暂无</span>';
                        
                        PhoneCore.notifications.send({
                            type: 'success',
                            title: '认知已更新',
                            message: ai.name + ' 的认知已生成',
                            size: 'mini'
                        });
                    });
                }
            } catch (e) {
                console.error('解析认知失败:', e);
                PhoneCore.notifications.send({
                    type: 'error',
                    title: '生成失败',
                    message: '无法解析AI返回的认知',
                    icon: '❌',
                    size: 'mini'
                });
            }
        }).catch(function(err) {
            console.error('生成认知失败:', err);
            PhoneCore.notifications.send({
                type: 'error',
                title: '生成失败',
                message: err.message || '请检查API配置',
                icon: '❌',
                size: 'mini'
            });
        }).finally(function() {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '更新认知';
            }
        });
    };
    
    // 【生成AI最近故事状态】
    SystemConfigApp.prototype.generateAIRecentStory = function(aiId, detailPage) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var btn = detailPage.querySelector('#generate-story-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '生成中...';
        }
        
        // 获取当前时间信息
        var now = new Date();
        var timeInfo = PhoneCore.time.getFormattedTime();
        
        // 构建故事生成提示词
        var prompt = '你是' + ai.name + '。请根据以下信息，用第一人称写一段你最近的生活状态（100字以内）：\n\n';
        prompt += '【现在时间】' + timeInfo.date + ' ' + timeInfo.time + ' ' + timeInfo.weekday + '\n';
        prompt += '【你的性格】\n' + (ai.personality || '暂无') + '\n';
        prompt += '【你的职业】' + (ai.job || '暂无') + '\n';
        prompt += '【你的作息】起床：' + (ai.preferences.wakeUpTime || '08:00') + '，睡觉：' + (ai.preferences.sleepTime || '23:00') + '\n';
        
        if (ai.scheduleId) {
            var schedule = PhoneCore.getSchedule(ai.scheduleId);
            if (schedule) {
                var activity = schedule.getCurrentActivity();
                if (activity) {
                    prompt += '【当前活动】' + activity.activity + ' (' + activity.start + '-' + activity.end + ')\n';
                }
            }
        }
        
        prompt += '\n写一段自然的生活状态描述，像在发朋友圈或跟朋友聊天一样。';
        
        PhoneCore.api.call({
            messages: [{ role: 'user', content: prompt }],
            aiId: aiId,
            appId: 'config-app'
        }).then(function(response) {
            ai.recentStory = response.trim();
            PhoneCore.saveAI(ai).then(function() {
                var storyText = detailPage.querySelector('#recent-story-text');
                if (storyText) {
                    storyText.innerHTML = ai.recentStory;
                }
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '故事状态已更新',
                    size: 'mini'
                });
            });
        }).catch(function(err) {
            console.error('生成故事失败:', err);
            PhoneCore.notifications.send({
                type: 'error',
                title: '生成失败',
                message: err.message || '请检查API配置',
                icon: '❌',
                size: 'mini'
            });
        }).finally(function() {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '生成';
            }
        });
    };
    
    // 【社交账户管理】
    SystemConfigApp.prototype.openSocialAccountsManager = function(aiId) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        var S = this.STYLES;
        var I = this.SVG;
        
        var html = '<div class="' + S.pageWrap + '">';
        
        // 标题区域
        html += '<div style="margin-bottom:20px;">';
        html += '<div style="font-size:20px;font-weight:700;color:#333;margin-bottom:6px;">' + ai.name + ' 的社交账户</div>';
        html += '<div style="font-size:13px;color:#79747E;line-height:1.5;">为AI在不同App中设置不同的网络ID和头像</div>';
        html += '</div>';
        
        // 已配置的App列表
        var registeredApps = PhoneCore.getRegisteredApps ? PhoneCore.getRegisteredApps() : [];
        var socialApps = registeredApps.filter(function(app) {
            return ['chat-app', 'weibo-app', 'couple-app', 'video-app'].indexOf(app.id) !== -1;
        });
        
        // 如果没有已注册的社交类App，使用默认列表
        if (socialApps.length === 0) {
            socialApps = [
                { id: 'chat-app', name: '聊天' },
                { id: 'weibo-app', name: '微博' },
                { id: 'video-app', name: '视频' }
            ];
        }
        
        html += '<div id="social-accounts-list">';
        
        socialApps.forEach(function(app) {
            var account = ai.socialAccounts && ai.socialAccounts[app.id] ? ai.socialAccounts[app.id] : {};
            
            // 使用统一的毛玻璃卡片样式
            html += '<div class="social-account-card config-card ' + S.glassCard + '" data-app-id="' + app.id + '">';
            html += '<div style="font-weight:600;margin-bottom:14px;font-size:15px;color:#FF6B8A;display:flex;align-items:center;gap:8px;">' + I.globe + ' ' + (app.name || app.id) + '</div>';
            
            html += '<div style="display:flex;gap:14px;align-items:flex-start;">';
            
            // 头像
            html += '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;">';
            html += '<div class="social-avatar" data-app-id="' + app.id + '" style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#FFF0F5,#FFE4E1);cursor:pointer;overflow:hidden;border:2px solid rgba(255,182,193,0.3);box-shadow:0 2px 8px rgba(255,182,193,0.2);">';
            if (account.avatar) {
                html += '<img src="' + account.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#FFB6C1;">' + I.image + '</div>';
            }
            html += '</div>';
            html += '<button class="select-from-avatar-library-btn ' + S.secondaryButton + '" data-app-id="' + app.id + '" style="padding:4px 10px;font-size:10px;">AI选头像</button>';
            html += '</div>';
            
            html += '<div style="flex:1;">';
            // 网络ID
            html += '<div style="margin-bottom:10px;">';
            html += '<label class="' + S.label + '">网络ID</label>';
            html += '<input type="text" class="social-network-id ' + S.input + '" data-app-id="' + app.id + '" value="' + (account.networkId || '') + '" placeholder="@' + ai.name + '">';
            html += '</div>';
            
            // 简介
            html += '<div>';
            html += '<label class="' + S.label + '">个性签名</label>';
            html += '<input type="text" class="social-bio ' + S.input + '" data-app-id="' + app.id + '" value="' + (account.bio || '') + '" placeholder="这个人很懒...">';
            html += '</div>';
            html += '</div>';
            
            html += '</div>';
            
            // 背景图设置
            html += '<div style="margin-top:14px;">';
            html += '<label class="' + S.label + '">主页背景</label>';
            html += '<div class="social-background" data-app-id="' + app.id + '" style="width:100%;height:80px;border-radius:12px;background:linear-gradient(135deg,#FFF8F9,#FFF0F5);cursor:pointer;overflow:hidden;position:relative;border:1px dashed rgba(255,182,193,0.5);">';
            if (account.background) {
                html += '<img src="' + account.background + '" style="width:100%;height:100%;object-fit:cover;">';
                html += '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;" class="bg-overlay"><span style="color:white;font-size:12px;">点击更换</span></div>';
            } else {
                html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#FFB6C1;font-size:12px;">点击选择背景图</div>';
            }
            html += '</div>';
            html += '<div style="display:flex;gap:8px;margin-top:8px;">';
            html += '<button class="select-from-bg-library-btn ' + S.secondaryButton + '" data-app-id="' + app.id + '" style="background:rgba(121,116,126,0.08);color:#79747E;padding:6px 12px;font-size:11px;">手动选背景</button>';
            html += '<button class="ai-select-bg-btn ' + S.secondaryButton + '" data-app-id="' + app.id + '" style="padding:6px 12px;font-size:11px;">AI选背景</button>';
            html += '</div>';
            html += '</div>';
            
            html += '</div>';
        });
        
        html += '</div>';
        
        // 自动生成网络ID和签名
        html += '<button id="auto-generate-ids-btn" class="' + S.primaryButton + ' sys-btn-full" style="margin-bottom:12px;">AI自动生成昵称和签名</button>';
        
        // 保存按钮 - 使用柔和的绿色
        html += '<button id="save-social-accounts-btn" style="width:100%;padding:12px 20px;background:linear-gradient(135deg,#81C784,#66BB6A);color:white;border:none;border-radius:12px;font-size:14px;font-weight:500;cursor:pointer;box-shadow:0 2px 8px rgba(102,187,106,0.3);">保存设置</button>';
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 头像点击上传
        page.querySelectorAll('.social-avatar').forEach(function(avatarEl) {
            avatarEl.onclick = function() {
                var appId = avatarEl.getAttribute('data-app-id');
                PhoneCore.resources.createImageInput(function(resource) {
                    avatarEl.innerHTML = '<img src="' + resource.data + '" style="width:100%;height:100%;object-fit:cover;">';
                    avatarEl.setAttribute('data-avatar', resource.data);
                });
            };
        });
        
        // 背景图点击上传
        page.querySelectorAll('.social-background').forEach(function(bgEl) {
            bgEl.onclick = function() {
                var appId = bgEl.getAttribute('data-app-id');
                PhoneCore.resources.createImageInput(function(resource) {
                    bgEl.innerHTML = '<img src="' + resource.data + '" style="width:100%;height:100%;object-fit:cover;">';
                    bgEl.setAttribute('data-background', resource.data);
                });
            };
            // hover效果
            bgEl.onmouseenter = function() {
                var overlay = bgEl.querySelector('.bg-overlay');
                if (overlay) overlay.style.opacity = '1';
            };
            bgEl.onmouseleave = function() {
                var overlay = bgEl.querySelector('.bg-overlay');
                if (overlay) overlay.style.opacity = '0';
            };
        });
        
        // 从背景库选择（手动）
        page.querySelectorAll('.select-from-bg-library-btn').forEach(function(btn) {
            btn.onclick = function() {
                var appId = btn.getAttribute('data-app-id');
                self.openBackgroundSelector(aiId, appId, page);
            };
        });
        
        // AI选头像 - 从头像库智能选择
        page.querySelectorAll('.select-from-avatar-library-btn').forEach(function(btn) {
            btn.onclick = function() {
                var appId = btn.getAttribute('data-app-id');
                btn.disabled = true;
                btn.textContent = '选择中...';
                
                self.aiSelectAvatar(aiId, appId, page, function() {
                    btn.disabled = false;
                    btn.textContent = 'AI选头像';
                });
            };
        });
        
        // AI选背景 - 从背景库智能选择
        page.querySelectorAll('.ai-select-bg-btn').forEach(function(btn) {
            btn.onclick = function() {
                var appId = btn.getAttribute('data-app-id');
                btn.disabled = true;
                btn.textContent = '选择中...';
                
                self.aiSelectBackground(aiId, appId, page, function() {
                    btn.disabled = false;
                    btn.textContent = 'AI选背景';
                });
            };
        });
        
        // 自动生成网络ID和签名
        var autoGenBtn = page.querySelector('#auto-generate-ids-btn');
        if (autoGenBtn) {
            autoGenBtn.onclick = function() {
                autoGenBtn.disabled = true;
                autoGenBtn.textContent = '生成中...';
                
                var prompt = '为角色"' + ai.name + '"生成3个不同风格的社交媒体账号信息。\n';
                prompt += '角色性格：' + (ai.personality || '普通') + '\n';
                prompt += '角色简介：' + (ai.description || '无') + '\n';
                prompt += '要求：\n';
                prompt += '1. 每个账号的网络ID要独特、有个性，适合中文社交媒体，不要太长\n';
                prompt += '2. 每个账号的个性签名要符合角色性格，简短有趣，10-20字左右\n';
                prompt += '用JSON格式回复：{"accounts":[{"id":"网络ID1","bio":"签名1"},{"id":"网络ID2","bio":"签名2"},{"id":"网络ID3","bio":"签名3"}]}';
                
                PhoneCore.api.call(prompt, null, {
                    messages: [{ role: 'user', content: prompt }],
                    aiId: aiId,
                    appId: 'config-app'
                }).then(function(response) {
                    try {
                        var content = response.content || response;
                        var jsonMatch = content.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            var result = JSON.parse(jsonMatch[0]);
                            var accounts = result.accounts || [];
                            var idInputs = page.querySelectorAll('.social-network-id');
                            var bioInputs = page.querySelectorAll('.social-bio');
                            idInputs.forEach(function(input, index) {
                                if (accounts[index]) {
                                    input.value = accounts[index].id || '';
                                }
                            });
                            bioInputs.forEach(function(input, index) {
                                if (accounts[index]) {
                                    input.value = accounts[index].bio || '';
                                }
                            });
                            PhoneCore.notifications.send({
                                type: 'success',
                                title: '昵称和签名已生成',
                                size: 'mini'
                            });
                        }
                    } catch (e) {
                        console.error('解析失败:', e);
                    }
                }).catch(function(err) {
                    console.error('API调用失败:', err);
                    PhoneCore.notifications.send({
                        type: 'error',
                        title: '生成失败：' + (err.message || '未知错误'),
                        size: 'mini'
                    });
                }).finally(function() {
                    autoGenBtn.disabled = false;
                    autoGenBtn.textContent = 'AI自动生成昵称和签名';
                });
            };
        }
        
        // 保存
        var saveBtn = page.querySelector('#save-social-accounts-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                if (!ai.socialAccounts) ai.socialAccounts = {};
                
                page.querySelectorAll('.social-account-card').forEach(function(card) {
                    var appId = card.getAttribute('data-app-id');
                    var networkIdInput = card.querySelector('.social-network-id');
                    var bioInput = card.querySelector('.social-bio');
                    var avatarEl = card.querySelector('.social-avatar');
                    var bgEl = card.querySelector('.social-background');
                    
                    var existingAccount = ai.socialAccounts[appId] || {};
                    
                    ai.socialAccounts[appId] = {
                        networkId: networkIdInput ? networkIdInput.value.trim() : '',
                        bio: bioInput ? bioInput.value.trim() : '',
                        avatar: avatarEl ? (avatarEl.getAttribute('data-avatar') || existingAccount.avatar || '') : '',
                        background: bgEl ? (bgEl.getAttribute('data-background') || existingAccount.background || '') : ''
                    };
                });
                
                PhoneCore.saveAI(ai).then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '社交账户已保存',
                        icon: '✅',
                        size: 'mini'
                    });
                    page.querySelector('.app-back-btn').click();
                });
            };
        }
    };
    
    /**
     * 打开背景选择器（从背景库选择）
     */
    SystemConfigApp.prototype.openBackgroundSelector = function(aiId, appId, parentPage) {
        var self = this;
        var S = this.STYLES;
        
        this.initBackgroundLibraryData();
        var backgrounds = PhoneCore.data.backgroundLibrary.backgrounds || [];
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:20px;font-weight:700;margin-bottom:20px;color:#333;">选择背景</div>';
        
        if (backgrounds.length === 0) {
            html += '<div style="text-align:center;padding:60px 20px;color:#999;">';
            html += '背景库为空，请先在世界观-背景库中上传背景';
            html += '</div>';
        } else {
            html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">';
            backgrounds.forEach(function(bg) {
                html += '<div class="bg-select-item" data-bg-data="' + encodeURIComponent(bg.data) + '" style="position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);">';
                html += '<img src="' + bg.data + '" style="width:100%;height:100%;object-fit:cover;">';
                html += '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:8px;color:white;font-size:12px;">' + (bg.name || '未命名') + '</div>';
                html += '</div>';
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 选择背景
        page.querySelectorAll('.bg-select-item').forEach(function(item) {
            item.onclick = function() {
                var bgData = decodeURIComponent(item.getAttribute('data-bg-data'));
                
                // 更新父页面的背景预览
                var bgEl = parentPage.querySelector('.social-background[data-app-id="' + appId + '"]');
                if (bgEl) {
                    bgEl.innerHTML = '<img src="' + bgData + '" style="width:100%;height:100%;object-fit:cover;">';
                    bgEl.setAttribute('data-background', bgData);
                }
                
                PhoneCore.notifications.send({ type: 'success', title: '已选择背景', size: 'mini' });
                page.querySelector('.app-back-btn').click();
            };
        });
    };
    
    /**
     * AI智能选择头像
     * @param {string} aiId - AI的ID
     * @param {string} appId - 应用ID
     * @param {HTMLElement} parentPage - 父页面
     * @param {function} callback - 完成回调
     */
    SystemConfigApp.prototype.aiSelectAvatar = function(aiId, appId, parentPage, callback) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) {
            callback && callback();
            return;
        }
        
        // 获取头像库数据
        this.initAvatarLibraryData();
        var avatars = PhoneCore.data.avatarLibrary.avatars || [];
        
        if (avatars.length === 0) {
            PhoneCore.notifications.send({
                type: 'warning',
                title: '头像库为空，请先上传头像',
                size: 'mini'
            });
            callback && callback();
            return;
        }
        
        // 构建头像列表描述
        var avatarList = avatars.map(function(avatar, index) {
            return (index + 1) + '. ' + (avatar.name || '头像' + (index + 1)) + (avatar.categoryId ? '（分类：' + avatar.categoryId + '）' : '');
        }).join('\n');
        
        var prompt = '你是一个AI助手，需要为角色选择最合适的社交媒体头像。\n\n';
        prompt += '【角色信息】\n';
        prompt += '名称：' + ai.name + '\n';
        prompt += '性格：' + (ai.personality || '未设定') + '\n';
        prompt += '简介：' + (ai.description || '未设定') + '\n\n';
        prompt += '【可选头像列表】\n' + avatarList + '\n\n';
        prompt += '【应用场景】' + appId + '\n\n';
        prompt += '请根据角色性格和场景，选择最合适的头像。\n';
        prompt += '只需回复JSON格式：{"selectedIndex": 数字}，其中数字是头像序号（从1开始）';
        
        PhoneCore.api.call(prompt, null, {
            messages: [{ role: 'user', content: prompt }],
            aiId: aiId,
            appId: 'config-app',
            maxTokens: 100
        }).then(function(response) {
            try {
                var content = response.content || response;
                var jsonMatch = content.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    var result = JSON.parse(jsonMatch[0]);
                    var selectedIndex = result.selectedIndex - 1; // 转为0开始的索引
                    
                    if (selectedIndex >= 0 && selectedIndex < avatars.length) {
                        var selectedAvatar = avatars[selectedIndex];
                        
                        // 更新页面上的头像预览
                        var avatarEl = parentPage.querySelector('.social-avatar[data-app-id="' + appId + '"]');
                        if (avatarEl) {
                            avatarEl.innerHTML = '<img src="' + selectedAvatar.data + '" style="width:100%;height:100%;object-fit:cover;">';
                            avatarEl.setAttribute('data-avatar', selectedAvatar.data);
                        }
                        
                        PhoneCore.notifications.send({
                            type: 'success',
                            title: 'AI选择了：' + (selectedAvatar.name || '头像'),
                            size: 'mini'
                        });
                    } else {
                        throw new Error('索引超出范围');
                    }
                } else {
                    throw new Error('无法解析AI回复');
                }
            } catch (e) {
                console.error('AI选择头像失败:', e);
                PhoneCore.notifications.send({
                    type: 'error',
                    title: '选择失败，请重试',
                    size: 'mini'
                });
            }
        }).catch(function(err) {
            console.error('API调用失败:', err);
            PhoneCore.notifications.send({
                type: 'error',
                title: '选择失败：' + (err.message || '未知错误'),
                size: 'mini'
            });
        }).finally(function() {
            callback && callback();
        });
    };
    
    /**
     * AI智能选择背景
     * @param {string} aiId - AI的ID
     * @param {string} appId - 应用ID
     * @param {HTMLElement} parentPage - 父页面
     * @param {function} callback - 完成回调
     */
    SystemConfigApp.prototype.aiSelectBackground = function(aiId, appId, parentPage, callback) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) {
            callback && callback();
            return;
        }
        
        // 获取背景库数据
        this.initBackgroundLibraryData();
        var backgrounds = PhoneCore.data.backgroundLibrary.backgrounds || [];
        
        if (backgrounds.length === 0) {
            PhoneCore.notifications.send({
                type: 'warning',
                title: '背景库为空，请先上传背景',
                size: 'mini'
            });
            callback && callback();
            return;
        }
        
        // 构建背景列表描述
        var bgList = backgrounds.map(function(bg, index) {
            return (index + 1) + '. ' + (bg.name || '背景' + (index + 1)) + (bg.categoryId ? '（分类：' + bg.categoryId + '）' : '');
        }).join('\n');
        
        var prompt = '你是一个AI助手，需要为角色选择最合适的社交媒体主页背景。\n\n';
        prompt += '【角色信息】\n';
        prompt += '名称：' + ai.name + '\n';
        prompt += '性格：' + (ai.personality || '未设定') + '\n';
        prompt += '简介：' + (ai.description || '未设定') + '\n\n';
        prompt += '【可选背景列表】\n' + bgList + '\n\n';
        prompt += '【应用场景】' + appId + '\n\n';
        prompt += '请根据角色性格和场景，选择最合适的背景图片。\n';
        prompt += '只需回复JSON格式：{"selectedIndex": 数字}，其中数字是背景序号（从1开始）';
        
        PhoneCore.api.call(prompt, null, {
            messages: [{ role: 'user', content: prompt }],
            aiId: aiId,
            appId: 'config-app',
            maxTokens: 100
        }).then(function(response) {
            try {
                var content = response.content || response;
                var jsonMatch = content.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    var result = JSON.parse(jsonMatch[0]);
                    var selectedIndex = result.selectedIndex - 1; // 转为0开始的索引
                    
                    if (selectedIndex >= 0 && selectedIndex < backgrounds.length) {
                        var selectedBg = backgrounds[selectedIndex];
                        
                        // 更新页面上的背景预览
                        var bgEl = parentPage.querySelector('.social-background[data-app-id="' + appId + '"]');
                        if (bgEl) {
                            bgEl.innerHTML = '<img src="' + selectedBg.data + '" style="width:100%;height:100%;object-fit:cover;">';
                            bgEl.setAttribute('data-background', selectedBg.data);
                        }
                        
                        PhoneCore.notifications.send({
                            type: 'success',
                            title: 'AI选择了：' + (selectedBg.name || '背景'),
                            size: 'mini'
                        });
                    } else {
                        throw new Error('索引超出范围');
                    }
                } else {
                    throw new Error('无法解析AI回复');
                }
            } catch (e) {
                console.error('AI选择背景失败:', e);
                PhoneCore.notifications.send({
                    type: 'error',
                    title: '选择失败，请重试',
                    size: 'mini'
                });
            }
        }).catch(function(err) {
            console.error('API调用失败:', err);
            PhoneCore.notifications.send({
                type: 'error',
                title: '选择失败：' + (err.message || '未知错误'),
                size: 'mini'
            });
        }).finally(function() {
            callback && callback();
        });
    };

    // 【关系圈管理】
    SystemConfigApp.prototype.openRelationshipsManager = function(aiId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:10px;">' + ai.name + ' 的关系圈</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">管理AI与其他AI之间的关系</div>';
        
        // 添加关系按钮
        html += '<button id="add-relationship-btn" style="width:100%;padding:12px;background:#007AFF;color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;margin-bottom:20px;">+ 添加关系</button>';
        
        // 关系类型说明
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">';
        var relTypes = [
            { type: 'lover', label: '恋人', color: '#E91E63' },
            { type: 'friend', label: '朋友', color: '#4CAF50' },
            { type: 'family', label: '家人', color: '#FF9800' },
            { type: 'colleague', label: '同事', color: '#2196F3' },
            { type: 'stranger', label: '陌生人', color: '#9E9E9E' }
        ];
        relTypes.forEach(function(rt) {
            html += '<span style="font-size:11px;padding:4px 10px;background:' + rt.color + '20;color:' + rt.color + ';border-radius:12px;">' + rt.label + '</span>';
        });
        html += '</div>';
        
        // 关系列表
        html += '<div id="relationships-list">';
        var relationships = ai.relationships || {};
        var relKeys = Object.keys(relationships);
        
        if (relKeys.length === 0) {
            html += '<div style="text-align:center;padding:40px;color:#999;font-size:14px;">暂无关系，点击添加</div>';
        } else {
            relKeys.forEach(function(relAiId) {
                var rel = relationships[relAiId];
                var relAi = PhoneCore.getAI(relAiId);
                if (!relAi) return;
                
                var relTypeInfo = relTypes.find(function(rt) { return rt.type === rel.type; }) || relTypes[4];
                
                html += '<div class="relationship-card" data-rel-ai-id="' + relAiId + '" style="background:white;border-radius:12px;padding:14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">';
                html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">';
                
                // 头像
                html += '<div style="width:44px;height:44px;border-radius:12px;background:#F5F5F5;overflow:hidden;display:flex;align-items:center;justify-content:center;">';
                if (relAi.avatar) {
                    html += '<img src="' + relAi.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
                } else {
                    html += '<span style="color:#999;">' + I.robot + '</span>';
                }
                html += '</div>';
                
                html += '<div style="flex:1;">';
                html += '<div style="font-weight:500;font-size:14px;color:#1D1B20;">' + relAi.name + '</div>';
                html += '<div style="font-size:11px;color:' + relTypeInfo.color + ';">' + relTypeInfo.label + '</div>';
                html += '</div>';
                
                // 删除按钮
                html += '<button class="delete-rel-btn" data-rel-ai-id="' + relAiId + '" style="width:28px;height:28px;background:#D8456C;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;">' + I.cross + '</button>';
                html += '</div>';
                
                // 亲密度
                html += '<div style="margin-bottom:10px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
                html += '<span style="font-size:12px;color:#666;">亲密度</span>';
                html += '<span class="rel-level-value" style="font-size:12px;color:#FF6B8A;font-weight:500;">' + (rel.level || 0) + '</span>';
                html += '</div>';
                html += '<input type="range" class="rel-level-slider" data-rel-ai-id="' + relAiId + '" min="0" max="100" value="' + (rel.level || 0) + '" style="width:100%;accent-color:#FF8FAB;">';
                html += '</div>';
                
                // 关系描述
                html += '<div>';
                html += '<label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">关系描述</label>';
                html += '<input type="text" class="rel-description" data-rel-ai-id="' + relAiId + '" value="' + (rel.description || '') + '" placeholder="描述两人的关系..." style="width:100%;padding:8px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;box-sizing:border-box;">';
                html += '</div>';
                
                html += '</div>';
            });
        }
        html += '</div>';
        
        // === 朋友圈好友（交际圈）===
        html += '<div style="margin-top:24px;margin-bottom:16px;">';
        html += '<div style="font-size:16px;font-weight:600;margin-bottom:8px;color:#333;">朋友圈好友</div>';
        html += '<div style="font-size:12px;color:#888;margin-bottom:12px;">选择能看到对方朋友圈动态的AI好友</div>';
        
        var socialCircle = ai.socialCircle || [];
        var allAIs = Object.values(PhoneCore.ais).filter(function(a) { return a.id !== aiId; });
        
        if (allAIs.length === 0) {
            html += '<div style="text-align:center;padding:15px;color:#999;font-size:13px;background:#f8f8f8;border-radius:10px;">暂无其他AI</div>';
        } else {
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            allAIs.forEach(function(otherAI) {
                var isSelected = socialCircle.indexOf(otherAI.id) !== -1;
                html += '<label class="social-circle-label" style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:' + (isSelected ? 'rgba(33,150,243,0.1)' : '#f5f5f5') + ';border-radius:20px;cursor:pointer;border:1px solid ' + (isSelected ? '#2196F3' : 'transparent') + ';transition:all 0.2s;">';
                html += '<input type="checkbox" class="social-circle-checkbox" data-friend-id="' + otherAI.id + '" ' + (isSelected ? 'checked' : '') + ' style="display:none;">';
                if (otherAI.avatar) {
                    html += '<img src="' + otherAI.avatar + '" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">';
                } else {
                    html += '<div style="width:24px;height:24px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:11px;color:#666;">' + otherAI.name.charAt(0) + '</div>';
                }
                html += '<span class="friend-name" style="font-size:13px;color:' + (isSelected ? '#2196F3' : '#333') + ';">' + otherAI.name + '</span>';
                if (isSelected) {
                    html += '<svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="#2196F3"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
                }
                html += '</label>';
            });
            html += '</div>';
        }
        html += '</div>';
        
        html += '<button id="save-relationships-btn" style="width:100%;padding:12px;background:#34C759;color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;margin-top:10px;">保存</button>';
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 朋友圈好友复选框事件
        page.querySelectorAll('.social-circle-checkbox').forEach(function(checkbox) {
            var label = checkbox.closest('.social-circle-label');
            checkbox.onchange = function() {
                var nameSpan = label.querySelector('.friend-name');
                var checkIcon = label.querySelector('.check-icon');
                if (checkbox.checked) {
                    label.style.background = 'rgba(33,150,243,0.1)';
                    label.style.borderColor = '#2196F3';
                    if (nameSpan) nameSpan.style.color = '#2196F3';
                    if (!checkIcon) {
                        var svg = document.createElement('span');
                        svg.innerHTML = '<svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="#2196F3"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
                        label.appendChild(svg.firstChild);
                    }
                } else {
                    label.style.background = '#f5f5f5';
                    label.style.borderColor = 'transparent';
                    if (nameSpan) nameSpan.style.color = '#333';
                    if (checkIcon) checkIcon.remove();
                }
            };
        });
        
        // 亲密度滑块事件
        page.querySelectorAll('.rel-level-slider').forEach(function(slider) {
            var valueSpan = slider.parentElement.querySelector('.rel-level-value');
            slider.oninput = function() {
                if (valueSpan) valueSpan.textContent = slider.value;
            };
        });
        
        // 删除关系
        page.querySelectorAll('.delete-rel-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var relAiId = btn.getAttribute('data-rel-ai-id');
                if (confirm('确定删除此关系？')) {
                    delete ai.relationships[relAiId];
                    PhoneCore.saveAI(ai).then(function() {
                        btn.closest('.relationship-card').remove();
                    });
                }
            };
        });
        
        // 添加关系
        var addRelBtn = page.querySelector('#add-relationship-btn');
        if (addRelBtn) {
            addRelBtn.onclick = function() {
                self.openAddRelationshipDialog(aiId, page);
            };
        }
        
        // 保存
        var saveBtn = page.querySelector('#save-relationships-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                // 保存关系设置
                page.querySelectorAll('.relationship-card').forEach(function(card) {
                    var relAiId = card.getAttribute('data-rel-ai-id');
                    var levelSlider = card.querySelector('.rel-level-slider');
                    var descInput = card.querySelector('.rel-description');
                    
                    if (ai.relationships[relAiId]) {
                        ai.relationships[relAiId].level = levelSlider ? parseInt(levelSlider.value) : 0;
                        ai.relationships[relAiId].description = descInput ? descInput.value.trim() : '';
                    }
                });
                
                // 保存朋友圈好友（交际圈）设置
                var newSocialCircle = [];
                page.querySelectorAll('.social-circle-checkbox').forEach(function(checkbox) {
                    if (checkbox.checked) {
                        newSocialCircle.push(checkbox.getAttribute('data-friend-id'));
                    }
                });
                ai.socialCircle = newSocialCircle;
                
                PhoneCore.saveAI(ai).then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '关系圈已保存',
                        icon: '✅',
                        size: 'mini'
                    });
                });
            };
        }
    };
    
    // 【Tokens消耗详情页】
    SystemConfigApp.prototype.openTokensDetailPage = function(aiId) {
        var self = this;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:10px;">' + ai.name + ' 的Tokens消耗</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">查看AI在各个App中的tokens消耗情况</div>';
        
        // 总消耗
        html += '<div style="background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;padding:20px;margin-bottom:20px;color:white;">';
        html += '<div style="font-size:14px;opacity:0.9;">总消耗</div>';
        html += '<div style="font-size:36px;font-weight:700;margin-top:8px;">' + (ai.tokensUsed.total || 0).toLocaleString() + '</div>';
        html += '<div style="font-size:12px;opacity:0.8;margin-top:8px;">tokens</div>';
        html += '</div>';
        
        // 按App分类
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div style="font-weight:600;margin-bottom:15px;">按App分类</div>';
        
        var byApp = ai.tokensUsed.byApp || {};
        var appIds = Object.keys(byApp).sort(function(a, b) {
            return byApp[b] - byApp[a]; // 按消耗量降序排列
        });
        
        if (appIds.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:#999;">暂无消耗记录</div>';
        } else {
            // 获取最大值用于计算进度条
            var maxTokens = Math.max.apply(null, appIds.map(function(id) { return byApp[id]; }));
            
            appIds.forEach(function(appId) {
                var tokens = byApp[appId];
                var percentage = ai.tokensUsed.total > 0 ? (tokens / ai.tokensUsed.total * 100).toFixed(1) : 0;
                var barWidth = maxTokens > 0 ? (tokens / maxTokens * 100) : 0;
                
                // 根据App名称选择颜色
                var colors = {
                    'chat-app': '#007AFF',
                    'weibo-app': '#FF6B8A',
                    'video-app': '#34C759',
                    'config-app': '#FF9500'
                };
                var barColor = colors[appId] || '#667eea';
                
                html += '<div style="margin-bottom:15px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
                html += '<span style="font-size:14px;font-weight:500;">' + appId + '</span>';
                html += '<span style="font-size:13px;color:#666;">' + tokens.toLocaleString() + ' (' + percentage + '%)</span>';
                html += '</div>';
                html += '<div style="height:8px;background:#f0f0f0;border-radius:4px;overflow:hidden;">';
                html += '<div style="height:100%;width:' + barWidth + '%;background:' + barColor + ';border-radius:4px;transition:width 0.3s;"></div>';
                html += '</div>';
                html += '</div>';
            });
        }
        html += '</div>';
        
        // 按日期分类
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div style="font-weight:600;margin-bottom:15px;">按日期分类（最近7天）</div>';
        
        var byDate = ai.tokensUsed.byDate || {};
        var dateKeys = Object.keys(byDate).sort().reverse().slice(0, 7); // 最近7天
        
        if (dateKeys.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:#999;">暂无日期记录</div>';
        } else {
            dateKeys.forEach(function(date) {
                var tokens = byDate[date];
                var formattedDate = date; // 格式：2026-01-17
                
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">';
                html += '<span style="font-size:14px;">' + formattedDate + '</span>';
                html += '<span style="font-size:14px;color:#007AFF;font-weight:500;">' + tokens.toLocaleString() + '</span>';
                html += '</div>';
            });
        }
        html += '</div>';
        
        // 重置统计按钮
        html += '<button id="reset-tokens-btn" style="width:100%;padding:12px;background:#FF3B30;color:white;border:none;border-radius:10px;font-size:14px;cursor:pointer;opacity:0.8;">重置统计数据</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 重置按钮
        var resetBtn = page.querySelector('#reset-tokens-btn');
        if (resetBtn) {
            resetBtn.onclick = function() {
                if (confirm('确定重置 ' + ai.name + ' 的tokens统计数据？此操作不可恢复。')) {
                    ai.tokensUsed = {
                        total: 0,
                        byApp: {},
                        byDate: {},
                        lastReset: Date.now()
                    };
                    PhoneCore.saveAI(ai).then(function() {
                        PhoneCore.notifications.send({
                            type: 'success',
                            title: '统计已重置',
                            icon: '✅',
                            size: 'mini'
                        });
                        page.querySelector('.app-back-btn').click();
                    });
                }
            };
        }
    };
    
    // 【上下文查看】
    SystemConfigApp.prototype.openContextViewer = function(aiId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        
        // 每次都重新获取最新的AI数据
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html += '<div style="font-size:20px;font-weight:600;">' + ai.name + ' 的上下文</div>';
        html += '<button id="refresh-context-btn" style="padding:8px 14px;background:#f5f5f5;border:none;border-radius:8px;font-size:13px;color:#666;cursor:pointer;display:flex;align-items:center;gap:6px;">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
        html += '刷新</button>';
        html += '</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">查看发送给AI的完整内容，包括系统提示词和对话历史</div>';
        
        // 【世界观信息卡片】
        if (ai.worldId) {
            var world = PhoneCore.getWorld(ai.worldId);
            if (world) {
                html += '<div class="config-card ' + S.glassCardAccent + '" style="margin-bottom:16px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
                html += '<span style="font-weight:600;font-size:14px;color:#FF6B8A;">世界观设定</span>';
                html += '<span style="font-size:11px;color:#888;background:#f5f5f5;padding:3px 8px;border-radius:10px;">已绑定</span>';
                html += '</div>';
                html += '<div style="font-size:14px;font-weight:500;color:#333;margin-bottom:8px;">' + world.name + '</div>';
                if (world.description) {
                    html += '<div style="font-size:12px;color:#666;line-height:1.5;background:#f8f9fa;padding:10px;border-radius:8px;max-height:100px;overflow-y:auto;">' + self.escapeHtml(world.description) + '</div>';
                }
                // 显示地点信息
                if (ai.locationId && world.locations && world.locations[ai.locationId]) {
                    var location = world.locations[ai.locationId];
                    html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.06);">';
                    html += '<div style="font-size:12px;color:#888;margin-bottom:4px;">所在地点</div>';
                    html += '<div style="font-size:13px;color:#333;font-weight:500;">' + location.name + '</div>';
                    if (location.description) {
                        html += '<div style="font-size:11px;color:#666;margin-top:4px;">' + location.description.substring(0, 100) + (location.description.length > 100 ? '...' : '') + '</div>';
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
        }
        
        // 系统提示词部分
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
        html += '<span style="font-weight:600;font-size:14px;color:#333;">系统提示词 (System Prompt)</span>';
        html += '<span style="font-size:11px;color:#888;background:#f5f5f5;padding:3px 8px;border-radius:10px;">role: system</span>';
        html += '</div>';
        
        // 构建系统提示词内容 - 使用完整版本
        var systemPrompt = self.buildSystemPromptPreview(ai);
        var promptCharCount = systemPrompt.length;
        var promptTokenEstimate = Math.ceil(promptCharCount * 0.5);
        html += '<div style="font-size:11px;color:#888;margin-bottom:8px;">约 ' + promptCharCount + ' 字符 / ~' + promptTokenEstimate + ' tokens</div>';
        html += '<div id="system-prompt-content" style="background:#f8f9fa;border-radius:10px;padding:12px;max-height:300px;overflow-y:auto;font-size:12px;color:#555;line-height:1.6;white-space:pre-wrap;word-break:break-all;">' + self.escapeHtml(systemPrompt) + '</div>';
        html += '</div>';
        
        // 对话历史部分 - 只显示实际会发送的消息
        var chatHistory = ai.chatHistory || [];
        var contextLength = ai.contextLength || 20;
        // 过滤掉通话消息，与实际发送逻辑一致
        var filteredHistory = chatHistory.filter(function(msg) {
            return !(msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat' || 
                msg.type === 'call_system' || msg.fromIsland || msg.isIslandReply);
        });
        var actualMessages = filteredHistory.slice(-contextLength);
        
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
        html += '<span style="font-weight:600;font-size:14px;color:#333;">对话历史 (Messages)</span>';
        html += '<span style="font-size:11px;color:#888;background:#f5f5f5;padding:3px 8px;border-radius:10px;">发送 ' + actualMessages.length + ' / 总 ' + filteredHistory.length + ' 条</span>';
        html += '</div>';
        
        if (actualMessages.length === 0) {
            html += '<div style="text-align:center;padding:30px;color:#999;font-size:13px;">暂无对话记录</div>';
        } else {
            html += '<div id="context-messages-list" style="max-height:400px;overflow-y:auto;">';
            
            // 显示实际会发送的对话历史
            actualMessages.forEach(function(msg, index) {
                var isUser = msg.role === 'user';
                var isSystem = msg.role === 'system';
                var bgColor = isUser ? '#E3F2FD' : (isSystem ? '#FFF3E0' : '#F3E5F5');
                var labelColor = isUser ? '#1976D2' : (isSystem ? '#E65100' : '#7B1FA2');
                var label = isUser ? 'user' : (isSystem ? 'system' : 'assistant');
                
                html += '<div style="margin-bottom:12px;padding:12px;background:' + bgColor + ';border-radius:10px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
                html += '<span style="font-size:11px;color:' + labelColor + ';font-weight:500;">role: ' + label + '</span>';
                html += '<span style="font-size:10px;color:#999;">#' + (index + 1) + '</span>';
                html += '</div>';
                
                var content = msg.content || '';
                // 处理多模态内容
                if (Array.isArray(content)) {
                    content = content.map(function(c) {
                        if (c.type === 'text') return c.text;
                        if (c.type === 'image_url') return '[图片]';
                        return JSON.stringify(c);
                    }).join('\n');
                }
                
                // 处理特殊消息类型
                if (msg.type === 'call_record' && msg.callRecord) {
                    var cr = msg.callRecord;
                    var callTypeName = cr.callType === 'video' ? '视频通话' : '语音通话';
                    if (cr.summary) {
                        content = '[之前有过' + callTypeName + '，梗概：' + cr.summary + ']';
                    } else if (cr.wasConnected) {
                        content = '[之前有过' + callTypeName + '，时长' + Math.floor(cr.duration / 60) + '分钟]';
                    } else {
                        content = '[之前有过未接通的' + callTypeName + ']';
                    }
                } else if (msg.type === 'moment_share' && msg.momentCard) {
                    var mc = msg.momentCard;
                    content = '[用户分享了一条朋友圈动态]\n发布者：' + (mc.ownerName || '未知');
                    if (mc.content) content += '\n内容：' + mc.content;
                } else if (msg.type === 'voice' && msg.voiceContent) {
                    content = msg.voiceContent;
                }
                
                html += '<div style="font-size:12px;color:#333;line-height:1.5;white-space:pre-wrap;word-break:break-all;">' + self.escapeHtml(content) + '</div>';
                html += '</div>';
            });
            
            html += '</div>';
        }
        html += '</div>';
        
        // 上下文长度设置信息
        // 上下文设置卡片用的SVG图标
        var contextIcons = {
            length: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8V9zm0 3h4v2h-4v-2zm0-6h8v2h-8V6z"/></svg>',
            send: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
            model: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-2 .9-2 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>',
            data: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
        };
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
        html += '<div style="font-weight:600;font-size:14px;color:#333;margin-bottom:12px;">上下文设置</div>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<span style="font-size:13px;color:#333;font-weight:500;">' + contextIcons.length + '上下文长度设置</span>';
        html += '<span style="font-size:13px;color:#333;">' + contextLength + ' 条</span>';
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<span style="font-size:13px;color:#333;font-weight:500;">' + contextIcons.send + '实际发送条数</span>';
        html += '<span style="font-size:13px;color:#333;">' + actualMessages.length + ' 条</span>';
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<span style="font-size:13px;color:#333;font-weight:500;">' + contextIcons.model + '使用模型</span>';
        html += '<span style="font-size:13px;color:#333;">' + (ai.model || '默认') + '</span>';
        html += '</div>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">';
        html += '<span style="font-size:13px;color:#333;font-weight:500;">' + contextIcons.data + '数据订阅</span>';
        var dataSub = ai.dataSubscription || {};
        var subItems = [];
        if (dataSub.weather !== false) subItems.push('天气');
        if (dataSub.time !== false) subItems.push('时间');
        html += '<span style="font-size:13px;color:#333;">' + (subItems.length > 0 ? subItems.join('、') : '无') + '</span>';
        html += '</div>';
        html += '</div>';
        
        // 【数据订阅详情卡片】展示实际发送给AI的订阅数据
        // SVG图标定义
        var svgIcons = {
            time: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>',
            weather: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>',
            user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
            location: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
            home: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
            moments: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/></svg>',
            world: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
            weibo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M10.8 15.6c-2.7.2-4.9-1.2-4.9-3.1s2.2-3.5 4.9-3.7c2.7-.2 4.9 1.2 4.9 3.1s-2.2 3.5-4.9 3.7zm-1-2.1c.9.3 2.1-.1 2.6-.9.5-.8.3-1.7-.6-2s-2.1.1-2.6.9c-.5.8-.3 1.7.6 2z"/></svg>'
        };
        
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:16px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
        html += '<span style="font-weight:600;font-size:14px;color:#333;">数据订阅详情</span>';
        html += '<span style="font-size:11px;background:#E8F5E9;padding:3px 8px;border-radius:10px;color:#4CAF50;">实际数据</span>';
        html += '</div>';
        
        // 获取用户面具信息
        var mask = PhoneCore.user.getCurrentMask ? PhoneCore.user.getCurrentMask() : null;
        
        // 0. 世界观内容 - 在数据订阅详情中显示
        if (ai.worldId) {
            var worldData = PhoneCore.getWorld(ai.worldId);
            if (worldData) {
                html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
                html += '<span style="font-size:13px;color:#333;font-weight:500;">' + svgIcons.world + '世界观设定</span>';
                html += '<span style="font-size:11px;color:#FF6B8A;background:#FFEBEF;padding:2px 6px;border-radius:4px;">已绑定</span>';
                html += '</div>';
                
                // 显示世界观名称和描述
                var worldContent = '【' + worldData.name + '】';
                if (worldData.description) {
                    worldContent += '\n' + worldData.description;
                }
                
                // 显示地点信息
                if (ai.locationId && worldData.locations && worldData.locations[ai.locationId]) {
                    var loc = worldData.locations[ai.locationId];
                    worldContent += '\n\n【所在地点：' + loc.name + '】';
                    if (loc.description) {
                        worldContent += '\n' + loc.description;
                    }
                }
                
                html += '<div style="font-size:12px;color:#666;background:#f8f9fa;padding:8px 10px;border-radius:8px;max-height:150px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5;">' + self.escapeHtml(worldContent) + '</div>';
                html += '</div>';
            }
        } else {
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span style="font-size:13px;color:#999;">' + svgIcons.world + '世界观设定</span>';
            html += '<span style="font-size:11px;color:#999;background:#f5f5f5;padding:2px 6px;border-radius:4px;">未绑定</span>';
            html += '</div>';
            html += '</div>';
        }
        
        // 1. 时间数据
        if (dataSub.time !== false) {
            var timeData = PhoneCore.time && PhoneCore.time.getFormattedTime ? PhoneCore.time.getFormattedTime() : null;
            var timeStr = '未获取到';
            if (timeData && typeof timeData === 'object') {
                // getFormattedTime返回对象，需要格式化为字符串
                timeStr = timeData.year + '年' + timeData.month + '月' + timeData.day + '日 星期' + timeData.weekday + ' ' + 
                    String(timeData.hour).padStart(2, '0') + ':' + String(timeData.minute).padStart(2, '0');
            } else if (typeof timeData === 'string') {
                timeStr = timeData;
            } else {
                var now = new Date();
                var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                timeStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + weekdays[now.getDay()] + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            }
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
            html += '<span style="font-size:13px;color:#333;font-weight:500;">' + svgIcons.time + '当前时间</span>';
            html += '<span style="font-size:11px;color:#4CAF50;background:#E8F5E9;padding:2px 6px;border-radius:4px;">已启用</span>';
            html += '</div>';
            html += '<div style="font-size:12px;color:#666;background:#f8f9fa;padding:8px 10px;border-radius:8px;word-break:break-all;">' + self.escapeHtml(timeStr) + '</div>';
            html += '</div>';
        } else {
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span style="font-size:13px;color:#999;">' + svgIcons.time + '当前时间</span>';
            html += '<span style="font-size:11px;color:#999;background:#f5f5f5;padding:2px 6px;border-radius:4px;">未启用</span>';
            html += '</div>';
            html += '</div>';
        }
        
        // 2. 天气数据
        if (dataSub.weather !== false) {
            var weatherStr = '未获取到';
            if (ai.weatherCity && ai.weatherCity.realCity) {
                var weatherApp = PhoneCore.apps && PhoneCore.apps['weather-app'];
                if (weatherApp && weatherApp.weatherCache) {
                    var realCity = ai.weatherCity.realCity;
                    var displayCity = ai.weatherCity.mappedName || realCity;
                    if (weatherApp.weatherCache[realCity]) {
                        var w = weatherApp.weatherCache[realCity];
                        weatherStr = displayCity + '：' + w.description + '，' + w.temperature + '°C，湿度' + w.humidity + '%';
                    } else {
                        weatherStr = displayCity + '：天气数据加载中...';
                    }
                } else {
                    weatherStr = (ai.weatherCity.mappedName || ai.weatherCity.realCity) + '：天气App未初始化';
                }
            } else {
                weatherStr = '未设置AI所在城市';
            }
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
            html += '<span style="font-size:13px;color:#333;font-weight:500;">' + svgIcons.weather + '天气信息</span>';
            html += '<span style="font-size:11px;color:#4CAF50;background:#E8F5E9;padding:2px 6px;border-radius:4px;">已启用</span>';
            html += '</div>';
            html += '<div style="font-size:12px;color:#666;background:#f8f9fa;padding:8px 10px;border-radius:8px;word-break:break-all;">' + self.escapeHtml(weatherStr) + '</div>';
            html += '</div>';
        } else {
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span style="font-size:13px;color:#999;">' + svgIcons.weather + '天气信息</span>';
            html += '<span style="font-size:11px;color:#999;background:#f5f5f5;padding:2px 6px;border-radius:4px;">未启用</span>';
            html += '</div>';
            html += '</div>';
        }
        
        // 3. 用户身份/人设
        var userPersonaStr = '未设置';
        if (mask) {
            if (PhoneCore.user.getMaskPersonaForAI) {
                userPersonaStr = PhoneCore.user.getMaskPersonaForAI(mask.id) || '未配置人设';
            } else if (mask.name) {
                userPersonaStr = '用户名：' + mask.name;
                if (mask.occupation) userPersonaStr += '，职业：' + mask.occupation;
            }
        }
        if (dataSub.userProfile !== false) {
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
            html += '<span style="font-size:13px;color:#333;font-weight:500;">' + svgIcons.user + '用户身份</span>';
            html += '<span style="font-size:11px;color:#4CAF50;background:#E8F5E9;padding:2px 6px;border-radius:4px;">已启用</span>';
            html += '</div>';
            html += '<div style="font-size:12px;color:#666;background:#f8f9fa;padding:8px 10px;border-radius:8px;max-height:100px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;">' + self.escapeHtml(userPersonaStr) + '</div>';
            html += '</div>';
        } else {
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span style="font-size:13px;color:#999;">' + svgIcons.user + '用户身份</span>';
            html += '<span style="font-size:11px;color:#999;background:#f5f5f5;padding:2px 6px;border-radius:4px;">未启用</span>';
            html += '</div>';
            html += '</div>';
        }
        
        // 4. 用户城市
        var userCityStr = mask && mask.city ? mask.city : (PhoneCore.user.realInfo && PhoneCore.user.realInfo.city ? PhoneCore.user.realInfo.city : '未设置');
        if (dataSub.userCity !== false) {
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
            html += '<span style="font-size:13px;color:#333;font-weight:500;">' + svgIcons.location + '用户城市</span>';
            html += '<span style="font-size:11px;color:#4CAF50;background:#E8F5E9;padding:2px 6px;border-radius:4px;">已启用</span>';
            html += '</div>';
            html += '<div style="font-size:12px;color:#666;background:#f8f9fa;padding:8px 10px;border-radius:8px;">' + self.escapeHtml(userCityStr) + '</div>';
            html += '</div>';
        } else {
            html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span style="font-size:13px;color:#999;">' + svgIcons.location + '用户城市</span>';
            html += '<span style="font-size:11px;color:#999;background:#f5f5f5;padding:2px 6px;border-radius:4px;">未启用</span>';
            html += '</div>';
            html += '</div>';
        }
        
        // 5. AI所在城市
        var aiCityStr = ai.weatherCity ? (ai.weatherCity.mappedName || ai.weatherCity.realCity || '未设置') : '未设置';
        html += '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html += '<span style="font-size:13px;color:#333;font-weight:500;">' + svgIcons.home + 'AI所在城市</span>';
        html += '<span style="font-size:11px;color:#2196F3;background:#E3F2FD;padding:2px 6px;border-radius:4px;">配置项</span>';
        html += '</div>';
        html += '<div style="font-size:12px;color:#666;background:#f8f9fa;padding:8px 10px;border-radius:8px;">' + self.escapeHtml(aiCityStr) + '</div>';
        html += '</div>';
        
        // 6. 朋友圈上下文 - 调用chat.js的buildMomentsContext获取实际内容
        var momentsConfig = ai.momentsReadConfig || { self: 3, user: 3, social: 3 };
        var chatApp = PhoneCore.apps && PhoneCore.apps['chat-app'];
        var momentsContextStr = '';
        if (chatApp && chatApp.buildMomentsContext) {
            momentsContextStr = chatApp.buildMomentsContext(ai, mask) || '';
        }
        
        html += '<div style="padding:10px 0;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html += '<span style="font-size:13px;color:#333;font-weight:500;">' + svgIcons.moments + '朋友圈上下文</span>';
        html += '<span style="font-size:11px;color:#FF9800;background:#FFF3E0;padding:2px 6px;border-radius:4px;">动态加载</span>';
        html += '</div>';
        html += '<div style="font-size:11px;color:#888;margin-bottom:6px;">配置：自己 ' + (momentsConfig.self || 0) + ' 条 / 用户 ' + (momentsConfig.user || 0) + ' 条 / 交际圈 ' + (momentsConfig.social || 0) + ' 条</div>';
        if (momentsContextStr) {
            html += '<div style="font-size:12px;color:#666;background:#f8f9fa;padding:8px 10px;border-radius:8px;max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5;">' + self.escapeHtml(momentsContextStr) + '</div>';
        } else {
            html += '<div style="font-size:12px;color:#999;background:#f8f9fa;padding:8px 10px;border-radius:8px;text-align:center;">暂无朋友圈内容（聊天时动态加载）</div>';
        }
        html += '</div>';
        
        // 7. 微博上下文 - 调用chat.js的buildWeiboContext获取实际内容
        var weiboContextStr = '';
        if (chatApp && chatApp.buildWeiboContext) {
            weiboContextStr = chatApp.buildWeiboContext(ai.id) || '';
        }
        
        // 获取微博数据源配置
        var weiboDataSource = (PhoneCore.data && PhoneCore.data.weiboDataSource) || {};
        var allowReadUserPosts = weiboDataSource.allowAIReadUserPosts !== false;
        var syncAIPosts = weiboDataSource.syncAIPostsToContext !== false;
        
        html += '<div style="padding:10px 0;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
        html += '<span style="font-size:13px;color:#333;font-weight:500;">' + svgIcons.weibo + '微博上下文</span>';
        html += '<span style="font-size:11px;color:#6bb9f0;background:#E8F4FD;padding:2px 6px;border-radius:4px;">动态加载</span>';
        html += '</div>';
        html += '<div style="font-size:11px;color:#888;margin-bottom:6px;">配置：读取用户微博 ' + (allowReadUserPosts ? '是' : '否') + ' / 同步AI微博 ' + (syncAIPosts ? '是' : '否') + '</div>';
        if (weiboContextStr) {
            html += '<div style="font-size:12px;color:#666;background:#f8f9fa;padding:8px 10px;border-radius:8px;max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5;">' + self.escapeHtml(weiboContextStr) + '</div>';
        } else {
            html += '<div style="font-size:12px;color:#999;background:#f8f9fa;padding:8px 10px;border-radius:8px;text-align:center;">暂无微博内容（聊天时动态加载）</div>';
        }
        html += '</div>';
        
        html += '</div>';
        
        // 导出按钮
        html += '<button id="export-context-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#4CAF50,#45a049);color:white;border:none;border-radius:12px;font-size:15px;cursor:pointer;margin-bottom:10px;">导出完整上下文</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 刷新按钮事件
        var refreshBtn = page.querySelector('#refresh-context-btn');
        if (refreshBtn) {
            refreshBtn.onclick = function() {
                // 关闭当前页面并重新打开
                page.querySelector('.app-back-btn').click();
                setTimeout(function() {
                    self.openContextViewer(aiId);
                }, 350);
            };
        }
        
        // 导出按钮事件
        var exportBtn = page.querySelector('#export-context-btn');
        if (exportBtn) {
            exportBtn.onclick = function() {
                // 重新获取最新数据
                var latestAi = PhoneCore.getAI(aiId);
                var latestPrompt = self.buildSystemPromptPreview(latestAi);
                var latestHistory = (latestAi.chatHistory || []).filter(function(msg) {
                    return !(msg.isCallMessage || msg.type === 'call_chat' || msg.type === 'island_call_chat' || 
                        msg.type === 'call_system' || msg.fromIsland || msg.isIslandReply);
                }).slice(-(latestAi.contextLength || 20));
                
                var exportData = {
                    ai_name: latestAi.name,
                    model: latestAi.model || '默认',
                    context_length: latestAi.contextLength || 20,
                    system_prompt: latestPrompt,
                    messages: latestHistory,
                    exported_at: new Date().toISOString()
                };
                
                var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = latestAi.name + '_context_' + new Date().toISOString().slice(0,10) + '.json';
                a.click();
                URL.revokeObjectURL(url);
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '导出成功',
                    message: '上下文已保存为JSON文件',
                    size: 'mini'
                });
            };
        }
    };
    
    // 构建系统提示词预览 - 完整版，与实际发送给AI的内容一致
    SystemConfigApp.prototype.buildSystemPromptPreview = function(ai) {
        var self = this;
        var prompt = '';
        
        // 1. 获取基础提示词（调用ai.getPrompt）
        try {
            var mask = PhoneCore.user.getCurrentMask ? PhoneCore.user.getCurrentMask() : null;
            var dataSub = ai.dataSubscription || {};
            var context = {
                weather: dataSub.weather !== false ? (ai.weatherCity ? '已启用' : '未设置城市') : '',
                time: dataSub.time !== false ? PhoneCore.time.getFormattedTime() : '',
                app: 'chat',
                userPersona: mask ? mask.getPersonaPrompt() : '',
                userCity: mask && mask.city ? mask.city : '',
                aiCity: ai.weatherCity ? (ai.weatherCity.mappedName || ai.weatherCity.realCity) : ''
            };
            
            if (ai.getPrompt) {
                prompt = ai.getPrompt(context);
            }
        } catch (e) {
            console.error('获取prompt失败:', e);
        }
        
        if (!prompt) {
            prompt = '你是' + (ai.name || 'AI助手') + '，请友好地回复用户。';
        }
        
        // 2. 添加当前时间信息
        var now = new Date();
        var currentHour = now.getHours();
        var currentMinute = now.getMinutes();
        var currentTimeStr = currentHour.toString().padStart(2, '0') + ':' + currentMinute.toString().padStart(2, '0');
        var weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
        var timePeriod = currentHour < 6 ? '凌晨' : currentHour < 9 ? '早上' : currentHour < 12 ? '上午' : currentHour < 14 ? '中午' : currentHour < 17 ? '下午' : currentHour < 19 ? '傍晚' : currentHour < 22 ? '晚上' : '深夜';
        
        prompt += '\n\n【当前时间】' + now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + weekday + ' ' + currentTimeStr + '（' + timePeriod + '）';
        prompt += '\n你的回复应该符合这个时间点的真实生活状态。';
        
        // 3. 添加可用的特殊动作说明
        prompt += '\n\n【可用的特殊动作】你可以在回复中使用以下特殊格式来执行动作：';
        prompt += '\n- 发红包：[发红包:金额:祝福语] 例如：[发红包:6.66:新年快乐]';
        prompt += '\n- 转账：[转账:金额] 例如：[转账:100]';
        prompt += '\n- 分享位置：[分享位置:地点名称:详细地址] 例如：[分享位置:星巴克咖啡:北京市朝阳区xxx路123号]';
        prompt += '\n- 分享歌曲：[分享歌曲:歌名:歌手] 例如：[分享歌曲:晴天:周杰伦]';
        prompt += '\n- 发起视频通话：[发起视频通话]';
        prompt += '\n- 拍一拍用户：[拍一拍用户]';
        prompt += '\n- 一起听音乐：[一起听:歌曲名] 例如：[一起听:夜曲]';
        prompt += '\n- 领取红包：[领取红包] - 当用户发红包给你时，使用此格式表示你要领取';
        prompt += '\n- 接收转账：[接收转账] - 当用户转账给你时，使用此格式表示你要接收';
        prompt += '\n- 代付购物：[代付:金额] - 当用户分享购物商品/购物车请求你代付时，使用此格式表示你愿意代付';
        prompt += '\n- 拒绝代付：[拒绝代付] - 当用户请求你代付但你不想代付时使用，可以配合理由一起说';
        prompt += '\n- 请求用户代付：[请求代付:金额:商品名] 例如：[请求代付:99.00:可爱小裙子] - 你想买东西但余额不足时，可以请求用户帮你代付';
        prompt += '\n- 发朋友圈：[发朋友圈:内容] 例如：[发朋友圈:今天天气真好，出去散步啦~] - 发布一条朋友圈动态，会出现在朋友圈列表中';
        prompt += '\n- 评论朋友圈：[评论朋友圈:发布者名字:评论内容] 例如：[评论朋友圈:小红:风景真美！] - 在指定好友的最新朋友圈下发评论';
        prompt += '\n- 回复朋友圈评论：[回复朋友圈评论:发布者名字:被回复人名字:回复内容] 例如：[回复朋友圈评论:小红:小明:我也这么觉得~] - 在朋友圈评论区回复某人的评论';
        prompt += '\n- 转发聊天记录：[转发聊天记录:发送者1:内容1|发送者2:内容2|...] 例如：[转发聊天记录:小明:你好啊|小红:你好呀|小明:最近怎么样] - 发送一条聊天记录卡片';
        prompt += '\n这些特殊格式会被解析并渲染为对应的卡片/动作，你可以在适当时机主动使用它们，也可以在用户请求时使用。特殊格式可以和普通文字混合使用。';
        prompt += '\n【注意】不要太频繁使用特殊动作，尤其是分享歌曲、一起听音乐、发红包等，只在真正需要时才使用，大部分时候正常文字聊天即可。';
        
        // 4. 分句输出要求
        prompt += '\n\n【回复格式】像真人发消息一样自然，根据你的性格特点决定发消息的风格：';
        prompt += '\n- 用 | 分隔多条消息，例如：好的我知道了|那我们下午见？|记得带伞哦';
        prompt += '\n- 可以发很短的消息（如"嗯"、"哈哈"、"？"），也可以发长一点的，取决于你的性格';
        prompt += '\n- 条数不限，想发几条发几条，符合人设就好';
        
        // 5. 朋友圈上下文 - 调用chat.js的buildMomentsContext获取实际内容
        var chatApp = PhoneCore.apps && PhoneCore.apps['chat-app'];
        var mask = PhoneCore.user.getCurrentMask ? PhoneCore.user.getCurrentMask() : null;
        if (chatApp && chatApp.buildMomentsContext) {
            var momentsContext = chatApp.buildMomentsContext(ai, mask);
            if (momentsContext) {
                prompt += '\n\n' + momentsContext;
            }
        }
        
        // 6. 一起听上下文 - 调用chat.js的buildListenTogetherContext获取实际内容
        if (chatApp && chatApp.buildListenTogetherContext) {
            var listenTogetherContext = chatApp.buildListenTogetherContext(ai.id);
            if (listenTogetherContext) {
                prompt += '\n\n' + listenTogetherContext;
            }
        }
        
        // 6.5 微博上下文 - 调用chat.js的buildWeiboContext获取实际内容
        if (chatApp && chatApp.buildWeiboContext) {
            var weiboContext = chatApp.buildWeiboContext(ai.id);
            if (weiboContext) {
                prompt += '\n\n' + weiboContext;
            }
        }
        
        // 7. 群聊记忆互通
        var memorySync = PhoneCore.user.groupMemorySync || { enabled: false, aiIds: [] };
        var syncAiIds = memorySync.aiIds || (memorySync.aiId ? [memorySync.aiId] : []);
        if (memorySync.enabled && syncAiIds.indexOf(ai.id) !== -1) {
            if (chatApp && chatApp.buildGroupChatMemoryContext) {
                var groupChatContext = chatApp.buildGroupChatMemoryContext(ai.id);
                if (groupChatContext) {
                    prompt += '\n\n' + groupChatContext;
                }
            }
        }
        
        // 7.5 记忆总结上下文
        if (ai.memorySummaries) {
            var memoryContext = [];
            
            // 聊天记忆总结
            if (ai.memorySummaries.chat && ai.memorySummaries.chat.enabled && ai.memorySummaries.chat.summary) {
                memoryContext.push('【聊天记忆总结】\n' + ai.memorySummaries.chat.summary);
            }
            
            // 微博记忆总结
            if (ai.memorySummaries.weibo && ai.memorySummaries.weibo.enabled) {
                var weiboMem = [];
                if (ai.memorySummaries.weibo.userSummary) {
                    weiboMem.push('用户微博特点：' + ai.memorySummaries.weibo.userSummary);
                }
                if (ai.memorySummaries.weibo.aiSummary) {
                    weiboMem.push('你的微博特点：' + ai.memorySummaries.weibo.aiSummary);
                }
                if (weiboMem.length > 0) {
                    memoryContext.push('【微博记忆总结】\n' + weiboMem.join('\n'));
                }
            }
            
            // 购物小剧场记忆总结
            if (ai.memorySummaries.shop && ai.memorySummaries.shop.enabled && ai.memorySummaries.shop.summary) {
                memoryContext.push('【小剧场记忆总结】\n' + ai.memorySummaries.shop.summary);
            }
            
            // 手动添加的记忆
            if (ai.memorySummaries.manualMemory) {
                var manualParts = [];
                // 已总结的内容
                if (ai.memorySummaries.manualMemory.summary) {
                    manualParts.push(ai.memorySummaries.manualMemory.summary);
                }
                // 待总结的内容也要包含
                if (ai.memorySummaries.manualMemory.items && ai.memorySummaries.manualMemory.items.length > 0) {
                    var pendingMems = ai.memorySummaries.manualMemory.items.map(function(m) { return '- ' + m.content; }).join('\n');
                    manualParts.push('最新补充：\n' + pendingMems);
                }
                if (manualParts.length > 0) {
                    memoryContext.push('【重要记忆】\n' + manualParts.join('\n\n'));
                }
            }
            // 兼容旧数据
            else if (ai.memorySummaries.manual && ai.memorySummaries.manual.length > 0) {
                var manualMems = ai.memorySummaries.manual.map(function(m) { return '- ' + m.content; }).join('\n');
                memoryContext.push('【重要记忆】\n' + manualMems);
            }
            
            if (memoryContext.length > 0) {
                prompt += '\n\n【背景记忆】以下是你需要记住的重要背景信息：\n' + memoryContext.join('\n\n');
            }
        }
        
        // 8. 关键词触发规则
        if (ai.replyEnhanceEnabled && ai.keywordPrompts && ai.keywordPrompts.length > 0) {
            prompt += '\n\n【关键词触发规则】当前已配置以下关键词规则（你可以根据情况主动使用或避免）：';
            ai.keywordPrompts.forEach(function(kp, index) {
                if (kp.keywords && kp.keywords.length > 0 && kp.prompt) {
                    prompt += '\n' + (index + 1) + '. 关键词[' + kp.keywords.join(', ') + ']：' + kp.prompt.substring(0, 80) + (kp.prompt.length > 80 ? '...' : '');
                }
            });
            prompt += '\n提示：这些关键词会在你回复后被系统检测，触发对应的提示词进行二次审核。你可以根据对话情境判断是否需要触发或避免某些关键词。';
        }
        
        // 9. 当前通话状态
        if (chatApp && chatApp.island && chatApp.island.state && chatApp.island.state.inCall) {
            var currentCallType = chatApp.island.state.callType === 'video' ? '视频通话' : '语音通话';
            prompt += '\n\n【重要：当前通话状态】你目前正在与用户进行' + currentCallType + '中！';
            prompt += '\n- 禁止使用[发起视频通话]、[发起语音通话]、[打电话]、[打视频]等通话指令';
            prompt += '\n- 不要在回复中提出要打电话或视频的请求，因为你们已经在通话了';
            prompt += '\n- 专注于当前通话内容即可';
        }
        
        return prompt.trim();
    };
    
    // HTML转义
    SystemConfigApp.prototype.escapeHtml = function(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // 【添加关系对话框】
    SystemConfigApp.prototype.openAddRelationshipDialog = function(aiId, parentPage) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var ai = PhoneCore.getAI(aiId);
        if (!ai) return;
        
        // 获取所有AI（排除自己和已有关系的）
        var allAIs = Object.values(PhoneCore.ais).filter(function(otherAi) {
            return otherAi.id !== aiId && (!ai.relationships || !ai.relationships[otherAi.id]);
        });
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">添加关系</div>';
        
        if (allAIs.length === 0) {
            html += '<div style="text-align:center;padding:40px;color:#999;">没有可添加的AI</div>';
        } else {
            // 选择AI
            html += '<div style="margin-bottom:20px;">';
            html += '<label class="' + S.label + '">选择AI</label>';
            html += '<select id="select-rel-ai" class="' + S.select + '">';
            allAIs.forEach(function(otherAi) {
                html += '<option value="' + otherAi.id + '">' + otherAi.name + ' (' + (otherAi.type === 'main' ? '主角色' : otherAi.type === 'supporting' ? '配角' : 'NPC') + ')</option>';
            });
            html += '</select>';
            html += '</div>';
            
            // 关系类型
            html += '<div style="margin-bottom:20px;">';
            html += '<label class="' + S.label + '">关系类型</label>';
            html += '<select id="select-rel-type" class="' + S.select + '">';
            html += '<option value="friend">朋友</option>';
            html += '<option value="lover">恋人</option>';
            html += '<option value="family">家人</option>';
            html += '<option value="colleague">同事</option>';
            html += '<option value="stranger">陌生人</option>';
            html += '</select>';
            html += '</div>';
            
            // 初始亲密度
            html += '<div style="margin-bottom:20px;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
            html += '<label style="font-size:14px;color:#666;">初始亲密度</label>';
            html += '<span id="init-level-value" style="font-size:14px;color:#FF6B8A;font-weight:500;">50</span>';
            html += '</div>';
            html += '<input type="range" id="init-level-slider" min="0" max="100" value="50" style="width:100%;accent-color:#FF8FAB;">';
            html += '</div>';
            
            // 关系描述
            html += '<div style="margin-bottom:20px;">';
            html += '<label class="' + S.label + '">关系描述（可选）</label>';
            html += '<input type="text" id="rel-description-input" placeholder="描述两人的关系..." class="' + S.input + '">';
            html += '</div>';
            
            html += '<button id="confirm-add-rel-btn" style="width:100%;padding:14px;background:#007AFF;color:white;border:none;border-radius:10px;font-size:16px;cursor:pointer;">确认添加</button>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 亲密度滑块
        var initSlider = page.querySelector('#init-level-slider');
        var initValue = page.querySelector('#init-level-value');
        if (initSlider && initValue) {
            initSlider.oninput = function() {
                initValue.textContent = initSlider.value;
            };
        }
        
        // 确认添加
        var confirmBtn = page.querySelector('#confirm-add-rel-btn');
        if (confirmBtn) {
            confirmBtn.onclick = function() {
                var selectAi = page.querySelector('#select-rel-ai');
                var selectType = page.querySelector('#select-rel-type');
                var descInput = page.querySelector('#rel-description-input');
                
                if (!selectAi || !selectAi.value) return;
                
                var relAiId = selectAi.value;
                var relType = selectType ? selectType.value : 'friend';
                var level = initSlider ? parseInt(initSlider.value) : 50;
                var description = descInput ? descInput.value.trim() : '';
                
                if (!ai.relationships) ai.relationships = {};
                ai.relationships[relAiId] = {
                    type: relType,
                    level: level,
                    description: description,
                    createdAt: Date.now()
                };
                
                PhoneCore.saveAI(ai).then(function() {
                    PhoneCore.notifications.send({
                        type: 'success',
                        title: '关系已添加',
                        size: 'mini'
                    });
                    // 返回并刷新关系管理页面
                    page.querySelector('.app-back-btn').click();
                    setTimeout(function() {
                        parentPage.querySelector('.app-back-btn').click();
                        setTimeout(function() {
                            self.openRelationshipsManager(aiId);
                        }, 350);
                    }, 350);
                });
            };
        }
    };

    // 提示词库
    /* 【三层提示词库系统】
       Category（分类）→ Collection（合集）→ Template（模板）
       - 角色AI提示词
       - 功能性AI提示词（NPC生成、天气生成等）
       - App专用提示词 */
    SystemConfigApp.prototype.openPromptLibrary = function() {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var manager = PhoneCore.promptLibrary;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">提示词库</div>';
        html += '<button id="add-prompt-category-btn" class="' + S.primaryButton + ' sys-btn-flex-6 sys-btn-add">' + I.plus + ' 新建分类</button>';
        html += '</div>';
        
        html += '<div style="font-size:13px;color:#666;margin-bottom:24px;line-height:1.6;">';
        html += '三层结构：<br>';
        html += '• <strong>分类</strong>：角色AI / 功能性AI / App专用<br>';
        html += '• <strong>合集</strong>：一组相关提示词，可被AI引用<br>';
        html += '• <strong>模板</strong>：具体的提示词，支持变量';
        html += '</div>';
        
        // 分类列表
        var categories = Object.values(manager.categories);
        
        // 按类型分组显示
        var typeGroups = {
            role: { name: '角色AI提示词', icon: I.star, color: '#FFD700', items: [] },
            functional: { name: '功能性AI提示词', icon: I.gear, color: '#4ECDC4', items: [] },
            app: { name: 'App专用提示词', icon: I.folder, color: '#FF6B8A', items: [] }
        };
        
        categories.forEach(function(cat) {
            var type = cat.type || 'role';
            if (typeGroups[type]) {
                typeGroups[type].items.push(cat);
            }
        });
        
        Object.keys(typeGroups).forEach(function(type) {
            var group = typeGroups[type];
            
            html += '<div style="margin-bottom:24px;">';
            html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">';
            html += '<span style="color:' + group.color + ';">' + group.icon + '</span>';
            html += '<span style="font-size:17px;font-weight:600;color:#333;">' + group.name + '</span>';
            html += '</div>';
            
            if (group.items.length === 0) {
                html += '<div class="' + S.glassCard + ' sys-card-empty" style="font-size:14px;">暂无此类提示词</div>';
            } else {
                group.items.forEach(function(cat) {
                    // 统计合集和模板数
                    var collCount = cat.collectionIds.length;
                    var tplCount = 0;
                    cat.collectionIds.forEach(function(collId) {
                        var coll = manager.collections[collId];
                        if (coll) tplCount += coll.templateIds.length;
                    });
                    
                    html += '<div class="prompt-category-card ' + S.glassCard + ' sys-card-clickable" data-category-id="' + cat.id + '" style="margin-bottom:12px;">';
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                    html += '<div>';
                    html += '<div style="font-weight:600;font-size:15px;color:#333;">' + cat.name + '</div>';
                    if (cat.description) {
                        html += '<div style="font-size:12px;color:#888;margin-top:4px;">' + cat.description + '</div>';
                    }
                    html += '</div>';
                    html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
                    html += '</div>';
                    html += '<div style="display:flex;gap:10px;margin-top:12px;font-size:12px;color:#666;">';
                    html += '<span style="background:rgba(102,187,106,0.15);padding:4px 10px;border-radius:12px;">' + collCount + ' 个合集</span>';
                    html += '<span style="background:rgba(255,182,193,0.15);padding:4px 10px;border-radius:12px;">' + tplCount + ' 个模板</span>';
                    html += '</div>';
                    html += '</div>';
                });
            }
            
            html += '</div>';
        });
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 新建分类
        var addBtn = page.querySelector('#add-prompt-category-btn');
        if (addBtn) {
            addBtn.onclick = function() {
                self.openPromptCategoryEditorV2(null);
            };
        }
        
        // 点击分类
        page.querySelectorAll('.prompt-category-card').forEach(function(card) {
            card.onclick = function() {
                var categoryId = card.getAttribute('data-category-id');
                self.openPromptCategoryDetail(categoryId);
            };
        });
    };
    
    /* 【提示词分类编辑器V2】 */
    SystemConfigApp.prototype.openPromptCategoryEditorV2 = function(categoryId) {
        var self = this;
        var S = this.STYLES;
        var manager = PhoneCore.promptLibrary;
        var cat = categoryId ? manager.categories[categoryId] : null;
        var isNew = !cat;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">' + (isNew ? '新建提示词分类' : '编辑分类') + '</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">分类名称</label>';
        html += '<input type="text" id="cat-name" value="' + (cat ? cat.name : '') + '" placeholder="如：日常聊天、浪漫情节..." class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">分类类型</label>';
        html += '<select id="cat-type" class="' + S.input + '">';
        html += '<option value="role"' + (cat && cat.type === 'role' ? ' selected' : '') + '>角色AI提示词</option>';
        html += '<option value="functional"' + (cat && cat.type === 'functional' ? ' selected' : '') + '>功能性AI提示词</option>';
        html += '<option value="app"' + (cat && cat.type === 'app' ? ' selected' : '') + '>App专用提示词</option>';
        html += '</select>';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">描述</label>';
        html += '<textarea id="cat-description" placeholder="描述这个分类的用途..." class="' + S.input + ' sys-input-textarea-md">' + (cat ? cat.description : '') + '</textarea>';
        html += '</div>';
        
        html += '</div>';
        
        html += '<button id="save-cat-btn" class="' + S.primaryButton + ' sys-btn-full">保存</button>';
        
        if (!isNew) {
            html += '<button id="delete-cat-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:14px;font-size:15px;font-weight:500;cursor:pointer;margin-top:12px;">删除分类</button>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 保存
        var saveBtn = page.querySelector('#save-cat-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var name = page.querySelector('#cat-name').value.trim();
                var type = page.querySelector('#cat-type').value;
                var description = page.querySelector('#cat-description').value.trim();
                
                if (!name) {
                    PhoneCore.notifications.send({ type: 'error', title: '请输入名称', icon: '❌', size: 'mini' });
                    return;
                }
                
                if (isNew) {
                    manager.createCategory({ name: name, type: type, description: description }).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openPromptLibrary();
                    });
                } else {
                    cat.name = name;
                    cat.type = type;
                    cat.description = description;
                    cat.updatedAt = Date.now();
                    PhoneCore.db.put('prompt_categories', cat.toJSON()).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openPromptLibrary();
                    });
                }
            };
        }
        
        // 删除
        var deleteBtn = page.querySelector('#delete-cat-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此分类？所有包含的合集和模板都将被删除。')) {
                    manager.deleteCategory(categoryId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.openPromptLibrary();
                    });
                }
            };
        }
    };
    
    /* 【提示词分类详情】 */
    SystemConfigApp.prototype.openPromptCategoryDetail = function(categoryId) {
        const self = this;
        const S = this.STYLES;
        const I = this.SVG;
        const manager = PhoneCore.promptLibrary;
        const cat = manager.categories[categoryId];
        if (!cat) return;
        
        const typeLabels = { role: '角色AI', functional: '功能性AI', app: 'App专用' };
        let html = `
        <div class="${S.pageWrap}">
            <div class="sys-detail-header">
                <div class="sys-detail-title">${cat.name}</div>
                <div class="sys-detail-type-badge">${typeLabels[cat.type]}</div>
                ${cat.description ? `<div class="sys-detail-desc">${cat.description}</div>` : ''}
            </div>
            <div class="sys-detail-btns-row">
                <button id="edit-cat-btn" class="${S.secondaryButton} sys-detail-btn-flex">编辑信息</button>
                <button id="add-coll-btn" class="${S.primaryButton} sys-btn-add-pack sys-detail-btn-flex">${I.plus} 添加合集</button>
            </div>
            <div class="sys-section-title">提示词合集 (${cat.collectionIds.length})</div>
        `;
        
        if (cat.collectionIds.length === 0) {
            html += `<div class="${S.glassCard} sys-card-empty">暂无合集，点击添加</div>`;
        } else {
            cat.collectionIds.forEach(function(collId) {
                const coll = manager.collections[collId];
                if (!coll) return;
                html += `
            <div class="prompt-coll-card ${S.glassCard} sys-card-clickable sys-card-mb" data-coll-id="${collId}">
                <div class="sys-card-row">
                    <div class="sys-card-title">${coll.name}</div>
                    <span class="sys-card-arrow">${I.arrow_right}</span>
                </div>
                ${coll.description ? `<div class="sys-card-desc">${coll.description}</div>` : ''}
                <div class="sys-card-meta">${coll.templateIds.length} 个模板</div>
            </div>
                `;
            });
        }
        
        html += `
        </div>
        `;
        
        const page = this.openDetailPage(html);
        
        // 编辑分类
        const editBtn = page.querySelector('#edit-cat-btn');
        if (editBtn) {
            editBtn.onclick = function() {
                self.openPromptCategoryEditorV2(categoryId);
            };
        }
        
        // 添加合集
        const addCollBtn = page.querySelector('#add-coll-btn');
        if (addCollBtn) {
            addCollBtn.onclick = function() {
                self.openPromptCollectionEditor(categoryId, null);
            };
        }
        
        // 点击合集
        page.querySelectorAll('.prompt-coll-card').forEach(function(card) {
            card.onclick = function() {
                var collId = card.getAttribute('data-coll-id');
                self.openPromptCollectionDetail(categoryId, collId);
            };
        });
    };
    
    /* 【提示词合集编辑器】 */
    SystemConfigApp.prototype.openPromptCollectionEditor = function(categoryId, collectionId) {
        const self = this;
        const S = this.STYLES;
        const manager = PhoneCore.promptLibrary;
        const coll = collectionId ? manager.collections[collectionId] : null;
        const isNew = !coll;
        
        let html = `
        <div class="${S.pageWrap}">
            <div class="sys-form-section-title">${isNew ? '新建提示词合集' : '编辑合集'}</div>
            <div class="config-card ${S.glassCard}">
                <div class="sys-form-field-mb">
                    <label class="${S.label}">合集名称</label>
                    <input type="text" id="coll-name" value="${coll ? coll.name : ''}" placeholder="如：基础人设、情绪表达..." class="${S.input}">
                </div>
                <div class="sys-form-field-mb">
                    <label class="${S.label}">描述</label>
                    <textarea id="coll-description" placeholder="描述这个合集的用途..." class="${S.input} sys-input-textarea-sm">${coll ? coll.description : ''}</textarea>
                </div>
            </div>
            <button id="save-coll-btn" class="${S.primaryButton} sys-btn-full">保存</button>
            ${!isNew ? `<button id="delete-coll-btn" class="sys-delete-btn">删除合集</button>` : ''}
        </div>
        `;
        
        const page = this.openDetailPage(html);
        
        // 保存
        const saveBtn = page.querySelector('#save-coll-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var name = page.querySelector('#coll-name').value.trim();
                var description = page.querySelector('#coll-description').value.trim();
                
                if (!name) {
                    PhoneCore.notifications.send({ type: 'error', title: '请输入名称', icon: '❌', size: 'mini' });
                    return;
                }
                
                if (isNew) {
                    manager.createCollection({ categoryId: categoryId, name: name, description: description }).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openPromptCategoryDetail(categoryId);
                    });
                } else {
                    coll.name = name;
                    coll.description = description;
                    coll.updatedAt = Date.now();
                    PhoneCore.db.put('prompt_collections', coll.toJSON()).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openPromptCategoryDetail(categoryId);
                    });
                }
            };
        }
        
        // 删除
        const deleteBtn = page.querySelector('#delete-coll-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此合集？所有包含的模板都将被删除。')) {
                    manager.deleteCollection(collectionId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.openPromptCategoryDetail(categoryId);
                    });
                }
            };
        }
    };
    
    /* 【提示词合集详情】 */
    SystemConfigApp.prototype.openPromptCollectionDetail = function(categoryId, collectionId) {
        const self = this;
        const S = this.STYLES;
        const I = this.SVG;
        const manager = PhoneCore.promptLibrary;
        const coll = manager.collections[collectionId];
        if (!coll) return;
        
        let html = `
        <div class="${S.pageWrap}">
            <div class="sys-detail-header">
                <div class="sys-detail-title">${coll.name}</div>
                ${coll.description ? `<div class="sys-detail-desc">${coll.description}</div>` : ''}
            </div>
            <div class="sys-detail-btns-row">
                <button id="edit-coll-btn" class="${S.secondaryButton} sys-detail-btn-flex">编辑信息</button>
                <button id="add-tpl-btn" class="${S.primaryButton} sys-btn-add-pack sys-detail-btn-flex">${I.plus} 添加模板</button>
            </div>
            <div class="sys-section-title">提示词模板 (${coll.templateIds.length})</div>
        `;
        
        if (coll.templateIds.length === 0) {
            html += `<div class="${S.glassCard} sys-card-empty">暂无模板，点击添加</div>`;
        } else {
            coll.templateIds.forEach(function(tplId) {
                const tpl = manager.templates[tplId];
                if (!tpl) return;
                const preview = tpl.content.substring(0, 60) + (tpl.content.length > 60 ? '...' : '');
                const varsHtml = tpl.variables && tpl.variables.length > 0
                    ? `<div class="sys-tpl-vars-row">${tpl.variables.map(function(v) { return `<span class="sys-tpl-var-tag">{{${v.name}}}</span>`; }).join('')}</div>`
                    : '';
                html += `
            <div class="prompt-tpl-card ${S.glassCard} sys-card-clickable sys-card-mb" data-tpl-id="${tplId}">
                <div class="sys-card-row">
                    <div class="sys-card-title">${tpl.title}</div>
                    <span class="sys-card-arrow">${I.arrow_right}</span>
                </div>
                <div class="sys-tpl-preview">${preview}</div>
                ${varsHtml}
            </div>
                `;
            });
        }
        
        html += `
        </div>
        `;
        
        const page = this.openDetailPage(html);
        
        // 编辑合集
        const editBtn = page.querySelector('#edit-coll-btn');
        if (editBtn) {
            editBtn.onclick = function() {
                self.openPromptCollectionEditor(categoryId, collectionId);
            };
        }
        
        // 添加模板
        const addTplBtn = page.querySelector('#add-tpl-btn');
        if (addTplBtn) {
            addTplBtn.onclick = function() {
                self.openPromptTemplateEditor(categoryId, collectionId, null);
            };
        }
        
        // 点击模板
        page.querySelectorAll('.prompt-tpl-card').forEach(function(card) {
            card.onclick = function() {
                const tplId = card.getAttribute('data-tpl-id');
                self.openPromptTemplateEditor(categoryId, collectionId, tplId);
            };
        });
    };
    
    /* 【提示词模板编辑器】 */
    SystemConfigApp.prototype.openPromptTemplateEditor = function(categoryId, collectionId, templateId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var manager = PhoneCore.promptLibrary;
        var tpl = templateId ? manager.templates[templateId] : null;
        var isNew = !tpl;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">' + (isNew ? '新建提示词模板' : '编辑模板') + '</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">标题</label>';
        html += '<input type="text" id="tpl-title" value="' + (tpl ? tpl.title : '') + '" placeholder="如：基础人设、回复风格..." class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">提示词内容 <span style="color:#999;font-weight:400;">(支持{{变量名}})</span></label>';
        html += '<textarea id="tpl-content" placeholder="输入提示词内容...&#10;&#10;可用变量：{{AI_NAME}}、{{AI_PERSONALITY}}、{{TIME}}、{{WEATHER}}..." class="' + S.input + ' sys-input-textarea-tpl">' + (tpl ? tpl.content : '') + '</textarea>';
        html += '</div>';
        
        // App绑定（仅App专用类型显示）
        var cat = manager.categories[categoryId];
        if (cat && cat.type === 'app') {
            html += '<div style="margin-bottom:18px;">';
            html += '<label class="' + S.label + '">绑定App</label>';
            html += '<select id="tpl-app" class="' + S.input + '">';
            html += '<option value="">不绑定</option>';
            Object.keys(PhoneCore.apps).forEach(function(appId) {
                var app = PhoneCore.apps[appId];
                var selected = tpl && tpl.appId === appId ? ' selected' : '';
                html += '<option value="' + appId + '"' + selected + '>' + app.name + '</option>';
            });
            html += '</select>';
            html += '</div>';
        }
        
        html += '</div>';
        
        // 变量说明
        html += '<div class="config-card ' + S.glassCard + '" style="margin-top:16px;">';
        html += '<div style="font-weight:600;font-size:14px;color:#333;margin-bottom:12px;">可用变量</div>';
        html += '<div style="font-size:12px;color:#666;line-height:1.8;">';
        html += '{{AI_NAME}} - AI名字<br>';
        html += '{{AI_PERSONALITY}} - AI性格<br>';
        html += '{{AI_JOB}} - AI职业<br>';
        html += '{{TIME}} - 当前时间<br>';
        html += '{{WEATHER}} - 天气信息<br>';
        html += '{{APP_ID}} - 当前App';
        html += '</div>';
        html += '</div>';
        
        html += '<button id="save-tpl-btn" class="' + S.primaryButton + ' sys-btn-save-mt">保存</button>';
        
        if (!isNew) {
            html += '<button id="delete-tpl-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:14px;font-size:15px;font-weight:500;cursor:pointer;margin-top:12px;">删除模板</button>';
        }
        
        html += '</div>';
        
        var page = self.openDetailPage(html);
        
        // 保存
        var saveBtn = page.querySelector('#save-tpl-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var title = page.querySelector('#tpl-title').value.trim();
                var content = page.querySelector('#tpl-content').value.trim();
                var appSelect = page.querySelector('#tpl-app');
                var appId = appSelect ? appSelect.value : null;
                
                if (!title) {
                    PhoneCore.notifications.send({ type: 'error', title: '请输入标题', icon: '❌', size: 'mini' });
                    return;
                }
                
                if (!content) {
                    PhoneCore.notifications.send({ type: 'error', title: '请输入内容', icon: '❌', size: 'mini' });
                    return;
                }
                
                // 解析变量
                var variables = [];
                var varMatch = content.match(/\{\{(\w+)\}\}/g);
                if (varMatch) {
                    varMatch.forEach(function(match) {
                        var name = match.replace(/\{\{|\}\}/g, '');
                        if (!variables.find(function(v) { return v.name === name; })) {
                            variables.push({ name: name, description: '', defaultValue: '' });
                        }
                    });
                }
                
                if (isNew) {
                    manager.createTemplate({ 
                        collectionId: collectionId, 
                        title: title, 
                        content: content,
                        variables: variables,
                        appId: appId || null
                    }).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openPromptCollectionDetail(categoryId, collectionId);
                    });
                } else {
                    tpl.title = title;
                    tpl.content = content;
                    tpl.variables = variables;
                    tpl.appId = appId || null;
                    tpl.updatedAt = Date.now();
                    PhoneCore.db.put('prompt_templates', tpl.toJSON()).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                        self.openPromptCollectionDetail(categoryId, collectionId);
                    });
                }
            };
        }
        
        // 删除
        var deleteBtn = page.querySelector('#delete-tpl-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此模板？')) {
                    manager.deleteTemplate(templateId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.openPromptCollectionDetail(categoryId, collectionId);
                    });
                }
            };
        }
    };
    
    // ============ 旧版提示词系统兼容 ============
    SystemConfigApp.prototype.openPromptLibraryLegacy = function() {
        var self = this;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
        html += '<div style="font-size:20px;font-weight:600;">提示词库 (旧版)</div>';
        html += '<button id="add-prompt-category-btn" style="background:#007AFF;color:white;border:none;padding:8px 16px;border-radius:10px;font-size:14px;cursor:pointer;">+ 新建分类</button>';
        html += '</div>';
        
        html += '<div id="prompt-categories-container">加载中...</div>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 加载提示词
        PhoneCore.db.getAll('prompts').then(function(prompts) {
            var container = page.querySelector('#prompt-categories-container');
            
            // 按分类分组
            var categories = {};
            prompts.forEach(function(p) {
                var cat = p.category || '未分类';
                if (!categories[cat]) {
                    categories[cat] = [];
                }
                categories[cat].push(p);
            });
            
            var catNames = Object.keys(categories);
            
            if (catNames.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:50px;color:#999;"><div style="font-size:14px;margin-bottom:15px;">暂无提示词</div><div>点击新建分类开始</div></div>';
            } else {
                var html = '';
                catNames.forEach(function(catName) {
                    var items = categories[catName];
                    html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:15px;">';
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">';
                    html += '<span style="font-weight:600;font-size:16px;">📂 ' + catName + '</span>';
                    html += '<button class="add-prompt-btn" data-category="' + catName + '" style="background:#34C759;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;">+ 添加</button>';
                    html += '</div>';
                    
                    items.forEach(function(item) {
                        html += '<div class="prompt-item" data-prompt-id="' + item.id + '" style="padding:12px;background:#f8f8f8;border-radius:10px;margin-bottom:8px;cursor:pointer;">';
                        html += '<div style="font-weight:500;margin-bottom:5px;">' + item.title + '</div>';
                        html += '<div style="font-size:12px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (item.content || '').substring(0, 50) + '...</div>';
                        html += '</div>';
                    });
                    
                    html += '</div>';
                });
                container.innerHTML = html;
                
                // 绑定事件
                container.querySelectorAll('.add-prompt-btn').forEach(function(btn) {
                    btn.onclick = function(e) {
                        e.stopPropagation();
                        var category = btn.getAttribute('data-category');
                        self.openPromptEditor(null, category);
                    };
                });
                
                container.querySelectorAll('.prompt-item').forEach(function(item) {
                    item.onclick = function() {
                        var promptId = item.getAttribute('data-prompt-id');
                        self.openPromptEditor(promptId);
                    };
                });
            }
        });
        
        // 新建分类
        var addCategoryBtn = page.querySelector('#add-prompt-category-btn');
        if (addCategoryBtn) {
            addCategoryBtn.onclick = function() {
                var categoryName = prompt('请输入分类名称：', '');
                if (categoryName && categoryName.trim()) {
                    self.openPromptEditor(null, categoryName.trim());
                }
            };
        }
    };

    // 提示词编辑器
    SystemConfigApp.prototype.openPromptEditor = function(promptId, defaultCategory) {
        var self = this;
        
        PhoneCore.db.get('prompts', promptId).then(function(promptData) {
            var isNew = !promptData;
            
            if (isNew) {
                promptData = {
                    id: 'prompt_' + Date.now(),
                    title: '',
                    content: '',
                    category: defaultCategory || '未分类'
                };
            }
            
            var html = '<div style="padding:20px;">';
            html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">' + (isNew ? '新建提示词' : '编辑提示词') + '</div>';
            
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
            
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">分类</label>';
            html += '<input type="text" id="prompt-category" value="' + promptData.category + '" placeholder="分类名称" class="' + S.input + '">';
            html += '</div>';
            
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">标题</label>';
            html += '<input type="text" id="prompt-title" value="' + (promptData.title || '') + '" placeholder="提示词标题" class="' + S.input + '">';
            html += '</div>';
            
            html += '<div style="margin-bottom:15px;">';
            html += '<label class="' + S.label + '">内容</label>';
            html += '<textarea id="prompt-content" placeholder="提示词内容..." class="' + S.input + ' sys-input-textarea-tpl" style="font-size:13px;">' + (promptData.content || '') + '</textarea>';
            html += '</div>';
            
            html += '</div>';
            
            html += '<button id="save-prompt-btn" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">保存</button>';
            
            if (!isNew) {
                html += '<button id="delete-prompt-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:12px;font-size:16px;cursor:pointer;margin-top:10px;">删除</button>';
            }
            
            html += '</div>';
            
            var page = self.openDetailPage(html);
            
            // 保存
            var saveBtn = page.querySelector('#save-prompt-btn');
            if (saveBtn) {
                saveBtn.onclick = function() {
                    var category = page.querySelector('#prompt-category').value.trim();
                    var title = page.querySelector('#prompt-title').value.trim();
                    var content = page.querySelector('#prompt-content').value.trim();
                    
                    if (!title) {
                        alert('请输入标题');
                        return;
                    }
                    
                    promptData.category = category || '未分类';
                    promptData.title = title;
                    promptData.content = content;
                    promptData.updatedAt = Date.now();
                    
                    PhoneCore.db.put('prompts', promptData).then(function() {
                        PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                        page.querySelector('.app-back-btn').click();
                    });
                };
            }
            
            // 删除
            var deleteBtn = page.querySelector('#delete-prompt-btn');
            if (deleteBtn) {
                deleteBtn.onclick = function() {
                    if (confirm('确定删除此提示词？')) {
                        PhoneCore.db.delete('prompts', promptId).then(function() {
                            page.querySelector('.app-back-btn').click();
                        });
                    }
                };
            }
        });
    };

    // NPC设置页面
    SystemConfigApp.prototype.openNPCSettings = function() {
        var self = this;
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:10px;">NPC生成设置</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">配置各App自动生成NPC时使用的提示词</div>';
        
        // NPC每日生成限制
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div style="font-weight:600;margin-bottom:15px;">全局设置</div>';
        
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<span>每日NPC生成上限</span>';
        html += '<input type="number" id="npc-daily-limit" value="3" min="1" max="10" style="width:60px;padding:8px;border:1px solid #e0e0e0;border-radius:8px;text-align:center;">';
        html += '</div>';
        
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">';
        html += '<span>NPC自动清理时间</span>';
        html += '<select id="npc-cleanup-time" style="padding:8px;border:1px solid #e0e0e0;border-radius:8px;">';
        html += '<option value="24">24小时</option>';
        html += '<option value="48">48小时</option>';
        html += '<option value="72">72小时</option>';
        html += '<option value="0">不自动清理</option>';
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        
        // 各App NPC设置
        var appNPCSettings = [
            { id: 'chat-app', name: '聊天App', desc: '生成联系人卡片中的新角色' },
            { id: 'sms-app', name: '短信App', desc: '生成匿名短信发送者' },
            { id: 'weather-app', name: '天气App', desc: '生成天气预报NPC' }
        ];
        
        appNPCSettings.forEach(function(app) {
            html += '<div class="config-card npc-app-setting" data-app-id="' + app.id + '" style="background:white;border-radius:16px;padding:20px;margin-bottom:15px;cursor:pointer;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div>';
            html += '<div style="font-weight:600;">' + app.name + '</div>';
            html += '<div style="font-size:12px;color:#666;margin-top:5px;">' + app.desc + '</div>';
            html += '</div>';
            html += '<span style="color:#999;font-size:20px;">›</span>';
            html += '</div>';
            html += '</div>';
        });
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // App NPC设置点击
        page.querySelectorAll('.npc-app-setting').forEach(function(card) {
            card.onclick = function() {
                var appId = card.getAttribute('data-app-id');
                self.openAppNPCPromptEditor(appId);
            };
        });
    };

    // ============ 阶段8：私生饭事件设置页面 ============
    SystemConfigApp.prototype.openSasaengSettings = function() {
        var self = this;
        
        // 获取当前设置
        var weiboApp = PhoneCore.getApp('weibo');
        var sasaengSettings = weiboApp ? weiboApp.getSasaengSettings() : { enabled: true, intensity: 'medium' };
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:10px;">私生饭事件设置</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">设置私生饭骚扰事件的触发和强度</div>';
        
        // 说明卡片
        html += '<div style="background:linear-gradient(135deg,#FF5252,#FF8A80);border-radius:16px;padding:20px;margin-bottom:20px;color:white;">';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
        html += '<span style="font-size:24px;">⚠️</span>';
        html += '<span style="font-size:16px;font-weight:600;">私生饭事件</span>';
        html += '</div>';
        html += '<div style="font-size:13px;opacity:0.9;">当粉丝数达到10万以上时，可能会遭遇私生饭骚扰。包括狂热型、跟踪型和恶意型三种，会通过短信骚扰你。</div>';
        html += '</div>';
        
        // 设置表单
        html += '<div style="background:white;border-radius:16px;padding:20px;">';
        
        // 功能开关
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:15px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<div>';
        html += '<div style="font-size:15px;font-weight:500;color:#333;">启用私生饭事件</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:4px;">关闭后不会触发任何私生饭事件</div>';
        html += '</div>';
        html += '<label style="position:relative;display:inline-block;width:50px;height:28px;">';
        html += '<input type="checkbox" id="sasaeng-enabled" ' + (sasaengSettings.enabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
        html += '<span id="sasaeng-toggle-bg" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:' + (sasaengSettings.enabled ? '#FF5252' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
        html += '<span id="sasaeng-toggle-dot" style="position:absolute;content:\'\';height:22px;width:22px;left:' + (sasaengSettings.enabled ? '25px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
        html += '</label>';
        html += '</div>';
        
        // 骚扰强度设置
        html += '<div style="padding:15px 0;border-bottom:1px solid #f0f0f0;">';
        html += '<div style="font-size:15px;font-weight:500;color:#333;margin-bottom:12px;">骚扰强度</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">';
        
        var intensityOptions = [
            { value: 'light', label: '轻度', desc: '偶尔骚扰', icon: '😐', color: '#FF9800' },
            { value: 'medium', label: '中度', desc: '定期骚扰', icon: '😰', color: '#FF5252' },
            { value: 'heavy', label: '重度', desc: '频繁骚扰', icon: '😱', color: '#9C27B0' }
        ];
        
        intensityOptions.forEach(function(opt) {
            var isSelected = sasaengSettings.intensity === opt.value;
            html += '<div class="sasaeng-intensity-option" data-value="' + opt.value + '" style="' +
                'padding:14px 10px;border-radius:14px;text-align:center;cursor:pointer;transition:all 0.2s;' +
                'background:' + (isSelected ? 'linear-gradient(135deg,' + opt.color + '15,' + opt.color + '10)' : '#f8f8f8') + ';' +
                'border:2px solid ' + (isSelected ? opt.color : 'transparent') + ';">';
            html += '<div style="font-size:24px;margin-bottom:6px;">' + opt.icon + '</div>';
            html += '<div style="font-size:14px;font-weight:500;color:' + (isSelected ? opt.color : '#333') + ';">' + opt.label + '</div>';
            html += '<div style="font-size:11px;color:#888;margin-top:3px;">' + opt.desc + '</div>';
            html += '</div>';
        });
        html += '</div>';
        html += '<input type="hidden" id="sasaeng-intensity" value="' + sasaengSettings.intensity + '">';
        html += '</div>';
        
        // 统计信息
        var se = PhoneCore.data.weibo && PhoneCore.data.weibo.sasaengEvents;
        if (se) {
            html += '<div style="padding:15px 0;">';
            html += '<div style="font-size:15px;font-weight:500;color:#333;margin-bottom:12px;">事件统计</div>';
            html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">';
            
            html += '<div style="background:#f8f8f8;padding:12px;border-radius:10px;text-align:center;">';
            html += '<div style="font-size:20px;font-weight:700;color:#FF5252;">' + se.active.filter(function(s){return s.status==='active';}).length + '</div>';
            html += '<div style="font-size:11px;color:#999;margin-top:4px;">活跃私生饭</div>';
            html += '</div>';
            
            html += '<div style="background:#f8f8f8;padding:12px;border-radius:10px;text-align:center;">';
            html += '<div style="font-size:20px;font-weight:700;color:#FF9800;">' + se.blocked.length + '</div>';
            html += '<div style="font-size:11px;color:#999;margin-top:4px;">已拉黑</div>';
            html += '</div>';
            
            html += '<div style="background:#f8f8f8;padding:12px;border-radius:10px;text-align:center;">';
            html += '<div style="font-size:20px;font-weight:700;color:#4CAF50;">' + se.reported.length + '</div>';
            html += '<div style="font-size:11px;color:#999;margin-top:4px;">已报警</div>';
            html += '</div>';
            
            html += '<div style="background:#f8f8f8;padding:12px;border-radius:10px;text-align:center;">';
            html += '<div style="font-size:20px;font-weight:700;color:#2196F3;">' + se.triggerHistory.length + '</div>';
            html += '<div style="font-size:11px;color:#999;margin-top:4px;">历史事件</div>';
            html += '</div>';
            
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>'; // 设置表单结束
        
        // 注意事项
        html += '<div style="margin-top:16px;padding:14px;background:rgba(255,152,0,0.08);border-radius:12px;border-left:3px solid #FF9800;">';
        html += '<div style="font-size:12px;color:#E65100;font-weight:500;">💡 说明</div>';
        html += '<div style="font-size:11px;color:#BF360C;margin-top:6px;line-height:1.6;">';
        html += '• 粉丝数达到10万以上才可能触发私生饭事件<br>';
        html += '• 公开恋情后触发概率翻倍<br>';
        html += '• 拉黑号码后该私生饭不再发短信<br>';
        html += '• 报警后会降低后续触发概率<br>';
        html += '• 回复私生饭可能导致骚扰升级<br>';
        html += '• 忽略恶意型私生饭可能导致负面热搜';
        html += '</div>';
        html += '</div>';
        
        html += '</div>'; // padding容器结束
        
        var page = this.openDetailPage(html);
        
        // 绑定事件
        
        // 开关事件
        var enabledCheckbox = page.querySelector('#sasaeng-enabled');
        if (enabledCheckbox) {
            enabledCheckbox.onchange = function() {
                var isEnabled = enabledCheckbox.checked;
                var bg = page.querySelector('#sasaeng-toggle-bg');
                var dot = page.querySelector('#sasaeng-toggle-dot');
                if (bg) bg.style.background = isEnabled ? '#FF5252' : '#ccc';
                if (dot) dot.style.left = isEnabled ? '25px' : '3px';
                
                if (weiboApp && weiboApp.updateSasaengSettings) {
                    weiboApp.updateSasaengSettings({ enabled: isEnabled });
                }
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: isEnabled ? '已开启' : '已关闭',
                    message: '私生饭事件' + (isEnabled ? '已启用' : '已禁用'),
                    size: 'mini',
                    duration: 2000
                });
            };
        }
        
        // 强度选择事件
        var intensityOptions2 = page.querySelectorAll('.sasaeng-intensity-option');
        intensityOptions2.forEach(function(opt) {
            opt.onclick = function() {
                var value = opt.getAttribute('data-value');
                var hiddenInput = page.querySelector('#sasaeng-intensity');
                if (hiddenInput) hiddenInput.value = value;
                
                // 更新选中样式
                var colorMap = { light: '#FF9800', medium: '#FF5252', heavy: '#9C27B0' };
                intensityOptions2.forEach(function(o) {
                    var v = o.getAttribute('data-value');
                    var isSelected = v === value;
                    o.style.background = isSelected ? 'linear-gradient(135deg,' + colorMap[v] + '15,' + colorMap[v] + '10)' : '#f8f8f8';
                    o.style.borderColor = isSelected ? colorMap[v] : 'transparent';
                    var label = o.querySelector('div:nth-child(2)');
                    if (label) label.style.color = isSelected ? colorMap[v] : '#333';
                });
                
                if (weiboApp && weiboApp.updateSasaengSettings) {
                    weiboApp.updateSasaengSettings({ intensity: value });
                }
                
                var labelMap = { light: '轻度', medium: '中度', heavy: '重度' };
                PhoneCore.notifications.send({
                    type: 'info',
                    title: '骚扰强度已更新',
                    message: '当前设置为：' + labelMap[value],
                    size: 'mini',
                    duration: 2000
                });
            };
        });
    };

    // 微博数据源配置
    SystemConfigApp.prototype.openWeiboDataSourceSettings = function() {
        var self = this;
        var S = this.STYLES;
        
        // 获取当前设置，优先从weiboDataSource读取，否则从weibo.aiVisibility反向映射
        var currentSettings;
        if (PhoneCore.data && PhoneCore.data.weiboDataSource) {
            currentSettings = PhoneCore.data.weiboDataSource;
        } else {
            // 从weibo.aiVisibility反向映射
            var aiVisibility = (PhoneCore.data && PhoneCore.data.weibo && PhoneCore.data.weibo.aiVisibility) || { mode: 'recent', recentCount: 10 };
            var readRange = 'recent10';
            var allowRead = true;
            
            switch (aiVisibility.mode) {
                case 'none':
                    allowRead = false;
                    readRange = 'recent10';
                    break;
                case 'all':
                    readRange = 'all';
                    break;
                case 'mentioned':
                    readRange = 'mentioned';
                    break;
                case 'recent':
                default:
                    readRange = aiVisibility.recentCount === 5 ? 'recent5' : 'recent10';
                    break;
            }
            
            currentSettings = {
                allowAIReadUserPosts: allowRead,
                readRange: readRange,
                syncAIPostsToContext: true
            };
        }
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:6px;">微博数据同步</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">配置AI与微博数据的交互方式</div>';
        
        // ===== 允许AI读取用户微博 =====
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:15px;color:#333;font-weight:500;">允许AI读取用户微博</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:4px;">开启后AI可以在对话中参考你发布的微博内容</div>';
        html += '</div>';
        html += '<label style="position:relative;width:50px;height:28px;flex-shrink:0;margin-left:15px;">';
        html += '<input type="checkbox" id="weibo-allow-read" ' + (currentSettings.allowAIReadUserPosts ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
        html += '<span class="switch-track" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (currentSettings.allowAIReadUserPosts ? '#34C759' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
        html += '<span class="switch-thumb" style="position:absolute;height:22px;width:22px;left:' + (currentSettings.allowAIReadUserPosts ? '25px' : '3px') + ';bottom:3px;background-color:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
        html += '</label>';
        html += '</div>';
        html += '</div>';
        
        // ===== 读取范围 =====
        html += '<div id="weibo-range-section" class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;' + (!currentSettings.allowAIReadUserPosts ? 'opacity:0.5;pointer-events:none;' : '') + '">';
        html += '<div style="font-size:15px;color:#333;font-weight:500;margin-bottom:12px;">读取范围</div>';
        html += '<div style="font-size:12px;color:#888;margin-bottom:15px;">设置AI可以读取的微博范围</div>';
        
        var rangeOptions = [
            { value: 'recent5', label: '最近5条', desc: '仅读取最新的5条微博' },
            { value: 'recent10', label: '最近10条', desc: '仅读取最新的10条微博' },
            { value: 'all', label: '全部微博', desc: '读取所有用户发布的微博' },
            { value: 'mentioned', label: '仅@提及', desc: '仅读取@了AI的微博' }
        ];
        
        rangeOptions.forEach(function(option) {
            var isSelected = currentSettings.readRange === option.value;
            html += '<label style="display:flex;align-items:flex-start;padding:14px;margin-bottom:8px;background:' + (isSelected ? 'rgba(25,118,210,0.08)' : '#f8f9fa') + ';border-radius:12px;cursor:pointer;border:2px solid ' + (isSelected ? '#1976D2' : 'transparent') + ';transition:all 0.2s;">';
            html += '<input type="radio" name="weibo-read-range" value="' + option.value + '" ' + (isSelected ? 'checked' : '') + ' style="margin-right:12px;margin-top:2px;accent-color:#1976D2;">';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:14px;color:#333;font-weight:500;">' + option.label + '</div>';
            html += '<div style="font-size:12px;color:#888;margin-top:3px;">' + option.desc + '</div>';
            html += '</div>';
            html += '</label>';
        });
        
        html += '</div>';
        
        // ===== 同步AI微博到智能拉取 =====
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:15px;color:#333;font-weight:500;">同步AI微博到智能拉取</div>';
        html += '<div style="font-size:12px;color:#888;margin-top:4px;">开启后AI发布的微博会作为上下文参考</div>';
        html += '</div>';
        html += '<label style="position:relative;width:50px;height:28px;flex-shrink:0;margin-left:15px;">';
        html += '<input type="checkbox" id="weibo-sync-context" ' + (currentSettings.syncAIPostsToContext ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
        html += '<span class="switch-track" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (currentSettings.syncAIPostsToContext ? '#34C759' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
        html += '<span class="switch-thumb" style="position:absolute;height:22px;width:22px;left:' + (currentSettings.syncAIPostsToContext ? '25px' : '3px') + ';bottom:3px;background-color:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
        html += '</label>';
        html += '</div>';
        html += '</div>';
        
        // ===== 提示信息 =====
        html += '<div class="config-card" style="background:linear-gradient(135deg,#E3F2FD,#FFF3E0);border-radius:16px;padding:16px;margin-bottom:20px;">';
        html += '<div style="display:flex;align-items:flex-start;gap:10px;">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="#FF6B8A"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>';
        html += '<div>';
        html += '<div style="font-size:13px;color:#333;font-weight:500;">提示</div>';
        html += '<div style="font-size:12px;color:#666;margin-top:4px;">这些设置控制AI如何与微博数据交互。合理配置可以让AI更好地理解你的动态和心情，提供更贴心的对话体验。</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        
        // ===== 保存按钮 =====
        html += '<button id="save-weibo-data-source-btn" style="width:100%;padding:15px;background:linear-gradient(135deg,#1976D2,#42A5F5);color:white;border:none;border-radius:12px;font-size:16px;font-weight:500;cursor:pointer;box-shadow:0 4px 12px rgba(25,118,210,0.3);">保存设置</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 绑定开关事件 - 允许AI读取用户微博
        var allowReadCheckbox = page.querySelector('#weibo-allow-read');
        if (allowReadCheckbox) {
            allowReadCheckbox.onchange = function() {
                var track = this.parentElement.querySelector('.switch-track');
                var thumb = this.parentElement.querySelector('.switch-thumb');
                var rangeSection = page.querySelector('#weibo-range-section');
                
                if (this.checked) {
                    track.style.backgroundColor = '#34C759';
                    thumb.style.left = '25px';
                    rangeSection.style.opacity = '1';
                    rangeSection.style.pointerEvents = 'auto';
                } else {
                    track.style.backgroundColor = '#ccc';
                    thumb.style.left = '3px';
                    rangeSection.style.opacity = '0.5';
                    rangeSection.style.pointerEvents = 'none';
                }
            };
        }
        
        // 绑定开关事件 - 同步AI微博到智能拉取
        var syncContextCheckbox = page.querySelector('#weibo-sync-context');
        if (syncContextCheckbox) {
            syncContextCheckbox.onchange = function() {
                var track = this.parentElement.querySelector('.switch-track');
                var thumb = this.parentElement.querySelector('.switch-thumb');
                
                if (this.checked) {
                    track.style.backgroundColor = '#34C759';
                    thumb.style.left = '25px';
                } else {
                    track.style.backgroundColor = '#ccc';
                    thumb.style.left = '3px';
                }
            };
        }
        
        // 绑定单选按钮样式更新
        page.querySelectorAll('input[name="weibo-read-range"]').forEach(function(radio) {
            radio.onchange = function() {
                page.querySelectorAll('input[name="weibo-read-range"]').forEach(function(r) {
                    var label = r.closest('label');
                    if (r.checked) {
                        label.style.background = 'rgba(25,118,210,0.08)';
                        label.style.borderColor = '#1976D2';
                    } else {
                        label.style.background = '#f8f9fa';
                        label.style.borderColor = 'transparent';
                    }
                });
            };
        });
        
        // 保存按钮
        var saveBtn = page.querySelector('#save-weibo-data-source-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var allowRead = page.querySelector('#weibo-allow-read').checked;
                var selectedRange = page.querySelector('input[name="weibo-read-range"]:checked');
                var syncContext = page.querySelector('#weibo-sync-context').checked;
                var rangeValue = selectedRange ? selectedRange.value : 'recent10';
                
                var newSettings = {
                    allowAIReadUserPosts: allowRead,
                    readRange: rangeValue,
                    syncAIPostsToContext: syncContext
                };
                
                // 保存到PhoneCore.data.weiboDataSource
                if (!PhoneCore.data) PhoneCore.data = {};
                PhoneCore.data.weiboDataSource = newSettings;
                
                // 同步到weibo.aiVisibility，确保weibo.js能正确读取
                if (!PhoneCore.data.weibo) PhoneCore.data.weibo = {};
                
                // 映射readRange到aiVisibility的mode和recentCount
                var aiVisibilityMode = 'recent';
                var aiVisibilityCount = 10;
                
                if (!allowRead) {
                    aiVisibilityMode = 'none';
                } else {
                    switch (rangeValue) {
                        case 'recent5':
                            aiVisibilityMode = 'recent';
                            aiVisibilityCount = 5;
                            break;
                        case 'recent10':
                            aiVisibilityMode = 'recent';
                            aiVisibilityCount = 10;
                            break;
                        case 'all':
                            aiVisibilityMode = 'all';
                            break;
                        case 'mentioned':
                            aiVisibilityMode = 'mentioned';
                            break;
                        default:
                            aiVisibilityMode = 'recent';
                            aiVisibilityCount = 10;
                    }
                }
                
                PhoneCore.data.weibo.aiVisibility = {
                    mode: aiVisibilityMode,
                    recentCount: aiVisibilityCount
                };
                
                PhoneCore.save && PhoneCore.save();
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '微博数据同步设置已保存',
                    size: 'mini'
                });
                
                page.querySelector('.app-back-btn').click();
            };
        }
    };

    // AI可见信息设置
    SystemConfigApp.prototype.openAIVisibilitySettings = function() {
        var self = this;
        var S = this.STYLES;
        
        // 定义所有App的可见性配置
        var appVisibilityConfig = this.getAppVisibilityConfig();
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:6px;">AI可见信息</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">配置AI在各应用中可以读取的数据</div>';
        
        // ===== 各App的可见性配置入口 =====
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:0;margin-bottom:20px;overflow:hidden;">';
        
        // 核心App配置（硬编码）
        var coreApps = [
            { id: 'chat', name: '聊天', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>', desc: 'AI在聊天时可读取的数据' },
            { id: 'sms', name: '短信', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>', desc: 'AI在短信中可读取的数据' },
            { id: 'call', name: '通话', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5856D6" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>', desc: 'AI在通话中可读取的数据' },
            { id: 'weibo', name: '微博', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6bb9f0" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>', desc: 'AI可见用户微博范围设置', isSpecial: true }
        ];
        
        // 从全局注册表获取扩展App的AI可见信息配置
        var registeredApps = PhoneCore.getAIVisibilityRegistry ? PhoneCore.getAIVisibilityRegistry() : {};
        var extApps = Object.values(registeredApps).map(function(config) {
            return {
                id: config.id,
                name: config.name,
                icon: config.icon || '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>',
                desc: config.desc,
                isExtension: true,          // 标记为扩展App
                dataSources: config.dataSources  // 携带自定义数据源
            };
        });
        
        // 合并核心App和扩展App
        var apps = coreApps.concat(extApps);
        
        apps.forEach(function(app, index) {
            var config = appVisibilityConfig[app.id] || {};
            var statusText = '';
            
            // 微博使用特殊的状态显示
            if (app.id === 'weibo') {
                var weiboSettings = (PhoneCore.data && PhoneCore.data.weibo && PhoneCore.data.weibo.aiVisibility) || { mode: 'recent', recentCount: 10 };
                var modeNames = { recent: '最近' + (weiboSettings.recentCount || 10) + '条', all: '全部可见', mentioned: '仅@提及', none: '不可见' };
                statusText = modeNames[weiboSettings.mode] || '最近10条';
            } else {
                var enabledCount = self.countEnabledItems(config);
                statusText = enabledCount + '项已启用';
            }
            
            html += '<div class="app-visibility-entry" data-app-id="' + app.id + '" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;cursor:pointer;' + (index < apps.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : '') + '">';
            html += '<div style="display:flex;align-items:center;gap:12px;">';
            html += '<div style="width:36px;height:36px;border-radius:10px;background:#f5f5f7;display:flex;align-items:center;justify-content:center;">' + app.icon + '</div>';
            html += '<div>';
            html += '<div style="font-size:15px;color:#333;font-weight:500;">' + app.name + '</div>';
            html += '<div style="font-size:12px;color:#888;margin-top:2px;">' + app.desc + '</div>';
            html += '</div>';
            html += '</div>';
            html += '<div style="display:flex;align-items:center;gap:8px;">';
            html += '<span style="font-size:12px;color:#999;">' + statusText + '</span>';
            html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            html += '</div>';
            html += '</div>';
        });
        
        html += '</div>';
        
        // ===== 预设组管理 =====
        html += '<div style="font-size:14px;font-weight:600;color:#666;margin-bottom:12px;margin-top:24px;">预设配置组</div>';
        
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:15px;">';
        html += '<div style="font-size:13px;color:#888;margin-bottom:15px;">创建预设组后可快速应用到不同AI</div>';
        
        // 预设组列表
        html += '<div id="data-sub-groups-list">';
        var dataSubGroups = JSON.parse(localStorage.getItem('ai_data_sub_groups') || '[]');
        if (dataSubGroups.length === 0) {
            dataSubGroups = [{ id: 'default', name: '默认配置', weather: true, userCity: true, userProfile: true, time: true, shopWishlist: true, shopBalance: false }];
            localStorage.setItem('ai_data_sub_groups', JSON.stringify(dataSubGroups));
        }
        dataSubGroups.forEach(function(group) {
            html += self.renderDataSubGroupItem(group);
        });
        html += '</div>';
        
        html += '<button id="add-data-sub-group-btn" style="width:100%;padding:12px;background:#f5f5f7;color:#007AFF;border:none;border-radius:10px;font-size:14px;cursor:pointer;margin-top:10px;">+ 新建预设组</button>';
        html += '</div>';
        
        // ===== AI配置分配 =====
        var mainAIs = Object.values(PhoneCore.ais).filter(function(ai) {
            return ai.type === 'main';
        });
        
        if (mainAIs.length > 0) {
            html += '<div style="font-size:14px;font-weight:600;color:#666;margin-bottom:12px;">AI预设分配</div>';
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:15px 20px;margin-bottom:20px;">';
            
            html += '<div id="ai-group-assignments">';
            mainAIs.forEach(function(ai, index) {
                var currentGroupId = ai.dataSubscriptions && ai.dataSubscriptions.groupId ? ai.dataSubscriptions.groupId : 'default';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;' + (index < mainAIs.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : '') + '">';
                html += '<div style="display:flex;align-items:center;gap:10px;">';
                if (ai.avatar) {
                    html += '<img src="' + ai.avatar + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">';
                } else {
                    html += '<div style="width:36px;height:36px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;">AI</div>';
                }
                html += '<div style="font-size:14px;color:#333;">' + ai.name + '</div>';
                html += '</div>';
                html += '<select class="ai-group-select" data-ai-id="' + ai.id + '" style="padding:8px 12px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;background:white;">';
                dataSubGroups.forEach(function(group) {
                    html += '<option value="' + group.id + '"' + (currentGroupId === group.id ? ' selected' : '') + '>' + group.name + '</option>';
                });
                html += '</select>';
                html += '</div>';
            });
            html += '</div>';
            
            html += '</div>';
        }
        
        // 保存按钮
        html += '<button id="save-ai-visibility-btn" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">保存</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 绑定App入口点击事件
        page.querySelectorAll('.app-visibility-entry').forEach(function(entry) {
            entry.onclick = function() {
                var appId = entry.getAttribute('data-app-id');
                // 微博使用专用设置界面
                if (appId === 'weibo') {
                    self.openWeiboVisibilitySettings(page);
                } else {
                    self.openAppVisibilityDetail(appId, page);
                }
            };
        });
        
        // 新建配置组按钮
        var addGroupBtn = page.querySelector('#add-data-sub-group-btn');
        if (addGroupBtn) {
            addGroupBtn.onclick = function() {
                self.openDataSubGroupEditor(null, page);
            };
        }
        
        // 配置组编辑和删除按钮
        self.bindDataSubGroupEvents(page);
        
        // 保存按钮
        var saveBtn = page.querySelector('#save-ai-visibility-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                // 保存AI配置分配
                var aiSelects = page.querySelectorAll('.ai-group-select');
                aiSelects.forEach(function(select) {
                    var aiId = select.getAttribute('data-ai-id');
                    var groupId = select.value;
                    var ai = PhoneCore.getAI(aiId);
                    if (ai) {
                        var groups = JSON.parse(localStorage.getItem('ai_data_sub_groups') || '[]');
                        var group = groups.find(function(g) { return g.id === groupId; });
                        if (group) {
                            ai.dataSubscriptions = {
                                groupId: groupId,
                                weather: group.weather,
                                userCity: group.userCity,
                                userProfile: group.userProfile,
                                time: group.time
                            };
                            PhoneCore.saveAI(ai);
                        }
                    }
                });
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '已保存',
                    size: 'mini'
                });
                
                page.querySelector('.app-back-btn').click();
            };
        }
    };
    
    // 获取App可见性配置
    SystemConfigApp.prototype.getAppVisibilityConfig = function() {
        return JSON.parse(localStorage.getItem('app_visibility_config') || '{}');
    };
    
    // 保存App可见性配置
    SystemConfigApp.prototype.saveAppVisibilityConfig = function(config) {
        localStorage.setItem('app_visibility_config', JSON.stringify(config));
    };
    
    // 统计启用项数量
    SystemConfigApp.prototype.countEnabledItems = function(config) {
        if (!config) return 0;
        var count = 0;
        for (var key in config) {
            if (config[key] === true) count++;
        }
        return count;
    };
    
    // 打开微博AI可见性设置
    SystemConfigApp.prototype.openWeiboVisibilitySettings = function(parentPage) {
        var self = this;
        var S = this.STYLES;
        
        // 获取当前设置
        var weiboApp = PhoneCore.getApp ? PhoneCore.getApp('weibo-app') : null;
        var currentSettings = { mode: 'recent', recentCount: 10 };
        if (weiboApp && weiboApp.getAIVisibilitySettings) {
            currentSettings = weiboApp.getAIVisibilitySettings();
        } else if (PhoneCore.data && PhoneCore.data.weibo && PhoneCore.data.weibo.aiVisibility) {
            currentSettings = PhoneCore.data.weibo.aiVisibility;
        }
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:6px;">微博 - AI可见范围</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">控制AI可以看到哪些用户微博</div>';
        
        // 模式选择
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div style="font-size:14px;font-weight:500;color:#333;margin-bottom:15px;">可见范围模式</div>';
        
        var modes = [
            { id: 'recent', name: '最近N条', desc: '只让AI看到最近发布的N条微博' },
            { id: 'all', name: '全部微博', desc: 'AI可以看到所有用户发布的微博' },
            { id: 'mentioned', name: '仅@提及', desc: '只让AI看到@了自己的微博' },
            { id: 'none', name: '不可见', desc: 'AI完全无法看到用户的微博' }
        ];
        
        modes.forEach(function(mode, index) {
            var isSelected = currentSettings.mode === mode.id;
            html += '<label style="display:flex;align-items:flex-start;padding:14px;margin-bottom:8px;background:' + (isSelected ? 'rgba(0,122,255,0.08)' : '#f8f9fa') + ';border-radius:12px;cursor:pointer;border:2px solid ' + (isSelected ? '#007AFF' : 'transparent') + ';transition:all 0.2s;">';
            html += '<input type="radio" name="weibo-visibility-mode" value="' + mode.id + '" ' + (isSelected ? 'checked' : '') + ' style="margin-right:12px;margin-top:2px;accent-color:#007AFF;">';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:15px;color:#333;font-weight:500;">' + mode.name + '</div>';
            html += '<div style="font-size:12px;color:#888;margin-top:3px;">' + mode.desc + '</div>';
            html += '</div>';
            html += '</label>';
        });
        
        html += '</div>';
        
        // 最近N条设置（仅在recent模式下显示）
        html += '<div id="recent-count-section" class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;' + (currentSettings.mode !== 'recent' ? 'display:none;' : '') + '">';
        html += '<div style="font-size:14px;font-weight:500;color:#333;margin-bottom:15px;">最近条数设置</div>';
        html += '<div style="display:flex;align-items:center;gap:15px;">';
        html += '<span style="font-size:14px;color:#666;">AI可见最近</span>';
        html += '<input type="number" id="weibo-recent-count" value="' + (currentSettings.recentCount || 10) + '" min="1" max="100" style="width:70px;padding:10px 12px;border:1px solid #e0e0e0;border-radius:8px;font-size:15px;text-align:center;">';
        html += '<span style="font-size:14px;color:#666;">条微博</span>';
        html += '</div>';
        html += '<div style="font-size:12px;color:#999;margin-top:10px;">建议设置5-20条，过多可能影响AI响应速度</div>';
        html += '</div>';
        
        // 预览提示
        html += '<div class="config-card" style="background:linear-gradient(135deg,#E8F4FD,#FDF2F8);border-radius:16px;padding:16px;margin-bottom:20px;">';
        html += '<div style="display:flex;align-items:flex-start;gap:10px;">';
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="#FF6B8A"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>';
        html += '<div>';
        html += '<div style="font-size:13px;color:#333;font-weight:500;">提示</div>';
        html += '<div style="font-size:12px;color:#666;margin-top:4px;">此设置影响AI在聊天时对用户微博内容的感知。AI可以据此了解用户的动态和心情。</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        
        // 保存按钮
        html += '<button id="save-weibo-visibility-btn" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">保存</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 模式切换时显示/隐藏条数设置
        page.querySelectorAll('input[name="weibo-visibility-mode"]').forEach(function(radio) {
            radio.onchange = function() {
                var recentSection = page.querySelector('#recent-count-section');
                if (radio.value === 'recent') {
                    recentSection.style.display = 'block';
                } else {
                    recentSection.style.display = 'none';
                }
                
                // 更新选中样式
                page.querySelectorAll('input[name="weibo-visibility-mode"]').forEach(function(r) {
                    var label = r.closest('label');
                    if (r.checked) {
                        label.style.background = 'rgba(0,122,255,0.08)';
                        label.style.borderColor = '#007AFF';
                    } else {
                        label.style.background = '#f8f9fa';
                        label.style.borderColor = 'transparent';
                    }
                });
            };
        });
        
        // 保存按钮
        var saveBtn = page.querySelector('#save-weibo-visibility-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var selectedMode = page.querySelector('input[name="weibo-visibility-mode"]:checked');
                var recentCountInput = page.querySelector('#weibo-recent-count');
                
                var newSettings = {
                    mode: selectedMode ? selectedMode.value : 'recent',
                    recentCount: parseInt(recentCountInput.value) || 10
                };
                
                // 保存设置
                if (weiboApp && weiboApp.setAIVisibilitySettings) {
                    weiboApp.setAIVisibilitySettings(newSettings);
                } else {
                    // 直接保存到PhoneCore.data
                    if (!PhoneCore.data) PhoneCore.data = {};
                    if (!PhoneCore.data.weibo) PhoneCore.data.weibo = {};
                    PhoneCore.data.weibo.aiVisibility = newSettings;
                    PhoneCore.save && PhoneCore.save();
                }
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '微博可见设置已保存',
                    size: 'mini'
                });
                
                page.querySelector('.app-back-btn').click();
            };
        }
    };
    
    // 打开App可见性详情
    SystemConfigApp.prototype.openAppVisibilityDetail = function(appId, parentPage) {
        var self = this;
        var config = this.getAppVisibilityConfig();
        var appConfig = config[appId] || {};
        
        // 核心App名称映射
        var coreAppNames = { chat: '聊天', sms: '短信', call: '通话' };
        
        // 检查是否是扩展App（从注册表获取配置）
        var registeredApps = PhoneCore.getAIVisibilityRegistry ? PhoneCore.getAIVisibilityRegistry() : {};
        var extAppConfig = registeredApps[appId];
        
        // 获取App名称
        var appName = coreAppNames[appId] || (extAppConfig ? extAppConfig.name : appId);
        
        // 定义数据源：核心App使用默认数据源，扩展App使用自定义数据源
        var dataSources;
        if (extAppConfig && extAppConfig.dataSources && extAppConfig.dataSources.length > 0) {
            // 扩展App使用自定义数据源
            dataSources = extAppConfig.dataSources.map(function(ds) {
                return {
                    id: ds.id,
                    name: ds.name,
                    desc: ds.desc || 'AI可读取' + ds.name,
                    default: ds.default !== false  // 默认启用
                };
            });
        } else {
            // 核心App使用默认数据源列表
            dataSources = [
                { id: 'weather', name: '天气App', desc: 'AI可读取天气信息' },
                { id: 'userCity', name: '用户城市', desc: 'AI可获知用户所在城市' },
                { id: 'userProfile', name: '用户身份', desc: 'AI可获知用户姓名、职业等' },
                { id: 'time', name: '当前时间', desc: 'AI可获知日期和时间' },
                { id: 'shopWishlist', name: '购物心愿单', desc: 'AI可看到用户想要的商品' },
                { id: 'shopBalance', name: '账户余额', desc: 'AI可了解用户财务状况' },
                { id: 'schedule', name: '时间表', desc: 'AI可读取绑定的时间表' },
                { id: 'chatHistory', name: '聊天记录', desc: 'AI可参考历史对话' }
            ];
        }
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:6px;">' + appName + ' - AI可见数据</div>';
        html += '<div style="font-size:13px;color:#666;margin-bottom:20px;">配置AI在' + appName + '中可以读取哪些数据</div>';
        
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:5px 20px;margin-bottom:20px;">';
        
        dataSources.forEach(function(source, index) {
            // 判断是否启用：如果用户配置过则使用用户配置，否则使用数据源的default值
            var isEnabled = appConfig[source.id] !== undefined ? appConfig[source.id] : (source.default !== false);
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;' + (index < dataSources.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : '') + '">';
            html += '<div>';
            html += '<div style="font-size:14px;color:#333;">' + source.name + '</div>';
            html += '<div style="font-size:12px;color:#888;margin-top:2px;">' + source.desc + '</div>';
            html += '</div>';
            html += '<label style="position:relative;width:50px;height:28px;">';
            html += '<input type="checkbox" data-source-id="' + source.id + '" ' + (isEnabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
            html += '<span class="toggle-track" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (isEnabled ? '#34C759' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
            html += '<span class="toggle-dot" style="position:absolute;height:22px;width:22px;left:3px;bottom:3px;background-color:white;border-radius:50%;transition:0.3s;transform:' + (isEnabled ? 'translateX(22px)' : 'translateX(0)') + ';box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
            html += '</label>';
            html += '</div>';
        });
        
        html += '</div>';
        
        html += '<button id="save-app-visibility-btn" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">保存</button>';
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 绑定开关事件
        page.querySelectorAll('input[type="checkbox"]').forEach(function(toggle) {
            toggle.onchange = function() {
                var track = toggle.parentElement.querySelector('.toggle-track');
                var dot = toggle.parentElement.querySelector('.toggle-dot');
                if (toggle.checked) {
                    track.style.backgroundColor = '#34C759';
                    dot.style.transform = 'translateX(22px)';
                } else {
                    track.style.backgroundColor = '#ccc';
                    dot.style.transform = 'translateX(0)';
                }
            };
        });
        
        // 保存按钮
        var saveBtn = page.querySelector('#save-app-visibility-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var newAppConfig = {};
                page.querySelectorAll('input[type="checkbox"]').forEach(function(checkbox) {
                    var sourceId = checkbox.getAttribute('data-source-id');
                    newAppConfig[sourceId] = checkbox.checked;
                });
                
                var fullConfig = self.getAppVisibilityConfig();
                fullConfig[appId] = newAppConfig;
                self.saveAppVisibilityConfig(fullConfig);
                
                PhoneCore.notifications.send({
                    type: 'success',
                    title: '已保存',
                    size: 'mini'
                });
                
                page.querySelector('.app-back-btn').click();
                
                // 刷新父页面显示
                setTimeout(function() {
                    self.refreshAppVisibilityEntries(parentPage);
                }, 100);
            };
        }
    };
    
    // 刷新App可见性入口显示
    SystemConfigApp.prototype.refreshAppVisibilityEntries = function(page) {
        var self = this;
        var config = this.getAppVisibilityConfig();
        
        page.querySelectorAll('.app-visibility-entry').forEach(function(entry) {
            var appId = entry.getAttribute('data-app-id');
            var appConfig = config[appId] || {};
            var enabledCount = self.countEnabledItems(appConfig);
            var countSpan = entry.querySelector('span');
            if (countSpan) {
                countSpan.textContent = enabledCount + '项已启用';
            }
        });
    };
    
    // 渲染数据订阅配置组项
    SystemConfigApp.prototype.renderDataSubGroupItem = function(group) {
        var html = '<div class="data-sub-group-item" data-group-id="' + group.id + '" style="background:#f8f9fa;border-radius:10px;padding:14px;margin-bottom:8px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div style="font-size:14px;font-weight:500;color:#333;">' + group.name + '</div>';
        html += '<div style="display:flex;gap:8px;">';
        html += '<button class="edit-group-btn" data-group-id="' + group.id + '" style="padding:5px 12px;background:#007AFF;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;">编辑</button>';
        html += '<button class="delete-group-btn" data-group-id="' + group.id + '" style="padding:5px 12px;background:#FF3B30;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;">删除</button>';
        html += '</div>';
        html += '</div>';
        
        // 显示配置摘要
        var items = [];
        if (group.weather) items.push('天气');
        if (group.userCity) items.push('城市');
        if (group.userProfile) items.push('身份');
        if (group.time) items.push('时间');
        if (group.shopWishlist) items.push('心愿单');
        
        html += '<div style="font-size:12px;color:#888;margin-top:8px;">';
        html += items.length > 0 ? items.join(' / ') : '无启用项';
        html += '</div>';
        html += '</div>';
        
        return html;
    };
    
    // 绑定配置组事件
    SystemConfigApp.prototype.bindDataSubGroupEvents = function(page) {
        var self = this;
        
        page.querySelectorAll('.edit-group-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var groupId = btn.getAttribute('data-group-id');
                var groups = JSON.parse(localStorage.getItem('ai_data_sub_groups') || '[]');
                var group = groups.find(function(g) { return g.id === groupId; });
                if (group) {
                    self.openDataSubGroupEditor(group, page);
                }
            };
        });
        
        page.querySelectorAll('.delete-group-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var groupId = btn.getAttribute('data-group-id');
                var groups = JSON.parse(localStorage.getItem('ai_data_sub_groups') || '[]');
                
                if (groups.length <= 1) {
                    alert('至少保留一个配置组');
                    return;
                }
                
                if (confirm('确定删除此配置组？')) {
                    groups = groups.filter(function(g) { return g.id !== groupId; });
                    localStorage.setItem('ai_data_sub_groups', JSON.stringify(groups));
                    self.refreshDataSubGroupsList(page);
                    self.refreshAIGroupAssignments(page);
                }
            };
        });
    };
    
    // 打开配置组编辑器
    SystemConfigApp.prototype.openDataSubGroupEditor = function(group, parentPage) {
        var self = this;
        var isNew = !group;
        
        if (isNew) {
            group = {
                id: 'group_' + Date.now(),
                name: '新配置组',
                weather: true,
                userCity: true,
                userProfile: true,
                time: true,
                shopWishlist: true,
                shopBalance: false
            };
        }
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">' + (isNew ? '新建' : '编辑') + '预设组</div>';
        
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        
        html += '<div style="margin-bottom:20px;">';
        html += '<label style="display:block;font-size:14px;color:#666;margin-bottom:8px;">名称</label>';
        html += '<input type="text" id="group-name" value="' + group.name + '" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:10px;font-size:14px;box-sizing:border-box;">';
        html += '</div>';
        
        var items = [
            { id: 'weather', name: '天气App数据', desc: 'AI可读取天气信息' },
            { id: 'userCity', name: '用户城市', desc: 'AI可获知用户所在城市' },
            { id: 'userProfile', name: '用户身份', desc: 'AI可获知用户姓名、职业等' },
            { id: 'time', name: '当前时间', desc: 'AI可获知日期和时间' },
            { id: 'shopWishlist', name: '购物心愿单', desc: 'AI可看到用户想要的商品' },
            { id: 'shopBalance', name: '账户余额', desc: 'AI可了解用户财务状况' }
        ];
        
        items.forEach(function(item, index) {
            var isEnabled = group[item.id] !== false;
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;' + (index < items.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : '') + '">';
            html += '<div>';
            html += '<div style="font-size:14px;color:#333;">' + item.name + '</div>';
            html += '<div style="font-size:11px;color:#999;margin-top:2px;">' + item.desc + '</div>';
            html += '</div>';
            html += '<label style="position:relative;width:50px;height:28px;">';
            html += '<input type="checkbox" id="group-' + item.id + '" ' + (isEnabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
            html += '<span class="toggle-track" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (isEnabled ? '#34C759' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
            html += '<span class="toggle-dot" style="position:absolute;height:22px;width:22px;left:3px;bottom:3px;background-color:white;border-radius:50%;transition:0.3s;transform:' + (isEnabled ? 'translateX(22px)' : 'translateX(0)') + ';box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
            html += '</label>';
            html += '</div>';
        });
        
        html += '</div>';
        
        html += '<button id="save-group-btn" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">保存</button>';
        
        html += '</div>';
        
        var editorPage = this.openDetailPage(html);
        
        // 绑定开关事件
        editorPage.querySelectorAll('input[type="checkbox"]').forEach(function(toggle) {
            toggle.onchange = function() {
                var track = toggle.parentElement.querySelector('.toggle-track');
                var dot = toggle.parentElement.querySelector('.toggle-dot');
                if (toggle.checked) {
                    track.style.backgroundColor = '#34C759';
                    dot.style.transform = 'translateX(22px)';
                } else {
                    track.style.backgroundColor = '#ccc';
                    dot.style.transform = 'translateX(0)';
                }
            };
        });
        
        // 保存按钮
        var saveBtn = editorPage.querySelector('#save-group-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var newGroup = {
                    id: group.id,
                    name: editorPage.querySelector('#group-name').value.trim() || '未命名',
                    weather: editorPage.querySelector('#group-weather').checked,
                    userCity: editorPage.querySelector('#group-userCity').checked,
                    userProfile: editorPage.querySelector('#group-userProfile').checked,
                    time: editorPage.querySelector('#group-time').checked,
                    shopWishlist: editorPage.querySelector('#group-shopWishlist').checked,
                    shopBalance: editorPage.querySelector('#group-shopBalance').checked
                };
                
                var groups = JSON.parse(localStorage.getItem('ai_data_sub_groups') || '[]');
                
                if (isNew) {
                    groups.push(newGroup);
                } else {
                    var index = groups.findIndex(function(g) { return g.id === group.id; });
                    if (index !== -1) {
                        groups[index] = newGroup;
                    }
                }
                
                localStorage.setItem('ai_data_sub_groups', JSON.stringify(groups));
                
                PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                editorPage.querySelector('.app-back-btn').click();
                
                setTimeout(function() {
                    self.refreshDataSubGroupsList(parentPage);
                    self.refreshAIGroupAssignments(parentPage);
                }, 100);
            };
        }
    };
    
    // 刷新配置组列表
    SystemConfigApp.prototype.refreshDataSubGroupsList = function(page) {
        var self = this;
        var container = page.querySelector('#data-sub-groups-list');
        if (!container) return;
        
        var groups = JSON.parse(localStorage.getItem('ai_data_sub_groups') || '[]');
        if (groups.length === 0) {
            groups = [{ id: 'default', name: '默认配置', weather: true, userCity: true, userProfile: true, time: true, shopWishlist: true, shopBalance: false }];
            localStorage.setItem('ai_data_sub_groups', JSON.stringify(groups));
        }
        
        var html = '';
        groups.forEach(function(group) {
            html += self.renderDataSubGroupItem(group);
        });
        container.innerHTML = html;
        
        self.bindDataSubGroupEvents(page);
    };
    
    // 刷新AI配置分配
    SystemConfigApp.prototype.refreshAIGroupAssignments = function(page) {
        var container = page.querySelector('#ai-group-assignments');
        if (!container) return;
        
        var groups = JSON.parse(localStorage.getItem('ai_data_sub_groups') || '[]');
        var mainAIs = Object.values(PhoneCore.ais).filter(function(ai) {
            return ai.type === 'main';
        });
        
        var html = '';
        mainAIs.forEach(function(ai, index) {
            var currentGroupId = ai.dataSubscriptions && ai.dataSubscriptions.groupId ? ai.dataSubscriptions.groupId : 'default';
            if (!groups.find(function(g) { return g.id === currentGroupId; })) {
                currentGroupId = groups.length > 0 ? groups[0].id : 'default';
            }
            
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;' + (index < mainAIs.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : '') + '">';
            html += '<div style="display:flex;align-items:center;gap:10px;">';
            if (ai.avatar) {
                html += '<img src="' + ai.avatar + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">';
            } else {
                html += '<div style="width:36px;height:36px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;">AI</div>';
            }
            html += '<div style="font-size:14px;color:#333;">' + ai.name + '</div>';
            html += '</div>';
            html += '<select class="ai-group-select" data-ai-id="' + ai.id + '" style="padding:8px 12px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;background:white;">';
            groups.forEach(function(group) {
                html += '<option value="' + group.id + '"' + (currentGroupId === group.id ? ' selected' : '') + '>' + group.name + '</option>';
            });
            html += '</select>';
            html += '</div>';
        });
        
        container.innerHTML = html;
    };

    // App NPC提示词编辑器
    SystemConfigApp.prototype.openAppNPCPromptEditor = function(appId) {
        var self = this;
        
        PhoneCore.db.get('app_data', appId + '_npc_config').then(function(config) {
            config = config || {
                appId: appId + '_npc_config',
                enabled: true,
                frequency: 'daily',
                prompt: ''
            };
            
            var appNames = {
                'chat-app': '聊天App',
                'sms-app': '短信App',
                'weather-app': '天气App'
            };
            
            var html = '<div style="padding:20px;">';
            html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">' + (appNames[appId] || appId) + ' NPC设置</div>';
            
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
            
            // 启用开关
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<span>启用NPC生成</span>';
            html += '<label style="position:relative;width:50px;height:28px;">';
            html += '<input type="checkbox" id="npc-enabled" ' + (config.enabled ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">';
            html += '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (config.enabled ? '#34C759' : '#ccc') + ';border-radius:28px;transition:0.3s;"></span>';
            html += '<span style="position:absolute;height:22px;width:22px;left:' + (config.enabled ? '25px' : '3px') + ';bottom:3px;background-color:white;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>';
            html += '</label>';
            html += '</div>';
            
            // 生成频率
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0;">';
            html += '<span>生成频率</span>';
            html += '<select id="npc-frequency" style="padding:8px 12px;border:1px solid #e0e0e0;border-radius:8px;">';
            html += '<option value="hourly"' + (config.frequency === 'hourly' ? ' selected' : '') + '>每小时</option>';
            html += '<option value="daily"' + (config.frequency === 'daily' ? ' selected' : '') + '>每天</option>';
            html += '<option value="weekly"' + (config.frequency === 'weekly' ? ' selected' : '') + '>每周</option>';
            html += '</select>';
            html += '</div>';
            
            html += '</div>';
            
            // 提示词
            html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
            html += '<div style="font-weight:600;margin-bottom:15px;">NPC生成提示词</div>';
            html += '<div style="font-size:11px;color:#746B6E;margin-bottom:10px;">可用变量: {{world}} {{user}} {{time}} {{context}}</div>';
            html += '<textarea id="npc-prompt" placeholder="输入NPC生成提示词..." class="' + S.input + ' sys-input-textarea-tpl" style="font-size:13px;">' + (config.prompt || '') + '</textarea>';
            html += '</div>';
            
            html += '<button id="save-npc-config-btn" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">保存</button>';
            
            html += '</div>';
            
            var page = self.openDetailPage(html);
            
            // 开关交互
            var enabledCheckbox = page.querySelector('#npc-enabled');
            if (enabledCheckbox) {
                enabledCheckbox.onchange = function() {
                    var toggle = enabledCheckbox.parentElement;
                    var slider = toggle.querySelector('span:last-child');
                    var track = toggle.querySelector('span:first-of-type');
                    
                    if (enabledCheckbox.checked) {
                        track.style.backgroundColor = '#34C759';
                        slider.style.left = '25px';
                    } else {
                        track.style.backgroundColor = '#ccc';
                        slider.style.left = '3px';
                    }
                };
            }
            
            // 保存
            var saveBtn = page.querySelector('#save-npc-config-btn');
            if (saveBtn) {
                saveBtn.onclick = function() {
                    config.enabled = page.querySelector('#npc-enabled').checked;
                    config.frequency = page.querySelector('#npc-frequency').value;
                    config.prompt = page.querySelector('#npc-prompt').value;
                    
                    PhoneCore.db.put('app_data', config).then(function() {
                        PhoneCore.notifications.send({
                            type: 'success',
                            title: '保存成功',
                            message: 'NPC设置已更新',
                            icon: '✅',
                            size: 'mini',
                            duration: 2000
                        });
                        page.querySelector('.app-back-btn').click();
                    });
                };
            }
        });
    };

    // ============ 页面4: API配置 ============
    SystemConfigApp.prototype.renderAPIPage = function() {
        var S = this.STYLES;
        var I = this.SVG;
        var html = '<div class="' + S.pageWrap + '">';
        
        // 新建API配置
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">';
        html += '<div style="font-size:22px;font-weight:700;color:#333;">API配置</div>';
        html += '<button id="add-api-config-btn" class="' + S.primaryButton + ' sys-btn-flex-6 sys-btn-add">' + I.plus + ' 新建</button>';
        html += '</div>';
        
        // 总消耗统计 - 优雅粉紫渐变
        var totalTokens = PhoneCore.api.getTotalTokensUsage();
        html += '<div class="config-card" style="background:linear-gradient(135deg,#FF8FAB,#C77DFF);border-radius:24px;padding:24px;color:white;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(199,125,255,0.3);">';
        html += '<div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:radial-gradient(circle,rgba(255,255,255,0.2),transparent);border-radius:50%;"></div>';
        html += '<div style="font-size:13px;opacity:0.9;font-weight:500;">总Tokens消耗</div>';
        html += '<div style="font-size:36px;font-weight:700;margin-top:12px;letter-spacing:-0.5px;">' + totalTokens.toLocaleString() + '</div>';
        html += '</div>';
        
        // API配置列表
        var configs = Object.values(PhoneCore.api.configs);
        
        if (configs.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty-schedule">';
            html += '<div style="width:64px;height:64px;margin:0 auto 16px;background:linear-gradient(135deg,rgba(255,182,193,0.2),rgba(255,218,233,0.3));border-radius:50%;display:flex;align-items:center;justify-content:center;">';
            html += '<span style="color:#FF8FAB;transform:scale(1.3);">' + I.key + '</span>';
            html += '</div>';
            html += '<div style="color:#999;font-size:14px;">暂无API配置，点击新建开始</div>';
            html += '</div>';
        } else {
            configs.forEach(function(config) {
                var tokens = PhoneCore.api.getTokensUsage(config.id);
                var tokenDetail = PhoneCore.api.getTokensUsageDetail ? PhoneCore.api.getTokensUsageDetail(config.id) : { input: 0, output: 0 };
                var errorCount = PhoneCore.api.errorHistory && PhoneCore.api.errorHistory[config.id] ? PhoneCore.api.errorHistory[config.id].length : 0;
                html += '<div class="api-config-card ' + S.glassCard + ' sys-card-clickable" data-config-id="' + config.id + '" style="margin-bottom:12px;position:relative;">';
                
                // 复制按钮
                html += '<button class="api-copy-btn" data-config-id="' + config.id + '" style="position:absolute;top:12px;right:12px;width:28px;height:28px;border:none;background:rgba(78,205,196,0.15);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;" title="复制此配置">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
                html += '</button>';
                
                html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-right:36px;">';
                html += '<div style="flex:1;">';
                html += '<div style="font-weight:600;font-size:16px;color:#333;">' + config.name + '</div>';
                html += '<div style="font-size:12px;color:#888;margin-top:6px;">' + (config.baseUrl || '未设置').substring(0, 28) + (config.baseUrl && config.baseUrl.length > 28 ? '...' : '') + '</div>';
                html += '<div style="font-size:12px;color:#FF6B8A;margin-top:4px;font-weight:500;">模型: ' + (config.model || '未设置') + '</div>';
                html += '</div>';
                html += '<div style="text-align:right;">';
                
                // 余额估算显示
                if (config.initialBalance > 0 && (config.inputPrice > 0 || config.outputPrice > 0)) {
                    var inputTokens = tokenDetail.input || 0;
                    var outputTokens = tokenDetail.output || 0;
                    var inputCost = (inputTokens / 1000000) * (config.inputPrice || 0);
                    var outputCost = (outputTokens / 1000000) * (config.outputPrice || 0);
                    var totalCost = inputCost + outputCost;
                    var remainingBalance = config.initialBalance - totalCost;
                    var balanceColor = remainingBalance > config.initialBalance * 0.3 ? '#34C759' : (remainingBalance > config.initialBalance * 0.1 ? '#FF9500' : '#FF3B30');
                    
                    html += '<div style="font-size:16px;font-weight:700;color:' + balanceColor + ';">¥' + remainingBalance.toFixed(2) + '</div>';
                    html += '<div style="font-size:11px;color:#999;">剩余余额</div>';
                    html += '<div style="font-size:10px;color:#BBB;margin-top:2px;">已用 ¥' + totalCost.toFixed(4) + '</div>';
                } else {
                    html += '<div style="font-size:16px;font-weight:700;color:#C77DFF;">' + tokens.toLocaleString() + '</div>';
                    html += '<div style="font-size:11px;color:#999;">tokens</div>';
                }
                
                html += '</div>';
                html += '</div>';
                if (config.usageLimit > 0) {
                    var usage = PhoneCore.api.usageCount[config.id] || 0;
                    var percentage = (usage / config.usageLimit * 100).toFixed(0);
                    html += '<div style="margin-top:16px;">';
                    html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#888;margin-bottom:6px;">';
                    html += '<span>使用次数</span>';
                    html += '<span style="font-weight:600;">' + usage + '/' + config.usageLimit + '</span>';
                    html += '</div>';
                    html += '<div style="height:6px;background:rgba(255,182,193,0.2);border-radius:3px;overflow:hidden;">';
                    html += '<div style="height:100%;width:' + percentage + '%;background:linear-gradient(90deg,#FF8FAB,#C77DFF);border-radius:3px;transition:width 0.3s ease;"></div>';
                    html += '</div>';
                    html += '</div>';
                }
                html += '</div>';
            });
        }
        
        // API组管理
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin:32px 0 16px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<span style="color:#4ECDC4;">' + I.folder + '</span>';
        html += '<span style="font-size:17px;font-weight:700;color:#333;">API组</span>';
        html += '</div>';
        html += '<button id="add-api-group-btn" style="background:rgba(78,205,196,0.15);color:#4ECDC4;border:none;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;">' + I.plus + ' 新建组</button>';
        html += '</div>';
        
        var groups = Object.values(PhoneCore.api.groups);
        
        if (groups.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty">';
            html += '<div style="color:#999;font-size:14px;">暂无API组</div>';
            html += '<div style="font-size:12px;color:#BBB;margin-top:6px;">API组可以实现自动切换和负载均衡</div>';
            html += '</div>';
        } else {
            groups.forEach(function(group) {
                html += '<div class="api-group-card ' + S.glassCard + ' sys-card-clickable" data-group-id="' + group.id + '" style="margin-bottom:12px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                html += '<div>';
                html += '<div style="font-weight:600;font-size:15px;color:#333;">' + group.name + '</div>';
                html += '<div style="font-size:12px;color:#888;margin-top:4px;">' + group.configIds.length + ' 个配置 · ' + (group.mode === 'failover' ? '故障转移' : '轮询') + '</div>';
                html += '</div>';
                html += '<span style="color:#CCC;">' + I.arrow_right + '</span>';
                html += '</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        
        return html;
    };

    SystemConfigApp.prototype.bindAPIPageEvents = function(container) {
        var self = this;
        
        // 新建API配置
        var addConfigBtn = container.querySelector('#add-api-config-btn');
        if (addConfigBtn) {
            addConfigBtn.onclick = function() {
                self.openAPIConfigEditor(null);
            };
        }
        
        // API配置复制按钮
        container.querySelectorAll('.api-copy-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var configId = btn.getAttribute('data-config-id');
                self.duplicateAPIConfig(configId);
            };
        });
        
        // API配置卡片点击
        container.querySelectorAll('.api-config-card').forEach(function(card) {
            card.onclick = function(e) {
                if (e.target.closest('.api-copy-btn')) return;
                var configId = card.getAttribute('data-config-id');
                self.openAPIConfigEditor(configId);
            };
        });
        
        // 新建API组
        var addGroupBtn = container.querySelector('#add-api-group-btn');
        if (addGroupBtn) {
            addGroupBtn.onclick = function() {
                self.openAPIGroupEditor(null);
            };
        }
        
        // API组卡片点击
        container.querySelectorAll('.api-group-card').forEach(function(card) {
            card.onclick = function() {
                var groupId = card.getAttribute('data-group-id');
                self.openAPIGroupEditor(groupId);
            };
        });
    };

    // 复制API配置
    SystemConfigApp.prototype.duplicateAPIConfig = function(configId) {
        var self = this;
        var originalConfig = PhoneCore.api.configs[configId];
        if (!originalConfig) return;
        
        // 创建副本
        var newConfig = JSON.parse(JSON.stringify(originalConfig));
        newConfig.id = 'api_' + Date.now();
        newConfig.name = originalConfig.name + '（副本）';
        
        // 重置使用统计（新副本从0开始）
        // 不复制initialBalance，让用户重新设置
        
        PhoneCore.api.configs[newConfig.id] = newConfig;
        
        PhoneCore.saveAPIConfig(newConfig).then(function() {
            self.refreshCurrentTab();
            // 显示提示
            if (window.PhoneCore && PhoneCore.showToast) {
                PhoneCore.showToast('已复制: ' + newConfig.name);
            }
        });
    };

    // 显示API错误日志
    SystemConfigApp.prototype.showAPIErrorLog = function(configId) {
        var self = this;
        var S = this.STYLES;
        var config = PhoneCore.api.configs[configId];
        var errorHistory = PhoneCore.api.errorHistory && PhoneCore.api.errorHistory[configId] ? PhoneCore.api.errorHistory[configId] : [];
        
        if (!config) return;
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:8px;color:#333;">错误日志</div>';
        html += '<div style="font-size:14px;color:#888;margin-bottom:24px;">' + config.name + '</div>';
        
        if (errorHistory.length === 0) {
            html += '<div class="' + S.glassCard + ' sys-card-empty-schedule">';
            html += '<div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(52,199,89,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;">';
            html += '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
            html += '</div>';
            html += '<div style="color:#34C759;font-size:16px;font-weight:500;">暂无错误记录</div>';
            html += '<div style="color:#999;font-size:13px;margin-top:8px;">API运行正常</div>';
            html += '</div>';
        } else {
            // 复制所有错误按钮
            html += '<button id="copy-all-errors-btn" class="' + S.secondaryButton + ' sys-btn-full" style="margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
            html += ' 复制全部错误日志（' + errorHistory.length + '条）';
            html += '</button>';
            
            // 清除错误按钮
            html += '<button id="clear-errors-btn" style="width:100%;margin-bottom:20px;padding:12px;background:rgba(255,59,48,0.1);color:#FF3B30;border:none;border-radius:12px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
            html += ' 清除全部错误记录';
            html += '</button>';
            
            // 错误列表（最新的在前面）
            var reversedErrors = errorHistory.slice().reverse();
            reversedErrors.forEach(function(error, index) {
                var date = new Date(error.timestamp);
                var timeStr = date.toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                html += '<div class="error-item ' + S.glassCard + '" style="margin-bottom:12px;position:relative;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">';
                html += '<div style="display:flex;align-items:center;gap:8px;">';
                html += '<div style="width:24px;height:24px;background:rgba(255,59,48,0.15);border-radius:6px;display:flex;align-items:center;justify-content:center;">';
                html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
                html += '</div>';
                html += '<span style="font-size:12px;color:#888;">' + timeStr + '</span>';
                html += '</div>';
                html += '<button class="copy-single-error-btn" data-error-index="' + (errorHistory.length - 1 - index) + '" style="padding:6px 12px;background:rgba(78,205,196,0.15);color:#4ECDC4;border:none;border-radius:8px;font-size:11px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;">';
                html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> 复制';
                html += '</button>';
                html += '</div>';
                html += '<div style="font-size:13px;color:#FF3B30;word-break:break-all;line-height:1.5;padding:12px;background:rgba(255,59,48,0.05);border-radius:10px;font-family:monospace;">' + self.escapeHtml(error.message) + '</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 绑定复制全部按钮
        var copyAllBtn = page.querySelector('#copy-all-errors-btn');
        if (copyAllBtn) {
            copyAllBtn.onclick = function() {
                var logText = '=== API错误日志 ===\n';
                logText += '配置名称: ' + config.name + '\n';
                logText += '配置ID: ' + configId + '\n';
                logText += 'Base URL: ' + (config.baseUrl || '未设置') + '\n';
                logText += '模型: ' + (config.model || '未设置') + '\n';
                logText += '导出时间: ' + new Date().toLocaleString('zh-CN') + '\n';
                logText += '错误数量: ' + errorHistory.length + '\n';
                logText += '==================\n\n';
                
                errorHistory.forEach(function(error, index) {
                    var date = new Date(error.timestamp);
                    logText += '[' + (index + 1) + '] ' + date.toLocaleString('zh-CN') + '\n';
                    logText += error.message + '\n\n';
                });
                
                self.copyToClipboard(logText, '已复制全部错误日志');
            };
        }
        
        // 绑定清除错误按钮
        var clearBtn = page.querySelector('#clear-errors-btn');
        if (clearBtn) {
            clearBtn.onclick = function() {
                if (confirm('确定要清除此配置的所有错误记录吗？')) {
                    if (PhoneCore.api.errorHistory) {
                        PhoneCore.api.errorHistory[configId] = [];
                    }
                    if (window.PhoneCore && PhoneCore.showToast) {
                        PhoneCore.showToast('已清除错误记录');
                    }
                    self.closeDetailPage();
                    self.refreshCurrentTab();
                }
            };
        }
        
        // 绑定复制单条错误按钮
        page.querySelectorAll('.copy-single-error-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var errorIndex = parseInt(btn.getAttribute('data-error-index'));
                var error = errorHistory[errorIndex];
                if (error) {
                    var date = new Date(error.timestamp);
                    var logText = '[' + date.toLocaleString('zh-CN') + ']\n' + error.message;
                    self.copyToClipboard(logText, '已复制错误信息');
                }
            };
        });
    };

    // 复制到剪贴板
    SystemConfigApp.prototype.copyToClipboard = function(text, successMessage) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function() {
                if (window.PhoneCore && PhoneCore.showToast) {
                    PhoneCore.showToast(successMessage || '已复制到剪贴板');
                }
            }).catch(function() {
                // fallback
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    if (window.PhoneCore && PhoneCore.showToast) {
                        PhoneCore.showToast(successMessage || '已复制到剪贴板');
                    }
                } catch (e) {
                    console.error('复制失败:', e);
                }
                document.body.removeChild(textarea);
            });
        } else {
            // fallback for older browsers
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                if (window.PhoneCore && PhoneCore.showToast) {
                    PhoneCore.showToast(successMessage || '已复制到剪贴板');
                }
            } catch (e) {
                console.error('复制失败:', e);
            }
            document.body.removeChild(textarea);
        }
    };

    // HTML转义
    SystemConfigApp.prototype.escapeHtml = function(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // API配置编辑器
    SystemConfigApp.prototype.openAPIConfigEditor = function(configId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var config = configId ? PhoneCore.api.configs[configId] : null;
        var isNew = !config;
        
        if (isNew) {
            config = {
                id: 'api_' + Date.now(),
                name: '',
                baseUrl: '',
                apiKey: '',
                model: '',
                maxTokens: 4096,
                temperature: 0.7,
                usageLimit: 0
            };
        }
        
        var html = '<div class="' + S.pageWrap + '">';
        html += '<div style="font-size:22px;font-weight:700;margin-bottom:24px;color:#333;">' + (isNew ? '新建API配置' : '编辑API配置') + '</div>';
        
        html += '<div class="config-card ' + S.glassCard + '">';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">配置名称</label>';
        html += '<input type="text" id="api-name" value="' + (config.name || '') + '" placeholder="如：OpenAI主账号" class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">API Base URL</label>';
        html += '<input type="text" id="api-base-url" value="' + (config.baseUrl || '') + '" placeholder="如：https://api.openai.com" class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">API Key</label>';
        html += '<input type="password" id="api-key" value="' + (config.apiKey || '') + '" placeholder="sk-..." class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">模型</label>';
        html += '<div style="display:flex;gap:10px;">';
        html += '<input type="text" id="api-model" value="' + (config.model || '') + '" placeholder="如：gpt-4" class="' + S.input + '" style="flex:1;">';
        html += '<button id="fetch-models-btn" class="' + S.secondaryButton + '" style="white-space:nowrap;">获取</button>';
        html += '</div>';
        html += '<div id="models-list" style="margin-top:12px;"></div>';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">Max Tokens</label>';
        html += '<input type="number" id="api-max-tokens" value="' + (config.maxTokens || 4096) + '" class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">Temperature (0-2)</label>';
        html += '<input type="number" id="api-temperature" value="' + (config.temperature || 0.7) + '" min="0" max="2" step="0.1" class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:18px;">';
        html += '<label class="' + S.label + '">使用次数限制（0为不限制）</label>';
        html += '<input type="number" id="api-usage-limit" value="' + (config.usageLimit || 0) + '" min="0" class="' + S.input + '">';
        html += '</div>';
        
        html += '</div>';
        
        // 余额估算配置卡片
        html += '<div class="config-card ' + S.glassCard + '" style="margin-top:16px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
        html += '<span style="font-weight:600;font-size:15px;color:#333;">余额估算</span>';
        html += '<span style="font-size:11px;color:#999;margin-left:auto;">用于估算API使用成本</span>';
        html += '</div>';
        
        html += '<div style="margin-bottom:14px;">';
        html += '<label class="' + S.label + '">初始余额（元）</label>';
        html += '<input type="number" id="api-initial-balance" value="' + (config.initialBalance || 0) + '" min="0" step="0.01" placeholder="如：100.00" class="' + S.input + '">';
        html += '<div style="font-size:11px;color:#999;margin-top:4px;">填写您在该API服务的当前余额</div>';
        html += '</div>';
        
        html += '<div style="display:flex;gap:12px;margin-bottom:14px;">';
        html += '<div style="flex:1;">';
        html += '<label class="' + S.label + '">输入价格（元/百万tokens）</label>';
        html += '<input type="number" id="api-input-price" value="' + (config.inputPrice || 0) + '" min="0" step="0.001" placeholder="如：0.15" class="' + S.input + '">';
        html += '</div>';
        html += '<div style="flex:1;">';
        html += '<label class="' + S.label + '">输出价格（元/百万tokens）</label>';
        html += '<input type="number" id="api-output-price" value="' + (config.outputPrice || 0) + '" min="0" step="0.001" placeholder="如：0.60" class="' + S.input + '">';
        html += '</div>';
        html += '</div>';
        
        html += '<div style="font-size:11px;color:#888;padding:10px;background:rgba(52,199,89,0.1);border-radius:8px;">';
        html += '<div style="font-weight:500;color:#34C759;margin-bottom:4px;">计算说明</div>';
        html += '剩余余额 = 初始余额 - (输入tokens × 输入价格 + 输出tokens × 输出价格) / 1000000<br>';
        html += '价格请参考您的API服务商定价页面';
        html += '</div>';
        
        html += '</div>';
        
        // 测试按钮
        html += '<button id="test-api-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#FFB74D,#FF9800);color:white;border:none;border-radius:14px;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:16px;box-shadow:0 4px 12px rgba(255,152,0,0.3);display:flex;align-items:center;justify-content:center;gap:8px;">' + I.gear + ' 测试连接</button>';
        html += '<div id="test-result" style="margin-bottom:16px;"></div>';
        
        html += '<button id="save-api-config-btn" class="' + S.primaryButton + ' sys-btn-full">保存</button>';
        
        if (!isNew) {
            // 错误日志入口（如果有错误记录才显示）
            var errorCount = PhoneCore.api.errorHistory && PhoneCore.api.errorHistory[configId] ? PhoneCore.api.errorHistory[configId].length : 0;
            if (errorCount > 0) {
                html += '<button id="view-error-log-btn" style="width:100%;padding:14px;background:rgba(255,59,48,0.1);color:#FF3B30;border:none;border-radius:14px;font-size:14px;font-weight:500;cursor:pointer;margin-top:12px;display:flex;align-items:center;justify-content:center;gap:8px;">';
                html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
                html += '查看错误日志（' + errorCount + '条）';
                html += '</button>';
            }
            
            html += '<button id="delete-api-config-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:14px;font-size:15px;font-weight:500;cursor:pointer;margin-top:12px;">删除配置</button>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 获取模型列表
        var fetchModelsBtn = page.querySelector('#fetch-models-btn');
        if (fetchModelsBtn) {
            fetchModelsBtn.onclick = function() {
                var baseUrl = page.querySelector('#api-base-url').value.trim();
                var apiKey = page.querySelector('#api-key').value.trim();
                
                if (!baseUrl || !apiKey) {
                    alert('请先填写API地址和Key');
                    return;
                }
                
                fetchModelsBtn.textContent = '获取中...';
                fetchModelsBtn.disabled = true;
                
                PhoneCore.api.fetchModels(baseUrl, apiKey).then(function(models) {
                    var modelsList = page.querySelector('#models-list');
                    if (models.length === 0) {
                        modelsList.innerHTML = '<div style="color:#999;font-size:12px;">未获取到模型</div>';
                    } else {
                        var html = '<div style="max-height:200px;overflow-y:auto;padding:4px;">';
                        html += '<div style="font-size:11px;color:#666;margin-bottom:8px;">共 ' + models.length + ' 个模型，点击选择：</div>';
                        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
                        models.forEach(function(model) {
                            var modelId = model.id || model;
                            html += '<button class="model-select-btn" data-model="' + modelId + '" style="padding:6px 12px;background:#f0f0f0;border:none;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background=\'#e0e0e0\'" onmouseout="this.style.background=\'#f0f0f0\'">' + modelId + '</button>';
                        });
                        html += '</div></div>';
                        modelsList.innerHTML = html;
                        
                        modelsList.querySelectorAll('.model-select-btn').forEach(function(btn) {
                            btn.onclick = function() {
                                page.querySelector('#api-model').value = btn.getAttribute('data-model');
                                modelsList.innerHTML = '';
                            };
                        });
                    }
                }).catch(function(err) {
                    page.querySelector('#models-list').innerHTML = '<div style="color:#FF3B30;font-size:12px;">获取失败: ' + err.message + '</div>';
                }).finally(function() {
                    fetchModelsBtn.textContent = '获取';
                    fetchModelsBtn.disabled = false;
                });
            };
        }
        
        // 测试连接
        var testBtn = page.querySelector('#test-api-btn');
        if (testBtn) {
            testBtn.onclick = function() {
                var baseUrl = page.querySelector('#api-base-url').value.trim();
                var apiKey = page.querySelector('#api-key').value.trim();
                var model = page.querySelector('#api-model').value.trim();
                
                if (!baseUrl || !apiKey || !model) {
                    alert('请填写完整配置');
                    return;
                }
                
                testBtn.textContent = '测试中...';
                testBtn.disabled = true;
                
                var testResultDiv = page.querySelector('#test-result');
                
                fetch(baseUrl + '/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + apiKey
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: '你好' }],
                        max_tokens: 10
                    })
                }).then(function(response) {
                    return response.json();
                }).then(function(data) {
                    if (data.error) {
                        testResultDiv.innerHTML = '<div style="padding:15px;background:#FFEBEE;border-radius:10px;color:#FF3B30;">❌ 测试失败: ' + data.error.message + '</div>';
                    } else if (data.choices && data.choices[0]) {
                        testResultDiv.innerHTML = '<div style="padding:15px;background:#E8F5E9;border-radius:10px;color:#34C759;">✅ 连接成功！返回: ' + data.choices[0].message.content + '</div>';
                    } else {
                        testResultDiv.innerHTML = '<div style="padding:15px;background:#FFF3E0;border-radius:10px;color:#FF9500;">⚠️ 返回格式异常</div>';
                    }
                }).catch(function(err) {
                    testResultDiv.innerHTML = '<div style="padding:15px;background:#FFEBEE;border-radius:10px;color:#FF3B30;">❌ 请求失败: ' + err.message + '</div>';
                }).finally(function() {
                    testBtn.textContent = '测试连接';
                    testBtn.disabled = false;
                });
            };
        }
        
        // 保存
        var saveBtn = page.querySelector('#save-api-config-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var name = page.querySelector('#api-name').value.trim();
                var baseUrl = page.querySelector('#api-base-url').value.trim();
                var apiKey = page.querySelector('#api-key').value.trim();
                var model = page.querySelector('#api-model').value.trim();
                var maxTokens = parseInt(page.querySelector('#api-max-tokens').value) || 4096;
                var temperature = parseFloat(page.querySelector('#api-temperature').value) || 0.7;
                var usageLimit = parseInt(page.querySelector('#api-usage-limit').value) || 0;
                
                // 余额估算字段
                var initialBalance = parseFloat(page.querySelector('#api-initial-balance').value) || 0;
                var inputPrice = parseFloat(page.querySelector('#api-input-price').value) || 0;
                var outputPrice = parseFloat(page.querySelector('#api-output-price').value) || 0;
                
                if (!name) {
                    alert('请输入配置名称');
                    return;
                }
                
                config.name = name;
                config.baseUrl = baseUrl;
                config.apiKey = apiKey;
                config.model = model;
                config.maxTokens = maxTokens;
                config.temperature = temperature;
                config.usageLimit = usageLimit;
                
                // 保存余额估算设置
                config.initialBalance = initialBalance;
                config.inputPrice = inputPrice;
                config.outputPrice = outputPrice;
                
                PhoneCore.api.configs[config.id] = config;
                
                PhoneCore.saveAPIConfig(config).then(function() {
                    PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                });
            };
        }
        
        // 查看错误日志
        var errorLogBtn = page.querySelector('#view-error-log-btn');
        if (errorLogBtn) {
            errorLogBtn.onclick = function() {
                self.showAPIErrorLog(configId);
            };
        }
        
        // 删除
        var deleteBtn = page.querySelector('#delete-api-config-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此API配置？')) {
                    PhoneCore.deleteAPIConfig(configId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.refreshCurrentTab();
                    });
                }
            };
        }
    };

    // API组编辑器
    SystemConfigApp.prototype.openAPIGroupEditor = function(groupId) {
        var self = this;
        var S = this.STYLES;
        var I = this.SVG;
        var group = groupId ? PhoneCore.api.groups[groupId] : null;
        var isNew = !group;
        
        if (isNew) {
            group = {
                id: 'group_' + Date.now(),
                name: '',
                configIds: [],
                mode: 'failover',
                type: 'group'
            };
        }
        
        var html = '<div style="padding:20px;">';
        html += '<div style="font-size:20px;font-weight:600;margin-bottom:20px;">' + (isNew ? '新建API组' : '编辑API组') + '</div>';
        
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        
        html += '<div style="margin-bottom:15px;">';
        html += '<label class="' + S.label + '">组名称</label>';
        html += '<input type="text" id="group-name" value="' + (group.name || '') + '" placeholder="如：备用API组" class="' + S.input + '">';
        html += '</div>';
        
        html += '<div style="margin-bottom:15px;">';
        html += '<label class="' + S.label + '">切换模式</label>';
        html += '<select id="group-mode" class="' + S.select + '">';
        html += '<option value="failover"' + (group.mode === 'failover' ? ' selected' : '') + '>故障转移（失败时切换下一个）</option>';
        html += '<option value="round-robin"' + (group.mode === 'round-robin' ? ' selected' : '') + '>轮询（依次使用每个配置）</option>';
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        
        // 选择API配置
        html += '<div class="config-card" style="background:white;border-radius:16px;padding:20px;margin-bottom:20px;">';
        html += '<div style="font-weight:600;margin-bottom:15px;">选择API配置</div>';
        
        var allConfigs = Object.values(PhoneCore.api.configs);
        
        if (allConfigs.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:#999;">暂无API配置，请先创建</div>';
        } else {
            allConfigs.forEach(function(config) {
                var isSelected = group.configIds.includes(config.id);
                html += '<div class="config-select-item" style="display:flex;align-items:center;padding:12px;background:#f8f8f8;border-radius:10px;margin-bottom:8px;cursor:pointer;">';
                html += '<input type="checkbox" class="config-checkbox" data-config-id="' + config.id + '" ' + (isSelected ? 'checked' : '') + ' style="width:20px;height:20px;margin-right:12px;">';
                html += '<div style="flex:1;">';
                html += '<div style="font-weight:500;">' + config.name + '</div>';
                html += '<div style="font-size:12px;color:#666;">' + (config.model || '未设置模型') + '</div>';
                html += '</div>';
                html += '</div>';
            });
        }
        
        html += '</div>';
        
        html += '<button id="save-group-btn" style="width:100%;padding:15px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">保存</button>';
        
        if (!isNew) {
            html += '<button id="delete-group-btn" style="width:100%;padding:15px;background:transparent;color:#FF3B30;border:none;border-radius:12px;font-size:16px;cursor:pointer;margin-top:10px;">删除API组</button>';
        }
        
        html += '</div>';
        
        var page = this.openDetailPage(html);
        
        // 保存
        var saveBtn = page.querySelector('#save-group-btn');
        if (saveBtn) {
            saveBtn.onclick = function() {
                var name = page.querySelector('#group-name').value.trim();
                var mode = page.querySelector('#group-mode').value;
                
                if (!name) {
                    alert('请输入组名称');
                    return;
                }
                
                var selectedConfigs = [];
                page.querySelectorAll('.config-checkbox:checked').forEach(function(checkbox) {
                    selectedConfigs.push(checkbox.getAttribute('data-config-id'));
                });
                
                if (selectedConfigs.length === 0) {
                    alert('请至少选择一个API配置');
                    return;
                }
                
                group.name = name;
                group.mode = mode;
                group.configIds = selectedConfigs;
                group.type = 'group';
                
                PhoneCore.api.groups[group.id] = group;
                PhoneCore.api.currentConfigIndex[group.id] = 0;
                
                PhoneCore.saveAPIConfig(group).then(function() {
                    PhoneCore.notifications.send({ type: 'success', title: '保存成功',  size: 'mini' });
                    page.querySelector('.app-back-btn').click();
                    self.refreshCurrentTab();
                });
            };
        }
        
        // 删除
        var deleteBtn = page.querySelector('#delete-group-btn');
        if (deleteBtn) {
            deleteBtn.onclick = function() {
                if (confirm('确定删除此API组？')) {
                    delete PhoneCore.api.groups[groupId];
                    PhoneCore.db.delete('api_configs', groupId).then(function() {
                        page.querySelector('.app-back-btn').click();
                        self.refreshCurrentTab();
                    });
                }
            };
        }
    };

    // ============ Tab切换逻辑 ============
    SystemConfigApp.prototype.bindTabEvents = function() {
        if (this.tabs.length === 0) return;
        
        var self = this;
        var tabItems = this.appWindow.querySelectorAll('.app-tab-item');
        var contentArea = this.appWindow.querySelector('#main-content-area');
        
        tabItems.forEach(function(item, index) {
            item.onclick = function(e) {
                e.stopPropagation();
                if (index === self.currentTabIndex) return;
                
                tabItems.forEach(function(t) { t.classList.remove('active'); });
                item.classList.add('active');
                
                self.currentTabIndex = index;
                self.renderTabContent(contentArea, index);
            };
        });
        
        // 初始渲染第一个Tab
        this.renderTabContent(contentArea, 0);
    };

    SystemConfigApp.prototype.renderTabContent = function(container, tabIndex) {
        var html = '';
        
        switch (tabIndex) {
            case 0:
                html = this.renderPersonalPage();
                break;
            case 1:
                html = this.renderWorldPage();
                break;
            case 2:
                html = this.renderAIPage();
                break;
            case 3:
                html = this.renderAPIPage();
                break;
        }
        
        // 使用更高效的DOM更新方式
        // 先清空容器，再使用insertAdjacentHTML插入
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        container.insertAdjacentHTML('afterbegin', html);
        
        this.bindCurrentTabEvents(container, tabIndex);
    };

    SystemConfigApp.prototype.bindCurrentTabEvents = function(container, tabIndex) {
        switch (tabIndex) {
            case 0:
                this.bindPersonalPageEvents(container);
                break;
            case 1:
                this.bindWorldPageEvents(container);
                break;
            case 2:
                this.bindAIPageEvents(container);
                break;
            case 3:
                this.bindAPIPageEvents(container);
                break;
        }
    };

    SystemConfigApp.prototype.refreshCurrentTab = function() {
        var contentArea = this.appWindow.querySelector('#main-content-area');
        if (contentArea) {
            this.renderTabContent(contentArea, this.currentTabIndex);
        }
    };

    // ============ 时间表小组件支持 ============
    
    /* 【获取支持的小组件类型】 */
    SystemConfigApp.prototype.getWidgetTypes = function() {
        return [
            { size: 'small', type: 'schedule', name: '时间表(小)' },
            { size: 'medium', type: 'schedule', name: '时间表(中)' },
            { size: 'large', type: 'schedule', name: '时间表(大)' }
        ];
    };
    
    /* 【渲染小组件】 */
    SystemConfigApp.prototype.renderWidget = function(size, data) {
        var I = this.SVG;
        var scheduleId = data.scheduleId;
        
        // 如果没有指定时间表，尝试获取用户绑定的时间表
        if (!scheduleId) {
            if (PhoneCore.user) {
                // 优先使用当前面具的时间表
                var mask = PhoneCore.user.getCurrentMask();
                if (mask && mask.scheduleId) {
                    scheduleId = mask.scheduleId;
                } else if (PhoneCore.user.realInfo.scheduleId) {
                    // 使用真实身份的时间表
                    scheduleId = PhoneCore.user.realInfo.scheduleId;
                }
            }
        }
        
        // 如果还是没有时间表，显示占位内容
        if (!scheduleId) {
            var placeholderHtml = '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(145deg,#FFF8F9,#FFFFFF);padding:12px;">';
            placeholderHtml += '<span style="color:#D8456C;margin-bottom:8px;">' + I.calendar + '</span>';
            placeholderHtml += '<div style="font-size:12px;color:#746B6E;text-align:center;">请先创建并绑定时间表</div>';
            placeholderHtml += '</div>';
            return placeholderHtml;
        }
        
        // 使用 ScheduleWidgetRenderer 渲染
        switch (size) {
            case 'small':
                return ScheduleWidgetRenderer.renderSmall(scheduleId);
            case 'medium':
                return ScheduleWidgetRenderer.renderMedium(scheduleId);
            case 'large':
                return ScheduleWidgetRenderer.renderLarge(scheduleId);
            default:
                return ScheduleWidgetRenderer.renderMedium(scheduleId);
        }
    };

    // 重写render方法
    SystemConfigApp.prototype.render = function() {
        EnhancedApp.prototype.render.call(this);
        this.bindTabEvents();
    };

    // 导出
    global.SystemConfigApp = SystemConfigApp;

    // 为 PhoneCore.resources 补丁 get 方法（core.js 的 ResourceManager 仅有 getImageUrl，此处提供 get 返回完整 resource 对象）
    function ensureResourcesGet() {
        if (typeof PhoneCore === 'undefined' || !PhoneCore.resources) return;
        if (typeof PhoneCore.resources.get === 'function') return;
        PhoneCore.resources.get = function(resourceId) {
            return PhoneCore.resources.db.get('resources', resourceId);
        };
    }

    // 自动初始化
    EventBus.on('core:initialized', function() {
        ensureResourcesGet();
        var systemConfigApp = new SystemConfigApp();
        PhoneCore.registerApp(systemConfigApp);
    });

})(window);
