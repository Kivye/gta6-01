// Keyboard and mouse state for the whole game. One Input instance owns
// the listeners: `down` is level-triggered (held), `hit` is edge-triggered
// (pressed since the last endFrame), and the mouse deltas accumulate only
// while the pointer is locked to the canvas.
export class Input {
  constructor(canvas, onPause) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.playing = false;
    this.onPause = onPause;
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault(); // the page must never scroll
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPause();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => {
      if (this.playing && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.()?.catch?.(() => {});
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  // Called once per frame after every system has read the state.
  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; }
  // WASD as a -1..1 axis pair, arrows folded in.
  moveAxis() {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const z = (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0) - (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0);
    return { x, z };
  }
}
