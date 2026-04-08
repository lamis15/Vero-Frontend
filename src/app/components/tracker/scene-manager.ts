import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * VERO CARBON ECOSYSTEM — Scene Manager
 * 
 * Renders a cinematic glass terrarium containing a miniature forest.
 * The ecosystem's health visually reacts to the user's carbon data.
 * 
 * health 100 → lush emerald paradise, golden fireflies, gentle sway
 * health   0 → barren gray wasteland, no particles, drooping trees
 */

interface TreeMesh {
  group: THREE.Group;
  trunk: THREE.Mesh;
  foliage: THREE.Mesh;
  baseY: number;
  swayOffset: number;
  swaySpeed: number;
}

export class EcosystemScene {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private container: HTMLElement;

  // Scene objects
  private dome!: THREE.Mesh;
  private terrain!: THREE.Mesh;
  private trees: TreeMesh[] = [];
  private particles!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleSpeeds!: Float32Array;

  // Lights
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  private innerGlow!: THREE.PointLight;

  // State
  private health = 70;
  private targetHealth = 70;
  private clock = new THREE.Clock();
  private animId = 0;
  private disposed = false;

  // Color palettes keyed by health
  private readonly LUSH_FOG    = new THREE.Color(0x0a1a0a);
  private readonly DEAD_FOG    = new THREE.Color(0x1a1410);
  private readonly LUSH_LEAF   = new THREE.Color(0x2d6b3f);
  private readonly STRESS_LEAF = new THREE.Color(0x8b6f3a);
  private readonly DEAD_LEAF   = new THREE.Color(0x4a3f35);
  private readonly LUSH_TRUNK  = new THREE.Color(0x5c3d2e);
  private readonly DEAD_TRUNK  = new THREE.Color(0x3a3530);
  private readonly LUSH_GROUND = new THREE.Color(0x2a4a2a);
  private readonly DEAD_GROUND = new THREE.Color(0x3a3530);

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
    this.buildTerrain();
    this.buildDome();
    this.buildTrees();
    this.buildParticles();
    this.setupLights();
    this.animate();
  }

  // ─── INIT ───────────────────────────────────────────

  private init(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Capped at 1.5x to save GPU
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1a0a);
    this.scene.fog = new THREE.FogExp2(0x0a1a0a, 0.08);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(4, 3, 5);
    this.camera.lookAt(0, 0.5, 0);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.04;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.maxPolarAngle = Math.PI * 0.65;
    this.controls.minPolarAngle = Math.PI * 0.2;
    this.controls.maxDistance = 10;
    this.controls.minDistance = 3;
    this.controls.target.set(0, 0.5, 0);

    // Resize
    window.addEventListener('resize', this.onResize);
  }

  // ─── TERRAIN ────────────────────────────────────────

  private buildTerrain(): void {
    const geo = new THREE.CircleGeometry(2, 64);
    geo.rotateX(-Math.PI / 2);

    // Add some vertex displacement for organic ground
    const pos = geo.attributes['position'] as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      const noise = Math.sin(x * 3) * Math.cos(z * 2.5) * 0.08;
      const edge = Math.max(0, 1 - dist / 2) * 0.15;
      pos.setY(i, noise + edge * (1 - dist / 2));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: this.LUSH_GROUND,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
    });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // Mossy rocks
    for (let i = 0; i < 6; i++) {
      const rockGeo = new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.12, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x3a4a3a),
        roughness: 0.95,
        flatShading: true
      });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.4 + Math.random() * 1.2;
      rock.position.set(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.setScalar(0.6 + Math.random() * 0.8);
      rock.castShadow = true;
      this.scene.add(rock);
    }
  }

  // ─── GLASS DOME ─────────────────────────────────────

  private buildDome(): void {
    const domeGeo = new THREE.SphereGeometry(2.4, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    // Heavy transmission dropped to standard transparency for performance
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xccffea,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide // Render mainly the inner reflection to fake glass edges best
    });
    this.dome = new THREE.Mesh(domeGeo, domeMat);
    this.dome.position.y = 0;
    this.scene.add(this.dome);

    // Wooden base ring
    const ringGeo = new THREE.TorusGeometry(2.4, 0.06, 8, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x5c3d2e,
      roughness: 0.8,
      metalness: 0.1
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);
  }

  // ─── PROCEDURAL TREES ───────────────────────────────

  private buildTrees(): void {
    const treeCount = 10;
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const radius = 0.3 + Math.random() * 1.3;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const height = 0.4 + Math.random() * 0.8;
      const crownSize = 0.15 + Math.random() * 0.25;

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.02, 0.04, height, 6);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: this.LUSH_TRUNK,
        roughness: 0.9,
        flatShading: true
      });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);

      // Foliage — layered cones for a stylized look
      const foliageGroup = new THREE.Group();
      const layers = 2 + Math.floor(Math.random() * 2);
      for (let j = 0; j < layers; j++) {
        const coneGeo = new THREE.ConeGeometry(
          crownSize * (1 - j * 0.2),
          crownSize * 1.5,
          6
        );
        const coneMat = new THREE.MeshStandardMaterial({
          color: this.LUSH_LEAF,
          roughness: 0.85,
          flatShading: true
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = height / 2 + j * crownSize * 0.6;
        cone.castShadow = true;
        foliageGroup.add(cone);
      }

      const group = new THREE.Group();
      group.add(trunk);
      group.add(foliageGroup);
      group.position.set(x, height / 2, z);
      group.castShadow = true;

      this.scene.add(group);
      this.trees.push({
        group,
        trunk,
        foliage: foliageGroup.children[0] as THREE.Mesh,
        baseY: height / 2,
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: 0.3 + Math.random() * 0.4
      });
    }
  }

  // ─── FIREFLY PARTICLES ──────────────────────────────

  private buildParticles(): void {
    const count = 120;
    this.particlePositions = new Float32Array(count * 3);
    this.particleSpeeds = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 1.8;
      this.particlePositions[i * 3]     = Math.cos(angle) * radius;
      this.particlePositions[i * 3 + 1] = 0.2 + Math.random() * 2;
      this.particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
      this.particleSpeeds[i] = 0.2 + Math.random() * 0.5;

      // Golden-green firefly color
      colors[i * 3]     = 0.9 + Math.random() * 0.1;
      colors[i * 3 + 1] = 0.85 + Math.random() * 0.15;
      colors[i * 3 + 2] = 0.3 + Math.random() * 0.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  // ─── LIGHTING ───────────────────────────────────────

  private setupLights(): void {
    // Ambient
    this.ambientLight = new THREE.AmbientLight(0x304830, 0.6);
    this.scene.add(this.ambientLight);

    // Sun
    this.sunLight = new THREE.DirectionalLight(0xfff8e7, 1.2);
    this.sunLight.position.set(5, 8, 3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 512; // Downgraded from 1024 for framing speed
    this.sunLight.shadow.mapSize.height = 512;
    this.sunLight.shadow.camera.near = 0.1;
    this.sunLight.shadow.camera.far = 20;
    this.scene.add(this.sunLight);

    // Inner glow
    this.innerGlow = new THREE.PointLight(0x6aaa6a, 0.8, 5);
    this.innerGlow.position.set(0, 1, 0);
    this.scene.add(this.innerGlow);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0x99bbff, 0.3);
    rimLight.position.set(-3, 2, -4);
    this.scene.add(rimLight);
  }

  // ─── PUBLIC API ─────────────────────────────────────

  setHealth(value: number): void {
    this.targetHealth = Math.max(0, Math.min(100, value));
  }

  // ─── ANIMATION LOOP ─────────────────────────────────

  private animate = (): void => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.animate);

    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    // Smooth health transition
    this.health += (this.targetHealth - this.health) * dt * 0.8;
    const h = this.health / 100; // 0..1

    this.updateEnvironment(h, t, dt);
    this.updateTrees(h, t);
    this.updateParticles(h, t, dt);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private updateEnvironment(h: number, t: number, _dt: number): void {
    // Background & fog color
    const bgColor = new THREE.Color().lerpColors(this.DEAD_FOG, this.LUSH_FOG, h);
    this.scene.background = bgColor;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(bgColor);
    }

    // Terrain color
    const terrainColor = new THREE.Color().lerpColors(this.DEAD_GROUND, this.LUSH_GROUND, h);
    (this.terrain.material as THREE.MeshStandardMaterial).color.copy(terrainColor);

    // Inner glow: green when healthy, dim amber when stressed
    const glowColor = new THREE.Color().lerpColors(
      new THREE.Color(0x8b5a2a),
      new THREE.Color(0x6aaa6a),
      h
    );
    this.innerGlow.color.copy(glowColor);
    this.innerGlow.intensity = 0.3 + h * 0.8;

    // Sun intensity
    this.sunLight.intensity = 0.4 + h * 1.0;

    // Ambient
    this.ambientLight.intensity = 0.3 + h * 0.5;

    // Dome opacity/tint based on health
    const domeMat = this.dome.material as THREE.MeshPhysicalMaterial;
    domeMat.transmission = 0.85 + h * 0.1;
    domeMat.color.setRGB(
      1 - (1 - h) * 0.15,
      1,
      1 - (1 - h) * 0.15
    );

    // Renderer exposure
    this.renderer.toneMappingExposure = 0.7 + h * 0.7;
  }

  private updateTrees(h: number, t: number): void {
    const foliageColor = new THREE.Color();
    if (h > 0.5) {
      foliageColor.lerpColors(this.STRESS_LEAF, this.LUSH_LEAF, (h - 0.5) * 2);
    } else {
      foliageColor.lerpColors(this.DEAD_LEAF, this.STRESS_LEAF, h * 2);
    }

    const trunkColor = new THREE.Color().lerpColors(this.DEAD_TRUNK, this.LUSH_TRUNK, h);
    const swayAmount = h * 0.03;
    const scaleMultiplier = 0.6 + h * 0.4;

    for (const tree of this.trees) {
      // Sway
      const sway = Math.sin(t * tree.swaySpeed + tree.swayOffset) * swayAmount;
      tree.group.rotation.z = sway;
      tree.group.rotation.x = Math.cos(t * tree.swaySpeed * 0.7 + tree.swayOffset) * swayAmount * 0.5;

      // Scale (trees "droop" when unhealthy)
      const targetScale = scaleMultiplier;
      tree.group.scale.y += (targetScale - tree.group.scale.y) * 0.02;
      tree.group.scale.x = tree.group.scale.z = 0.8 + h * 0.2;

      // Colors
      tree.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (child === tree.trunk) {
            mat.color.copy(trunkColor);
          } else {
            mat.color.copy(foliageColor);
          }
        }
      });
    }
  }

  private updateParticles(h: number, t: number, dt: number): void {
    const positions = this.particles.geometry.attributes['position'] as THREE.BufferAttribute;
    const count = positions.count;

    // Particle opacity based on health
    (this.particles.material as THREE.PointsMaterial).opacity = h * 0.9;
    (this.particles.material as THREE.PointsMaterial).size = 0.015 + h * 0.025;

    for (let i = 0; i < count; i++) {
      let y = positions.getY(i);
      const speed = this.particleSpeeds[i];

      // Gentle float upward
      y += speed * dt * 0.3 * h;

      // Slight horizontal drift
      const x = positions.getX(i) + Math.sin(t * speed + i) * dt * 0.05;
      const z = positions.getZ(i) + Math.cos(t * speed * 0.8 + i) * dt * 0.05;

      // Reset if above dome
      if (y > 2.2) {
        y = 0.1;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.5;
        positions.setX(i, Math.cos(angle) * r);
        positions.setZ(i, Math.sin(angle) * r);
      }

      positions.setX(i, x);
      positions.setY(i, y);
      positions.setZ(i, z);
    }

    positions.needsUpdate = true;
  }

  // ─── RESIZE ─────────────────────────────────────────

  private onResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // ─── DISPOSE ────────────────────────────────────────

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
