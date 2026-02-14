"""
Bubble Pop! - 2 Player Hand Tracking Game
==========================================
Cara main:
  - Berdiri di depan kamera, masing-masing di kiri / kanan layar
  - Wajah terdeteksi → status READY
  - Kedua player READY → countdown 3-2-1 GO → game mulai
  - Pecahin bubble pakai tangan! Siapa paling banyak menang.
  - Tekan Q / ESC untuk keluar

Requirements:
  pip install -r requirements.txt
"""

import sys
import cv2
import pygame
import numpy as np
from enum import Enum, auto

from hand_tracker import HandTracker
from face_tracker import FaceTracker
from game import Game

# ── Config ───────────────────────────────────────────────────────────────────
WINDOW_TITLE  = "Bubble Pop!"
CAM_INDEX     = 0
TARGET_FPS    = 30
FLIP_CAMERA   = True
CAM_W, CAM_H  = 1280, 720

# Berapa frame wajah harus terdeteksi terus sebelum dianggap READY
READY_HOLD_FRAMES  = 40
# Berapa frame hilang sebelum kembali NOT READY
UNREADY_HOLD_FRAMES = 25

COUNTDOWN_SECS = 3   # 3-2-1 lalu GO
GO_HOLD_SECS   = 0.8 # durasi tampil "GO!" sebelum game mulai

PLAYER_COLORS = {1: (100, 200, 255), 2: (255, 150, 100)}
# ─────────────────────────────────────────────────────────────────────────────


class GameState(Enum):
    LOBBY     = auto()
    COUNTDOWN = auto()
    PLAYING   = auto()
    GAME_OVER = auto()


def frame_to_surface(frame_bgr: np.ndarray) -> pygame.Surface:
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    return pygame.surfarray.make_surface(np.transpose(frame_rgb, (1, 0, 2)))


def draw_overlay(surface, alpha=100):
    ov = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
    ov.fill((0, 0, 0, alpha))
    surface.blit(ov, (0, 0))


