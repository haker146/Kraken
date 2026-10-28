# SteaMidra - Steam game setup and manifest tool (SFF)
# Copyright (c) 2025-2026 Midrag (https://github.com/Midrags)
#
# This file is part of SteaMidra.
#
# SteaMidra is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

import json
import logging
from PyQt6.QtWidgets import (
    QVBoxLayout, QHBoxLayout, QPushButton,
    QSlider, QLabel, QWidget, QSizePolicy,
)
from PyQt6.QtMultimedia import QMediaPlayer, QAudioOutput
from PyQt6.QtMultimediaWidgets import QVideoWidget
from PyQt6.QtCore import QUrl, Qt, QTime, QTimer, QEvent, QRect, QPoint
from PyQt6.QtGui import QDesktopServices, QKeyEvent, QMouseEvent

logger = logging.getLogger(__name__)


class VideoContainer(QVideoWidget):
    """QVideoWidget with double-click expand inside the overlay."""
    def __init__(self, overlay):
        super().__init__()
        self._overlay = overlay

    def mouseDoubleClickEvent(self, event):
        if self._overlay:
            self._overlay.toggle_expand()
        super().mouseDoubleClickEvent(event)


def _trailer_quality_key(url: str) -> tuple[int, int]:
    u = (url or "").lower()
    fmt = 0 if ".mp4" in u else (1 if ".webm" in u else 2)
    if "movie_max" in u or "1080" in u or "/max" in u:
        q = 0
    elif "720" in u:
        q = 1
    elif "movie480" in u or "480" in u:
        q = 3
    else:
        q = 2
    return (fmt, q)


def _quality_label(url: str) -> str:
    u = (url or "").lower()
    if "movie_max" in u or "1080" in u or "/max" in u:
        return "1080p"
    if "720" in u:
        return "720p"
    if "movie480" in u or "480" in u:
        return "480p"
    return "HD"


def _split_trailer_urls(url_str: str) -> list[str]:
    raw = str(url_str or "").strip()
    urls: list[str] = []
    if not raw:
        return urls
    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                urls = [str(u).strip() for u in parsed if str(u).strip()]
        except Exception:
            urls = []
    elif "|" in raw:
        urls = [part.strip() for part in raw.split("|") if part.strip()]
    else:
        urls = [raw]
    seen: set[str] = set()
    unique: list[str] = []
    for url in urls:
        if url in seen:
            continue
        seen.add(url)
        unique.append(url)
    unique.sort(key=_trailer_quality_key)
    return unique


def _resolve_host(parent):
    """Prefer the WebEngine view so the overlay covers the React UI."""
    if parent is None:
        return None
    view = getattr(parent, "_web_view", None)
    if view is not None:
        return view
    return parent


