import * as THREE from "./assets/three.module.js";

const container = document.querySelector("#three-hero-bg");

if (!container) {
  throw new Error("Missing #three-hero-bg container");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);
document.body.classList.add("three-ready");

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;

    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uResolution;

    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 34.123);
      return fract(p.x * p.y);
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

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;

      for (int i = 0; i < 6; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.52;
      }

      return value;
    }

    float plume(vec2 uv, vec2 center, vec2 scale, float blur) {
      vec2 q = (uv - center) / scale;
      float d = dot(q, q);
      return smoothstep(1.0, blur, d);
    }

    float sparkle(vec2 uv, float time) {
      vec2 grid = vec2(44.0, 26.0);
      vec2 id = floor(uv * grid);
      vec2 local = fract(uv * grid) - 0.5;

      float seed = hash(id + vec2(19.0, 73.0));
      float active = step(0.97, seed);
      float blink = 0.55 + 0.45 * sin(time * (2.0 + seed * 4.0) + seed * 20.0);
      float star = smoothstep(0.08, 0.0, length(local));

      return active * blink * star;
    }

    void main() {
      vec2 uv = vUv;
      vec2 aspectUv = uv;
      aspectUv.x *= uResolution.x / uResolution.y;

      float time = uTime * 0.06;

      vec2 field = aspectUv * 2.4;
      float warpA = fbm(field + vec2(time * 0.72, -time * 0.28));
      float warpB = fbm(field * 1.6 + vec2(-time * 0.36, time * 0.48));
      vec2 distortion = vec2(warpA - 0.5, warpB - 0.5) * 0.14;
      vec2 uvWarped = uv + distortion;

      vec2 greenCenterA = vec2(
        0.62 + sin(time * 0.85) * 0.02,
        0.18 + cos(time * 0.74) * 0.02
      );

      vec2 greenCenterB = vec2(
        0.82 + cos(time * 0.95) * 0.018,
        0.24 + sin(time * 0.72) * 0.018
      );

      vec2 yellowCenterA = vec2(
        0.73 + sin(time * 0.9) * 0.025,
        0.13 + cos(time * 0.62) * 0.016
      );

      vec2 yellowCenterB = vec2(
        0.91 + cos(time * 0.74) * 0.018,
        0.1 + sin(time * 0.88) * 0.014
      );

      float greenA = plume(uvWarped, greenCenterA, vec2(0.34, 0.28), -0.28);
      float greenB = plume(uvWarped, greenCenterB, vec2(0.28, 0.34), -0.3);
      float yellowA = plume(uvWarped, yellowCenterA, vec2(0.3, 0.24), -0.26);
      float yellowB = plume(uvWarped, yellowCenterB, vec2(0.23, 0.3), -0.24);
      float haze = plume(uvWarped, vec2(0.56, 0.26), vec2(0.5, 0.2), -0.22);

      float band = smoothstep(0.12, 0.62, uv.x) * (1.0 - smoothstep(0.78, 1.03, uv.y));
      float corner = smoothstep(1.08, 0.22, distance(uv, vec2(0.86, 0.08)));
      float mask = band * corner;

      float greenField = (greenA * 0.9 + greenB * 0.84 + haze * 0.2);
      float yellowField = (yellowA * 0.94 + yellowB * 0.92 + haze * 0.14);

      vec3 greenColor = vec3(0.18, 0.95, 0.24);
      vec3 yellowColor = vec3(0.96, 0.95, 0.23);

      vec3 color = vec3(0.0);
      color += greenColor * greenField * 1.12;
      color += yellowColor * yellowField * 1.06;

      float glowVeil = fbm(aspectUv * 1.8 + vec2(0.0, -time * 0.16));
      color += vec3(0.1, 0.36, 0.1) * haze * glowVeil * 0.18;

      float glints = sparkle(uv + distortion * 0.18 + vec2(time * 0.02, 0.0), time);
      float glintMask = smoothstep(0.58, 1.0, uv.x) * smoothstep(0.08, 0.38, uv.y) * (1.0 - smoothstep(0.7, 0.92, uv.y));
      color += vec3(1.0, 0.99, 0.72) * glints * glintMask * 0.45;

      float alpha = clamp((greenField * 0.68 + yellowField * 0.78 + haze * 0.16) * mask, 0.0, 0.96);
      alpha += glints * glintMask * 0.14;

      gl_FragColor = vec4(color * mask, alpha);
    }
  `,
});

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", resize);

let homeActive = document.body.classList.contains("is-home-page");

const classObserver = new MutationObserver(() => {
  homeActive = document.body.classList.contains("is-home-page");
});

classObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["class"],
});

const clock = new THREE.Clock();

function render() {
  const elapsed = clock.getElapsedTime();

  if (homeActive) {
    material.uniforms.uTime.value = prefersReducedMotion ? elapsed * 0.18 : elapsed;
    renderer.render(scene, camera);
  } else {
    renderer.clear();
  }

  requestAnimationFrame(render);
}

render();