def draw_lobby(screen, w, h, player_ready, face_hold, font_title, font_sub, font_hint):
    draw_overlay(screen, alpha=110)

    # Garis tengah
    pygame.draw.line(screen, (255, 255, 255), (w // 2, 0), (w // 2, h), 2)

    for player in [1, 2]:
        color  = PLAYER_COLORS[player]
        cx     = w // 4 if player == 1 else 3 * w // 4
        ready  = player_ready[player]

        # Kotak kartu (semi transparan)
        card_w, card_h = 320, 200
        card_x = cx - card_w // 2
        card_y = h // 2 - card_h // 2 - 20
        card_surf = pygame.Surface((card_w, card_h), pygame.SRCALPHA)
        card_surf.fill((0, 0, 0, 140))
        pygame.draw.rect(card_surf, (*color, 180), (0, 0, card_w, card_h), 3, border_radius=16)
        screen.blit(card_surf, (card_x, card_y))

        # Label "PLAYER X"
        lbl = font_title.render(f"PLAYER {player}", True, color)
        screen.blit(lbl, (cx - lbl.get_width() // 2, card_y + 20))

        # Status
        if ready:
            status_txt   = "READY!"
            status_color = (80, 255, 100)
        else:
            status_txt   = "NOT READY"
            status_color = (200, 60, 60)

        status_surf = font_sub.render(status_txt, True, status_color)
        screen.blit(status_surf, (cx - status_surf.get_width() // 2, card_y + 90))

        # Progress bar (berapa lama wajah sudah terdeteksi)
        bar_w = card_w - 40
        bar_x = card_x + 20
        bar_y = card_y + 148
        bar_fill = int(bar_w * min(face_hold[player] / READY_HOLD_FRAMES, 1.0))
        pygame.draw.rect(screen, (60, 60, 60), (bar_x, bar_y, bar_w, 14), border_radius=7)
        if bar_fill > 0:
            pygame.draw.rect(screen, color, (bar_x, bar_y, bar_fill, 14), border_radius=7)

    # Hint di atas
    hint = font_hint.render("Berdiri di depan kamera — kiri = P1, kanan = P2", True, (220, 220, 220))
    screen.blit(hint, (w // 2 - hint.get_width() // 2, 30))


def draw_countdown(screen, w, h, number, font_big, font_sub):
    draw_overlay(screen, alpha=130)

    if number > 0:
        text  = str(number)
        color = (255, 220, 60)
    else:
        text  = "GO!"
        color = (80, 255, 100)

    rendered = font_big.render(text, True, color)
    # Bayangan
    shadow = font_big.render(text, True, (0, 0, 0))
    cx = w // 2 - rendered.get_width() // 2
    cy = h // 2 - rendered.get_height() // 2
    screen.blit(shadow, (cx + 4, cy + 4))
    screen.blit(rendered, (cx, cy))

    sub = font_sub.render("Siapkan tangan kamu!", True, (220, 220, 220))
    screen.blit(sub, (w // 2 - sub.get_width() // 2, cy + rendered.get_height() + 10))


def draw_game_over(screen, w, h, scores, winner, font_title, font_sub, font_hint):
    draw_overlay(screen, alpha=160)

    # Judul
    title_color = (255, 220, 60)
    title = font_title.render("GAME OVER!", True, title_color)
    shadow = font_title.render("GAME OVER!", True, (0, 0, 0))
    tx = w // 2 - title.get_width() // 2
    ty = h // 2 - 160
    screen.blit(shadow, (tx + 3, ty + 3))
    screen.blit(title, (tx, ty))

    # Skor masing-masing player
    for player, cx in [(1, w // 4), (2, 3 * w // 4)]:
        color = PLAYER_COLORS[player]
        is_winner = winner == player

        # Kotak
        card_w, card_h = 280, 160
        card_x = cx - card_w // 2
        card_y = h // 2 - 70
        border_color = (255, 220, 60) if is_winner else color
        card_surf = pygame.Surface((card_w, card_h), pygame.SRCALPHA)
        card_surf.fill((0, 0, 0, 160))
        border_thick = 4 if is_winner else 2
        pygame.draw.rect(card_surf, (*border_color, 220),
                         (0, 0, card_w, card_h), border_thick, border_radius=16)
        screen.blit(card_surf, (card_x, card_y))

        # Label player
        lbl = font_sub.render(f"Player {player}", True, color)
        screen.blit(lbl, (cx - lbl.get_width() // 2, card_y + 15))

        # Skor
        sc = font_title.render(str(scores[player]), True, color)
        screen.blit(sc, (cx - sc.get_width() // 2, card_y + 60))

        # Mahkota kalau menang
        if is_winner:
            crown = font_sub.render("WINNER!", True, (255, 220, 60))
            screen.blit(crown, (cx - crown.get_width() // 2, card_y + card_h + 10))

    if winner is None:
        tie = font_sub.render("SERI!", True, (220, 220, 220))
        screen.blit(tie, (w // 2 - tie.get_width() // 2, h // 2 + 120))

    # Hint restart
    hint = font_hint.render("Tekan SPACE untuk main lagi  |  ESC untuk keluar", True, (180, 180, 180))
    screen.blit(hint, (w // 2 - hint.get_width() // 2, h - 50))


def main():
    # Camera
    cap = cv2.VideoCapture(CAM_INDEX)
    if not cap.isOpened():
        print(f"[ERROR] Tidak bisa buka kamera index {CAM_INDEX}")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAM_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_H)
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"[INFO] Kamera: {W}x{H}")

    # Pygame
    pygame.init()
    screen = pygame.display.set_mode((W, H))
    pygame.display.set_caption(WINDOW_TITLE)
    clock = pygame.time.Clock()

    font_title     = pygame.font.SysFont("Arial", 52, bold=True)
    font_sub       = pygame.font.SysFont("Arial", 34, bold=True)
    font_hint      = pygame.font.SysFont("Arial", 22)
    font_countdown = pygame.font.SysFont("Arial", 200, bold=True)

    face_tracker = FaceTracker()
    hand_tracker = HandTracker(max_hands=2)
    game = Game(W, H)

    state = GameState.LOBBY

    # Hysteresis counters
    face_hold   = {1: 0, 2: 0}   # frame terdeteksi berturut
    face_miss   = {1: 0, 2: 0}   # frame tidak terdeteksi berturut
    player_ready = {1: False, 2: False}

    countdown_start_ms = 0

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_q, pygame.K_ESCAPE):
                    running = False
                elif event.key == pygame.K_SPACE and state == GameState.GAME_OVER:
                    # Restart: kembali ke lobby
                    state = GameState.LOBBY
                    face_hold = {1: 0, 2: 0}
                    face_miss = {1: 0, 2: 0}
                    player_ready = {1: False, 2: False}

        ret, frame = cap.read()
        if not ret:
            continue

        if FLIP_CAMERA:
            frame = cv2.flip(frame, 1)

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Background kamera
        screen.blit(frame_to_surface(frame), (0, 0))

        # ── LOBBY ─────────────────────────────────────────────────────────────
        if state == GameState.LOBBY:
            detected = face_tracker.detect_players(frame_rgb, W, H)

            for p in [1, 2]:
                if p in detected:
                    face_hold[p] = min(face_hold[p] + 1, READY_HOLD_FRAMES + 5)
                    face_miss[p] = 0
                else:
                    face_miss[p] += 1
                    if face_miss[p] >= UNREADY_HOLD_FRAMES:
                        face_hold[p] = max(face_hold[p] - 2, 0)

                player_ready[p] = face_hold[p] >= READY_HOLD_FRAMES

            draw_lobby(screen, W, H, player_ready, face_hold, font_title, font_sub, font_hint)

            # Kalau dua-duanya READY → mulai countdown
            if player_ready[1] and player_ready[2]:
                state = GameState.COUNTDOWN
                countdown_start_ms = pygame.time.get_ticks()
                game = Game(W, H)   # reset game baru

        # ── COUNTDOWN ─────────────────────────────────────────────────────────
        elif state == GameState.COUNTDOWN:
            elapsed_s = (pygame.time.get_ticks() - countdown_start_ms) / 1000.0
            number    = COUNTDOWN_SECS - int(elapsed_s)   # 3 → 2 → 1 → 0 (GO!)

            draw_countdown(screen, W, H, max(number, 0), font_countdown, font_hint)

            if elapsed_s >= COUNTDOWN_SECS + GO_HOLD_SECS:
                state = GameState.PLAYING
                game.initial_spawn()   # penuhkan layar bubble

        # ── PLAYING ───────────────────────────────────────────────────────────
        elif state == GameState.PLAYING:
            draw_overlay(screen, alpha=75)
            hands_data = hand_tracker.process(frame_rgb, W, H)
            game.update(hands_data)
            game.draw(screen, hands_data)

            if game.finished:
                state = GameState.GAME_OVER

        # ── GAME OVER ─────────────────────────────────────────────────────────
        elif state == GameState.GAME_OVER:
            draw_overlay(screen, alpha=75)
            game.draw(screen, [])   # gambar sisa partikel
            draw_game_over(screen, W, H, game.scores, game.get_winner(),
                           font_title, font_sub, font_hint)

        pygame.display.flip()
        clock.tick(TARGET_FPS)

    face_tracker.close()
    hand_tracker.close()
    cap.release()
    pygame.quit()
    print("[INFO] Game selesai.")


if __name__ == "__main__":
    main()