class TrailerOverlay(QWidget):
    """In-window trailer player. Child of the main window, covering the
    WebEngine view — same chrome as Game Hub, no separate OS window.
    """
    def __init__(self, url_str: str, title: str = "Trailer", host=None):
        win = host.window() if host is not None else None
        super().__init__(win if win is not None else host)
        self._host = host
        self._expanded = False
        self._urls = _split_trailer_urls(url_str)
        self._url_idx = 0
        self._advancing = False
        self.url_str = self._urls[0] if self._urls else str(url_str or "")
        self._title = title or "Trailer"

        self.setObjectName("TrailerOverlay")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self._fill = False
        self.setStyleSheet("""
            QWidget#TrailerOverlay {
                background-color: rgba(4, 6, 14, 210);
            }
            QWidget#TrailerCard {
                background-color: #070910;
                border: 1px solid rgba(167, 139, 250, 0.22);
                border-radius: 18px;
            }
            QWidget#TrailerBar {
                background-color: rgba(9, 12, 22, 0.96);
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }
            QWidget#controlsBar {
                background-color: rgba(9, 12, 22, 0.96);
                border-top: 1px solid rgba(255, 255, 255, 0.06);
            }
            QLabel#badgeLabel, QLabel#qualityLabel {
                color: #ddd6fe;
                background: rgba(124, 58, 237, 0.28);
                border: 1px solid rgba(167, 139, 250, 0.45);
                border-radius: 99px;
                padding: 3px 9px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.06em;
            }
            QLabel#qualityLabel {
                color: #fde68a;
                background: rgba(251, 191, 36, 0.14);
                border-color: rgba(251, 191, 36, 0.35);
            }
            QLabel#titleLabel {
                color: #f8fafc;
                font-size: 13px;
                font-weight: 700;
            }
            QLabel#failTitle {
                color: #f8fafc;
                font-size: 20px;
                font-weight: 800;
            }
            QLabel#failBody {
                color: #94a3b8;
                font-size: 13px;
            }
            QPushButton {
                background: rgba(255, 255, 255, 0.07);
                color: #e2e8f0;
                border: 1px solid rgba(255, 255, 255, 0.10);
                border-radius: 10px;
                padding: 7px 14px;
                font-weight: 600;
                font-size: 12px;
            }
            QPushButton:hover {
                background: rgba(255, 255, 255, 0.14);
                color: #ffffff;
            }
            QPushButton#playBtn {
                background: #7c3aed;
                border-color: #8b5cf6;
                color: #ffffff;
                min-width: 78px;
                font-weight: 700;
            }
            QPushButton#playBtn:hover { background: #6d28d9; }
            QPushButton#closeBtn {
                min-width: 34px;
                max-width: 34px;
                min-height: 34px;
                padding: 0;
                border-radius: 17px;
                color: #94a3b8;
            }
            QPushButton#closeBtn:hover {
                background: rgba(239, 68, 68, 0.22);
                border-color: rgba(239, 68, 68, 0.45);
                color: #fca5a5;
            }
            QSlider::groove:horizontal {
                height: 5px;
                background: rgba(255, 255, 255, 0.12);
                border-radius: 3px;
            }
            QSlider::sub-page:horizontal {
                background: #a78bfa;
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #ffffff;
                width: 12px;
                margin-top: -4px;
                margin-bottom: -4px;
                border-radius: 6px;
            }
            QSlider::handle:horizontal:hover { background: #ddd6fe; }
            QLabel {
                color: #94a3b8;
                font-size: 12px;
            }
        """)

        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self._card = QWidget()
        self._card.setObjectName("TrailerCard")
        self._card.setSizePolicy(QSizePolicy.Policy.Fixed, QSizePolicy.Policy.Fixed)
        card_layout = QVBoxLayout(self._card)
        card_layout.setContentsMargins(0, 0, 0, 0)
        card_layout.setSpacing(0)

        bar = QWidget()
        bar.setObjectName("TrailerBar")
        bar_layout = QHBoxLayout(bar)
        bar_layout.setContentsMargins(16, 10, 12, 10)
        bar_layout.setSpacing(8)

        badge = QLabel("TRAILER")
        badge.setObjectName("badgeLabel")
        bar_layout.addWidget(badge)

        self.quality_label = QLabel(_quality_label(self.url_str))
        self.quality_label.setObjectName("qualityLabel")
        bar_layout.addWidget(self.quality_label)

        self.title_label = QLabel(self._title)
        self.title_label.setObjectName("titleLabel")
        bar_layout.addWidget(self.title_label, stretch=1)

        self.btn_close = QPushButton("✕")
        self.btn_close.setObjectName("closeBtn")
        self.btn_close.setToolTip("Zamknij (Esc)")
        self.btn_close.clicked.connect(self.close)
        bar_layout.addWidget(self.btn_close)
        card_layout.addWidget(bar)

        self.stage = QWidget()
        self.stage.setStyleSheet("background-color: #000000;")
        stage_layout = QVBoxLayout(self.stage)
        stage_layout.setContentsMargins(0, 0, 0, 0)

        self.video_widget = VideoContainer(self)
        self.video_widget.setStyleSheet("background-color: #000000;")
        try:
            self.video_widget.setAspectRatioMode(Qt.AspectRatioMode.KeepAspectRatio)
        except Exception:
            pass
        stage_layout.addWidget(self.video_widget, stretch=1)

        self.fail_box = QWidget()
        self.fail_box.setVisible(False)
        fail_layout = QVBoxLayout(self.fail_box)
        fail_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        fail_title = QLabel("Trailer niedostępny")
        fail_title.setObjectName("failTitle")
        fail_title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        fail_body = QLabel("Steam nie zwrócił odtwarzalnego pliku wideo dla tej gry.")
        fail_body.setObjectName("failBody")
        fail_body.setAlignment(Qt.AlignmentFlag.AlignCenter)
        fail_body.setWordWrap(True)
        self.btn_browser = QPushButton("Otwórz w przeglądarce")
        self.btn_browser.clicked.connect(self._open_external)
        fail_layout.addWidget(fail_title)
        fail_layout.addWidget(fail_body)
        fail_layout.addWidget(self.btn_browser, alignment=Qt.AlignmentFlag.AlignCenter)
        stage_layout.addWidget(self.fail_box)
        card_layout.addWidget(self.stage)

        self.player = QMediaPlayer(self)
        self.audio = QAudioOutput(self)
        self.audio.setVolume(0.85)
        self.player.setAudioOutput(self.audio)
        self.player.setVideoOutput(self.video_widget)

        controls_widget = QWidget()
        controls_widget.setObjectName("controlsBar")
        self._controls = controls_widget
        controls_layout = QHBoxLayout(controls_widget)
        controls_layout.setContentsMargins(14, 10, 14, 12)
        controls_layout.setSpacing(10)

        self.btn_play = QPushButton("Pause")
        self.btn_play.setObjectName("playBtn")
        self.btn_play.clicked.connect(self._toggle_play)
        controls_layout.addWidget(self.btn_play)

        self.time_label = QLabel("00:00 / 00:00")
        controls_layout.addWidget(self.time_label)

        self.timeline = QSlider(Qt.Orientation.Horizontal)
        self.timeline.setRange(0, 0)
        self.timeline.sliderMoved.connect(self._seek)
        controls_layout.addWidget(self.timeline, stretch=1)

        self.btn_mute = QPushButton("🔊")
        self.btn_mute.setFixedWidth(38)
        self.btn_mute.clicked.connect(self._toggle_mute)
        controls_layout.addWidget(self.btn_mute)

        self.vol_slider = QSlider(Qt.Orientation.Horizontal)
        self.vol_slider.setRange(0, 100)
        self.vol_slider.setValue(85)
        self.vol_slider.setFixedWidth(88)
        self.vol_slider.valueChanged.connect(self._set_volume)
        controls_layout.addWidget(self.vol_slider)

        self.btn_fill = QPushButton("Fill")
        self.btn_fill.setToolTip("Przytnij kadr do 16:9 (F)")
        self.btn_fill.clicked.connect(self.toggle_fill)
        controls_layout.addWidget(self.btn_fill)

        self.btn_expand = QPushButton("⛶")
        self.btn_expand.setFixedWidth(38)
        self.btn_expand.setToolTip("Większy player (F11)")
        self.btn_expand.clicked.connect(self.toggle_expand)
        controls_layout.addWidget(self.btn_expand)

        card_layout.addWidget(controls_widget)
        root.addWidget(self._card, alignment=Qt.AlignmentFlag.AlignCenter)

        self.player.positionChanged.connect(self._position_changed)
        self.player.durationChanged.connect(self._duration_changed)
        self.player.errorOccurred.connect(self._on_player_error)
        self.player.mediaStatusChanged.connect(self._on_media_status)

        if self._host is not None:
            self._host.installEventFilter(self)
            win = self._host.window()
            if win is not None and win is not self._host:
                win.installEventFilter(self)

        self._sync_geom()
        self.raise_()
        self.show()
        self.setFocus()
        self._play_index(0)

    def _sync_geom(self):
        host = self._host
        parent = self.parentWidget()
        if host is None or parent is None:
            return
        top_left = host.mapTo(parent, QPoint(0, 0))
        self.setGeometry(QRect(top_left, host.size()))
        margin = 28 if self._expanded else 72
        chrome_h = 98
        avail_w = max(640, host.width() - margin * 2)
        avail_h = max(360, host.height() - margin * 2 - chrome_h)
        cap = 1600 if self._expanded else 1280
        w = min(cap, avail_w)
        h = int(w * 9 / 16)
        if h > avail_h:
            h = avail_h
            w = int(h * 16 / 9)
        self._card.setFixedWidth(w)
        self.stage.setFixedHeight(h)

    def eventFilter(self, obj, event):
        if event.type() in (QEvent.Type.Resize, QEvent.Type.Move):
            self._sync_geom()
        return False

    def mousePressEvent(self, event: QMouseEvent):
        child = self.childAt(event.position().toPoint())
        widget = child
        while widget is not None and widget is not self:
            if widget is self._card:
                super().mousePressEvent(event)
                return
            widget = widget.parentWidget()
        self.close()

    def toggle_expand(self):
        self._expanded = not self._expanded
        self.btn_expand.setToolTip("Mniejszy player (F11)" if self._expanded else "Większy player (F11)")
        self._sync_geom()

    def toggle_fill(self):
        self._fill = not self._fill
        mode = (
            Qt.AspectRatioMode.KeepAspectRatioByExpanding
            if self._fill
            else Qt.AspectRatioMode.KeepAspectRatio
        )
        try:
            self.video_widget.setAspectRatioMode(mode)
        except Exception:
            pass
        self.btn_fill.setText("Fit" if self._fill else "Fill")

    def _toggle_play(self):
        if self.player.playbackState() == QMediaPlayer.PlaybackState.PlayingState:
            self.player.pause()
            self.btn_play.setText("Play")
        else:
            self.player.play()
            self.btn_play.setText("Pause")

    def _toggle_mute(self):
        is_muted = self.audio.isMuted()
        self.audio.setMuted(not is_muted)
        self.btn_mute.setText("🔇" if not is_muted else "🔊")

    def _set_volume(self, val):
        self.audio.setVolume(val / 100.0)
        if self.audio.isMuted():
            self.audio.setMuted(False)
            self.btn_mute.setText("🔊")

    def _seek(self, pos):
        self.player.setPosition(pos)

    def _position_changed(self, pos):
        if not self.timeline.isSliderDown():
            self.timeline.setValue(pos)
        self._update_time(pos, self.player.duration())

    def _duration_changed(self, dur):
        self.timeline.setRange(0, dur)
        self._update_time(self.player.position(), dur)

    def _update_time(self, pos, dur):
        cur_t = QTime(0, 0, 0).addMSecs(max(0, pos)).toString("mm:ss")
        dur_t = QTime(0, 0, 0).addMSecs(max(0, dur)).toString("mm:ss")
        self.time_label.setText(f"{cur_t} / {dur_t}")

    def _open_external(self):
        if self.url_str:
            QDesktopServices.openUrl(QUrl(self.url_str))

    def _play_index(self, idx: int):
        if idx < 0 or idx >= len(self._urls):
            return
        self._url_idx = idx
        self.url_str = self._urls[idx]
        logger.info("Playing trailer URL %s/%s", idx + 1, len(self._urls))
        self.fail_box.setVisible(False)
        self.video_widget.setVisible(True)
        self._controls.setVisible(True)
        self.quality_label.setText(_quality_label(self.url_str))
        self.player.setSource(QUrl(self.url_str))
        self.player.play()
        self.btn_play.setText("Pause")

    def _advance_url(self):
        if self._advancing:
            return
        self._advancing = True
        nxt = self._url_idx + 1
        if nxt < len(self._urls):
            QTimer.singleShot(0, lambda: self._play_next(nxt))
            return
        logger.warning("All trailer URLs failed: %s", self.url_str)
        self._show_failed()
        self._advancing = False

    def _play_next(self, idx: int):
        self._advancing = False
        self._play_index(idx)

    def _show_failed(self):
        try:
            self.player.stop()
        except Exception:
            pass
        self.video_widget.setVisible(False)
        self._controls.setVisible(False)
        self.fail_box.setVisible(True)

    def _on_media_status(self, status):
        if status == QMediaPlayer.MediaStatus.InvalidMedia:
            logger.warning("Trailer media invalid: %s", self.url_str)
            self._advance_url()

    def _on_player_error(self, err, err_str):
        logger.warning("Trailer playback error: %s (%s) url=%s", err_str, err, self.url_str)
        self._advance_url()

    def keyPressEvent(self, event: QKeyEvent):
        if event.key() == Qt.Key.Key_Escape:
            if self._expanded:
                self.toggle_expand()
                return
            self.close()
        elif event.key() == Qt.Key.Key_Space:
            self._toggle_play()
        elif event.key() == Qt.Key.Key_F11:
            self.toggle_expand()
        elif event.key() == Qt.Key.Key_F:
            self.toggle_fill()
        else:
            super().keyPressEvent(event)

    def closeEvent(self, event):
        try:
            self.player.stop()
        except Exception:
            pass
        host = self._host
        if host is not None:
            try:
                host.removeEventFilter(self)
            except Exception:
                pass
            win = host.window()
            if win is not None:
                try:
                    win.removeEventFilter(self)
                except Exception:
                    pass
        super().closeEvent(event)
        self.deleteLater()


_ACTIVE_TRAILER = None


def play_trailer_native(url_str: str, title: str = "Trailer", parent=None):
    """Show the trailer as an in-window overlay over the WebEngine UI."""
    global _ACTIVE_TRAILER
    urls = _split_trailer_urls(url_str)
    if not urls:
        return False
    if _ACTIVE_TRAILER is not None:
        try:
            _ACTIVE_TRAILER.close()
        except Exception:
            pass
        _ACTIVE_TRAILER = None
    host = _resolve_host(parent)
    _ACTIVE_TRAILER = TrailerOverlay("|".join(urls), title, host=host)
    return True
