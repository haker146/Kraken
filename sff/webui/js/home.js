/**
 * Playnite-style Home: hero slider + shelves.
 */
window.Home = (function() {
    'use strict';

    var _heroGames = [];
    var _idx = 0;
    var _timer = null;
    var _active = false;

    function onPageEnter() {
        _active = true;
        _load();
        if (window.GameDetails) GameDetails.maybeShowWhatsNew();
    }

    function onPageLeave() {
        _active = false;
        _stop();
    }

    function refreshShelves() {
        if (_active) _loadShelves();
    }

    function _cover(appId) {
        if (window.Components && Components.getLibraryCoverUrl) {
            return Components.getLibraryCoverUrl(appId);
        }
        return 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + appId + '/library_600x900.jpg';
    }
    function _heroUrl(appId) {
        return 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + appId + '/library_hero.jpg';
    }

    function _load() {
        var empty = document.getElementById('home-hero-empty');
        if (empty) empty.classList.remove('hidden');
        // One catalog search: hero + "Recently updated". Newest waits in the
        // store search queue so it does not overwrite this request.
        Bridge.call('search_games', '', 0, 16, 'updated', '', 'home-hero');
        _loadLocalShelves();
        _catalogBanner();
    }

    function _catalogBanner() {
        Bridge.callWithCallback('get_catalog_status', function(json) {
            var data = {};
            try { data = JSON.parse(json || '{}'); } catch (e) {}
            var el = document.getElementById('home-catalog-banner');
            if (!el) return;
            if (data.stale) {
                el.classList.remove('hidden');
                el.textContent = data.loaded
                    ? 'Game catalog is stale. Open Store and click Update List when you are online.'
                    : 'Catalog is empty or offline. Open Store and click Update List.';
            } else {
                el.classList.add('hidden');
            }
        });
    }

    function _loadShelves() {
        _loadLocalShelves();
        if (_heroGames.length) _renderShelf('Recently updated', _heroGames);
        Bridge.call('search_games', '', 0, 16, 'newest', '', 'home-newest');
    }

    function _loadLocalShelves() {
        var host = document.getElementById('home-shelves');
        if (!host) return;
        host.innerHTML = '';
        Bridge.callWithCallback('get_installed_games', function(json) {
            var games = [];
            try { games = JSON.parse(json || '[]'); } catch (e) {}
            _renderShelf('Installed', games.slice(0, 16));
        });
        Bridge.callWithCallback('get_kraken_favorites', function(json) {
            _idsToShelf('Favorites', json);
        });
        Bridge.callWithCallback('get_kraken_recent', function(json) {
            _idsToShelf('Recently viewed', json);
        });
    }

    function _idsToShelf(title, json) {
        var ids = [];
        try { ids = JSON.parse(json || '[]'); } catch (e) {}
        var games = (ids || []).map(function(id) {
            return { app_id: id, name: 'App ' + id };
        });
        _renderShelf(title, games);
    }

    function _renderShelf(title, games) {
        var host = document.getElementById('home-shelves');
        if (!host || !games || !games.length) return;
        var existing = host.querySelector('[data-shelf="' + title + '"]');
        if (existing) existing.remove();
        var wrap = document.createElement('div');
        wrap.className = 'home-shelf';
        wrap.dataset.shelf = title;
        wrap.innerHTML = '<h3>' + title + '</h3>';
        var row = document.createElement('div');
        row.className = 'home-shelf-row';
        games.forEach(function(g) {
            var id = String(g.app_id || g.appid || '');
            if (!id) return;
            var card = document.createElement('div');
            card.className = 'home-shelf-card';
            card.tabIndex = 0;
            card.innerHTML = '<img alt=""><span></span>';
            card.querySelector('span').textContent = g.name || ('App ' + id);
            var img = card.querySelector('img');
            img.alt = g.name || '';
            img.loading = 'lazy';
            img.src = _cover(id);
            card.addEventListener('click', function() { GameDetails.show(id, g.name); });
            card.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') GameDetails.show(id, g.name);
            });
            row.appendChild(card);
        });
        wrap.appendChild(row);
        host.appendChild(wrap);
    }

    function _renderHero(games) {
        _heroGames = games || [];
        var empty = document.getElementById('home-hero-empty');
        var slides = document.getElementById('home-hero-slides');
        var dots = document.getElementById('home-hero-dots');
        if (!slides) return;
        slides.innerHTML = '';
        if (dots) dots.innerHTML = '';
        if (!_heroGames.length) {
            if (empty) {
                empty.classList.remove('hidden');
                empty.querySelector('p').textContent = 'No games in the catalog yet.';
            }
            return;
        }
        if (empty) empty.classList.add('hidden');
        _heroGames.forEach(function(g, i) {
            var id = String(g.app_id || '');
            var slide = document.createElement('div');
            slide.className = 'home-hero-slide' + (i === 0 ? ' active' : '');
            slide.style.backgroundImage = 'url("' + _heroUrl(id) + '")';
            var copy = document.createElement('div');
            copy.className = 'home-hero-copy';
            var meta = [];
            if (g.last_updated) meta.push(g.last_updated);
            copy.innerHTML = '<h2></h2><p></p><button type="button" class="btn btn-primary">Open</button>';
            copy.querySelector('h2').textContent = g.name || ('App ' + id);
            copy.querySelector('p').textContent = meta.join(' · ') || ('App ID ' + id);
            copy.querySelector('button').addEventListener('click', function(ev) {
                ev.stopPropagation();
                GameDetails.show(id, g.name);
            });
            slide.addEventListener('click', function() { GameDetails.show(id, g.name); });
            slide.appendChild(copy);
            slides.appendChild(slide);
            if (dots) {
                var dot = document.createElement('button');
                dot.type = 'button';
                if (i === 0) dot.className = 'active';
                dot.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    _go(i);
                });
                dots.appendChild(dot);
            }
        });
        _idx = 0;
        _start();
    }

    function _go(i) {
        if (!_heroGames.length) return;
        _idx = (i + _heroGames.length) % _heroGames.length;
        document.querySelectorAll('.home-hero-slide').forEach(function(el, n) {
            el.classList.toggle('active', n === _idx);
        });
        document.querySelectorAll('#home-hero-dots button').forEach(function(el, n) {
            el.classList.toggle('active', n === _idx);
        });
    }

    function _start() {
        _stop();
        _timer = setInterval(function() { _go(_idx + 1); }, 7000);
    }
    function _stop() {
        if (_timer) clearInterval(_timer);
        _timer = null;
    }

    function init() {
        var prev = document.getElementById('home-hero-prev');
        var next = document.getElementById('home-hero-next');
        var hero = document.getElementById('home-hero');
        if (prev) prev.addEventListener('click', function(e) { e.stopPropagation(); _go(_idx - 1); });
        if (next) next.addEventListener('click', function(e) { e.stopPropagation(); _go(_idx + 1); });
        if (hero) {
            hero.addEventListener('mouseenter', _stop);
            hero.addEventListener('mouseleave', function() { if (_active) _start(); });
        }
        var retry = document.getElementById('home-hero-retry');
        if (retry) retry.addEventListener('click', _load);
        document.addEventListener('keydown', function(e) {
            if (!_active || (window.GameDetails && GameDetails.isOpen())) return;
            if (e.key === 'ArrowLeft') _go(_idx - 1);
            if (e.key === 'ArrowRight') _go(_idx + 1);
        });
        Bridge.on('search_results', function(json) {
            if (!_active) return;
            try {
                var data = JSON.parse(json);
                if (data.request_id === 'home-hero') {
                    _renderHero(data.games || []);
                    _renderShelf('Recently updated', data.games || []);
                    if (_active) Bridge.call('search_games', '', 0, 16, 'newest', '', 'home-newest');
                } else if (data.request_id === 'home-newest') {
                    _renderShelf('Newest', data.games || []);
                }
            } catch (e) {}
        });
    }

    return { init: init, onPageEnter: onPageEnter, onPageLeave: onPageLeave, refreshShelves: refreshShelves };
})();
