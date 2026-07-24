"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero's one signature WebGL moment (webgl-3d-effects skill): a soft,
 * slow-drifting noise-gradient in ink/accent tones, rendered with a raw
 * WebGL1 shader - no Three.js/library dependency, so the added JS is just
 * this file (well under the skill's 150KB budget). Always mounted behind
 * (never in front of) the static SVG gradient fallback (see Hero3D usage
 * in app/page.tsx) - that fallback is the real LCP candidate and the
 * permanent reduced-motion/no-WebGL experience; this canvas is a
 * progressive enhancement layered on top once it's confirmed safe to run.
 *
 * Colors are hardcoded RGB mirrors of --color-accent (#0071e3) and
 * --color-ink (#0a0a0a) from globals.css - a shader uniform can't read a
 * CSS custom property, so these two must be kept in sync by hand if the
 * tokens ever change.
 */
const VERTEX_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision mediump float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColorAccent;
uniform vec3 uColorInk;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  // A small, restrained accent detail confined to the top-right corner
  // (roughly the far side from the headline) - fully transparent
  // everywhere else, never a full-bleed wash. This is the ONE accent
  // moment on the page; everything else stays monochrome.
  vec2 corner = vec2(0.82, 0.22);
  float dist = distance(uv * vec2(uResolution.x / uResolution.y, 1.0), corner * vec2(uResolution.x / uResolution.y, 1.0));
  float region = 1.0 - smoothstep(0.0, 0.42, dist);
  vec2 p = uv * 2.6;
  float n = 0.0;
  n += 0.55 * noise(p + uTime * 0.045);
  n += 0.28 * noise(p * 2.1 - uTime * 0.03);
  n += 0.14 * noise(p * 4.3 + uTime * 0.02);
  vec3 color = mix(uColorInk, uColorAccent, smoothstep(0.4, 0.6, n));
  float alpha = smoothstep(0.45, 0.75, n) * 0.11 * region;
  gl_FragColor = vec4(color, alpha);
}
`;

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function hexToRgb01(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return [0x00 / 255, 0x71 / 255, 0xe3 / 255];
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255];
}

/** `accentHex` defaults to --color-accent's mirror (see comment above) - only the founder's color-A/B preview page passes a different one. */
export default function Hero3D({ accentHex = "#0071e3" }: { accentHex?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && isWebGLAvailable()) setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) {
      setActive(false);
      return;
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) {
      setActive(false);
      return;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setActive(false);
      return;
    }
    gl.useProgram(program);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "uTime");
    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uColorAccent = gl.getUniformLocation(program, "uColorAccent");
    const uColorInk = gl.getUniformLocation(program, "uColorInk");
    gl.uniform3f(uColorAccent, ...hexToRgb01(accentHex));
    gl.uniform3f(uColorInk, 0x0a / 255, 0x0a / 255, 0x0a / 255);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(canvas);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(canvas!.clientWidth * dpr);
      const height = Math.round(canvas!.clientHeight * dpr);
      if (canvas!.width !== width || canvas!.height !== height) {
        canvas!.width = width;
        canvas!.height = height;
        gl!.viewport(0, 0, width, height);
      }
    }
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    let raf = 0;
    function render(now: number) {
      raf = requestAnimationFrame(render);
      if (!visible) return;
      resize();
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.uniform2f(uResolution, canvas!.width, canvas!.height);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    }
    raf = requestAnimationFrame(render);

    function onContextLost(e: Event) {
      e.preventDefault();
      cancelAnimationFrame(raf);
      setActive(false);
    }
    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, accentHex]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}
