// src/game/Engine.ts
export const PLAYER_COLORS = {
  1: 'rgb(100, 200, 255)', 
  2: 'rgb(255, 150, 100)', 
};

export class Bubble {
  x: number;
  y: number;
  radius: number;
  vy: number;
  vx: number;
  alpha: number;
  alive: boolean = true;
  wobble: number;
  wobbleSpeed: number;

  constructor(width: number, height: number, startY?: number) {
    this.radius = Math.random() * (52 - 22) + 22;
    this.x = Math.random() * (width - this.radius * 2) + this.radius;
    this.y = startY !== undefined ? startY : height + this.radius;
    this.vy = -(Math.random() * (2.2 - 0.6) + 0.6);
    this.vx = (Math.random() - 0.5) * 1.2;
    this.alpha = Math.random() * (220 - 160) + 160;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * (0.06 - 0.02) + 0.02;
  }

  update(width: number) {
    this.wobble += this.wobbleSpeed;
    this.x += this.vx + Math.sin(this.wobble) * 0.4;
    this.y += this.vy;

    if (this.x - this.radius < 0 || this.x + this.radius > width) {
      this.vx *= -1;
      this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
    }

    if (this.y + this.radius < 0) {
      this.alive = false;
    }
  }

  checkPop(fx: number, fy: number): boolean {
    const dist = Math.hypot(fx - this.x, fy - this.y);
    return dist < this.radius;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.alpha / 255;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x - this.radius / 3, this.y - this.radius / 3, this.radius / 5, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.restore();
  }
}

export class PopParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number = 1.0;
  color: string;
  radius: number;

  constructor(x: number, y: number, color: string) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.radius = Math.random() * 4 + 3;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.18; 
    this.life -= 0.055;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
