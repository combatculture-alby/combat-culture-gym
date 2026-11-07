import Phaser from 'phaser';

const WIDTH = 480;
const HEIGHT = 270;
const CELL = 12;
type Point = { x: number; y: number };
const obstacles = [
  { x: 368, y: 62, w: 38, h: 80 }, // heavy bag
  { x: 346, y: 180, w: 92, h: 34 }, // reception
];
const inside = (x: number, y: number): boolean =>
  x >= 14 && x <= WIDTH - 14 && y >= 27 && y <= 218 &&
  !obstacles.some(o => x + 9 > o.x && x - 9 < o.x + o.w && y + 8 > o.y && y - 8 < o.y + o.h);

class GymScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private route: Point[] = [];
  private readonly speed = 115;
  constructor() { super('Gym'); }

  create(): void {
    const g = this.add.graphics();
    g.fillStyle(0xc9ae86).fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0x426f70).fillRect(32, 32, 286, 178);
    g.lineStyle(1, 0x639596, 0.7);
    for (let x = 32; x <= 318; x += 32) g.lineBetween(x, 32, x, 210);
    for (let y = 32; y <= 210; y += 32) g.lineBetween(32, y, 318, y);
    g.fillStyle(0x963d35).fillRoundedRect(368, 62, 38, 80, 10);
    g.fillStyle(0x765337).fillRect(346, 180, 92, 34);
    g.fillStyle(0x3b332d).fillRect(0, 0, WIDTH, 14);
    this.add.text(12, 235, 'COMBAT CULTURE GYM | Prototype 0.1', { fontFamily: 'monospace', fontSize: '12px', color: '#29383b' });
    this.add.text(12, 250, 'WASD / Arrows: Move | Click: Move', { fontFamily: 'monospace', fontSize: '10px', color: '#29383b' });
    this.add.text(340, 220, 'RECEPTION', { fontFamily: 'monospace', fontSize: '10px', color: '#493e33' });

    // Temporary owner silhouette; sprite art will replace this container.
    const body = this.add.rectangle(0, 0, 22, 30, 0x292a2c).setStrokeStyle(2, 0xb52427);
    const band = this.add.rectangle(0, -13, 22, 5, 0xd92928);
    this.player = this.add.container(170, 150, [body, band]);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.route = this.findRoute({ x: this.player.x, y: this.player.y }, { x: p.worldX, y: p.worldY });
    });
  }

  private findRoute(start: Point, end: Point): Point[] {
    const cols = Math.ceil(WIDTH / CELL);
    const rows = Math.ceil(HEIGHT / CELL);
    const key = (x: number, y: number) => y * cols + x;
    const cell = (p: Point) => ({
      x: Phaser.Math.Clamp(Math.floor(p.x / CELL), 0, cols - 1),
      y: Phaser.Math.Clamp(Math.floor(p.y / CELL), 0, rows - 1),
    });
    const s = cell(start);
    const goal = cell(end);
    const valid = (x: number, y: number) => x >= 0 && x < cols && y >= 0 && y < rows && inside(x * CELL + CELL / 2, y * CELL + CELL / 2);
    if (!valid(goal.x, goal.y)) return [];
    const queue = [s];
    const previous = new Map<number, number>();
    const visited = new Set<number>([key(s.x, s.y)]);
    let found = false;
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (current.x === goal.x && current.y === goal.y) { found = true; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = current.x + dx, y = current.y + dy, id = key(x, y);
        if (!valid(x, y) || visited.has(id)) continue;
        visited.add(id);
        previous.set(id, key(current.x, current.y));
        queue.push({ x, y });
      }
    }
    if (!found) return [];
    const route: Point[] = [];
    let current = key(goal.x, goal.y);
    const origin = key(s.x, s.y);
    while (current !== origin) {
      route.unshift({ x: (current % cols) * CELL + CELL / 2, y: Math.floor(current / cols) * CELL + CELL / 2 });
      const parent = previous.get(current);
      if (parent === undefined) return [];
      current = parent;
    }
    if (inside(end.x, end.y)) route.push(end);
    return route;
  }

  update(_time: number, delta: number): void {
    let dx = Number(this.cursors.right.isDown || this.wasd.D.isDown) - Number(this.cursors.left.isDown || this.wasd.A.isDown);
    let dy = Number(this.cursors.down.isDown || this.wasd.S.isDown) - Number(this.cursors.up.isDown || this.wasd.W.isDown);
    if (dx || dy) this.route = [];
    else if (this.route.length) {
      const target = this.route[0];
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
      if (distance < 2) { this.route.shift(); return; }
      dx = (target.x - this.player.x) / distance;
      dy = (target.y - this.player.y) / distance;
    }
    const length = Math.hypot(dx, dy);
    if (!length) return;
    const step = Math.min(delta, 50) / 1000 * this.speed;
    const moveX = this.player.x + dx / length * Math.min(step, this.route.length ? Phaser.Math.Distance.Between(this.player.x, this.player.y, this.route[0].x, this.route[0].y) : step);
    const moveY = this.player.y + dy / length * Math.min(step, this.route.length ? Phaser.Math.Distance.Between(this.player.x, this.player.y, this.route[0].x, this.route[0].y) : step);
    if (inside(moveX, this.player.y)) this.player.x = moveX;
    if (inside(this.player.x, moveY)) this.player.y = moveY;
  }
}

new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: WIDTH, height: HEIGHT,
  backgroundColor: '#c9ae86', pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GymScene],
});
