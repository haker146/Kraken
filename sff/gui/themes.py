# SteaMidra - Steam game setup and manifest tool (SFF)
# Copyright (c) 2025-2026 Midrag (https://github.com/Midrags)
#
# This file is part of SteaMidra.
#
# SteaMidra is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# SteaMidra is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with SteaMidra.  If not, see <https://www.gnu.org/licenses/>.

def _gen_dark_variant(bg, fg, accent, btn_bg, btn_hover, input_bg, border):
    """Generate a Qt stylesheet from the Steam-like core colors."""
    return f"""
QMainWindow, QWidget {{ background-color: {bg}; color: {fg}; }}
QGroupBox {{
    font-weight: bold; border: 1px solid {border}; border-radius: 4px;
    margin-top: 8px; padding-top: 8px; color: {fg};
}}
QGroupBox::title {{ subcontrol-origin: margin; left: 10px; padding: 0 4px; color: {fg}; }}
QPushButton {{
    background-color: {btn_bg}; border: 1px solid {border}; border-radius: 3px;
    padding: 6px 12px; min-width: 80px; color: {fg};
}}
QPushButton:hover {{ background-color: {btn_hover}; color: #fff; }}
QPushButton:pressed {{ background-color: {accent}; color: #1b2838; }}
QPushButton:disabled {{ background-color: {bg}; color: {border}; }}
QLineEdit, QComboBox {{
    background-color: {input_bg}; border: 1px solid {border}; border-radius: 3px;
    padding: 4px; min-height: 20px; color: #fff;
}}
QComboBox::drop-down {{ border: none; width: 24px; min-width: 24px; }}
QComboBox QAbstractItemView {{ background-color: {input_bg}; color: {fg}; }}
QTextEdit, QPlainTextEdit {{
    background-color: {input_bg}; border: 1px solid {border}; border-radius: 3px;
    font-family: Consolas, monospace; font-size: 12px; color: {fg};
}}
QMenuBar {{ background-color: {btn_bg}; color: {fg}; }}
QMenuBar::item:selected {{ background-color: {btn_hover}; color: #fff; }}
QMenu {{ background-color: {bg}; color: {fg}; }}
QMenu::item:selected {{ background-color: {btn_hover}; color: #fff; }}
QRadioButton {{ color: {fg}; }}
QRadioButton::indicator {{ width: 14px; height: 14px; }}
QRadioButton::indicator:unchecked {{ border: 2px solid {border}; border-radius: 7px; background-color: transparent; }}
QRadioButton::indicator:checked {{ border: 2px solid {accent}; border-radius: 7px; background-color: {accent}; }}
QLabel {{ color: {fg}; }}
QDialog {{ background-color: {bg}; color: {fg}; }}
QTabWidget::pane {{ border: 1px solid {border}; background-color: {bg}; }}
QTabBar::tab {{
    background-color: {btn_bg}; color: {fg}; padding: 8px 16px;
    border: 1px solid {border}; border-bottom: none; border-radius: 3px 3px 0 0;
    margin-right: 2px;
}}
QTabBar::tab:selected {{ background-color: {bg}; color: {accent}; border-bottom: 2px solid {accent}; }}
QTabBar::tab:hover {{ background-color: {btn_hover}; }}
QProgressBar {{
    border: 1px solid {border}; border-radius: 3px;
    background-color: {input_bg}; text-align: center; color: {fg};
}}
QProgressBar::chunk {{ background-color: {accent}; border-radius: 2px; }}
QTableView {{ background-color: {input_bg}; color: {fg}; gridline-color: {border}; }}
QHeaderView::section {{ background-color: {btn_bg}; color: {fg}; padding: 4px; border: 1px solid {border}; }}
"""


STEAM_STYLE = _gen_dark_variant(
    bg="#1b2838",
    fg="#c7d5e0",
    accent="#66c0f4",
    btn_bg="#2a475e",
    btn_hover="#3d6c8d",
    input_bg="#316282",
    border="#2a475e",
)

THEMES = {
    "steam": ("Steam", STEAM_STYLE),
}

THEME_BACKGROUNDS = {
    "steam": "#1b2838",
}

TITLEBAR_COLORS = {
    "steam": {
        "bg": "#171a21",
        "fg": "#c7d5e0",
        "accent": "#66c0f4",
        "close": "#e81123",
        "border": "#2a475e",
    },
}


def canonical_theme(key: str) -> str:
    return "steam" if key in THEMES else "steam"


def theme_background(key: str) -> str:
    """Hex bg colour for a theme key. Always Steam for now."""
    return THEME_BACKGROUNDS.get(canonical_theme(key), "#1b2838")


def titlebar_colors(key: str) -> dict:
    return TITLEBAR_COLORS.get(canonical_theme(key), TITLEBAR_COLORS["steam"])
