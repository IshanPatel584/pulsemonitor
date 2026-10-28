import { useEffect, useRef } from 'react';
import { motionReduced } from '../../hooks/useMotion';

// Same grid as the original .bg-grid: 48px cells, 1px lines at 60% of --line.
const CELL = 48;
const LINE_ALPHA = 0.6;
const SAMPLE = 12; // px between vertices along each grid line
const MARGIN = CELL * 2; // draw past the edges so displaced lines never leave gaps

// Wave (CSS px / radians). Amplitude eases between CALM (idle or cursor away)
// and up to MAX depending on the cursor's vertical position.
const AMP_CALM = 7;
const AMP_MAX = 22;
const MAX_DIRECTION = 0.55; // rad of wave rotation at the far left/right
const PHASE_X_RANGE = 1.6;
const PHASE_Y_RANGE = 1.0;
const FREQ_CALM = 1.3;
const EASE = 0.045; // fraction of the remaining distance per 16.7ms frame

const INTERACTIVE_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 768px)';

const VERTEX_SHADER = `
attribute vec2 a_pos;   // this vertex on the flat grid (CSS px)
attribute vec2 a_other; // the other end of its segment
attribute float a_side; // -1 / +1: which edge of the line quad

uniform vec2 u_res;
uniform float u_time;
uniform float u_amp;
uniform float u_ampMax;
uniform float u_dir;
uniform vec2 u_phase;
uniform float u_freq;
uniform mediump float u_halfWidth; // shared with the fragment shader: precisions must match

varying float v_side;
varying float v_light;

// One height field for the whole surface, from global grid coordinates and time.
float height(vec2 p) {
  vec2 d = vec2(cos(u_dir), sin(u_dir));
  vec2 q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x))) / 520.0;
  float a = sin(q.x * 2.2 + u_phase.x + u_time * 0.55) * cos(q.y * u_freq + u_phase.y + u_time * 0.4);
  float b = sin((q.x * 0.8 - q.y * 1.1) * 1.6 + u_time * 0.3 + u_phase.x * 0.6);
  return u_amp * (a * 0.72 + b * 0.28);
}

// Perspective-ish projection: crests rise and spread slightly, troughs sink.
vec2 project(vec2 p, float z) {
  float s = 900.0 / (900.0 - z);
  return vec2(u_res.x * 0.5 + (p.x - u_res.x * 0.5) * s, p.y - z * 0.9);
}

void main() {
  float z = height(a_pos);
  vec2 s0 = project(a_pos, z);
  vec2 s1 = project(a_other, height(a_other));
  vec2 dir = s1 - s0;
  float len = max(length(dir), 1e-4);
  vec2 normal = vec2(-dir.y, dir.x) / len;
  vec2 screen = s0 + normal * a_side * u_halfWidth;

  v_side = a_side;
  v_light = clamp(z / u_ampMax, -1.0, 1.0);
  vec2 clip = screen / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 u_line;
uniform vec3 u_accent;
uniform float u_alpha;
uniform float u_halfWidth;
uniform float u_feather;
varying float v_side;
varying float v_light;

void main() {
  // 1px line with a soft edge for anti-aliasing.
  float dist = abs(v_side) * u_halfWidth;
  float coverage = 1.0 - smoothstep(0.5 - u_feather, 0.5 + u_feather, dist);
  // Subtle lighting: crests pick up a little accent colour, troughs dim slightly.
  float crest = max(v_light, 0.0);
  vec3 color = mix(u_line, u_accent, crest * 0.45);
  float alpha = u_alpha * coverage * (0.85 + 0.35 * v_light);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'Shader compile failed');
  }
  return shader;
}

function readRgb(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
    .split(/\s+/)
    .map((c) => Number(c) / 255);
}

/** Vertices for every grid line as thin quads: [x, y, otherX, otherY, side] × 6 per segment. */
function buildGeometry(width, height) {
  const segments = [];
  const addLine = (x0, y0, x1, y1) => {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(length / SAMPLE));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      segments.push([x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1]);
    }
  };
  for (let x = 0.5 - MARGIN; x <= width + MARGIN; x += CELL) addLine(x, -MARGIN, x, height + MARGIN);
  for (let y = 0.5 - MARGIN; y <= height + MARGIN; y += CELL) addLine(-MARGIN, y, width + MARGIN, y);

  const data = new Float32Array(segments.length * 6 * 5);
  let o = 0;
  const push = (x, y, ox, oy, side) => {
    data[o++] = x;
    data[o++] = y;
    data[o++] = ox;
    data[o++] = oy;
    data[o++] = side;
  };
  for (const [ax, ay, bx, by] of segments) {
    // The end vertices look back at the start, which flips the normal, so their side is negated.
    push(ax, ay, bx, by, -1);
    push(ax, ay, bx, by, 1);
    push(bx, by, ax, ay, 1);
    push(ax, ay, bx, by, -1);
    push(bx, by, ax, ay, 1);
    push(bx, by, ax, ay, -1);
  }
  return { data, count: segments.length * 6 };
}

/**
 * Landing-hero background: the existing grid rendered by WebGL as a continuous
 * 3D surface. A vertex shader displaces every vertex of both line directions
 * with one global height field (broad sine/cosine waves over grid coordinates
 * and time). The mouse steers the whole wave — direction and phase from its
 * horizontal position, amplitude and shape from its vertical position — all
 * eased in a requestAnimationFrame loop with no React re-renders.
 */
export default function HeroGrid() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const area = stage?.parentElement;
    if (!stage || !canvas || !area) return undefined;

    const fallbackToCss = () => {
      canvas.style.display = 'none';
      stage.classList.add('bg-grid');
    };

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) {
      fallbackToCss();
      return undefined;
    }

    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    } catch {
      fallbackToCss();
      return undefined;
    }
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const attr = (name) => gl.getAttribLocation(program, name);
    const uni = (name) => gl.getUniformLocation(program, name);
    const loc = {
      pos: attr('a_pos'),
      other: attr('a_other'),
      side: attr('a_side'),
      res: uni('u_res'),
      time: uni('u_time'),
      amp: uni('u_amp'),
      ampMax: uni('u_ampMax'),
      dir: uni('u_dir'),
      phase: uni('u_phase'),
      freq: uni('u_freq'),
      halfWidth: uni('u_halfWidth'),
      feather: uni('u_feather'),
      line: uni('u_line'),
      accent: uni('u_accent'),
      alpha: uni('u_alpha'),
    };

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = 5 * 4;
    gl.enableVertexAttribArray(loc.pos);
    gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc.other);
    gl.vertexAttribPointer(loc.other, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(loc.side);
    gl.vertexAttribPointer(loc.side, 1, gl.FLOAT, false, stride, 16);

    const interactive = window.matchMedia(INTERACTIVE_QUERY);
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Fewer cores usually means a weaker GPU: render at 1x to keep it light.
    const lowPower = (navigator.hardwareConcurrency || 8) <= 4;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let vertexCount = 0;
    let frame = 0;
    let lastNow = 0;
    let time = 0;
    let visible = true;

    const calm = { amp: AMP_CALM, dir: 0, phaseX: 0, phaseY: 0, freq: FREQ_CALM };
    const target = { ...calm };
    const current = { ...calm };

    const animating = () => interactive.matches && !motionReduced();
    // Development-only inspection hook (stripped from production builds).
    if (import.meta.env.DEV) canvas.__waveState = { current, target, isAnimating: () => Boolean(frame), renderNow: () => render() };

    const setColors = () => {
      gl.uniform3fv(loc.line, readRgb('--line'));
      gl.uniform3fv(loc.accent, readRgb('--accent'));
      gl.uniform1f(loc.alpha, LINE_ALPHA);
    };

    const render = () => {
      // Static mode is the original flat grid; animated mode uses the eased wave.
      const amp = animating() ? current.amp : 0;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(loc.res, width, height);
      gl.uniform1f(loc.time, time);
      gl.uniform1f(loc.amp, amp);
      gl.uniform1f(loc.ampMax, AMP_MAX);
      gl.uniform1f(loc.dir, current.dir);
      gl.uniform2f(loc.phase, current.phaseX, current.phaseY);
      gl.uniform1f(loc.freq, current.freq);
      const feather = 0.5 / dpr;
      gl.uniform1f(loc.halfWidth, 0.5 + feather);
      gl.uniform1f(loc.feather, feather);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    };

    const tick = (now) => {
      const dt = lastNow ? Math.min(64, now - lastNow) : 16.7;
      lastNow = now;
      time += dt / 1000;
      const k = 1 - (1 - EASE) ** (dt / 16.7);
      for (const key of Object.keys(current)) current[key] += (target[key] - current[key]) * k;
      render();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame && visible && animating()) {
        lastNow = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const refresh = () => {
      if (animating()) start();
      else {
        stop();
        render(); // one static flat frame
      }
    };

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      dpr = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth;
        height = nextHeight;
        const geometry = buildGeometry(width, height);
        gl.bufferData(gl.ARRAY_BUFFER, geometry.data, gl.STATIC_DRAW);
        vertexCount = geometry.count;
      }
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      render();
    };

    // Mouse → global wave parameters (targets; the loop eases towards them).
    const onMove = (event) => {
      if (event.pointerType !== 'mouse' || !animating()) return;
      const rect = area.getBoundingClientRect();
      const visibleHeight = Math.max(1, Math.min(rect.height, window.innerHeight - Math.max(0, rect.top)));
      const mx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      const my = Math.max(-1, Math.min(1, ((event.clientY - Math.max(rect.top, 0)) / visibleHeight) * 2 - 1));
      const lower = (my + 1) / 2; // 0 at the top of the hero, 1 at the bottom
      target.dir = mx * MAX_DIRECTION;
      target.phaseX = mx * PHASE_X_RANGE;
      target.phaseY = my * PHASE_Y_RANGE;
      target.amp = AMP_CALM + (AMP_MAX - AMP_CALM) * (0.45 + 0.55 * lower);
      target.freq = 1.1 + 0.6 * lower;
    };
    const onLeave = () => Object.assign(target, calm);

    setColors();
    resize();
    refresh();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    const themeObserver = new MutationObserver(() => {
      setColors();
      refresh();
      if (!frame) render();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    // Only animate while the hero is on screen.
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    visibilityObserver.observe(stage);

    const onContextLost = (event) => {
      event.preventDefault();
      stop();
      fallbackToCss();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    area.addEventListener('pointermove', onMove, { passive: true });
    area.addEventListener('pointerleave', onLeave);
    interactive.addEventListener('change', refresh);
    reducedQuery.addEventListener('change', refresh);

    return () => {
      stop();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      area.removeEventListener('pointermove', onMove);
      area.removeEventListener('pointerleave', onLeave);
      interactive.removeEventListener('change', refresh);
      reducedQuery.removeEventListener('change', refresh);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div ref={stageRef} className="hero-grid-stage pointer-events-none absolute inset-0" aria-hidden>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
