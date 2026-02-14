import pygame
import random
import math

PLAYER_COLORS = {
    1: (100, 200, 255),   # Blue  - Player 1
    2: (255, 150, 100),   # Orange - Player 2
}

POP_PARTICLE_COUNT = 10


class Bubble:
    MIN_RADIUS = 22
    MAX_RADIUS = 52
    SPEED_MIN = 0.6
    SPEED_MAX = 2.2

    def __init__(self, screen_w, screen_h, start_y=None):
        self.radius = random.randint(self.MIN_RADIUS, self.MAX_RADIUS)
        self.x = float(random.randint(self.radius, screen_w - self.radius))
        # start_y: kalau None muncul dari bawah, kalau diset langsung di posisi itu
        self.y = float(start_y if start_y is not None else screen_h + self.radius)
        self.vy = -random.uniform(self.SPEED_MIN, self.SPEED_MAX)
        self.vx = random.uniform(-0.6, 0.6)
        self.alpha = random.randint(160, 220)
        self.alive = True
        self.screen_w = screen_w
        self.screen_h = screen_h
        self.wobble = random.uniform(0, math.pi * 2)
        self.wobble_speed = random.uniform(0.02, 0.06)

    def update(self):
        self.wobble += self.wobble_speed
        self.x += self.vx + math.sin(self.wobble) * 0.4
        self.y += self.vy

        if self.x - self.radius < 0 or self.x + self.radius > self.screen_w:
            self.vx *= -1
            self.x = max(self.radius, min(self.screen_w - self.radius, self.x))

        if self.y + self.radius < 0:
            self.alive = False

    def check_pop(self, index_tip):
        """Hanya index finger tip yang bisa pop bubble."""
        fx, fy = index_tip
        return math.hypot(fx - self.x, fy - self.y) < self.radius

    def draw(self, surface):
        size = self.radius * 2 + 4
        bubble_surf = pygame.Surface((size, size), pygame.SRCALPHA)
        cx = cy = self.radius + 2

        pygame.draw.circle(bubble_surf, (255, 255, 255, self.alpha // 4), (cx, cy), self.radius)
        pygame.draw.circle(bubble_surf, (255, 255, 255, self.alpha), (cx, cy), self.radius, 2)
        glint_x = cx - self.radius // 3
        glint_y = cy - self.radius // 3
        pygame.draw.circle(bubble_surf, (255, 255, 255, self.alpha), (glint_x, glint_y), self.radius // 5)

        surface.blit(bubble_surf, (int(self.x) - self.radius - 2, int(self.y) - self.radius - 2))


class PopParticle:
    def __init__(self, x, y, color):
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(2, 7)
        self.x = float(x)
        self.y = float(y)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.life = 1.0
        self.color = color
        self.radius = random.randint(3, 7)

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.vy += 0.18
        self.life -= 0.055

    @property
    def alive(self):
        return self.life > 0

    def draw(self, surface):
        alpha = int(self.life * 255)
        r, g, b = self.color
        s = pygame.Surface((self.radius * 2, self.radius * 2), pygame.SRCALPHA)
        pygame.draw.circle(s, (r, g, b, alpha), (self.radius, self.radius), self.radius)
        surface.blit(s, (int(self.x) - self.radius, int(self.y) - self.radius))


class Game:
    TOTAL_BUBBLES  = 40   # jumlah fixed bubble per ronde
    POINTS_PER_POP = 10

    def __init__(self, screen_w, screen_h):
        self.screen_w = screen_w
        self.screen_h = screen_h
        self.bubbles: list[Bubble] = []
        self.particles: list[PopParticle] = []
        self.scores = {1: 0, 2: 0}
        self.remaining = self.TOTAL_BUBBLES
        self.font_large = pygame.font.SysFont("Arial", 52, bold=True)
        self.font_small = pygame.font.SysFont("Arial", 28)

    def initial_spawn(self):
        """Spawn semua bubble sekaligus, sebar di seluruh layar."""
        for _ in range(self.TOTAL_BUBBLES):
            b = Bubble(self.screen_w, self.screen_h)
            b.y = float(random.randint(
                int(self.screen_h * 0.05),
                int(self.screen_h * 0.90),
            ))
            self.bubbles.append(b)
        self.remaining = self.TOTAL_BUBBLES

    @property
    def finished(self):
        """True kalau semua bubble sudah habis (dipop atau keluar layar)."""
        return self.remaining == 0 and len(self.bubbles) == 0

    def get_winner(self):
        """Return 1, 2, atau None (seri)."""
        if self.scores[1] > self.scores[2]:
            return 1
        if self.scores[2] > self.scores[1]:
            return 2
        return None

    def update(self, hands_data):
        for bubble in self.bubbles:
            bubble.update()
            for hand in hands_data:
                if bubble.alive and bubble.check_pop(hand["index_tip"]):
                    bubble.alive = False
                    player = hand["player"]
                    self.scores[player] += self.POINTS_PER_POP
                    color = PLAYER_COLORS[player]
                    for _ in range(POP_PARTICLE_COUNT):
                        self.particles.append(PopParticle(bubble.x, bubble.y, color))
                    break

        # Hitung bubble yang hilang (dipop atau keluar layar atas)
        dead = [b for b in self.bubbles if not b.alive]
        self.remaining = max(0, self.remaining - len(dead))
        self.bubbles = [b for b in self.bubbles if b.alive]

        for p in self.particles:
            p.update()
        self.particles = [p for p in self.particles if p.alive]

    def draw(self, surface, hands_data):
        # Divider
        pygame.draw.line(surface, (255, 255, 255),
                         (self.screen_w // 2, 0), (self.screen_w // 2, self.screen_h), 2)

        for bubble in self.bubbles:
            bubble.draw(surface)

        for p in self.particles:
            p.draw(surface)

        # Hanya tampilkan cursor index finger tip
        for hand in hands_data:
            color = PLAYER_COLORS[hand["player"]]
            fx, fy = hand["index_tip"]
            pygame.draw.circle(surface, color, (fx, fy), 12)
            pygame.draw.circle(surface, (255, 255, 255), (fx, fy), 12, 2)

        self._draw_scores(surface)

    def _draw_scores(self, surface):
        c1 = PLAYER_COLORS[1]
        lbl1 = self.font_small.render("Player 1", True, c1)
        sc1  = self.font_large.render(str(self.scores[1]), True, c1)
        surface.blit(lbl1, (20, 15))
        surface.blit(sc1,  (20, 48))

        c2 = PLAYER_COLORS[2]
        lbl2 = self.font_small.render("Player 2", True, c2)
        sc2  = self.font_large.render(str(self.scores[2]), True, c2)
        surface.blit(lbl2, (self.screen_w - lbl2.get_width() - 20, 15))
        surface.blit(sc2,  (self.screen_w - sc2.get_width()  - 20, 48))

        # Sisa bubble di tengah atas
        font_rem = self.font_small
        rem_surf = font_rem.render(f"Bubble: {self.remaining}", True, (255, 255, 255))
        surface.blit(rem_surf, (self.screen_w // 2 - rem_surf.get_width() // 2, 15))
