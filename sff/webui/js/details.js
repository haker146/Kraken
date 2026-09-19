/**
 * Shared game details overlay (Home + Store) — Steam store layout.
 */
window.GameDetails = (function() {
    'use strict';

    var _open = false;
    var _appId = '';
    var _onKey = null;
    var _trailerUrls = [];
    var _trailerIdx = 0;
    var _fallbackImage = '';
    var _name = '';

    function init() {
        var close = document.getElementById('gd-close');
        if (close) close.addEventListener('click', hide);
        document.addEventListener('click', function(e) {
            if (!e.target) return;
            if (e.target.id === 'whats-new-ok' || e.target.id === 'whats-new-close') {
                _dismissWhatsNew();
            }
            if (e.target.classList && e.target.classList.contains('modal-overlay') && e.target.parentNode && e.target.parentNode.id === 'whats-new-modal') {
                _dismissWhatsNew();
            }
        });
        var dlcAll = document.getElementById('gd-dlc-all');
        if (dlcAll) {
            dlcAll.addEventListener('change', function() {
                document.querySelectorAll('#gd-dlc .gd-dlc-cb').forEach(function(cb) {
                    var row = cb.closest('.gd-dlc-row');
                    if (row && row.classList.contains('is-active')) return;
                    cb.checked = dlcAll.checked;
                });
            });
        }
        var activate = document.getElementById('gd-dlc-activate');
        if (activate) {
            activate.addEventListener('click', _activateSelectedDlc);
        }
    }

    function _dismissWhatsNew() {
        var m = document.getElementById('whats-new-modal');
        if (m) m.classList.add('hidden');
        Bridge.call('set_whats_new_seen');
    }

    function maybeShowWhatsNew() {
        Bridge.callWithCallback('get_whats_new_seen', function(seen) {
            if (seen) return;
            var m = document.getElementById('whats-new-modal');
            if (m) m.classList.remove('hidden');
        });
    }

    function show(appId, name) {
        if (!appId) return;
        _appId = String(appId);
        _name = name || '';
        _open = true;
        var root = document.getElementById('game-details');
        if (!root) return;
        root.classList.remove('hidden');
        root.setAttribute('aria-hidden', 'false');
        document.getElementById('gd-title').textContent = name || ('App ' + _appId);
        document.getElementById('gd-sub').textContent = 'Loading details…';
        document.getElementById('gd-desc').textContent = '';
        var about = document.getElementById('gd-about');
        if (about) about.innerHTML = '';
        document.getElementById('gd-dlc').innerHTML = '';
        document.getElementById('gd-actions').innerHTML = '';
        var thumbs = document.getElementById('gd-thumbs');
        if (thumbs) thumbs.innerHTML = '';
        document.getElementById('gd-req').textContent = '';
        var header = document.getElementById('gd-header-img');
        if (header) {
            header.removeAttribute('src');
            header.alt = name || '';
            header.src = _hero(_appId);
        }
        var page = root.querySelector('.gd-steam-page');
        if (page) page.classList.add('is-loading');
        var vid = document.getElementById('gd-trailer');
        var mediaImg = document.getElementById('gd-media-image');
        if (vid) {
            try { vid.pause(); vid.removeAttribute('src'); } catch (e) {}
            vid.classList.add('hidden');
        }
        if (mediaImg) mediaImg.classList.add('hidden');
        _setText('gd-release', '—');
        _setText('gd-dev', '—');
        _setText('gd-pub', '—');
        _setText('gd-protection', '—');
        var crack = document.getElementById('gd-crack');
        if (crack) {
            crack.innerHTML = '';
            crack.className = 'gd-crack';
        }
        var tags = document.getElementById('gd-tags');
        if (tags) tags.innerHTML = '';
        var reviews = document.getElementById('gd-reviews');
        if (reviews) reviews.innerHTML = '';
        var dlcSum = document.getElementById('gd-dlc-summary');
        if (dlcSum) dlcSum.textContent = 'Loading DLC…';
        var dlcBar = document.getElementById('gd-dlc-toolbar');
        if (dlcBar) dlcBar.classList.add('hidden');
        _trailerUrls = [];
        _trailerIdx = 0;
        _fallbackImage = _hero(_appId);
        Bridge.call('add_kraken_recent', _appId);
        Bridge.call('get_store_game_details', _appId);
        Bridge.call('dlc_check_get_list', _appId);
        _bindKeys();
    }

    function hide() {
        _open = false;
        var root = document.getElementById('game-details');
        if (root) {
            root.classList.add('hidden');
            root.setAttribute('aria-hidden', 'true');
        }
        var vid = document.getElementById('gd-trailer');
        if (vid) {
            try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) {}
        }
        _unbindKeys();
    }

    function isOpen() { return _open; }

    function _bindKeys() {
        _unbindKeys();
        _onKey = function(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                hide();
            }
        };
        document.addEventListener('keydown', _onKey);
    }
    function _unbindKeys() {
        if (_onKey) document.removeEventListener('keydown', _onKey);
        _onKey = null;
    }

    function _setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value || '—';
    }

    function _esc(value) {
        return window.Components ? Components.escapeHtml(value) : String(value || '');
    }

    function _hero(appId) {
        return 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + appId + '/header.jpg';
    }

    function _reviewClass(percent) {
        var n = Number(percent) || 0;
        if (n >= 70) return 'positive';
        if (n >= 40) return 'mixed';
        if (n > 0) return 'negative';
        return '';
    }

    function _reviewRow(label, score, count, percent) {
        if (!score) return '';
        var n = Number(count) || 0;
        return '<div class="gd-review-row"><span class="gd-review-label">' + _esc(label) + '</span>' +
            '<span class="gd-review-value ' + _reviewClass(percent) + '">' + _esc(score) +
            (n ? ' <span class="gd-review-count">(' + n.toLocaleString() + ')</span>' : '') +
            '</span></div>';
    }

    function _statusClass(status) {
        var key = String(status || '').toLowerCase();
        if (key.indexOf('uncracked') >= 0) return 'steam-status--uncracked';
        if (key.indexOf('hypervisor') >= 0) return 'steam-status--hypervisor';
        if (key.indexOf('unreleased') >= 0 || key.indexOf('early') >= 0) return 'steam-status--unreleased';
        if (key.indexOf('cracked') >= 0) return 'steam-status--cracked';
        return 'steam-status--unknown';
    }

    function _showMedia(kind, url, poster, urls) {
        var vid = document.getElementById('gd-trailer');
        var img = document.getElementById('gd-media-image');
        if (!vid || !img) return;
        _trailerUrls = ((urls && urls.length) ? urls.slice() : (url ? [url] : [])).filter(function(item) {
            return item && !/\.m3u8($|\?)/i.test(String(item)) && !/hls_/i.test(String(item));
        });
        _trailerUrls.sort(function(a, b) {
            var ap = /\.mp4($|\?)/i.test(a) ? 0 : 1;
            var bp = /\.mp4($|\?)/i.test(b) ? 0 : 1;
            return ap - bp;
        });
        _trailerIdx = 0;
        if (kind === 'video' && _trailerUrls.length) {
            img.classList.add('hidden');
            vid.classList.remove('hidden');
            if (poster) vid.poster = poster;
            vid.preload = 'metadata';
            vid.muted = true;
            vid.src = _trailerUrls[0];
            try { vid.play().catch(function() {}); } catch (e) {}
        } else {
            try { vid.pause(); } catch (e) {}
            vid.classList.add('hidden');
            img.classList.remove('hidden');
            img.src = url || _fallbackImage || _hero(_appId);
        }
    }

    function _bindTrailerFallback(vid) {
        if (!vid || vid._krakenBound) return;
        vid._krakenBound = true;
        vid.addEventListener('error', function() {
            if (!_trailerUrls.length) return;
            _trailerIdx++;
            if (_trailerIdx < _trailerUrls.length) {
                vid.src = _trailerUrls[_trailerIdx];
                return;
            }
            _showMedia('image', _fallbackImage);
        });
    }

    function _playAboutMedia(root) {
        if (!root) return;
        root.querySelectorAll('img').forEach(function(img) {
            var src = img.getAttribute('src') || '';
            if (!/\.(webm|mp4)(\?|$)/i.test(src)) return;
            var vid = document.createElement('video');
            vid.src = src;
            vid.autoplay = true;
            vid.loop = true;
            vid.muted = true;
            vid.playsInline = true;
            img.replaceWith(vid);
        });
        root.querySelectorAll('video').forEach(function(vid) {
            vid.muted = true;
            vid.loop = true;
            vid.autoplay = true;
            vid.playsInline = true;
            try { vid.play().catch(function() {}); } catch (e) {}
        });
    }

    function _renderDlc(payload) {
        var list = document.getElementById('gd-dlc');
        var summary = document.getElementById('gd-dlc-summary');
        var bar = document.getElementById('gd-dlc-toolbar');
        if (!list) return;
        var dlcs = payload.dlcs || [];
        if (!dlcs.length) {
            list.innerHTML = '<li class="gd-dlc-empty">No DLC listed on the Steam Store.</li>';
            if (summary) summary.textContent = '';
            if (bar) bar.classList.add('hidden');
            return;
        }
        var owned = dlcs.filter(function(dlc) { return !!dlc.in_applist; }).length;
        if (summary) summary.textContent = owned + ' of ' + dlcs.length + ' already active';
        list.innerHTML = dlcs.map(function(dlc) {
            var on = !!dlc.in_applist;
            return '<li class="gd-dlc-row' + (on ? ' is-active' : '') + '">' +
                '<label>' +
                '<input type="checkbox" class="gd-dlc-cb" data-appid="' + _esc(dlc.id) + '">' +
                '<span class="gd-dlc-name">' + _esc(dlc.name || ('DLC ' + dlc.id)) + '</span>' +
                '<span class="gd-dlc-id">' + _esc(dlc.id) + '</span>' +
                '<span class="gd-dlc-state">' + (on ? 'Active' : 'Not active') + '</span>' +
                '</label></li>';
        }).join('');
        if (bar) bar.classList.remove('hidden');
        var all = document.getElementById('gd-dlc-all');
        if (all) all.checked = false;
    }

    function _activateSelectedDlc() {
        var ids = [];
        document.querySelectorAll('#gd-dlc .gd-dlc-cb:checked:not(:disabled)').forEach(function(cb) {
            if (cb.dataset.appid) ids.push(String(cb.dataset.appid));
        });
        if (!ids.length) {
            if (window.Components) Components.showToast('warning', 'Select at least one DLC to activate.');
            return;
        }
        if (window.Components) Components.showToast('info', 'Activating ' + ids.length + ' DLC(s) on Steam…');
        Bridge.call('activate_dlcs', _appId, JSON.stringify(ids));
    }

    function _crackBuildNote(data) {
        var bid = String((data && data.crack_downgrade_build) || '').trim();
        if (!bid) return '';
        return '<div class="gd-crack-build">Crack is for Steam build <strong>' + _esc(bid) +
            '</strong>. Downgrade the game to this version for the crack to work.</div>';
    }

    function _fillCrackBox(el, data) {
        if (!el) return;
        var status = (data && data.crack_status) || '';
        var note = _crackBuildNote(data);
        if (!status && !(data && data.protection) && !note) {
            el.className = 'gd-crack';
            el.innerHTML = '';
            return;
        }
        el.className = 'gd-crack ' + _statusClass(status);
        el.innerHTML = '<div class="steam-status-box"><div class="steam-discount">' +
            _esc(status || (data && data.protection) || 'Denuvo') +
            '</div><div class="steam-status-copy"><span class="steam-protection">' +
            _esc((data && data.protection) || '') +
            '</span><span class="steam-status-sub">isitcracked.com</span></div></div>' + note;
    }

    function _onDetails(json) {
        var data;
        try { data = JSON.parse(json || '{}'); } catch (e) { data = {}; }
        if (data.task === 'dlc_check') {
            if (!_open || String(data.app_id) !== _appId) return;
            if (!data.success) {
                var sum = document.getElementById('gd-dlc-summary');
                if (sum) sum.textContent = data.message || 'Could not load DLC.';
                return;
            }
            _renderDlc(data);
            return;
        }
        if (data.task === 'activate_dlcs') {
            if (!_open || String(data.app_id) !== _appId) return;
            if (window.Components) {
                Components.showToast(data.success ? 'success' : 'error', data.message || (data.success ? 'DLC activated.' : 'Activation failed.'));
            }
            if (data.success) Bridge.call('dlc_check_get_list', _appId);
            return;
        }
        if (data.task !== 'game_details') return;
        if (String(data.app_id) !== _appId) return;
        if (data.extra_only) {
            if (data.protection) _setText('gd-protection', data.protection);
            _fillCrackBox(document.getElementById('gd-crack'), data);
            var reviewsEl = document.getElementById('gd-reviews');
            if (reviewsEl && (data.review_label || data.review_recent_label)) {
                var recent = _reviewRow(
                    'Recent Reviews:',
                    data.review_recent_label || data.review_label,
                    data.review_recent_count || (data.review_recent_label ? 0 : data.review_count),
                    data.review_recent_percent || data.review_percent
                );
                var all = _reviewRow('All Reviews:', data.review_label, data.review_count, data.review_percent);
                reviewsEl.innerHTML = recent + all;
            }
            return;
        }
        if (!data.success) {
            var msg = data.message || 'Could not load details.';
            if (window.Components && Components.friendlyError) msg = Components.friendlyError(msg);
            document.getElementById('gd-sub').textContent = msg;
            var failedPage = document.querySelector('#game-details .gd-steam-page');
            if (failedPage) failedPage.classList.remove('is-loading');
            return;
        }
        var shownName = data.name || _name || ('App ' + _appId);
        if (_name && /^App\s+\d+$/i.test(String(data.name || ''))) shownName = _name;
        document.getElementById('gd-title').textContent = shownName;
        if (data.partial) {
            var earlyHeader = document.getElementById('gd-header-img');
            if (earlyHeader && data.header_image) {
                earlyHeader.alt = shownName;
                earlyHeader.src = data.header_image;
            }
            return;
        }
        var page = document.querySelector('#game-details .gd-steam-page');
        if (page) page.classList.remove('is-loading');
        document.getElementById('gd-sub').textContent = '';
        document.getElementById('gd-desc').textContent = data.short_description || '';
        _setText('gd-release', data.release_date);
        _setText('gd-dev', (data.developers || []).join(', '));
        _setText('gd-pub', (data.publishers || []).join(', '));
        _setText('gd-protection', data.protection || data.drm_notice || 'Steam');

        var header = document.getElementById('gd-header-img');
        if (header) {
            header.alt = data.name || '';
            header.src = data.header_image || _hero(_appId);
            header.onerror = function() { this.onerror = null; this.src = _hero(_appId); };
        }

        var reviews = document.getElementById('gd-reviews');
        if (reviews) {
            var recent = _reviewRow(
                'Recent Reviews:',
                data.review_recent_label || data.review_label,
                data.review_recent_count || (data.review_recent_label ? 0 : data.review_count),
                data.review_recent_percent || data.review_percent
            );
            var all = _reviewRow('All Reviews:', data.review_label, data.review_count, data.review_percent);
            if (data.review_recent_label && data.review_recent_label === data.review_label &&
                Number(data.review_recent_count) === Number(data.review_count)) {
                recent = '';
            }
            reviews.innerHTML = recent + all;
        }

        _fillCrackBox(document.getElementById('gd-crack'), data);

        var tags = document.getElementById('gd-tags');
        if (tags) {
            tags.innerHTML = '';
            (data.genres || []).concat(data.categories || []).slice(0, 12).forEach(function(tag) {
                var span = document.createElement('span');
                span.className = 'steam-tag';
                span.textContent = tag;
                tags.appendChild(span);
            });
        }

        var about = document.getElementById('gd-about');
        if (about) {
            var html = data.about_html || data.detailed_html || '';
            if (html) {
                about.innerHTML = html;
                _playAboutMedia(about);
            } else {
                about.textContent = data.short_description || '';
            }
        }

        var thumbs = document.getElementById('gd-thumbs');
        var vid = document.getElementById('gd-trailer');
        _bindTrailerFallback(vid);
        if (thumbs) thumbs.innerHTML = '';
        var mediaItems = [];
        var movies = data.movies || [];
        if (movies.length) {
            movies.forEach(function(movie) {
                var urls = (movie.urls && movie.urls.length) ? movie.urls : (movie.url ? [movie.url] : []);
                if (!urls.length) return;
                mediaItems.push({
                    kind: 'video',
                    url: urls[0],
                    urls: urls,
                    poster: movie.poster || data.trailer_poster || '',
                    thumb: movie.poster || data.header_image || _hero(_appId)
                });
            });
        } else if (data.trailer_urls && data.trailer_urls.length) {
            mediaItems.push({
                kind: 'video',
                url: data.trailer_urls[0],
                urls: data.trailer_urls,
                poster: data.trailer_poster || '',
                thumb: data.trailer_poster || data.header_image || _hero(_appId)
            });
        } else if (data.trailer) {
            mediaItems.push({
                kind: 'video',
                url: data.trailer,
                urls: [data.trailer],
                poster: data.trailer_poster || '',
                thumb: data.trailer_poster || data.header_image || _hero(_appId)
            });
        }
        var shots = data.screenshots || [];
        var shotThumbs = data.screenshot_thumbs || [];
        shots.forEach(function(url, idx) {
            mediaItems.push({ kind: 'image', url: url, thumb: shotThumbs[idx] || url });
        });
        _fallbackImage = shots[0] || data.header_image || _hero(_appId);
        mediaItems.forEach(function(item, idx) {
            if (!thumbs) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            var img = document.createElement('img');
            img.src = item.thumb || item.url;
            img.alt = '';
            btn.appendChild(img);
            if (item.kind === 'video') {
                var badge = document.createElement('span');
                badge.className = 'gd-thumb-play';
                badge.textContent = '▶';
                btn.appendChild(badge);
            }
            btn.addEventListener('click', function() {
                thumbs.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                _showMedia(item.kind, item.url, item.poster, item.urls);
            });
            if (idx === 0) btn.classList.add('active');
            thumbs.appendChild(btn);
        });
        if (mediaItems.length) {
            _showMedia(mediaItems[0].kind, mediaItems[0].url, mediaItems[0].poster, mediaItems[0].urls);
        } else {
            _showMedia('image', data.header_image || _hero(_appId));
        }

        var req = [data.pc_requirements, data.pc_requirements_recommended].filter(Boolean).join('\n\n');
        document.getElementById('gd-req').textContent = req;
        document.getElementById('gd-req-wrap').classList.toggle('hidden', !req);

        var links = document.getElementById('gd-links');
        links.innerHTML = '';
        var linkPairs = [
            ['Steam Store', 'https://store.steampowered.com/app/' + _appId + '/'],
            ['SteamDB', 'https://steamdb.info/app/' + _appId + '/'],
            ['PCGamingWiki', 'https://www.pcgamingwiki.com/api/appid.php?appid=' + _appId]
        ];
        if (data.crack_url) {
            linkPairs.push(['Is It Cracked?', data.crack_url]);
        }
        linkPairs.forEach(function(pair) {
            var a = document.createElement('a');
            a.href = pair[1];
            a.textContent = pair[0];
            a.addEventListener('click', function(ev) {
                ev.preventDefault();
                Bridge.call('open_url', pair[1]);
            });
            links.appendChild(a);
        });
        var actions = document.getElementById('gd-actions');
        actions.innerHTML = '';
        var dl = document.createElement('button');
        dl.className = 'btn btn-primary';
        dl.textContent = 'Download';
        dl.addEventListener('click', function() {
            Components.showDownloadModal(_appId, data.name, navigator.platform);
        });
        actions.appendChild(dl);
        var star = document.createElement('button');
        star.className = 'btn';
        star.textContent = data.favorite ? '★ Favorite' : '☆ Favorite';
        star.addEventListener('click', function() {
            var next = !data.favorite;
            Bridge.callWithCallback('set_kraken_favorite', _appId, next, function() {
                data.favorite = next;
                star.textContent = next ? '★ Favorite' : '☆ Favorite';
                if (window.Home && Home.refreshShelves) Home.refreshShelves();
            });
        });
        actions.appendChild(star);
        if (data.installed) {
            var play = document.createElement('button');
            play.className = 'btn btn-primary';
            play.textContent = 'Play in Steam';
            play.addEventListener('click', function() {
                Bridge.call('open_url', 'steam://rungameid/' + _appId);
            });
            actions.appendChild(play);
        }
        if (data.size && window._krakenCheckDisk) {
            window._krakenCheckDisk(data.size);
        }
    }

    Bridge.on('task_finished', _onDetails);

    return { init: init, show: show, hide: hide, isOpen: isOpen, maybeShowWhatsNew: maybeShowWhatsNew };
})();
