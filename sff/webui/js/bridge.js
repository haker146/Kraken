/**
 * SteaMidra — QWebChannel Python↔JS Bridge
 * Connects to the Python WebBridge QObject via QWebChannel.
 * All slot calls are async in Qt6 — use callbacks or signals.
 */

window.Bridge = (function() {
    'use strict';

    let _py = null;
    let _ready = false;
    const _readyCallbacks = [];
    const _signalListeners = {};

    function init() {
        if (typeof QWebChannel === 'undefined') {
            console.error('[Bridge] QWebChannel not available — running outside QtWebEngine?');
            _simulateBridge();
            return;
        }
        new QWebChannel(qt.webChannelTransport, function(channel) {
            _py = channel.objects.bridge;
            if (!_py) {
                console.error('[Bridge] No "bridge" object registered in QWebChannel');
                return;
            }
            _ready = true;
            _connectSignals();
            _readyCallbacks.forEach(function(cb) { cb(_py); });
            _readyCallbacks.length = 0;
            console.log('[Bridge] Connected to Python backend');
        });
    }

    function _connectSignals() {
        var signalNames = [
            'search_results',
            'depot_history_results',
            'download_progress',
            'task_finished',
            'log_message',
            'lc_progress',
            'game_branches_ready',
            'download_queue_state'
        ];
        signalNames.forEach(function(name) {
            if (_py[name] && typeof _py[name].connect === 'function') {
                _py[name].connect(function(data) {
                    _emit(name, data);
                });
            }
        });
    }

    function onReady(callback) {
        if (_ready && _py) {
            callback(_py);
        } else {
            _readyCallbacks.push(callback);
        }
    }

    function isReady() {
        return _ready && _py !== null;
    }

    // Signal listener system
    function on(signalName, callback) {
        if (!_signalListeners[signalName]) {
            _signalListeners[signalName] = [];
        }
        _signalListeners[signalName].push(callback);
    }

    function off(signalName, callback) {
        if (!_signalListeners[signalName]) return;
        var idx = _signalListeners[signalName].indexOf(callback);
        if (idx !== -1) _signalListeners[signalName].splice(idx, 1);
    }

    function _emit(signalName, data) {
        var listeners = _signalListeners[signalName];
        if (!listeners) return;
        listeners.forEach(function(cb) {
            try { cb(data); } catch(e) { console.error('[Bridge] Signal handler error:', signalName, e); }
        });
    }

    // Call a bridge method (async slot — no return value, results via signals)
    function call(method /*, ...args */) {
        if (!_py) {
            console.warn('[Bridge] Not connected, queuing call:', method);
            var _args = arguments;
            onReady(function() { call.apply(null, _args); });
            return;
        }
        var args = Array.prototype.slice.call(arguments, 1);
        if (typeof _py[method] === 'function') {
            _py[method].apply(_py, args);
        } else {
            console.error('[Bridge] Unknown method:', method);
        }
    }

    // Call a sync bridge method (with callback — because Qt6 QWebChannel is always async)
    function callSync(method, callback) {
        if (!_py) {
            onReady(function() { callSync(method, callback); });
            return;
        }
        if (typeof _py[method] === 'function') {
            _py[method](callback);
        } else {
            console.error('[Bridge] Unknown method:', method);
        }
    }

    // Call with args + trailing callback (for sync slots with parameters)
    function callWithCallback(method /*, arg1, arg2, ..., callback */) {
        if (!_py) {
            onReady(function() { callWithCallback.apply(null, arguments); });
            return;
        }
        var args = Array.prototype.slice.call(arguments, 1);
        if (typeof _py[method] === 'function') {
            _py[method].apply(_py, args);
        } else {
            console.error('[Bridge] Unknown method:', method);
        }
    }

    function _simShot(appId, hash, nested) {
        var id = String(hash || '').split('/')[0];
        var base = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + appId + '/';
        var prefix = nested ? (id + '/') : '';
        return {
            full: base + prefix + 'ss_' + id + '.1920x1080.jpg',
            thumb: base + prefix + 'ss_' + id + '.600x338.jpg'
        };
    }

    function _simMovie(movieId, name) {
        var url = 'https://cdn.akamai.steamstatic.com/steam/apps/' + movieId + '/movie480.mp4';
        return {
            id: movieId,
            name: name,
            url: url,
            urls: [url],
            poster: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + movieId + '/movie.293x165.jpg',
            highlight: true
        };
    }

    function _simCatalog() {
        return [
            {
                app_id: 949230, name: 'Cities: Skylines II', last_updated: '2025-11-12',
                tags: ['Simulation', 'City Builder', 'Strategy', 'Management'],
                release_date: '24 Oct, 2023',
                developers: ['Iceflake Studios', 'Colossal Order'], publishers: ['Paradox Interactive'],
                genres: ['Simulation'], categories: ['Single-player', 'Steam Achievements', 'Steam Cloud'],
                short_description: 'Raise a city from the ground up and transform it into a thriving metropolis with the most realistic city builder ever. Push your creativity and problem-solving to build on a scale you\'ve never experienced.',
                about_html: '<p>Raise a city from the ground up and transform it into the thriving metropolis only you can imagine. You\'ve never experienced building on this scale. With deep simulation and a living economy, Cities: Skylines II is world-building without limits.</p>',
                crack_status: 'Cracked', protection: 'Denuvo', status_key: 'cracked',
                review_label: 'Mixed', review_percent: 59, review_count: 48000,
                review_recent_label: 'Mixed', review_recent_percent: 62, review_recent_count: 2100,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/949230/header.jpg',
                screenshots: ['fcc6a62a3b53c6f76ae1a7ce0cc5a4b8a0e1f022', 'ee0b920f27abfa62682bbb5c70862a5e18804fe2', 'c2092a2047a684f24faaaa47e58dc1dc1d3a57e6', 'c5bc1c21dfa34627c31ea78a61fa906df2f62ae1'].map(function(h) { return _simShot(949230, h, true).full; }),
                screenshot_thumbs: ['fcc6a62a3b53c6f76ae1a7ce0cc5a4b8a0e1f022', 'ee0b920f27abfa62682bbb5c70862a5e18804fe2', 'c2092a2047a684f24faaaa47e58dc1dc1d3a57e6', 'c5bc1c21dfa34627c31ea78a61fa906df2f62ae1'].map(function(h) { return _simShot(949230, h, true).thumb; }),
                movies: [],
                dlc: [
                    { id: '3579840', name: 'Cities: Skylines II - Expansion Pass 2', in_applist: false, type: 'appid' },
                    { id: '3725980', name: 'Cities: Skylines II - Downtown Market Set', in_applist: false, type: 'appid' }
                ]
            },
            {
                app_id: 916440, name: 'Anno 1800', last_updated: '2025-04-16',
                tags: ['City Builder', 'Strategy', 'Simulation', 'Economy'],
                release_date: '16 Apr, 2019',
                developers: ['Ubisoft Mainz'], publishers: ['Ubisoft'],
                genres: ['Strategy', 'Simulation'], categories: ['Single-player', 'Multi-player', 'Co-op'],
                short_description: 'Anno 1800 — Lead the Industrial Revolution! Welcome to the dawn of the Industrial Age. The path you choose will define your world.',
                about_html: '<p>Anno 1800 — Lead the Industrial Revolution!</p><p>Welcome to the dawn of the Industrial Age. The path you choose will define your world. Are you an innovator or an exploiter? A conqueror or a liberator? How the world remembers your name is up to you.</p>',
                crack_status: 'Cracked', protection: 'Denuvo', status_key: 'cracked',
                review_label: 'Very Positive', review_percent: 88, review_count: 72000,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/916440/header.jpg',
                screenshots: [], screenshot_thumbs: [], movies: [], dlc: []
            },
            {
                app_id: 1245620, name: 'ELDEN RING', last_updated: '2024-06-21',
                tags: ['Souls-like', 'RPG', 'Open World', 'Dark Fantasy'],
                release_date: '25 Feb, 2022',
                developers: ['FromSoftware, Inc.'], publishers: ['FromSoftware, Inc.', 'Bandai Namco Entertainment'],
                genres: ['Action', 'RPG'], categories: ['Single-player', 'Multi-player', 'Co-op'],
                short_description: 'THE CRITICALLY ACCLAIMED FANTASY ACTION RPG. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.',
                about_html: '<p>THE CRITICALLY ACCLAIMED FANTASY ACTION RPG. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.</p>',
                crack_status: 'Uncracked', protection: 'Easy Anti-Cheat', status_key: 'uncracked',
                review_label: 'Very Positive', review_percent: 92, review_count: 780000,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg',
                screenshots: ['943bf6fe62352757d9070c1d33e50b92fe8539f1', 'dcdac9e4b26ac0ee5248bfd2967d764fd00cdb42', '3c41384a24d86dddd58a8f61db77f9dc0bfda8b5'].map(function(h) { return _simShot(1245620, h).full; }),
                screenshot_thumbs: ['943bf6fe62352757d9070c1d33e50b92fe8539f1', 'dcdac9e4b26ac0ee5248bfd2967d764fd00cdb42', '3c41384a24d86dddd58a8f61db77f9dc0bfda8b5'].map(function(h) { return _simShot(1245620, h).thumb; }),
                movies: [_simMovie(256889452, 'ELDEN RING - Accolades Trailer')],
                dlc: [
                    { id: '2778580', name: 'ELDEN RING Shadow of the Erdtree', in_applist: false, type: 'appid' },
                    { id: '3655690', name: 'ELDEN RING Tarnished Pack', in_applist: false, type: 'appid' }
                ]
            },
            {
                app_id: 1145360, name: 'Hades', last_updated: '2021-09-14',
                tags: ['Roguelite', 'Action', 'Indie', 'Mythology'],
                release_date: '17 Sep, 2020',
                developers: ['Supergiant Games'], publishers: ['Supergiant Games'],
                genres: ['Action', 'Indie', 'RPG'], categories: ['Single-player', 'Steam Achievements', 'Full controller support'],
                short_description: 'Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler from the creators of Bastion, Transistor, and Pyre.',
                about_html: '<p>Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler from the creators of Bastion, Transistor, and Pyre.</p>',
                crack_status: 'Cracked', protection: 'Steam', status_key: 'cracked',
                review_label: 'Overwhelmingly Positive', review_percent: 98, review_count: 210000,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/header.jpg',
                screenshots: ['c0fed447426b69981cf1721756acf75369801b31', '8a9f0953e8a014bd3df2789c2835cb787cd3764d'].map(function(h) { return _simShot(1145360, h).full; }),
                screenshot_thumbs: ['c0fed447426b69981cf1721756acf75369801b31', '8a9f0953e8a014bd3df2789c2835cb787cd3764d'].map(function(h) { return _simShot(1145360, h).thumb; }),
                movies: [_simMovie(256801252, 'Hades - v1.0 Launch Trailer')],
                dlc: [{ id: '1206340', name: 'Hades Original Soundtrack', in_applist: false, type: 'appid' }]
            },
            {
                app_id: 394360, name: 'Hearts of Iron IV', last_updated: '2024-11-21',
                tags: ['Strategy', 'Grand Strategy', 'World War II', 'Simulation'],
                release_date: '6 Jun, 2016',
                developers: ['Paradox Development Studio'], publishers: ['Paradox Interactive'],
                genres: ['Simulation', 'Strategy'], categories: ['Single-player', 'Multi-player', 'Co-op'],
                short_description: 'Victory is at your fingertips! Hearts of Iron IV lets you take command of any nation in World War II, the most engaging conflict in world history.',
                about_html: '<p>Victory is at your fingertips! Your ability to lead your nation is your supreme weapon. Hearts of Iron IV lets you take command of any nation in World War II.</p>',
                crack_status: 'Cracked', protection: 'Steam', status_key: 'cracked',
                review_label: 'Very Positive', review_percent: 90, review_count: 220000,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/394360/header.jpg',
                screenshots: ['242abc1c2ca21f7d8694ba8d9239d8944217b29f', '679ae0d56f3a3b33591262839588c4b1dc6bef12'].map(function(h) { return _simShot(394360, h).full; }),
                screenshot_thumbs: ['242abc1c2ca21f7d8694ba8d9239d8944217b29f', '679ae0d56f3a3b33591262839588c4b1dc6bef12'].map(function(h) { return _simShot(394360, h).thumb; }),
                movies: [], dlc: []
            },
            {
                app_id: 255710, name: 'Cities: Skylines', last_updated: '2023-03-22',
                tags: ['City Builder', 'Simulation', 'Sandbox', 'Management'],
                release_date: '10 Mar, 2015',
                developers: ['Colossal Order'], publishers: ['Paradox Interactive'],
                genres: ['Simulation', 'Strategy'], categories: ['Single-player', 'Steam Workshop', 'Steam Cloud'],
                short_description: 'Cities: Skylines is a modern take on the classic city simulation. Create and maintain a real city, from street layout to public transport and neighborhoods.',
                about_html: '<p>Cities: Skylines is a modern take on the classic city simulation. The game introduces new gameplay elements to realize the thrill and hardships of creating and maintaining a real city.</p>',
                crack_status: 'Cracked', protection: 'Steam', status_key: 'cracked',
                review_label: 'Very Positive', review_percent: 93, review_count: 180000,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/255710/header.jpg',
                screenshots: ['0754001c88ad4dbfff92faf9a97e8d87cf3f8840', 'e0f842c9327df9defabf120b6c59e1ba42f54a75'].map(function(h) { return _simShot(255710, h).full; }),
                screenshot_thumbs: ['0754001c88ad4dbfff92faf9a97e8d87cf3f8840', 'e0f842c9327df9defabf120b6c59e1ba42f54a75'].map(function(h) { return _simShot(255710, h).thumb; }),
                movies: [], dlc: []
            },
            {
                app_id: 620, name: 'Portal 2', last_updated: '2011-04-19',
                tags: ['Puzzle', 'Action', 'Co-op', 'First-Person'],
                release_date: '19 Apr, 2011',
                developers: ['Valve'], publishers: ['Valve'],
                genres: ['Action', 'Adventure'], categories: ['Single-player', 'Co-op', 'Steam Achievements', 'Captions available', 'Steam Cloud'],
                short_description: 'Portal 2 draws from the award-winning formula of innovative gameplay, story, and music that earned the original Portal over 70 industry accolades and created a cult following.',
                about_html: '<p>Portal 2 draws from the award-winning formula of innovative gameplay, story, and music that earned the original Portal over 70 industry accolades and created a cult following.</p><p>The single-player portion of Portal 2 introduces a cast of dynamic new characters, a host of fresh puzzle elements, and a much larger set of devious test chambers. Players will explore never-before-seen areas of the Aperture Science Labs and be reunited with GLaDOS, the occasionally murderous computer companion who guided them through the original game.</p>',
                crack_status: 'Cracked', protection: 'Steam', status_key: 'cracked',
                review_label: 'Overwhelmingly Positive', review_percent: 98, review_count: 210000,
                review_recent_label: 'Overwhelmingly Positive', review_recent_percent: 97, review_recent_count: 1200,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
                screenshots: ['f3f6787d74739d3b2ec8a484b5c994b3d31ef325','6a4f5afdaa98402de9cf0b59fed27bab3256a6f4','0cdd90fafc160b52d08b303d205f9fd4e83cf164','ec35a739b4b33270eb170d9e561c5b016cba50a6'].map(function(h) { return _simShot(620, h).full; }),
                screenshot_thumbs: ['f3f6787d74739d3b2ec8a484b5c994b3d31ef325','6a4f5afdaa98402de9cf0b59fed27bab3256a6f4','0cdd90fafc160b52d08b303d205f9fd4e83cf164','ec35a739b4b33270eb170d9e561c5b016cba50a6'].map(function(h) { return _simShot(620, h).thumb; }),
                movies: [
                    _simMovie(80822, 'Portal 2 Remix Trailer'),
                    _simMovie(5787, 'Portal 2 E3 Demo'),
                    _simMovie(5926, 'Portal 2 Co-op Trailer')
                ],
                dlc: [
                    { id: '323180', name: 'Portal 2 - Peer Review', in_applist: false, type: 'appid' },
                    { id: '32340', name: 'Portal 2 - Soundtrack', in_applist: true, type: 'appid' }
                ]
            },
            {
                app_id: 440, name: 'Team Fortress 2', last_updated: '2024-01-18',
                tags: ['Shooter', 'Multiplayer', 'Action', 'Free to Play'],
                release_date: '10 Oct, 2007',
                developers: ['Valve'], publishers: ['Valve'],
                genres: ['Action', 'Free to Play'], categories: ['Multi-player', 'Steam Achievements'],
                short_description: 'Nine classes. Hats. Chaos. Valve’s class-based multiplayer shooter.',
                about_html: '<p>Nine distinct classes provide a broad range of tactical abilities and personalities. Constantly updated, TF2 has hundreds of community-made hats and items.</p>',
                crack_status: 'Cracked', protection: 'Steam', status_key: 'cracked',
                review_label: 'Very Positive', review_percent: 93, review_count: 980000,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/header.jpg',
                screenshots: [], screenshot_thumbs: [], movies: [], dlc: []
            },
            {
                app_id: 570, name: 'Dota 2', last_updated: '2024-09-01',
                tags: ['MOBA', 'Strategy', 'Free to Play', 'Multiplayer'],
                release_date: '9 Jul, 2013',
                developers: ['Valve'], publishers: ['Valve'],
                genres: ['Action', 'Free to Play', 'Strategy'], categories: ['Multi-player', 'Co-op', 'Steam Trading Cards'],
                short_description: 'Every day, millions of players worldwide enter battle as one of over a hundred Dota heroes.',
                about_html: '<p>Every day, millions of players worldwide enter battle as one of over a hundred Dota heroes. And no matter if it\'s their 10th hour of play or 1,000th, there\'s always something new to discover.</p>',
                crack_status: 'Uncracked', protection: 'VAC', status_key: 'uncracked',
                review_label: 'Very Positive', review_percent: 82, review_count: 2200000,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/header.jpg',
                screenshots: [], screenshot_thumbs: [], movies: [], dlc: []
            },
            {
                app_id: 400, name: 'Portal', last_updated: '2007-10-10',
                tags: ['Puzzle', 'Action', 'First-Person'],
                release_date: '10 Oct, 2007',
                developers: ['Valve'], publishers: ['Valve'],
                genres: ['Action'], categories: ['Single-player', 'Steam Achievements'],
                short_description: 'A new single-player game from Valve. Played from a first-person perspective.',
                about_html: '<p>Portal is a new single player game from Valve. Set in the mysterious Aperture Science Laboratories, Portal has been called one of the most innovative new games in years.</p>',
                crack_status: 'Cracked', protection: 'Steam', status_key: 'cracked',
                review_label: 'Overwhelmingly Positive', review_percent: 98, review_count: 120000,
                header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/400/header.jpg',
                screenshots: [], screenshot_thumbs: [], movies: [], dlc: []
            }
        ];
    }

    // Simulation mode for development outside QtWebEngine
    function _simulateBridge() {
        console.warn('[Bridge] Running in SIMULATION mode — no Python backend');
        _py = {
            search_games: function(query, offset, perPage, sortBy, tag, requestId) {
                var q = String(query || '').toLowerCase();
                var all = _simCatalog();
                var games = q ? all.filter(function(g) {
                    return g.name.toLowerCase().indexOf(q) !== -1 || String(g.app_id) === q;
                }) : all.slice();
                if (tag) {
                    var t = String(tag).toLowerCase();
                    games = games.filter(function(g) {
                        return (g.tags || []).some(function(x) { return String(x).toLowerCase() === t; });
                    });
                }
                var sb = String(sortBy || 'newest').toLowerCase();
                games.sort(function(a, b) {
                    if (sb === 'name_asc') return a.name.localeCompare(b.name);
                    if (sb === 'name_desc') return b.name.localeCompare(a.name);
                    if (sb === 'oldest') return (a.app_id || 0) - (b.app_id || 0);
                    if (sb === 'updated') return String(b.last_updated || '').localeCompare(String(a.last_updated || ''));
                    return (b.app_id || 0) - (a.app_id || 0);
                });
                var start = Math.max(0, parseInt(offset, 10) || 0);
                var count = Math.max(1, parseInt(perPage, 10) || 12);
                var page = games.slice(start, start + count);
                setTimeout(function() {
                    _emit('search_results', JSON.stringify({
                        games: page,
                        total: games.length,
                        request_id: requestId || '',
                        has_hubcap: false,
                        has_fallback_data: true
                    }));
                }, 30);
            },
            fetch_depot_history: function() {},
            download_game_fastest: function() {},
            download_game_version: function() {},
            download_dlc_oureveryday: function() {},
            run_game_action: function() {},
            dlc_check_get_list: function(appId) {
                var id = String(appId || '');
                var game = _simCatalog().filter(function(g) { return String(g.app_id) === id; })[0];
                var dlcs = (game && game.dlc) ? game.dlc : [];
                setTimeout(function() {
                    _emit('task_finished', JSON.stringify({
                        task: 'dlc_check',
                        success: true,
                        app_id: id,
                        base_name: game ? game.name : ('App ' + id),
                        owned_count: dlcs.filter(function(d) { return d.in_applist; }).length,
                        total_count: dlcs.length,
                        dlcs: dlcs
                    }));
                }, 50);
            },
            activate_dlcs: function(appId, idsJson) {
                var ids = [];
                try { ids = JSON.parse(idsJson || '[]'); } catch (e) { ids = []; }
                setTimeout(function() {
                    _emit('task_finished', JSON.stringify({
                        task: 'activate_dlcs',
                        success: true,
                        app_id: String(appId || ''),
                        activated: ids.length,
                        message: 'Activated ' + ids.length + ' DLC(s) on Steam. Restart Steam if they are not visible yet.'
                    }));
                }, 40);
            },
            enqueue_dropped_blobs: function() {},
            get_platform: function(cb) { if (cb) cb('win32'); },
            app_update_check: function(arg, cb) { if (cb) cb('{"ok":true,"update_available":false,"current":"dev","latest":"dev"}'); },
            lumacore_check_update: function(arg, cb) { if (cb) cb('{"installed":"dev","latest":"dev","update_available":false}'); },
            connect_store: function() {},
            get_stored_api_key: function(cb) { if (cb) cb(''); },
            list_profiles: function(cb) { if (cb) cb('[]'); },
            switch_profile: function() {},
            save_profile: function() {},
            delete_profile: function() {},
            rename_profile: function() {},
            set_setting: function() {},
            export_settings_file: function(cb) { if (cb) cb('{"ok":false,"cancelled":true}'); },
            import_settings_file: function(cb) { if (cb) cb('{"ok":false,"cancelled":true}'); },
            import_depot_manifest_html: function(cb) { if (cb) cb('{"ok":false,"cancelled":true}'); },
            get_setting: function(key, cb) { if (cb) cb(''); },
            get_steam_libraries: function(cb) { if (cb) cb('[]'); },
            set_active_library: function() {},
            browse_ddmod_download_folder: function(cb) { if (cb) cb(''); },
            open_file_dialog: function(cb) { if (cb) cb(''); },
            open_log_window: function() {},
            restart_steam: function() {},
            refresh_library: function(cb) { if (cb) cb('[]'); },
            get_installed_games: function(cb) { if (cb) cb('[{"app_id":620,"name":"Portal 2"}]'); },
            get_steam_client_status: function(cb) { if (cb) cb('{"state":"missing","label":"Steam missing","path":"","running":false,"found":false}'); },
            get_catalog_status: function(cb) { if (cb) cb('{"loaded":true,"stale":true,"count":4,"age_seconds":400000}'); },
            get_kraken_favorites: function(cb) { if (cb) cb('[]'); },
            get_kraken_recent: function(cb) { if (cb) cb('[]'); },
            get_whats_new_seen: function(cb) { if (cb) cb(true); },
            set_whats_new_seen: function() {},
            add_kraken_recent: function() {},
            set_kraken_favorite: function(appId, enabled, cb) { if (cb) cb('[]'); },
            get_store_game_details: function(appId) {
                var id = String(appId || '');
                var game = _simCatalog().filter(function(g) { return String(g.app_id) === id; })[0] || {
                    app_id: id,
                    name: 'App ' + id,
                    short_description: '',
                    about_html: '',
                    release_date: '',
                    developers: [],
                    publishers: [],
                    genres: [],
                    categories: [],
                    screenshots: [],
                    screenshot_thumbs: [],
                    movies: [],
                    dlc: [],
                    header_image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + id + '/header.jpg',
                    crack_status: '',
                    protection: ''
                };
                var movies = game.movies || [];
                setTimeout(function() {
                    _emit('task_finished', JSON.stringify({
                        task: 'game_details',
                        success: true,
                        app_id: id,
                        name: game.name,
                        short_description: game.short_description || '',
                        about_html: game.about_html || '',
                        release_date: game.release_date || '',
                        developers: game.developers || [],
                        publishers: game.publishers || [],
                        genres: game.genres || game.tags || [],
                        categories: game.categories || [],
                        latest_buildid: '1234567',
                        installed_buildid: id === '620' ? '1234567' : '',
                        screenshots: game.screenshots && game.screenshots.length
                            ? game.screenshots
                            : [game.header_image],
                        screenshot_thumbs: game.screenshot_thumbs && game.screenshot_thumbs.length
                            ? game.screenshot_thumbs
                            : [game.header_image],
                        dlc: game.dlc || [],
                        favorite: false,
                        installed: id === '620',
                        header_image: game.header_image,
                        trailer: movies.length ? movies[0].url : '',
                        trailer_urls: movies.length ? movies[0].urls : [],
                        trailer_poster: movies.length ? movies[0].poster : '',
                        movies: movies,
                        pc_requirements: game.pc_requirements || '',
                        protection: game.protection || '',
                        crack_status: game.crack_status || '',
                        status_key: game.status_key || '',
                        review_label: game.review_label || '',
                        review_count: game.review_count || 0,
                        review_percent: game.review_percent || 0,
                        review_recent_label: game.review_recent_label || '',
                        review_recent_count: game.review_recent_count || 0,
                        review_recent_percent: game.review_recent_percent || 0
                    }));
                }, 40);
            },
            get_disk_usage: function(path, cb) { if (cb) cb('{}'); },
            get_game_list: function(cb) { if (cb) cb('[]'); },
            scan_cloud_games: function() {},
            backup_cloud_save: function() {},
            restore_cloud_save: function() {},
            generate_gbe_token: function() {},
            extract_vdf_keys: function(cb) { if (cb) cb('[]'); },
            fix_game: function() {},
            revert_game: function() {},
            get_fix_game_list: function(cb) { if (cb) cb('[]'); },
            get_applist_games: function(cb) { if (cb) cb('[]'); },
            browse_game_folder: function(cb) { if (cb) cb(''); },
            run_game_action_outside: function() {},
            open_url: function() {},
        };
        _ready = true;
        _readyCallbacks.forEach(function(cb) { cb(_py); });
        _readyCallbacks.length = 0;
    }

    return {
        init: init,
        onReady: onReady,
        isReady: isReady,
        on: on,
        off: off,
        call: call,
        callSync: callSync,
        callWithCallback: callWithCallback,
        getPy: function() { return _py; }
    };
})();

// Initialize the bridge immediately
Bridge.init();
