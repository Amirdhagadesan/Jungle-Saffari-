/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Award, BarChart3, Clock, Milestone, Compass, Palmtree, Info,
  Share2, LogOut, Globe, Users
} from 'lucide-react';
import { 
  saveScore, getLeaderboard, ScoreEntry,
  auth, googleProvider, signInWithPopup, onAuthStateChanged, signOut,
  db, doc, setDoc, updateDoc, onSnapshot, getDoc, serverTimestamp, collection, query, orderBy
} from './firebase';
import { 
  Dice5, ShoppingCart, Palette, User as UserIcon, 
  Coins, Shield, Trash2, Bomb, ArrowUpRight, 
  Rocket, Lock, X, Settings
} from 'lucide-react';

// --- TYPES & CONSTANTS ---

enum ThemeType {
  BLOCKY = 'Minecraft',
  FOREST = 'Forest',
  VOID = 'Void'
}

enum LevelID {
  WHISPERING_WOODS = 'Whispering Woods',
  VOXEL_VALLEY = 'Voxel Valley',
  ABYSSAL_VOID = 'Abyssal Void',
  MINER_MAZE = 'Miner Maze'
}

interface LevelConfig {
  id: LevelID;
  theme: ThemeType;
  boardSize: number;
  description: string;
  specialRules: string;
  difficultyLabel: string;
  itemDensity: {
    treasure: [number, number]; 
    predator: [number, number];
    buff: [number, number];
    debuff: [number, number];
  };
}

const LEVELS: Record<LevelID, LevelConfig> = {
  [LevelID.WHISPERING_WOODS]: {
    id: LevelID.WHISPERING_WOODS,
    theme: ThemeType.FOREST,
    boardSize: 60,
    description: 'A lush forest filled with treasures. Fast and easy.',
    specialRules: 'Classic rules. High density of coins.',
    difficultyLabel: 'Beginner',
    itemDensity: { treasure: [3, 4], predator: [1, 2], buff: [2, 3], debuff: [1, 1] }
  },
  [LevelID.VOXEL_VALLEY]: {
    id: LevelID.VOXEL_VALLEY,
    theme: ThemeType.BLOCKY,
    boardSize: 80,
    description: 'A pixelated world of cubes and ores. Watch your step!',
    specialRules: 'Voxel visuals. High density of obstacles.',
    difficultyLabel: 'Intermediate',
    itemDensity: { treasure: [2, 3], predator: [2, 3], buff: [1, 2], debuff: [2, 3] }
  },
  [LevelID.ABYSSAL_VOID]: {
    id: LevelID.ABYSSAL_VOID,
    theme: ThemeType.VOID,
    boardSize: 100,
    description: 'A dark dimension where traps lurk in every shadow.',
    specialRules: 'Deeper fog. High predator density.',
    difficultyLabel: 'Expert',
    itemDensity: { treasure: [1, 2], predator: [3, 4], buff: [1, 2], debuff: [3, 4] }
  },
  [LevelID.MINER_MAZE]: {
    id: LevelID.MINER_MAZE,
    theme: ThemeType.BLOCKY,
    boardSize: 120,
    description: 'The deepest mines ever explored. Pixelated peril!',
    specialRules: 'Longest path. Voxel architecture.',
    difficultyLabel: 'Legendary',
    itemDensity: { treasure: [1, 2], predator: [4, 5], buff: [0, 1], debuff: [4, 6] }
  }
};

type ItemType = 'COIN' | 'ANTI_VENOM' | 'TANK' | 'TNT' | 'ARROW' | 'ROCKET' | 'CAGE' | 'ACID' | 'QUICKSAND' | 'BOOST' | 'MULTIPLIER' | 'REVERSE' | 'REDUCED';

type DiceSkinType = 'DEFAULT' | 'GOLD' | 'NEON' | 'RUBY' | 'GALAXY';

interface DiceSkin {
  type: DiceSkinType;
  name: string;
  color: number;
  emissive: number;
  price: number;
  icon: string;
}

const DICE_SKINS: Record<DiceSkinType, DiceSkin> = {
  DEFAULT: { type: 'DEFAULT', name: 'Alloy', color: 0xffffff, emissive: 0x000000, price: 0, icon: '🎲' },
  GOLD: { type: 'GOLD', name: 'Gold', color: 0xFFD700, emissive: 0xAA8800, price: 100, icon: '👑' },
  NEON: { type: 'NEON', name: 'Voxel', color: 0x5D9948, emissive: 0x5D9948, price: 150, icon: '🟩' },
  RUBY: { type: 'RUBY', name: 'Ruby', color: 0xFF0000, emissive: 0x880000, price: 120, icon: '💎' },
  GALAXY: { type: 'GALAXY', name: 'Galaxy', color: 0x00F5FF, emissive: 0xBF5FFF, price: 200, icon: '🌌' },
};

interface Item {
  type: ItemType;
  name: string;
  icon: string;
  price: number;
}

const ITEMS: Record<ItemType, Item> = {
  COIN: { type: 'COIN', name: 'Coin', icon: '🪙', price: 0 },
  ANTI_VENOM: { type: 'ANTI_VENOM', name: 'Anti-Venom', icon: '💉', price: 35 },
  TANK: { type: 'TANK', name: 'Armoured Fighting Vehicle', icon: '🛡️', price: 60 },
  TNT: { type: 'TNT', name: 'TNT', icon: '💣', price: 50 },
  ARROW: { type: 'ARROW', name: 'Arrow', icon: '🏹', price: 30 },
  ROCKET: { type: 'ROCKET', name: 'Rocket Launcher', icon: '🚀', price: 80 },
  CAGE: { type: 'CAGE', name: 'Cage', icon: '🔒', price: 60 },
  ACID: { type: 'ACID', name: 'Acid Pool', icon: '🧪', price: 0 },
  QUICKSAND: { type: 'QUICKSAND', name: 'Quicksand', icon: '🏜️', price: 0 },
  BOOST: { type: 'BOOST', name: 'Speed Boost', icon: '⚡', price: 0 },
  MULTIPLIER: { type: 'MULTIPLIER', name: 'Coin 2x', icon: '💎', price: 0 },
  REVERSE: { type: 'REVERSE', name: 'Confusion', icon: '🌀', price: 0 },
  REDUCED: { type: 'REDUCED', name: 'Sluggish', icon: '🐌', price: 0 },
};

interface Player {
  id: number;
  name: string;
  color: string;
  position: number; // 0 to 100
  coins: number;
  inventory: ItemType[];
  turns: number;
  cagedTurns: number;
  speedBoost: boolean;
  multiplier: boolean;
  reversed: boolean;
  sluggish: boolean;
  isBot?: boolean;
}

const TRANSPORTS = [
  { start: 4, end: 25, type: 'FLIGHT', label: '✈ BUCKLE UP!' },
  { start: 12, end: 50, type: 'TRAIN', label: '🚂 ALL ABOARD!' },
  { start: 28, end: 64, type: 'BIKE', label: '🏍 SPARKS FLY!' },
  { start: 36, end: 72, type: 'CAR', label: '🚗 DRIFTING!' },
  { start: 51, end: 67, type: 'FLIGHT', label: '✈ HIGH FLYER!' },
  { start: 6, end: 38, type: 'TRAIN', label: '🚂 FAST TRACK!' },
  { start: 45, end: 74, type: 'BIKE', label: '🏍 WHEELIE!' },
  { start: 63, end: 81, type: 'CAR', label: '🚗 FULL THROTTLE!' },
];

const PREDATORS = [
  { start: 99, end: 20, type: 'SNAKE', label: '🐍 CHOMPED!' },
  { start: 89, end: 68, type: 'BEAR', label: '🐻 REKT!' },
  { start: 76, end: 32, type: 'RHINO', label: '🦏 SCOOPED!' },
  { start: 95, end: 48, type: 'DINO', label: 'REX! DRAGGED BACK!' },
  { start: 54, end: 19, type: 'SNAKE', label: '🐍 COILED!' },
  { start: 62, end: 3, type: 'BEAR', label: '🐻 DRAGGED!' },
  { start: 16, end: 5, type: 'SNAKE', label: '🐍 SNAP!' },
  { start: 24, end: 11, type: 'RHINO', label: '🦏 RAMMED!' },
  { start: 35, end: 21, type: 'BEAR', label: '🐻 CLAWED!' },
  { start: 42, end: 28, type: 'DINO', label: '🦖 ROAR!' },
  { start: 58, end: 33, type: 'SNAKE', label: '🐍 CONSTRICTED!' },
  { start: 69, end: 47, type: 'BEAR', label: '🐻 MAULED!' },
  { start: 82, end: 61, type: 'RHINO', label: '🦏 CHARGED!' },
  { start: 91, end: 73, type: 'DINO', label: '🦖 HUNTED!' },
  { start: 48, end: 36, type: 'SNAKE', label: '🐍 SLITHERED BACK!' },
  { start: 12, end: 2, type: 'BEAR', label: '🐻 HIBERNATION ENDED!' },
  { start: 8, end: 1, type: 'SNAKE', label: '🐍 INFANT REPTILE!' },
  { start: 72, end: 55, type: 'BEAR', label: '🐻 FOREST GUARDIAN!' },
];

const TREASURE_TILES = [7, 15, 33, 42, 58, 69, 84, 91];

// --- SOUND ENGINE ---

const SoundEngine = {
  ctx: null as AudioContext | null,
  bgGain: null as GainNode | null,
  musicSource: null as AudioBufferSourceNode | null,
  intensity: 'calm' as 'calm' | 'intense',
  isMuted: true,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.bgGain = this.ctx.createGain();
      this.bgGain.gain.setValueAtTime(this.isMuted ? 0 : 0.05, this.ctx.currentTime);
      this.bgGain.connect(this.ctx.destination);
    }
  },
  setIntensity(newIntensity: 'calm' | 'intense') {
    this.intensity = newIntensity;
  },
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.bgGain && this.ctx) {
      this.bgGain.gain.setValueAtTime(this.isMuted ? 0 : 0.05, this.ctx.currentTime);
    }
    return this.isMuted;
  },
  playBackground() {
    // Background sound removed at user request
    return;
  },
  play(type: 'roll' | 'collect' | 'action' | 'fail' | 'win' | 'rocket' | 'explosion' | 'arrow' | 'tank') {
    if (this.isMuted) return;
    if (!this.ctx) {
      try {
        this.init();
      } catch (e) {
        return;
      }
    }
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (type === 'roll') {
      // Atari-style movement blip
      osc.type = 'square';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
    } else if (type === 'collect') {
      // Classic Gold Coin "Ching"
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.05); // E6
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    } else if (type === 'rocket') {
      // Atari Missile Launch
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      
      const noise = ctx.createBufferSource();
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.05, now);
      noiseGain.gain.linearRampToValueAtTime(0, now + 0.3);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
    } else if (type === 'arrow') {
      // Simple "shing"
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
    } else if (type === 'explosion') {
      // Atari-style white noise blast
      const noise = ctx.createBufferSource();
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();

      osc.type = 'square';
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
    } else if (type === 'tank') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(60, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.5);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.8);
      
      const noise = ctx.createBufferSource();
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
    } else if (type === 'action') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
    } else if (type === 'fail') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.setValueAtTime(90, now + 0.1);
      osc.frequency.setValueAtTime(70, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
    } else if (type === 'win') {
      osc.type = 'square';
      const melody = [523.25, 523.25, 659.25, 783.99, 659.25, 783.99];
      melody.forEach((f, i) => {
        osc.frequency.setValueAtTime(f, now + i * 0.1);
      });
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.6);
    }
    
    osc.start();
    osc.stop(now + 1);
  }
};

const createCrater = () => {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.45, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  group.add(ring);
  
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 12),
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.005;
  group.add(inner);

  const bomb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshPhongMaterial({ color: 0x333333 })
  );
  bomb.position.y = 0.1;
  group.add(bomb);
  
  return group;
};

// --- PATH GENERATION (ORGANIC SERPENTINE TRAIL) ---
const PATH_COORDS: {x: number, y: number, z: number}[] = (() => {
  const coords: {x: number, y: number, z: number}[] = [];
  const spacing = 3.5; 
  
  for (let i = 0; i < 200; i++) {
    const row = Math.floor(i / 10);
    let col = i % 10;
    
    // Serpentine logic
    if (row % 2 !== 0) col = 9 - col;
    
    // Base grid position
    let x = (col - 4.5) * spacing;
    let z = (row - 4.5) * spacing;
    
    // Add organic jitter
    x += (Math.random() - 0.5) * 1.5;
    z += (Math.random() - 0.5) * 1.5;
    
    // Elevation
    let y = Math.sin(col * 0.4) * 0.5 + Math.cos(row * 0.4) * 0.5;
    y += row * 0.05; // Slightly reduced ascent for longer paths
    
    coords.push({x, y: Math.max(0, y), z});
  }
  return coords;
})();

const getTileCoordsGlobal = (tileNumber: number) => {
  if (tileNumber === undefined || tileNumber === null || isNaN(tileNumber)) return PATH_COORDS[0];
  const index = Math.max(0, Math.min(Math.floor(tileNumber) - 1, 199));
  return PATH_COORDS[index];
};

const MC_COLORS = {
  GRASS: 0x5D9948,
  DIRT: 0x866043,
  STONE: 0x7D7D7D,
  OAK_LOG: 0x675231,
  OAK_LEAVES: 0x48B02C,
  IRON: 0xD8D8D8,
  GOLD: 0xFDF55F,
  DIAMOND: 0x64F2F2,
  BEDROCK: 0x333333
};

// Optimization: Shared Unit Geometries
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_ICOSA = new THREE.IcosahedronGeometry(0.8, 1);
const UNIT_DIRT_MAT = new THREE.MeshPhongMaterial({ color: MC_COLORS.DIRT, flatShading: true });
const UNIT_GRASS_MAT = new THREE.MeshPhongMaterial({ color: MC_COLORS.GRASS, flatShading: true });
const UNIT_TRUNK_MAT = new THREE.MeshPhongMaterial({ color: MC_COLORS.OAK_LOG, flatShading: true });
const UNIT_LEAF_MAT = new THREE.MeshPhongMaterial({ color: MC_COLORS.OAK_LEAVES, flatShading: true });

const createStoneTile = (scale: number, color: number, theme: ThemeType = ThemeType.FOREST) => {
  const isBlocky = theme === ThemeType.BLOCKY;
  if (isBlocky) {
    const group = new THREE.Group();
    // Dirt base
    const dirt = new THREE.Mesh(UNIT_BOX, UNIT_DIRT_MAT);
    dirt.scale.set(scale, 0.4, scale);
    dirt.position.y = -0.2;
    // Grass top
    const grass = new THREE.Mesh(UNIT_BOX, UNIT_GRASS_MAT);
    grass.scale.set(scale, 0.1, scale);
    grass.position.y = 0.05;
    group.add(dirt, grass);
    group.receiveShadow = true;
    return group;
  }
  const geo = UNIT_ICOSA.clone();
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    // Rough terrain distortion
    posAttr.setXYZ(i, 
      x + (Math.random() - 0.5) * 0.3,
      y + (Math.random() - 0.5) * 0.2,
      z + (Math.random() - 0.5) * 0.3
    );
  }
  geo.scale(scale, 1, scale);
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhongMaterial({ 
    color, 
    flatShading: true,
    shininess: 5,
    emissive: color,
    emissiveIntensity: 0.1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(1, 0.3, 1); 
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.receiveShadow = true;
  return mesh;
};

const createAnimal = (type: 'HANGING_BAT', scale: number = 0.5, theme: ThemeType = ThemeType.FOREST) => {
  const isBlocky = theme === ThemeType.BLOCKY;
  if (isBlocky && type === 'HANGING_BAT') {
    const group = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0x333333, flatShading: true });
    
    // Voxel Bat Body
    const body = new THREE.Mesh(UNIT_BOX, mat);
    body.scale.set(0.3, 0.4, 0.3);
    body.position.y = 0.2;
    group.add(body);
    
    // Head (hanging down)
    const head = new THREE.Mesh(UNIT_BOX, mat);
    head.scale.set(0.2, 0.2, 0.2);
    head.position.y = -0.1;
    group.add(head);

    // Wings (closed)
    const wingL = new THREE.Mesh(UNIT_BOX, mat);
    wingL.scale.set(0.05, 0.4, 0.25);
    wingL.position.set(-0.15, 0.2, 0.05);
    const wingR = wingL.clone();
    wingR.position.x = 0.15;
    group.add(wingL, wingR);

    group.scale.set(scale, scale, scale);
    group.name = `animal_${type}_${Math.random().toString(36).substr(2, 9)}`;
    return group;
  }
  const emoji = '🦇';
  const group = new THREE.Group();
  
  // Use a simple sprite for the animal
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '80px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  if (type === 'HANGING_BAT') {
    ctx.save();
    ctx.translate(64, 64);
    ctx.scale(1, -1); // Flip upside down
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(emoji, 64, 64);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  group.add(sprite);
  group.name = `animal_${type}_${Math.random().toString(36).substr(2, 9)}`;
  return group;
};

const create3DBear = (scale: number = 1, theme: ThemeType = ThemeType.FOREST) => {
  const group = new THREE.Group();
  const isBlocky = theme === ThemeType.BLOCKY;
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x5c4033, flatShading: true });
  
  // Body - Always boxy for bears usually but let's make it explicitly voxel for blocky theme
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 0.5 * scale, 0.4 * scale), bodyMat);
  body.position.y = 0.25 * scale;
  group.add(body);
  
  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.35 * scale, 0.35 * scale), bodyMat);
  head.position.set(0, 0.6 * scale, 0);
  group.add(head);
  
  // Ears
  const earM = new THREE.MeshPhongMaterial({ color: isBlocky ? 0x222222 : 0x3d2b1f, flatShading: true });
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.1 * scale, 0.05 * scale), earM);
  earL.position.set(-0.15 * scale, 0.75 * scale, 0);
  const earR = earL.clone();
  earR.position.x = 0.15 * scale;
  group.add(earL, earR);
  
  // Legs
  const legGeo = new THREE.BoxGeometry(0.15 * scale, 0.2 * scale, 0.15 * scale);
  const leg1 = new THREE.Mesh(legGeo, bodyMat);
  leg1.position.set(-0.2 * scale, 0.1 * scale, -0.1 * scale);
  const leg2 = leg1.clone();
  leg2.position.x = 0.2 * scale;
  const leg3 = leg1.clone();
  leg3.position.z = 0.1 * scale;
  const leg4 = leg2.clone();
  leg4.position.z = 0.1 * scale;
  group.add(leg1, leg2, leg3, leg4);

  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
};

const createEmojiSprite = (emoji: string, scale: number = 0.72) => {
  if (typeof document === 'undefined') return new THREE.Group(); // SSR safety
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '100px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.center.set(0.5, 0); // Bottom align
  return sprite;
};

// --- ENVIRONMENT: MOUNTAINS & GROUND ---
const createMountain = (scale: number = 10, theme: ThemeType = ThemeType.FOREST) => {
  const isBlocky = theme === ThemeType.BLOCKY;
  const isVoid = theme === ThemeType.VOID;
  
  if (isBlocky) {
    const group = new THREE.Group();
    const size = scale * 0.5;
    for (let i = 0; i < 4; i++) {
        const layerSize = size * (1 - i * 0.25);
        const layer = new THREE.Mesh(
            new THREE.BoxGeometry(layerSize, 2, layerSize),
            new THREE.MeshPhongMaterial({ color: i === 0 ? MC_COLORS.STONE : MC_COLORS.BEDROCK, flatShading: true })
        );
        layer.position.y = i * 2;
        group.add(layer);
    }
    return group;
  }
  
  const sprite = createEmojiSprite('⛰️', scale * 0.8);
  if (isVoid) {
    sprite.userData.pulsate = true;
    (sprite as any).isMountain = true;
  }
  return sprite;
};

const createTree = (scale: number = 1, theme: ThemeType = ThemeType.FOREST) => {
  const group = new THREE.Group();
  const isBlocky = theme === ThemeType.BLOCKY;
  const isVoid = theme === ThemeType.VOID;
  
  if (isBlocky) {
    // Voxel Tree
    const trunk = new THREE.Mesh(UNIT_BOX, UNIT_TRUNK_MAT);
    trunk.scale.set(0.3 * scale, 1.2 * scale, 0.3 * scale);
    trunk.position.y = 0.6 * scale;
    group.add(trunk);

    const foliage = new THREE.Mesh(UNIT_BOX, UNIT_LEAF_MAT);
    foliage.scale.set(1.0 * scale, 1.0 * scale, 1.0 * scale);
    foliage.position.y = 1.5 * scale;
    group.add(foliage);
    return group;
  }

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.1 * scale, 0.15 * scale, 0.8 * scale, 8);
  const trunkMat = isVoid 
    ? new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x2d1b0a, emissiveIntensity: 1.2 })
    : new THREE.MeshPhongMaterial({ color: 0x2d1b0a }); // Natural brown trunk
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  if (isVoid) trunk.userData.pulsate = true;
  trunk.position.y = 0.4 * scale;
  if (!isVoid) trunk.castShadow = true;
  group.add(trunk);
  
  // Dense Foliage - Multi-layered
  for (let i = 0; i < 3; i++) {
    const foliageGeo = new THREE.DodecahedronGeometry(0.4 * scale, 0);
    const foliageMat = isVoid
      ? new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x1b3d1b, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 })
      : new THREE.MeshPhongMaterial({ color: 0x1b3d1b }); // Natural deep forest green foliage
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    if (isVoid) foliage.userData.pulsate = true;
    foliage.position.y = (0.7 + i * 0.3) * scale;
    foliage.position.x = (Math.random() - 0.5) * 0.2;
    foliage.position.z = (Math.random() - 0.5) * 0.2;
    foliage.rotation.y = Math.random() * Math.PI;
    foliage.scale.set(1.2 - i * 0.2, 0.6, 1.2 - i * 0.2);
    if (!isVoid) foliage.castShadow = true;
    group.add(foliage);
  }
  
  return group;
};

const createFort = (theme: ThemeType = ThemeType.FOREST) => {
  const isBlocky = theme === ThemeType.BLOCKY;
  const isVoid = theme === ThemeType.VOID;
  if (isBlocky) {
    const group = new THREE.Group();
    // Voxel Castle
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, 4),
        new THREE.MeshPhongMaterial({ color: MC_COLORS.STONE, flatShading: true })
    );
    base.position.y = 1.5;
    group.add(base);

    for (let i = 0; i < 4; i++) {
        const tower = new THREE.Mesh(
            new THREE.BoxGeometry(1, 4, 1),
            new THREE.MeshPhongMaterial({ color: MC_COLORS.BEDROCK, flatShading: true })
        );
        tower.position.set(i < 2 ? 1.8 : -1.8, 2, i % 2 === 0 ? 1.8 : -1.8);
        group.add(tower);
    }
    return group;
  }
  const sprite = createEmojiSprite('🏰', 4);
  if (isVoid) {
    sprite.userData.pulsate = true;
  }
  return sprite;
};

// --- MAIN COMPONENT ---

export default function BlockyBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boardRef = useRef<THREE.Group | null>(null);
  const staticGroupRef = useRef<THREE.Group | null>(null);
  const playersRef = useRef<THREE.Group | null>(null);
  const trapsRef = useRef<THREE.Group | null>(null);
  const treasureRef = useRef<THREE.Group | null>(null);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const diceRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const rainRef = useRef<THREE.Points | null>(null);
  const mistRef = useRef<THREE.Points | null>(null);

  const pulsatingObjectsRef = useRef<THREE.Mesh[]>([]);
  const animatingLinesRef = useRef<THREE.Line[]>([]);
  const animatingFlagsRef = useRef<THREE.Group[]>([]);
  const animatingCoinsRef = useRef<THREE.Group[]>([]);
  const animalsRef = useRef<THREE.Group | null>(null);
  const effectsRef = useRef<any[]>([]);

  // Game State
  const [gameState, setGameState] = useState<'SETUP' | 'IDLE' | 'ROLLING' | 'MOVING' | 'REACTION' | 'WON'>('SETUP');
  const [players, setPlayers] = useState<Player[]>([]);
  const [setupPlayerCount, setSetupPlayerCount] = useState(2);
  const [setupPlayerNames, setSetupPlayerNames] = useState<string[]>(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  
  const PLAYER_COLORS = [
    '#5D9948', // Grass Green
    '#A1643F', // Brown
    '#64F2F2', // Diamond Blue
    '#FFEB3B', // Yellow
    '#7E57C2', // Purple
    '#FF7043', // Orange
    '#4CAF50', // Green
    '#FFD700', // Gold
    '#2196F3', // Blue
    '#E91E63'  // Pink
  ];

  const [setupPlayerColors, setSetupPlayerColors] = useState<string[]>(PLAYER_COLORS.slice(0, 4));

  const [isSpectating, setIsSpectating] = useState(false);
  const [cameraMode, setCameraMode] = useState<'FREE' | 'TOP' | 'ISO' | 'FOLLOW' | 'SHOULDER'>('FOLLOW');
  const [followedPlayerIndex, setFollowedPlayerIndex] = useState(0);

  const [isMuted, setIsMuted] = useState(true);
  const [fogDensity, setFogDensity] = useState(0.015);
  const [currentLevelID, setCurrentLevelID] = useState<LevelID>(LevelID.WHISPERING_WOODS);
  const currentLevel = LEVELS[currentLevelID];
  const theme = currentLevel.theme;
  const boardSize = currentLevel.boardSize;

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [selectedDiceSkin, setSelectedDiceSkin] = useState<DiceSkinType>('DEFAULT');
  const [unlockedDiceSkins, setUnlockedDiceSkins] = useState<DiceSkinType[]>(['DEFAULT']);
  const [toast, setToast] = useState<{ text: string; color: string } | null>(null);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [disabledTransports, setDisabledTransports] = useState<number[]>([]);
  const [tntTiles, setTntTiles] = useState<number[]>([]);
  const [predators, setPredators] = useState<{start: number, end: number, type: string, label: string}[]>([]);
  const [treasureMap, setTreasureMap] = useState<Map<number, ItemType | 'COIN'>>(new Map());
  const [lastCollectedTile, setLastCollectedTile] = useState<number | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [targetingItem, setTargetingItem] = useState<ItemType | null>(null);
  const [activePaletteIndex, setActivePaletteIndex] = useState<number | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<ScoreEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [boardSyncData, setBoardSyncData] = useState<any>(null);

  // Multiplayer State
  const [user, setUser] = useState<any>(null);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [copied, setCopied] = useState(false);

  // Weather and Navigation States
  const [weather, setWeather] = useState<'SUNNY' | 'RAIN' | 'MIST'>('SUNNY');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // URL Parameter check for auto-joining
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('match');
    if (code) {
      setJoinCodeInput(code.toUpperCase());
      // Optional: auto-join if user is already logged in? 
      // Better to just fill the input for safety.
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setSetupPlayerNames(prev => {
          const names = [...prev];
          names[0] = u.displayName || 'Player 1';
          return names;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      showToast("SIGN IN FAILED", "#ff4444");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('match', matchId || '');
    const fullUrl = url.toString();

    const shareData = {
      title: '🌴 Eco Board Game: Multi-Player',
      text: `Join my match on Wild Board! Code: ${matchId}`,
      url: fullUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        showToast("SHARED SUCCESSFULLY!", "#39FF14");
      } else {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        showToast("LINK COPIED TO CLIPBOARD!", "#39FF14");
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        // Fallback for any other error
        navigator.clipboard.writeText(fullUrl);
        showToast("LINK COPIED TO CLIPBOARD!", "#39FF14");
      }
    }
  };

  const generateJoinCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const hostMatch = async () => {
    if (!user) return handleLogin();
    setLoadingMatch(true);
    const code = generateJoinCode();
    try {
      const matchRef = doc(db, 'matches', code);
      await setDoc(matchRef, {
        hostId: user.uid,
        status: 'LOBBY',
        levelId: currentLevelID,
        currentTurn: 0,
        lastRoll: 0,
        updatedAt: serverTimestamp()
      });

      // Add self as participant
      const pRef = doc(db, 'matches', code, 'participants', user.uid);
      await setDoc(pRef, {
        userId: user.uid,
        name: user.displayName || 'Host',
        photoURL: user.photoURL,
        position: 0,
        coins: 100,
        color: PLAYER_COLORS[0],
        isReady: true,
        inventory: [],
        joinedAt: serverTimestamp()
      });

      setMatchId(code);
      setIsHost(true);
      setIsMultiplayer(true);
      showToast(`MATCH CREATED: ${code}`, "#39FF14");
    } catch (e) {
      console.error(e);
      showToast("FAILED TO CREATE MATCH", "#ff4444");
    }
    setLoadingMatch(false);
  };

  const joinMatch = async (code: string) => {
    if (!user) return handleLogin();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    setLoadingMatch(true);
    try {
      const matchRef = doc(db, 'matches', cleanCode);
      const matchSnap = await getDoc(matchRef);
      if (!matchSnap.exists()) {
        showToast("INVALID MATCH CODE", "#ff4444");
        setLoadingMatch(false);
        return;
      }

      const matchData = matchSnap.data();
      setCurrentLevelID(matchData.levelId);

      // Add self as participant
      const pRef = doc(db, 'matches', cleanCode, 'participants', user.uid);
      await setDoc(pRef, {
        userId: user.uid,
        name: user.displayName || 'Guest',
        photoURL: user.photoURL,
        position: 0,
        coins: 100,
        color: PLAYER_COLORS[Math.floor(Math.random() * 10)], 
        isReady: true,
        inventory: [],
        joinedAt: serverTimestamp()
      });

      setMatchId(cleanCode);
      setIsHost(false);
      setIsMultiplayer(true);
      showToast("JOINED MATCH!", "#39FF14");
    } catch (e) {
      console.error(e);
      showToast("FAILED TO JOIN MATCH", "#ff4444");
    }
    setLoadingMatch(false);
  };

  // Match Sync
  useEffect(() => {
    if (!matchId || !isMultiplayer) return;

    const matchRef = doc(db, 'matches', matchId);
    const unsubMatch = onSnapshot(matchRef, (snap) => {
      const data = snap.data();
      if (!data) return;
      
      if (data.status === 'PLAYING' && gameState === 'SETUP') {
        setGameState('IDLE');
      }

      if (data.boardLayout) {
        setBoardSyncData(JSON.parse(data.boardLayout));
      }

      if (data.currentTurn !== undefined) setCurrentPlayerIndex(data.currentTurn);
      if (data.lastRoll !== undefined) setRollResult(data.lastRoll);
    });

    const participantsRef = collection(db, 'matches', matchId, 'participants');
    const unsubParticipants = onSnapshot(query(participantsRef, orderBy('joinedAt', 'asc')), (snap) => {
      const parts = snap.docs.map(d => d.data());
      setParticipants(parts);
      
      const localPlayers = parts.map((p: any, idx: number) => ({
        id: idx,
        userId: p.userId,
        name: p.name,
        position: p.position,
        coins: p.coins,
        color: p.color,
        isAuto: false,
        isImmune: false,
        isSlowed: false,
        inventory: p.inventory || [],
        turns: p.turns || 0,
        cagedTurns: p.cagedTurns || 0
      }));
      setPlayers(localPlayers);
    });

    return () => {
      unsubMatch();
      unsubParticipants();
    };
  }, [matchId, isMultiplayer, gameState]);

  const fetchLeaderboard = useCallback(async (level: LevelID) => {
    setLoadingLeaderboard(true);
    const data = await getLeaderboard(level);
    setLeaderboardData(data);
    setLoadingLeaderboard(false);
  }, []);

  useEffect(() => {
    if (isLeaderboardOpen) {
      fetchLeaderboard(currentLevelID);
    }
  }, [isLeaderboardOpen, currentLevelID, fetchLeaderboard]);

  useEffect(() => {
    if (messages.length > 0) {
      setShowNotification(true);
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // Navigation Guard for Jungle Theme
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // theme FOREST is the classic Jungle theme (Whispering Woods)
      if (gameState !== 'SETUP' && gameState !== 'WON' && theme === ThemeType.FOREST) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (gameState !== 'SETUP' && gameState !== 'WON' && theme === ThemeType.FOREST) {
        // Prevent back navigation by pushing current state back
        window.history.pushState(null, '', window.location.pathname);
        setShowExitConfirm(true);
      }
    };

    if (gameState !== 'SETUP' && gameState !== 'WON' && theme === ThemeType.FOREST) {
      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [gameState, theme]);

  // Weather Cycle Logic
  useEffect(() => {
    const weatherCycle = setInterval(() => {
      const weathers: ('SUNNY' | 'RAIN' | 'MIST')[] = ['SUNNY', 'RAIN', 'MIST'];
      setWeather(prev => {
        const next = weathers[Math.floor(Math.random() * weathers.length)];
        return next;
      });
    }, 25000); 
    return () => clearInterval(weatherCycle);
  }, []);



  const currentP = players[currentPlayerIndex] || { 
    id: -1, 
    name: '---', 
    color: '#fff', 
    position: 1, 
    coins: 0, 
    inventory: [] as ItemType[], 
    cagedTurns: 0 
  };

  const uiColors = theme === ThemeType.BLOCKY 
    ? { primary: '#A1643F', secondary: '#5D9948', accent: '#64F2F2', bg: 'bg-[#795548]', border: 'border-[#A1643F]/50', text: 'text-[#efebe9]', glow: 'shadow-[0_0_15px_rgba(161,100,63,0.4)]' }
    : theme === ThemeType.VOID
    ? { primary: '#00A2FF', secondary: '#FFFFFF', accent: '#00A2FF', bg: 'bg-[#1B1D1F]', border: 'border-[#393B3D]/80', text: 'text-white', glow: 'shadow-[0_0_15px_rgba(0,162,255,0.3)]' }
    : { primary: '#10b981', secondary: '#f59e0b', accent: '#3b82f6', bg: 'bg-emerald-950', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]' };

  const currentPlayerRef = useRef(0);
  const playersDataRef = useRef<Player[]>([]);
  useEffect(() => { 
    currentPlayerRef.current = currentPlayerIndex; 
    playersDataRef.current = players;
  }, [currentPlayerIndex, players]);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
    return () => window.removeEventListener('beforeinstallprompt', () => {});
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  useEffect(() => {
    if (sceneRef.current) {
      pulsatingObjectsRef.current = []; // Reset when theme changes
      const ground = sceneRef.current.getObjectByName("ground_base") as THREE.Mesh;
      const particles = particlesRef.current;
      if (theme === ThemeType.BLOCKY) {
        if (rendererRef.current) rendererRef.current.shadowMap.enabled = true;
        sceneRef.current.background = new THREE.Color(0x78A7FF); // Sky blue
        sceneRef.current.fog = new THREE.FogExp2(0x78A7FF, fogDensity);
        
        if (particles) (particles.material as THREE.PointsMaterial).color.setHex(0xFFFFFF); // White clouds

        const sunLight = sceneRef.current.children.find(c => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
        if (sunLight) {
          sunLight.intensity = 1.4;
          sunLight.color.setHex(0xFFFFFF);
        }

        if (ground) {
          const groundMat = ground.material as THREE.MeshStandardMaterial;
          groundMat.color.setHex(MC_COLORS.DIRT);
          groundMat.emissive.setHex(0x221100);
          groundMat.emissiveIntensity = 0.05;
          groundMat.roughness = 1.0;
          groundMat.metalness = 0.0;
        }
      } else if (theme === ThemeType.VOID) {
        if (rendererRef.current) rendererRef.current.shadowMap.enabled = false;
        sceneRef.current.background = new THREE.Color(0x1B1D1F);
        sceneRef.current.fog = new THREE.FogExp2(0x1B1D1F, fogDensity);
        
        if (particles) (particles.material as THREE.PointsMaterial).color.setHex(0x00A2FF);

        const moonLight = sceneRef.current.children.find(c => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
        if (moonLight) {
          moonLight.intensity = 1.0;
          moonLight.color.setHex(0x00A2FF); // Roblox Blueish light
        }

        if (ground) {
          const groundMat = ground.material as THREE.MeshStandardMaterial;
          groundMat.color.setHex(0x000000);
          groundMat.emissive.setHex(0x111111);
          groundMat.emissiveIntensity = 0.1;
          groundMat.roughness = 1.0;
          groundMat.metalness = 0.0;
        }
      } else if (theme === ThemeType.FOREST) {
        if (rendererRef.current) rendererRef.current.shadowMap.enabled = true;
        sceneRef.current.background = new THREE.Color(0x050a05);
        sceneRef.current.fog = new THREE.FogExp2(0x0a1a0a, fogDensity);

        if (particles) (particles.material as THREE.PointsMaterial).color.setHex(0x39FF14);

        const moonLight = sceneRef.current.children.find(c => c instanceof THREE.DirectionalLight && (c.color.getHex() === 0xFF2D78 || c.color.getHex() === 0x39FF14 || c.color.getHex() === 0xBF5FFF)) as THREE.DirectionalLight;
        if (moonLight) {
          moonLight.intensity = 0.6;
          moonLight.color.setHex(0x39FF14);
        }

        if (ground) {
          const groundMat = ground.material as THREE.MeshPhongMaterial;
          groundMat.color.setHex(0x4a3a2a);
          groundMat.emissive.setHex(0x000000);
          groundMat.wireframe = false;
        }
      }
    }
  }, [theme, fogDensity]);

  useEffect(() => {
    if (sceneRef.current && sceneRef.current.fog instanceof THREE.FogExp2) {
      sceneRef.current.fog.density = fogDensity;
    }
  }, [fogDensity]);



  const startGame = () => {
    const initialPlayers: Player[] = [];
    const count = setupPlayerCount === 1 ? 2 : setupPlayerCount;
    
    for (let i = 0; i < count; i++) {
      const isBot = setupPlayerCount === 1 && i === 1;
      initialPlayers.push({
        id: i,
        name: isBot ? "BlockBot-ONE" : (setupPlayerNames[i] || `Player ${i + 1}`),
        color: isBot ? "#5D9948" : setupPlayerColors[i],
        position: 1,
        coins: 50,
        inventory: [],
        turns: 0,
        cagedTurns: 0,
        speedBoost: false,
        multiplier: false,
        reversed: false,
        sluggish: false,
        isBot
      });
    }
    setPlayers(initialPlayers);
    setCurrentPlayerIndex(0);
    setGameState('IDLE');
  };

  // Weather Effects Switcher
  useEffect(() => {
    if (!sceneRef.current) return;
    const rain = rainRef.current;
    const mist = mistRef.current;
    const dirLight = sceneRef.current.children.find(c => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight;

    if (weather === 'RAIN') {
      if (rain) {
        rain.visible = true;
        gsap.to((rain.material as THREE.PointsMaterial), { opacity: 0.6, duration: 2 });
      }
      if (mist) gsap.to((mist.material as THREE.PointsMaterial), { opacity: 0, duration: 2, onComplete: () => { if (mistRef.current) mistRef.current.visible = false; } });
      gsap.to(sceneRef.current.fog, { density: 0.03, duration: 3 });
      if (dirLight) gsap.to(dirLight, { intensity: 0.6, duration: 3 });
    } else if (weather === 'MIST') {
      if (mist) {
        mist.visible = true;
        gsap.to((mist.material as THREE.PointsMaterial), { opacity: 0.3, duration: 2 });
      }
      if (rain) gsap.to((rain.material as THREE.PointsMaterial), { opacity: 0, duration: 2, onComplete: () => { if (rainRef.current) rainRef.current.visible = false; } });
      gsap.to(sceneRef.current.fog, { density: 0.06, duration: 3 });
      if (dirLight) gsap.to(dirLight, { intensity: 0.8, duration: 3 });
    } else { // SUNNY
      if (rain) gsap.to((rain.material as THREE.PointsMaterial), { opacity: 0, duration: 2, onComplete: () => { if (rainRef.current) rainRef.current.visible = false; } });
      if (mist) gsap.to((mist.material as THREE.PointsMaterial), { opacity: 0, duration: 2, onComplete: () => { if (mistRef.current) mistRef.current.visible = false; } });
      gsap.to(sceneRef.current.fog, { density: 0.015, duration: 3 });
      if (dirLight) gsap.to(dirLight, { intensity: 1.4, duration: 3 });
    }
  }, [weather]);

  const resetToSetup = () => {
    setGameState('SETUP');
    setMessages([]);
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setRollResult(null);
    setTntTiles([]);
    setTreasureMap(new Map());
    setLastCollectedTile(null);
    if (SoundEngine.intensity === 'intense') {
      SoundEngine.setIntensity('calm');
    }
  };

  const ConfettiPopper = () => {
    const pieces = Array.from({ length: 100 });
    return (
      <div className="fixed inset-0 pointer-events-none z-[120] overflow-hidden">
        {pieces.map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              top: -20, 
              left: `${Math.random() * 100}%`,
              rotate: 0,
              scale: 0
            }}
            animate={{ 
              top: '110%', 
              left: `${(Math.random() * 100) + (Math.random() - 0.5) * 30}%`,
              rotate: Math.random() * 1000,
              scale: [0, 1, 1, 0.5]
            }}
            transition={{ 
              duration: 4 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 8,
              ease: "linear"
            }}
            className="absolute w-2 h-4 sm:w-3 sm:h-5 rounded-sm shadow-sm"
            style={{ 
              backgroundColor: ['#39FF14', '#FF2D78', '#00F5FF', '#FFE600', '#BF5FFF'][Math.floor(Math.random() * 5)]
            }}
          />
        ))}
        {/* Dynamic Party Poppers */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`popper-${i}`}
            initial={{ scale: 0, opacity: 0, y: 100 }}
            animate={{ 
              scale: [0, 2, 0], 
              opacity: [0, 1, 0],
              x: (i % 2 === 0 ? 1 : -1) * (200 + Math.random() * 300),
              y: -500 - Math.random() * 300
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              repeatDelay: Math.random() * 3 + 1,
              delay: i * 0.5
            }}
            className={`absolute bottom-0 ${i % 2 === 0 ? 'left-[10%]' : 'right-[10%]'} text-6xl sm:text-8xl`}
          >
            {['🎉', '🎊', '✨', '🎈'][Math.floor(Math.random() * 4)]}
          </motion.div>
        ))}
      </div>
    );
  };

  // --- CAMERA MODES UI ---
  const CameraControls = () => (
    <div className={`absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 backdrop-blur-md p-2 rounded-2xl border border-white/10 pointer-events-auto shadow-2xl z-[100] ${uiColors.bg}`}>
      <div className="flex gap-2">
        {(['FOLLOW', 'SHOULDER', 'ISO', 'TOP', 'FREE'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setCameraMode(mode)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
              cameraMode === mode 
              ? 'text-white' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
            style={cameraMode === mode ? { backgroundColor: uiColors.primary, boxShadow: `0 0 15px ${uiColors.primary}60` } : {}}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="w-[1px] h-6 bg-white/10 mx-1" />
      <button 
        onClick={() => setIsMuted(SoundEngine.toggleMute())}
        className={`p-2 rounded-xl transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'hover:bg-white/5'}`}
        style={!isMuted ? { color: uiColors.primary } : {}}
      >
        <span className="text-xs font-bold">{isMuted ? '🔇 MUTED' : '🔊 AUDIO'}</span>
      </button>
      <div className="w-[1px] h-6 bg-white/10 mx-1" />
      <div className="flex flex-col gap-1">
        <span className="text-[8px] text-white/40 font-bold uppercase">Fog Density</span>
        <input 
          type="range" 
          min="0" 
          max="0.05" 
          step="0.001" 
          value={fogDensity} 
          onChange={(e) => setFogDensity(parseFloat(e.target.value))}
          className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
        />
      </div>
      {deferredPrompt && (
        <button 
          onClick={handleInstallClick}
          className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition-colors scale-in"
        >
          <span className="text-[10px] font-black uppercase tracking-wider">Install Offline</span>
        </button>
      )}
    </div>
  );


  const addMessage = (msg: string) => {
    setMessages(prev => [msg, ...prev].slice(0, 10));
  };

  const triggerVFX = useCallback((type: 'explosion' | 'spark' | 'collect' | 'shield' | 'cage', position: { x: number, y: number, z: number }, color: number) => {
    if (!sceneRef.current) return;
    
    if (type === 'collect') {
      // Enhanced collection burst - flying emoji
      const emoji = color === 0xFFE600 ? '🪙' : '🌀';
      const sprite = createEmojiSprite(emoji, 0.4);
      sprite.position.set(position.x, position.y + 0.5, position.z);
      sceneRef.current.add(sprite);
      
      const tl = gsap.timeline({
        onComplete: () => {
          sceneRef.current?.remove(sprite);
        }
      });
      
      tl.to(sprite.position, { y: position.y + 3.5, duration: 0.7, ease: "back.out(1.5)" });
      tl.to(sprite.scale, { x: 0, y: 0, z: 0, duration: 0.5, ease: "power2.in" }, "-=0.3");
      
      // Also add a little particle ring
      const ringGeo = new THREE.TorusGeometry(0.3, 0.02, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(position.x, position.y + 0.1, position.z);
      sceneRef.current.add(ring);
      
      gsap.to(ring.scale, { x: 2.5, y: 2.5, duration: 0.5 });
      gsap.to(ring.material, { opacity: 0, duration: 0.5, onComplete: () => {
        sceneRef.current?.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }});
    }
    
    if (type === 'cage') {
      const group = new THREE.Group();
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, wireframe: true });
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 4), material);
      cage.position.set(position.x, position.y + 0.25, position.z);
      cage.scale.set(0, 0, 0);
      group.add(cage);
      
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 })
      );
      glow.position.set(position.x, position.y + 0.25, position.z);
      glow.scale.set(0, 0, 0);
      group.add(glow);
      
      sceneRef.current.add(group);
      
      gsap.to([cage.scale, glow.scale], {
        x: 1, y: 1, z: 1,
        duration: 0.5,
        ease: "back.out(2)"
      });
      
      gsap.to(cage.rotation, {
        y: Math.PI * 2,
        duration: 2,
        repeat: -1,
        ease: "none"
      });
      
      setTimeout(() => {
        gsap.to(group.scale, {
          x: 0, y: 0, z: 0,
          duration: 0.5,
          onComplete: () => {
            sceneRef.current?.remove(group);
            cage.geometry.dispose();
            glow.geometry.dispose();
            material.dispose();
          }
        });
      }, 2000);
      return;
    }

    const count = type === 'explosion' ? 50 : 20;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.2 + 0.1;
      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = Math.random() * speed;
      velocities[i * 3 + 2] = Math.sin(angle) * speed;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ 
      color: color, 
      size: type === 'explosion' ? 0.2 : 0.08, 
      transparent: true, 
      opacity: 1, 
      blending: THREE.AdditiveBlending 
    });
    
    const points = new THREE.Points(geometry, material);
    sceneRef.current.add(points);
    
    const startTime = Date.now();
    const duration = 1000;
    
    effectsRef.current.push({
      update: (now: number) => {
        const elapsed = now - startTime;
        if (elapsed > duration) {
          sceneRef.current?.remove(points);
          geometry.dispose();
          material.dispose();
          return false;
        }
        
        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < count; i++) {
          posAttr.array[i * 3] += velocities[i * 3];
          posAttr.array[i * 3 + 1] += velocities[i * 3 + 1];
          posAttr.array[i * 3 + 2] += velocities[i * 3 + 2];
          velocities[i * 3 + 1] -= 0.005; // gravity
        }
        posAttr.needsUpdate = true;
        material.opacity = 1 - (elapsed / duration);
        return true;
      }
    });

    if (type === 'explosion') {
      // Screen shake disabled as requested
    }
  }, []);

  const triggerDizzyEffect = useCallback((pIdx: number, duration: number = 2000) => {
    if (!sceneRef.current || !playersRef.current) return;
    const token = playersRef.current.children[pIdx] as THREE.Group;
    if (!token) return;

    const group = new THREE.Group();
    const starCount = 5;
    for (let i = 0; i < starCount; i++) {
      const star = createEmojiSprite('💫', 0.2);
      const angle = (i / starCount) * Math.PI * 2;
      star.position.set(Math.cos(angle) * 0.4, 1.2, Math.sin(angle) * 0.4);
      group.add(star);
    }
    token.add(group);

    gsap.to(group.rotation, {
      y: Math.PI * 2,
      duration: 1,
      repeat: -1,
      ease: "none"
    });

    setTimeout(() => {
      token.remove(group);
      group.traverse((c: any) => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    }, duration);
  }, []);

  const triggerPulse = useCallback((object: THREE.Object3D, color: number) => {
    if (!object) return;
    const originalColor = (object as any).material?.emissive?.getHex?.() || 0x000000;
    gsap.to((object as any).material.emissive, {
      r: (color >> 16 & 255) / 255,
      g: (color >> 8 & 255) / 255,
      b: (color & 255) / 255,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        (object as any).material.emissive.setHex(originalColor);
      }
    });
  }, []);

  const triggerProjectile = useCallback((type: 'ARROW' | 'ROCKET' | 'TANK', from: number, to: number, onHit: () => void) => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;
    const fromCoords = getTileCoordsGlobal(from);
    const toCoords = getTileCoordsGlobal(to);

    let projectile: THREE.Object3D;
    if (type === 'ARROW') {
      const group = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), new THREE.MeshPhongMaterial({ color: 0x8B4513 }));
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 4), new THREE.MeshPhongMaterial({ color: 0xaaaaaa }));
      head.position.y = 0.3;
      group.add(shaft, head);
      projectile = group;
    } else if (type === 'ROCKET') {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5), new THREE.MeshPhongMaterial({ color: 0x333333 }));
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 8), new THREE.MeshPhongMaterial({ color: 0xff0000 }));
      nose.position.y = 0.35;
      group.add(body, nose);
      projectile = group;
    } else {
      // Tank shell (Armoured Fighting Vehicle)
      projectile = createEmojiSprite('🛡️', 0.6);
    }
    
    projectile.position.set(fromCoords.x, 2, fromCoords.z); // Start a bit higher
    projectile.lookAt(toCoords.x, 2, toCoords.z);
    projectile.rotateX(Math.PI / 2); // Cylinder/Cone are Y-up
    
    sceneRef.current.add(projectile);

    SoundEngine.play(type === 'ROCKET' ? 'rocket' : type === 'ARROW' ? 'arrow' : 'tank');

    const duration = type === 'ARROW' ? 2.5 : 3.5; // Slow motion flight
    const prevCameraMode = cameraMode;
    setCameraMode('FREE');

    gsap.to(projectile.position, {
      x: toCoords.x,
      y: 1,
      z: toCoords.z,
      duration: duration,
      ease: "power1.inOut",
      onUpdate: () => {
        if (type !== 'ARROW') {
          triggerVFX('spark', { x: projectile.position.x, y: projectile.position.y, z: projectile.position.z }, 0xffaa00);
        }
        
        // Cinematic camera travel - float alongside
        if (cameraRef.current && controlsRef.current) {
          const camOffset = new THREE.Vector3(-4, 4, 4);
          const camTargetPos = projectile.position.clone().add(camOffset);
          cameraRef.current.position.lerp(camTargetPos, 0.1);
          controlsRef.current.target.lerp(projectile.position, 0.1);
        }
      },
      onComplete: () => {
        sceneRef.current?.remove(projectile);
        if (type !== 'ARROW') {
          triggerVFX('explosion', { x: toCoords.x, y: 1, z: toCoords.z }, type === 'ROCKET' ? 0xFF2D78 : 0x555555);
          SoundEngine.play('explosion');
        }
        onHit();
        
        // Return camera after hit
        setTimeout(() => setCameraMode(prevCameraMode), 1000);
      }
    });
  }, [triggerVFX, cameraMode]);

  const [activeTransports, setActiveTransports] = useState<{start: number, end: number, type: string, label: string}[]>([]);

  // Dynamic initialization of board elements based on level
  useEffect(() => {
    if (isMultiplayer && !isHost && !boardSyncData) return;

    if (isMultiplayer && boardSyncData) {
      setActiveTransports(boardSyncData.transports);
      setPredators(boardSyncData.predators);
      const m = new Map();
      Object.entries(boardSyncData.treasure).forEach(([k, v]) => m.set(parseInt(k), v));
      setTreasureMap(m);
      setTntTiles(boardSyncData.tnt);
      return;
    }

    const occupied = new Set<number>();
    occupied.add(1); 
    occupied.add(boardSize);

    const newTransports: {start: number, end: number, type: string, label: string}[] = [];
    const newPredators: {start: number, end: number, type: string, label: string}[] = [];
    const map = new Map<number, ItemType | 'COIN'>();
    const initialTnt: number[] = [];

    const buffItems: ItemType[] = ['BOOST', 'MULTIPLIER', 'ANTI_VENOM'];
    const debuffItems: ItemType[] = ['ACID', 'QUICKSAND', 'REVERSE', 'REDUCED'];
    const weaponItems: ItemType[] = ['TANK', 'TNT', 'ARROW', 'ROCKET', 'CAGE'];

    const isPredatorOrDebuff = (tile: number) => {
      // Check predators
      if (newPredators.some(p => p.start === tile)) return true;
      // Check debuffs in map
      const item = map.get(tile);
      if (item && debuffItems.includes(item as ItemType)) return true;
      return false;
    };

    // Process in blocks of 10
    for (let blockStart = 1; blockStart < boardSize; blockStart += 10) {
      const blockEnd = Math.min(boardSize, blockStart + 9);
      const constraints = currentLevel.itemDensity;
      
      const pool: string[] = [];
      // Use block percentage to adjust if we are near the end
      const blockSize = blockEnd - blockStart + 1;
      
      // Fill pool with minimums
      for (let i = 0; i < constraints.treasure[0]; i++) pool.push('TREASURE');
      for (let i = 0; i < (blockStart < boardSize * 0.8 ? 1 : 0); i++) pool.push('TRANSPORT');
      for (let i = 0; i < constraints.buff[0]; i++) pool.push('BUFF');
      for (let i = 0; i < constraints.debuff[0]; i++) pool.push('DEBUFF');
      for (let i = 0; i < 1; i++) pool.push('EMPTY');
      for (let i = 0; i < constraints.predator[0]; i++) pool.push('PREDATOR');

      // Randomly add more until we reach 10 (taking max into account)
      const options = [
        { key: 'TREASURE', max: constraints.treasure[1] },
        { key: 'BUFF', max: constraints.buff[1] },
        { key: 'DEBUFF', max: constraints.debuff[1] },
        { key: 'EMPTY', max: 5 },
        { key: 'PREDATOR', max: constraints.predator[1] }
      ];

      while (pool.length < blockSize) {
        const validOptions = options.filter(o => {
          const current = pool.filter(p => p === o.key).length;
          return current < o.max;
        });
        if (validOptions.length === 0) break;
        const choice = validOptions[Math.floor(Math.random() * validOptions.length)];
        pool.push(choice.key);
      }
      
      // Shuffle pool
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      // Assign to tiles
      let poolIdx = 0;
      for (let t = blockStart; t <= blockEnd; t++) {
        if (occupied.has(t)) continue;
        if (poolIdx >= pool.length) break;
        
        let type = pool[poolIdx];
        
        // RULE: No two continuous tiles contains predator or DeBuff
        if ((type === 'PREDATOR' || type === 'DEBUFF') && isPredatorOrDebuff(t - 1)) {
          // Try to find a later item in pool that is safe
          let foundSafe = false;
          for (let j = poolIdx + 1; j < pool.length; j++) {
            if (pool[j] !== 'PREDATOR' && pool[j] !== 'DEBUFF') {
              // Swap
              [pool[poolIdx], pool[j]] = [pool[j], pool[poolIdx]];
              type = pool[poolIdx];
              foundSafe = true;
              break;
            }
          }
          if (!foundSafe) type = 'EMPTY'; // Fallback
        }
        poolIdx++;

        if (type === 'TREASURE') {
          const isCoin = Math.random() > 0.4;
          if (isCoin) {
            map.set(t, 'COIN');
          } else {
            const weapon = weaponItems[Math.floor(Math.random() * weaponItems.length)];
            if (weapon === 'TNT') initialTnt.push(t);
            else map.set(t, weapon);
          }
        } else if (type === 'TRANSPORT' && t < boardSize * 0.9) {
          const jump = Math.floor(Math.random() * 15) + boardSize * 0.1;
          const end = Math.min(boardSize - 1, Math.round(t + jump));
          newTransports.push({ start: t, end, type: 'TRAIN', label: `SHORTCUT: TO ${end}` });
        } else if (type === 'BUFF') {
          const item = buffItems[Math.floor(Math.random() * buffItems.length)];
          map.set(t, item);
        } else if (type === 'DEBUFF') {
          const item = debuffItems[Math.floor(Math.random() * debuffItems.length)];
          map.set(t, item);
        } else if (type === 'PREDATOR') {
          const back = Math.floor(Math.random() * 12) + 4;
          const end = Math.max(2, t - back);
          const predatorTypes = ['SNAKE', 'BEAR', 'RHINO', 'DINO'];
          const pType = predatorTypes[Math.floor(Math.random() * predatorTypes.length)];
          const isVoid = theme === ThemeType.VOID;
          let pLabel = pType;
          if (isVoid) {
            if (pType === 'BEAR') pLabel = '🐯 TIGER';
            else if (pType === 'RHINO') pLabel = '🐘 ELEPHANT';
            else if (pType === 'SNAKE') pLabel = '🐍 SNAKE';
            else if (pType === 'DINO') pLabel = '🦖 DINO';
          } else {
            if (pType === 'BEAR') pLabel = '🐻 BEAR';
            else if (pType === 'RHINO') pLabel = '🦏 RHINO';
            else if (pType === 'SNAKE') pLabel = '🐍 SNAKE';
            else if (pType === 'DINO') pLabel = '🦖 DINO';
          }
          newPredators.push({ start: t, end, type: pType, label: `${pLabel} AMBUSH: BACK TO ${end}` });
          occupied.add(end); // Landing is safe
        }
        
        occupied.add(t);
      }
    }

    setActiveTransports(newTransports);
    setPredators(newPredators);
    setTreasureMap(map);
    setTntTiles(initialTnt);

    if (isMultiplayer && isHost && matchId) {
      const layout = {
        transports: newTransports,
        predators: newPredators,
        treasure: Object.fromEntries(map),
        tnt: initialTnt
      };
      updateDoc(doc(db, 'matches', matchId), { boardLayout: JSON.stringify(layout) });
    }
  }, [currentLevelID, boardSize, boardSyncData, isMultiplayer, isHost, matchId]);

  const createCoin = () => {
    // Replaced 3D coin with 🪙 emoji sprite
    const sprite = createEmojiSprite('🪙', 0.4);
    sprite.userData = { type: 'COIN' };
    return sprite;
  };

  const createTreasureBox = (itemType: ItemType | 'COIN') => {
    const group = new THREE.Group();
    
    // Base of the chest
    const boxBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.4), 
      new THREE.MeshPhongMaterial({ color: 0x5a3a22, flatShading: true })
    );
    boxBase.position.y = 0.15;
    boxBase.castShadow = true;
    boxBase.receiveShadow = true;
    group.add(boxBase);

    // Lid - pivot at the back edge
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.3, -0.2); // Pivot at the back top edge
    lidGroup.name = "lid";
    
    const lidMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.1, 0.4),
      new THREE.MeshPhongMaterial({ color: 0x8B4513, flatShading: true })
    );
    lidMesh.position.set(0, 0.05, 0.2); // Offset so pivot is at edge
    lidMesh.castShadow = true;
    lidGroup.add(lidMesh);
    
    // Add some gold trim to lid
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.02, 0.05),
      new THREE.MeshPhongMaterial({ color: 0xFFD700 })
    );
    trim.position.set(0, 0.1, 0.4);
    lidMesh.add(trim);
    
    group.add(lidGroup);

    // Item inside (hidden until open)
    const icon = itemType === 'COIN' ? '🪙' : ITEMS[itemType].icon;
    const content = createEmojiSprite(icon, 0.5);
    content.position.set(0, 0.2, 0);
    content.scale.set(0, 0, 0);
    content.name = "content";
    group.add(content);
    
    return group;
  };

  const createCage = () => {
    const group = new THREE.Group();
    const material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
    for(let i=0; i<4; i++) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), material);
        pillar.position.set(i < 2 ? 0.2 : -0.2, 0, i % 2 === 0 ? 0.2 : -0.2);
        group.add(pillar);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), material);
    top.position.y = 0.25;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), material);
    base.position.y = -0.25;
    group.add(top, base);
    return group;
  };

  const showToast = (text: string, color: string = '#39FF14') => {
    setToast({ text, color });
    setTimeout(() => setToast(null), 2500);
  };

  const getTileCoords = useCallback((tileNumber: number) => {
    return getTileCoordsGlobal(tileNumber);
  }, []);

  // --- THREE.JS INITIALIZATION ---

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050a05); // Deeper jungle black
    scene.fog = new THREE.FogExp2(0x0a1a0a, 0.015); // Volumetric green fog
    sceneRef.current = scene;

    const startPos = getTileCoordsGlobal(1);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Start with a clear overview
    camera.position.set(startPos.x - 10, startPos.y + 15, startPos.z + 15);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
    renderer.shadowMap.enabled = theme !== ThemeType.VOID; // Disable shadows in Void for visibility
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const onContextLost = (event: Event) => {
      event.preventDefault();
      addMessage("System Alert: Graphics context lost. Attempting recovery...");
    };

    const onContextRestored = () => {
      addMessage("Graphics context restored.");
      handleResize();
    };

    renderer.domElement.addEventListener('webglcontextlost', onContextLost as any, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored as any, false);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 2;
    controls.maxDistance = 60;
    controls.target.set(startPos.x, startPos.y, startPos.z);
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); // Brighter
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 40, 20); // Central light
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    scene.add(dirLight);

    const spotlight = new THREE.SpotLight(0xffffff, 30, 100, Math.PI / 3.5, 0.5, 1);
    spotlight.name = "playerSpotlight";
    spotlight.castShadow = true;
    spotlight.shadow.mapSize.width = 1024;
    spotlight.shadow.mapSize.height = 1024;
    spotlight.position.set(startPos.x, startPos.y + 20, startPos.z);
    scene.add(spotlight);
    scene.add(spotlight.target);

    const moonLight = new THREE.DirectionalLight(0x39FF14, 0.6); // Slightly brighter green moonlight
    moonLight.position.set(startPos.x + 5, 20, startPos.z + 5);
    scene.add(moonLight);

    // Darkened Ground Base
    const groundGeo = new THREE.PlaneGeometry(500, 500, 60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x4a3a2a, 
      roughness: 0.8,
      metalness: 0.2,
      flatShading: true
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.name = "ground_base";
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    const gPosAttr = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < gPosAttr.count; i++) {
        // More rugged terrain with organic variance
        const x = gPosAttr.getX(i);
        const y = gPosAttr.getY(i);
        const h = (Math.sin(x/10) * Math.cos(y/10) * 1.5) + (Math.random() - 0.5) * 0.8;
        gPosAttr.setZ(i, h);
    }
    groundGeo.computeVertexNormals();
    scene.add(ground);

    const board = new THREE.Group();
    boardRef.current = board;
    scene.add(board);

    const environmentGroup = new THREE.Group();
    environmentGroup.name = "environment_group";
    scene.add(environmentGroup);

    const staticGroup = new THREE.Group();
    staticGroupRef.current = staticGroup;
    board.add(staticGroup);

    const animalsGroup = new THREE.Group();
    animalsRef.current = animalsGroup;
    board.add(animalsGroup);

    const playersGroup = new THREE.Group();
    playersRef.current = playersGroup;
    board.add(playersGroup);

    const treasureGroup = new THREE.Group();
    treasureRef.current = treasureGroup;
    board.add(treasureGroup);

    const trapsGroup = new THREE.Group();
    trapsRef.current = trapsGroup;
    board.add(trapsGroup);

    const pCount = 800;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for(let i=0; i<pCount*3; i++) pPos[i] = (Math.random() - 0.5) * 85;
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x39FF14, size: 0.12, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);
    particlesRef.current = points;

    // Helper for soft particle texture
    const createSoftTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.4)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };
    const softTexture = createSoftTexture();

    // Rain Particles
    const rainCount = 1500;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for(let i=0; i<rainCount*3; i++) {
      rainPos[i*3] = (Math.random() - 0.5) * 60;
      rainPos[i*3+1] = Math.random() * 40;
      rainPos[i*3+2] = (Math.random() - 0.5) * 60;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ 
      color: 0x88ccff, 
      size: 0.2, 
      map: softTexture, 
      transparent: true, 
      opacity: 0, 
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const rain = new THREE.Points(rainGeo, rainMat);
    rain.visible = false;
    scene.add(rain);
    rainRef.current = rain;

    // Mist Particles
    const mistCount = 600;
    const mistGeo = new THREE.BufferGeometry();
    const mistPos = new Float32Array(mistCount * 3);
    for(let i=0; i<mistCount*3; i++) {
      mistPos[i*3] = (Math.random() - 0.5) * 80;
      mistPos[i*3+1] = Math.random() * 8;
      mistPos[i*3+2] = (Math.random() - 0.5) * 80;
    }
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    const mistMat = new THREE.PointsMaterial({ 
      color: 0xeeeeee, 
      size: 6, 
      map: softTexture,
      transparent: true, 
      opacity: 0, 
      blending: THREE.NormalBlending,
      depthWrite: false
    });
    const mist = new THREE.Points(mistGeo, mistMat);
    mist.visible = false;
    scene.add(mist);
    mistRef.current = mist;

    const animate = () => {
      requestAnimationFrame(animate);
      const now = Date.now();
      
      // Safety check: ensure canvas is in DOM
      if (containerRef.current && rendererRef.current && !containerRef.current.contains(rendererRef.current.domElement)) {
        containerRef.current.appendChild(rendererRef.current.domElement);
        handleResize();
      }

      // Camera Logic (Immersive Spectator Mode)
      if (cameraRef.current && controlsRef.current && playersRef.current) {
        const activeIdx = currentPlayerRef.current;
        const token = playersRef.current.children[activeIdx];
        
        if (token) {
          const playerPos = token.position.clone();
          
          if (cameraMode === 'TOP') {
            cameraRef.current.position.lerp(new THREE.Vector3(playerPos.x, playerPos.y + 25, playerPos.z + 0.1), 0.05);
            controlsRef.current.target.lerp(playerPos, 0.05);
          } else if (cameraMode === 'ISO') {
            cameraRef.current.position.lerp(new THREE.Vector3(playerPos.x - 12, playerPos.y + 12, playerPos.z + 12), 0.05);
            controlsRef.current.target.lerp(playerPos, 0.05);
          } else if (cameraMode === 'FOLLOW') {
            // Immersive Cinematic following camera: slides through jungle
            // Optimized tracking factors
            const lerpFactor = gameState === 'MOVING' ? 0.08 : 0.04;
            const targetLerpFactor = gameState === 'MOVING' ? 0.12 : 0.06;

            // Follow ground position to avoid hopping Y jitter
            const floorPos = playerPos.clone();
            floorPos.y = Math.max(0, playerPos.y - 0.5); // Approximate floor
            
            const offset = new THREE.Vector3(-10, 12, 10); 
            const targetPos = floorPos.clone().add(offset);
            cameraRef.current.position.lerp(targetPos, lerpFactor); 
            
            // Dynamic Look Target based on path direction
            let lookDir = new THREE.Vector3(1, 0, -1); // Default
            const p = playersDataRef.current[activeIdx];
            if (p && p.position < 100) {
              const nextTile = getTileCoordsGlobal(p.position + 1);
              lookDir.set(nextTile.x - playerPos.x, 0, nextTile.z - playerPos.z).normalize();
            }

            const lookTarget = playerPos.clone().add(lookDir.multiplyScalar(5));
            controlsRef.current.target.lerp(lookTarget, targetLerpFactor);
          } else if (cameraMode === 'SHOULDER') {
            // High-detail shoulder view - tight tracking
            const offset = new THREE.Vector3(-3.5, 3.5, 4.5);
            const targetPos = playerPos.clone().add(offset);
            cameraRef.current.position.lerp(targetPos, 0.08); 
            
            const lookTarget = playerPos.clone().add(new THREE.Vector3(6, 0, -6));
            controlsRef.current.target.lerp(lookTarget, 0.1);
          }
        }
      }

      // Update Spotlight for jungle immersion
      if (playersRef.current && sceneRef.current) {
        const activeIdx = currentPlayerRef.current;
        const token = playersRef.current.children[activeIdx];
        const spotlight = sceneRef.current.getObjectByName("playerSpotlight") as THREE.SpotLight;
        
        if (token && spotlight) {
          // Spotlight follows player
          const lightTargetY = token.position.y + 0.5;
          spotlight.position.set(token.position.x, token.position.y + 8, token.position.z);
          spotlight.target.position.lerp(new THREE.Vector3(token.position.x, lightTargetY, token.position.z), 0.1);
          spotlight.target.updateMatrixWorld();
        }
      }

      // Animate Animals
      if (animalsRef.current) {
        animalsRef.current.children.forEach(animal => {
          if (animal.name.includes('animal_HANGING_BAT_')) {
              // Subtle swaying for hanging bats
              animal.rotation.z = Math.sin(now * 0.002) * 0.1;
          }
        });
      }

      // Weather Particle Animation
      if (rainRef.current && rainRef.current.visible) {
        const rPosArr = rainRef.current.geometry.attributes.position.array as Float32Array;
        for(let i=0; i<1500; i++) {
          rPosArr[i*3+1] -= 1.0; 
          if (rPosArr[i*3+1] < -2) rPosArr[i*3+1] = 40;
        }
        rainRef.current.geometry.attributes.position.needsUpdate = true;
      }

      if (mistRef.current && mistRef.current.visible) {
        const mPosArr = mistRef.current.geometry.attributes.position.array as Float32Array;
        for(let i=0; i<600; i++) {
          mPosArr[i*3] += Math.sin(now * 0.001 + i) * 0.01; 
          mPosArr[i*3+2] += Math.cos(now * 0.001 + i) * 0.01;
        }
        mistRef.current.geometry.attributes.position.needsUpdate = true;
      }

      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      if (points) points.rotation.y += 0.001;

      // Optimized Animation for pulsating elements
      pulsatingObjectsRef.current.forEach((child) => {
        if ((child as any).material?.emissiveIntensity !== undefined) {
          const baseIntensity = (child as any).material.wireframe ? 1.8 : 1.0;
          (child as any).material.emissiveIntensity = baseIntensity + Math.sin(now * 0.005) * 0.6;
        }
      });

      // Optimized Line, Flag and Coin animations
      animatingLinesRef.current.forEach((line) => {
        if ((line.material as any).dashOffset !== undefined) {
          (line.material as any).dashOffset -= 0.01;
        }
      });

      animatingFlagsRef.current.forEach((flag: any) => {
        flag.rotation.y = Math.sin(now * 0.005) * 0.2;
        if (flag.geometry?.attributes?.position) {
          flag.geometry.attributes.position.array[0] = Math.sin(now * 0.01) * 0.1;
          flag.geometry.attributes.position.needsUpdate = true;
        }
      });

      animatingCoinsRef.current.forEach((coin: any) => {
        const pulse = Math.sin(now * 0.005) * 0.5 + 0.5;
        coin.traverse((mesh: any) => {
          if (mesh.material && mesh.material.emissiveIntensity !== undefined) {
            mesh.material.emissiveIntensity = 0.3 + pulse * 0.7;
            if (theme === ThemeType.BLOCKY) {
              mesh.material.emissive.setHex(0xFFFF00);
            } else {
              mesh.material.emissive.setHex(0xFFD700);
            }
          }
        });
      });

      // Update Effects
      effectsRef.current = effectsRef.current.filter(effect => {
        if (effect.update) return effect.update(now);
        return false;
      });
    };
    animate();

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      if (width === 0 || height === 0) return; // Prevent division by zero or NaN
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResize();
        // Force a render in case the loop was throttled
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    handleResize(); // Initial call
    setIsSceneReady(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost as any);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored as any);
      renderer.dispose();
    };
  }, []);

  // Sync Scene Environment to Theme
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;
    const scene = sceneRef.current;
    const renderer = rendererRef.current;

    const isBlocky = theme === ThemeType.BLOCKY;
    const isVoid = theme === ThemeType.VOID;
    if (isBlocky) {
      scene.background = new THREE.Color(0x78A7FF);
      scene.fog = new THREE.FogExp2(0x78A7FF, 0.012);
      renderer.shadowMap.enabled = true;
    } else if (isVoid) {
      scene.background = new THREE.Color(0x1B1D1F);
      scene.fog = new THREE.FogExp2(0x1B1D1F, 0.012);
      renderer.shadowMap.enabled = false;
    } else {
      scene.background = new THREE.Color(0x050a05);
      scene.fog = new THREE.FogExp2(0x0a1a0a, 0.015);
      renderer.shadowMap.enabled = true;
    }

    const ground = scene.getObjectByName("ground_base") as THREE.Mesh;
    if (ground) {
      const mat = ground.material as THREE.MeshStandardMaterial;
      if (isBlocky) {
        mat.color.set(MC_COLORS.DIRT);
        mat.emissive.set(0x221100);
        mat.roughness = 1.0;
      } else {
        mat.color.set(0x262615); // Natural dark forest floor
        mat.emissive.set(0x020502); // Subtle biological glow
        mat.roughness = 0.9;
        mat.metalness = 0.1;
      }
    }

    // Update sunlight
    scene.traverse((child) => {
      if (child instanceof THREE.DirectionalLight && child.intensity === 0.6) {
        child.color.set(isBlocky ? 0xFFFFFF : 0x39FF14);
      }
    });

    // Rebuild mountains
    const environmentGroup = scene.getObjectByName("environment_group") as THREE.Group;
    if (environmentGroup) {
      environmentGroup.clear();
      for (let i = 0; i < 15; i++) {
        const mntScale = 25 + Math.random() * 35;
        const mnt = createMountain(mntScale, theme);
        if (theme === ThemeType.VOID) pulsatingObjectsRef.current.push(mnt as any);
        const angle = (i / 15) * Math.PI * 2;
        const dist = 80 + Math.random() * 50;
        mnt.position.set(Math.cos(angle) * dist, -5, Math.sin(angle) * dist);
        mnt.rotation.y = Math.random() * Math.PI;
        environmentGroup.add(mnt);
      }
    }
  }, [theme]);

  useEffect(() => {
    if (diceRef.current) {
      const skin = DICE_SKINS[selectedDiceSkin];
      if (theme === ThemeType.BLOCKY) {
        if (diceRef.current instanceof THREE.Mesh) {
          (diceRef.current.material as THREE.MeshPhongMaterial).color.setHex(skin.color);
          (diceRef.current.material as THREE.MeshPhongMaterial).emissive.setHex(skin.emissive);
        }
      } else if (diceRef.current instanceof THREE.Mesh) {
        (diceRef.current.material as THREE.MeshPhongMaterial).color.setHex(skin.color);
        (diceRef.current.material as THREE.MeshPhongMaterial).emissive.setHex(skin.emissive);
      }
    }
  }, [selectedDiceSkin, theme]);

  useEffect(() => {
    if (!isSceneReady || !staticGroupRef.current || !animalsRef.current || !sceneRef.current) return;
    const staticGroup = staticGroupRef.current;
    const animalsGroup = animalsRef.current;
    const scene = sceneRef.current;
    
    staticGroup.clear();
    animalsGroup.clear();
    pulsatingObjectsRef.current = [];
    animatingLinesRef.current = [];
    animatingFlagsRef.current = [];
    animatingCoinsRef.current = []; // Important: Clear all animation arrays whenever the scene is rebuilt

    // Update Dice for the theme
    if (diceRef.current) scene.remove(diceRef.current);
    let dice;
    const skin = DICE_SKINS[selectedDiceSkin];
    const diceGeo = new THREE.BoxGeometry(1, 1, 1);
    const diceMat = new THREE.MeshPhongMaterial({ color: skin.color, emissive: skin.emissive });
    dice = new THREE.Mesh(diceGeo, diceMat);
    dice.position.set(7, 0.5, 7);
    scene.add(dice);
    diceRef.current = dice as any;

    // Update particles for the theme
    if (particlesRef.current) {
      const pMat = particlesRef.current.material as THREE.PointsMaterial;
      pMat.color.set(theme === ThemeType.BLOCKY ? 0xFFFFFF : 0x39FF14);
    }

    // Performance Optimization: Use InstancedMesh for Blocky objects
    if (theme === ThemeType.BLOCKY) {
      const stoneMatrices: THREE.Matrix4[] = [];
      const grassMatrices: THREE.Matrix4[] = [];
      const dirtMatrices: THREE.Matrix4[] = [];
      const trunkMatrices: THREE.Matrix4[] = [];
      const foliageMatrices: THREE.Matrix4[] = [];

      for (let i = 1; i <= boardSize; i++) {
        const coords = getTileCoords(i);
        
        // Tile Matrices
        const scale = 0.8 + Math.random() * 0.4;
        const matrixDirt = new THREE.Matrix4().makeTranslation(coords.x, coords.y - 0.4, coords.z);
        matrixDirt.scale(new THREE.Vector3(scale, 0.4, scale));
        dirtMatrices.push(matrixDirt);

        const matrixGrass = new THREE.Matrix4().makeTranslation(coords.x, coords.y - 0.15, coords.z);
        matrixGrass.scale(new THREE.Vector3(scale, 0.1, scale));
        grassMatrices.push(matrixGrass);

        // Decoration
        if (Math.random() > 0.45) {
          const treeCount = Math.floor(Math.random() * 2) + 1;
          for(let j=0; j<treeCount; j++) {
            const tScale = 0.6 + Math.random() * 0.7;
            const treePos = new THREE.Vector3(coords.x + (Math.random()-0.5)*4, coords.y - 0.2, coords.z + (Math.random()-0.5)*4);
            
            const matrixTrunk = new THREE.Matrix4().makeTranslation(treePos.x, treePos.y + 0.6 * tScale, treePos.z);
            matrixTrunk.scale(new THREE.Vector3(0.3 * tScale, 1.2 * tScale, 0.3 * tScale));
            trunkMatrices.push(matrixTrunk);

            const matrixFoliage = new THREE.Matrix4().makeTranslation(treePos.x, treePos.y + 1.5 * tScale, treePos.z);
            matrixFoliage.scale(new THREE.Vector3(1.0 * tScale, 1.0 * tScale, 1.0 * tScale));
            foliageMatrices.push(matrixFoliage);
          }
        }
      }

      const imDirt = new THREE.InstancedMesh(UNIT_BOX, UNIT_DIRT_MAT, dirtMatrices.length);
      dirtMatrices.forEach((m, i) => imDirt.setMatrixAt(i, m));
      staticGroup.add(imDirt);

      const imGrass = new THREE.InstancedMesh(UNIT_BOX, UNIT_GRASS_MAT, grassMatrices.length);
      grassMatrices.forEach((m, i) => imGrass.setMatrixAt(i, m));
      staticGroup.add(imGrass);

      const imTrunk = new THREE.InstancedMesh(UNIT_BOX, UNIT_TRUNK_MAT, trunkMatrices.length);
      trunkMatrices.forEach((m, i) => imTrunk.setMatrixAt(i, m));
      staticGroup.add(imTrunk);

      const imFoliage = new THREE.InstancedMesh(UNIT_BOX, UNIT_LEAF_MAT, foliageMatrices.length);
      foliageMatrices.forEach((m, i) => imFoliage.setMatrixAt(i, m));
      staticGroup.add(imFoliage);

    } else {
      // Non-Blocky mode: Original loop (simplified)
      for (let i = 1; i <= boardSize; i++) {
        const coords = getTileCoords(i);
        
        // Jungle Stone Biomes
        let stoneColor = 0x444444; 
        const stoneMix = [0x444444, 0x555555, 0x2d4c1e, 0x3a5f0b, 0x3d3d3d, 0x1a2a1a];
        stoneColor = stoneMix[(i + Math.floor(i/7)) % stoneMix.length];
        
        const stoneScale = 0.8 + Math.random() * 0.4;
        const tile = createStoneTile(stoneScale, stoneColor, theme);
        tile.position.set(coords.x, coords.y - 0.2, coords.z);
        staticGroup.add(tile);
      
        const density = 0.4; 
        if (Math.random() > density) {
          const treeCount = Math.floor(Math.random() * 3) + 1;
          for(let j = 0; j < treeCount; j++) {
            const treeScale = (0.6 + Math.random() * 0.7) * 1.5 * 0.64; 
            const tree = createTree(treeScale, theme);
            const side = Math.random() > 0.5 ? 1 : -1;
            const dist = 3.5 + Math.random() * 3.5;
            tree.position.set(coords.x + side * dist, coords.y - 0.2, coords.z + (Math.random()-0.5)*3);
            tree.rotation.y = Math.random() * Math.PI;
            staticGroup.add(tree);
          }
        }
      }
    }

    const lastCoords = getTileCoords(boardSize);
    const fort = createFort(theme);
    fort.position.set(lastCoords.x, lastCoords.y - 0.1, lastCoords.z);
    staticGroup.add(fort);

    activeTransports.forEach((t, index) => {
      const isBroken = disabledTransports.includes(index);
      const start = getTileCoords(t.start);
      const end = getTileCoords(t.end);
      if (!start || !end) return;
      
      const dist = Math.sqrt((start.x - end.x)**2 + (start.z - end.z)**2);
      const height = dist * 0.4;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(start.x, 0.25, start.z),
        new THREE.Vector3((start.x + end.x) / 2, height, (start.z + end.z) / 2),
        new THREE.Vector3(end.x, 0.25, end.z)
      );
      
      const points = curve.getPoints(30);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      let tColor = 0x00FF00; // Green
      if (t.type === 'FLIGHT') tColor = 0x0000FF; // Blue
      else if (t.type === 'TRAIN') tColor = 0xFFFF00; // Yellow
      else if (t.type === 'BIKE') tColor = 0x00FF00; // Green
      else if (t.type === 'CAR') tColor = 0xFFFF00; // Yellow (or another choice from the set)

      const material = new THREE.LineDashedMaterial({ 
        color: isBroken ? 0x444444 : (theme === ThemeType.BLOCKY ? 0x64F2F2 : tColor),
        transparent: true,
        opacity: theme === ThemeType.BLOCKY ? 0.3 : 0.1,
        dashSize: 0.2,
        gapSize: 0.1
      });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      staticGroup.add(line);

      const transportObj = new THREE.Group();
      let emoji = '🚗';
      if (t.type === 'FLIGHT') emoji = '✈️';
      else if (t.type === 'TRAIN') emoji = '🚂';
      else if (t.type === 'BIKE') emoji = '🛵';
      else if (t.type === 'CAR') emoji = '🚗';
      
      const sprite = createEmojiSprite(emoji, 1.3) as THREE.Sprite;
      if (isBroken) (sprite.material as THREE.SpriteMaterial).color.set(0x444444);
      transportObj.add(sprite);

      if (theme === ThemeType.BLOCKY) {
        const glow = new THREE.PointLight(isBroken ? 0x444444 : tColor, 0.5, 2);
        glow.position.set(0, 0.5, 0);
        transportObj.add(glow);
      }

      if (isBroken) {
        const xGeo = new THREE.BoxGeometry(0.05, 0.4, 0.05);
        const xMat = new THREE.MeshPhongMaterial({ color: 0xFF2D78 });
        const x1 = new THREE.Mesh(xGeo, xMat);
        x1.rotation.z = Math.PI / 4;
        x1.position.y = 0.2;
        const x2 = new THREE.Mesh(xGeo, xMat);
        x2.rotation.z = -Math.PI / 4;
        x2.position.y = 0.2;
        transportObj.add(x1, x2);
      }

      transportObj.position.set(start.x, start.y + 0.2, start.z);
      staticGroup.add(transportObj);
    });

    predators.forEach(p => {
      const start = getTileCoords(p.start);
      const end = getTileCoords(p.end);
      if (!start || !end) return;
      
      const dist = Math.sqrt((start.x - end.x)**2 + (start.z - end.z)**2);
      const height = dist * 0.5;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(start.x, 0.25, start.z),
        new THREE.Vector3((start.x + end.x) / 2, height, (start.z + end.z) / 2),
        new THREE.Vector3(end.x, 0.25, end.z)
      );
      
      const points = curve.getPoints(30);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({ 
        color: theme === ThemeType.BLOCKY ? 0xFF0000 : 0x990000, 
        transparent: true, 
        opacity: theme === ThemeType.BLOCKY ? 0.3 : 0.1,
        dashSize: 0.2,
        gapSize: 0.1
      });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      staticGroup.add(line);
 
      let predObj;
      const baseScale = 1.62; // Increased by 20%
      const isVoid = theme === ThemeType.VOID;
      
      if (p.type === 'SNAKE') {
        predObj = createEmojiSprite('🐍', baseScale);
      } else if (p.type === 'RHINO') {
        predObj = createEmojiSprite(isVoid ? '🐘' : '🦏', baseScale);
      } else if (p.type === 'DINO') {
        predObj = createEmojiSprite('🦖', baseScale);
      } else if (p.type === 'BEAR') {
        predObj = createEmojiSprite(isVoid ? '🐯' : '🐻', baseScale);
      } else {
        predObj = createEmojiSprite('👾', baseScale);
      }

      if (theme === ThemeType.BLOCKY) {
        const glow = new THREE.PointLight(0xFF00FF, 0.5, 3);
        glow.position.set(0, 0.5, 0);
        predObj.add(glow);
      }

      predObj.position.set(start.x, start.y + 0.5, start.z);
      predObj.name = `predator_${p.start}`;
      
      // Predator floating/sway animation
      gsap.to(predObj.position, {
        y: "+=0.3",
        duration: 1.5 + Math.random(),
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      });
      gsap.to(predObj.rotation, {
        z: 0.1,
        duration: 2,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      });

      staticGroup.add(predObj);
    });

    // Gather all objects for animation buckets to optimize render loop
    staticGroup.traverse((child) => {
      if ((child as any).userData?.pulsate && (child as any).material?.emissiveIntensity !== undefined) {
        pulsatingObjectsRef.current.push(child as THREE.Mesh);
      }
      if ((child as any).material?.type === 'LineDashedMaterial') {
        animatingLinesRef.current.push(child as THREE.Line);
      }
      if (child.name === "victory_flag") {
        animatingFlagsRef.current.push(child as any);
      }
      if (child.userData?.type === 'COIN') {
        animatingCoinsRef.current.push(child as any);
      }
    });

  }, [isSceneReady, theme, disabledTransports, predators, activeTransports, getTileCoords]);

  useEffect(() => {
    if (!isSceneReady || !playersRef.current) return;
    playersRef.current.clear();
    players.forEach(p => {
      const isBlocky = theme === ThemeType.BLOCKY;
      const isVoid = theme === ThemeType.VOID;
      const group = new THREE.Group();
      
      const body = new THREE.Mesh(
        isBlocky ? new THREE.BoxGeometry(0.5, 0.6, 0.3) : new THREE.CylinderGeometry(0.26, 0.26, 0.52, 16),
        new THREE.MeshPhongMaterial({ color: p.color, emissive: p.color, emissiveIntensity: isBlocky ? 0.2 : 0.4 })
      );
      body.position.y = isBlocky ? 0.3 : 0.26;
      
      const headsSize = 0.4;
      const head = new THREE.Mesh(
        isBlocky ? new THREE.BoxGeometry( headsSize, headsSize, headsSize) : new THREE.SphereGeometry(0.234, 16, 16),
        new THREE.MeshPhongMaterial({ color: p.color })
      );
      head.position.y = isBlocky ? 0.8 : 0.715;

      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(isBlocky ? 0.3 : 0.26, 0.065, 0.13),
        new THREE.MeshPhongMaterial({ color: 0x000000 })
      );
      visor.position.set(0, isBlocky ? 0.8 : 0.715, isBlocky ? 0.2 : 0.156);
      
      group.add(body, head, visor);

      if (isVoid) {
        // Add a glowing base ring for void theme
        const ringGeo = new THREE.TorusGeometry(0.5, 0.05, 8, 32);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: p.color, emissiveIntensity: 3 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.05;
        ring.userData.pulsate = true;
        pulsatingObjectsRef.current.push(ring);
        group.add(ring);

        // Light for the player in dark themes
        const pLight = new THREE.PointLight(p.color, 1, 5);
        pLight.position.y = 1;
        group.add(pLight);
      }

      if (p.cagedTurns > 0) {
        const cageGeo = new THREE.SphereGeometry(0.5, 16, 16);
        const cageMat = new THREE.MeshPhongMaterial({ 
          color: 0x00F5FF, 
          transparent: true, 
          opacity: 0.3,
          wireframe: true 
        });
        const cage = new THREE.Mesh(cageGeo, cageMat);
        cage.position.y = 0.35;
        group.add(cage);
      }

      const coords = getTileCoords(p.position);
      group.position.set(coords.x, coords.y, coords.z);
      playersRef.current?.add(group);
    });
  }, [players, isSceneReady, theme]);

  useEffect(() => {
    if (!isSceneReady || !treasureRef.current) return;
    treasureRef.current.clear();

    treasureMap.forEach((type, t) => {
      const coords = getTileCoords(t);
      const icon = type === 'COIN' ? '🪙' : ITEMS[type].icon;
      const name = type === 'COIN' ? 'COINS' : ITEMS[type].name;
      
      const group = new THREE.Group();
      const itemSprite = createEmojiSprite(icon, 0.8);
      itemSprite.position.y = 0.5;
      group.add(itemSprite);

      // Label for the item
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText(name, 128, 40);
      
      const labelTex = new THREE.CanvasTexture(canvas);
      const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
      const labelSprite = new THREE.Sprite(labelMat);
      labelSprite.scale.set(1.5, 0.375, 1);
      labelSprite.position.y = 1.2; // Move to top
      group.add(labelSprite);

      group.position.set(coords.x, coords.y + 0.1, coords.z);
      group.name = `treasure_${t}`;
      
      // Subtle float animation
      gsap.to(itemSprite.position, {
        y: 0.7,
        duration: 2,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      });

      treasureRef.current?.add(group);
    });
  }, [isSceneReady, treasureMap, theme]);

  useEffect(() => {
    if (!isSceneReady || !trapsRef.current) return;
    trapsRef.current.clear();
      tntTiles.forEach(t => {
      let trap;
      if (theme === ThemeType.BLOCKY) {
        // Red voxel TNT
        trap = new THREE.Group();
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.8, 0.8),
            new THREE.MeshPhongMaterial({ color: 0xCC0000, flatShading: true })
        );
        trap.add(box);
        const white = new THREE.Mesh(
            new THREE.BoxGeometry(0.82, 0.2, 0.82),
            new THREE.MeshPhongMaterial({ color: 0xFFFFFF, flatShading: true })
        );
        trap.add(white);
      } else {
        trap = createCrater();
      }
      const coords = getTileCoords(t);
      trap.position.set(coords.x, coords.y - 0.1, coords.z);
      trapsRef.current?.add(trap);
    });
  }, [isSceneReady, tntTiles, theme]);

  useEffect(() => {
    if (isStoreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Ensure gameState is IDLE when closing store to prevent stuck states
      // Only do this if we are not in SETUP or WON phases
      if (gameState !== 'MOVING' && gameState !== 'ROLLING' && gameState !== 'SETUP' && gameState !== 'WON') {
        setGameState('IDLE');
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isStoreOpen, gameState]);

  const updatePlayer = useCallback((idx: number, data: Partial<Player>) => {
    setPlayers(prev => {
      if (idx < 0 || idx >= prev.length) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...data };
      
      // Multiplayer Sync: Push our updates to Firestore
      const p = next[idx];
      if (isMultiplayer && matchId && p.userId === user?.uid) {
        const participantRef = doc(db, 'matches', matchId, 'participants', user.uid);
        updateDoc(participantRef, {
          position: p.position ?? 0,
          coins: p.coins ?? 100,
          inventory: p.inventory ?? [],
          isReady: true
        }).catch(err => console.error("Sync error:", err));
      }

      return next;
    });
  }, [isMultiplayer, matchId, user]);

  const nextTurn = useCallback(() => {
    if (players.length === 0) return;
    
    setPlayers(current => current.map((p, idx) => 
      idx === currentPlayerIndex ? { ...p, turns: p.turns + 1 } : p
    ));

    const nextIdx = (currentPlayerIndex + 1) % players.length;

    if (isMultiplayer && matchId) {
      // Only host or current player advances turn to avoid race conditions
      if (participants[currentPlayerIndex]?.userId === user?.uid || isHost) {
        updateDoc(doc(db, 'matches', matchId), { currentTurn: nextIdx });
      }
    }

    setGameState('IDLE');
    setRollResult(null);
    setCurrentPlayerIndex(nextIdx);
  }, [players, currentPlayerIndex, isMultiplayer, matchId, participants, user, isHost]);

  const checkTileEffect = useCallback((pIdx: number, tile: number, skipSecondary: boolean = false) => {
    const p = players[pIdx];
    if (!p) return;
    if (tntTiles.includes(tile)) {
      showToast("BOMBED! SKIP TURN", "#FF0000");
      const coords = getTileCoords(tile);
      triggerVFX('explosion', coords, 0xFF4500);
      SoundEngine.play('explosion');
      setTntTiles(prev => prev.filter(t => t !== tile));
      updatePlayer(pIdx, { cagedTurns: 1 });
      addMessage(`${p.name} stepped on a TNT trap at tile ${tile}! Skipping 1 turn.`);
      nextTurn();
      return;
    }
    const transport = activeTransports.find(t => t.start === tile);
    const brokenIdx = activeTransports.findIndex(t => t.start === tile);
    if (transport && !disabledTransports.includes(brokenIdx) && !skipSecondary) {
      showToast(transport.label, "#00F5FF");
      SoundEngine.play('action');
      const coords = getTileCoords(tile);
      triggerVFX('spark', coords, 0x00F5FF);
      addMessage(`${p.name} used ${transport.label}! Jumping from tile ${tile} to ${transport.end}!`);
      animateDirectJump(pIdx, transport.end, false);
      return;
    }
    const predator = predators.find(pred => pred.start === tile);
    if (predator && !skipSecondary) {
      const coords = getTileCoords(tile);
      if (p.inventory.includes('ANTI_VENOM')) {
        showToast("ANTI-VENOM USED!", "#39FF14");
        triggerVFX('shield', coords, 0x39FF14);
        updatePlayer(pIdx, { inventory: p.inventory.filter(i => i !== 'ANTI_VENOM') });
        addMessage(`${p.name} repelled ${predator.label} at tile ${tile} using Anti-Venom!`);
        nextTurn();
      } else {
        showToast(predator.label, "#FF2D78");
        SoundEngine.play('fail');
        triggerVFX('explosion', coords, 0xFF2D78);
        const backSteps = tile - predator.end;
        addMessage(`${p.name} was caught by ${predator.label} at tile ${tile}! Moved back ${backSteps} steps to tile ${predator.end}.`);
        animateDirectJump(pIdx, predator.end, true);
      }
      return;
    }
    if (treasureMap.has(tile) && !skipSecondary) {
      const item = treasureMap.get(tile)!;
      const coords = getTileCoords(tile);
      
      // Animate Item Collection
      const itemObj = treasureRef.current?.getObjectByName(`treasure_${tile}`);
      if (itemObj) {
        gsap.to(itemObj.scale, { x: 2, y: 2, z: 2, duration: 0.5 });
        gsap.to(itemObj.position, { y: "+=2", opacity: 0, duration: 0.8, ease: "power2.out" });
        triggerVFX('collect', coords, 0xFFD700);
      }

      setTimeout(() => {
        // Handling special items/traps/buffs
        if (item === 'COIN') {
          let amount = Math.floor(Math.random() * 20) + 10;
          if (p.multiplier) {
            amount *= 2;
            showToast(`MULTIPLIER! ${amount} COINS!`, "#FFE600");
            updatePlayer(pIdx, { multiplier: false });
          } else {
            showToast(`COLLECTED: ${amount} COINS!`, "#FFE600");
          }
          SoundEngine.play('collect');
          updatePlayer(pIdx, { coins: p.coins + amount });
          addMessage(`${p.name} collected ${amount} coins on tile ${tile}.`);
        } else if (item === 'ACID') {
          showToast("ACID POOL: -30 COINS!", "#32CD32");
          triggerVFX('explosion', coords, 0x32CD32);
          SoundEngine.play('fail');
          updatePlayer(pIdx, { coins: Math.max(0, p.coins - 30) });
          addMessage(`${p.name} hit an Acid Pool on tile ${tile}. Lost 30 coins!`);
        } else if (item === 'QUICKSAND') {
          showToast("QUICKSAND: SLOWED DOWN!", "#F4A460");
          triggerVFX('spark', coords, 0xF4A460);
          SoundEngine.play('fail');
          updatePlayer(pIdx, { sluggish: true });
          addMessage(`${p.name} got stuck in Quicksand on tile ${tile}! Movement is now sluggish.`);
        } else if (item === 'BOOST') {
          showToast("SPEED BOOST ACTIVATED!", "#FFD700");
          triggerVFX('collect', coords, 0xFFD700);
          SoundEngine.play('collect');
          updatePlayer(pIdx, { speedBoost: true });
          addMessage(`${p.name} found a Speed Boost on tile ${tile}!`);
        } else if (item === 'MULTIPLIER') {
          showToast("COIN MULTIPLIER ACTIVE!", "#00F5FF");
          triggerVFX('collect', coords, 0x00F5FF);
          SoundEngine.play('collect');
          updatePlayer(pIdx, { multiplier: true });
          addMessage(`${p.name} activated a Coin Multiplier on tile ${tile}!`);
        } else if (item === 'REVERSE') {
          showToast("REVERSE CURSE!", "#BF5FFF");
          triggerVFX('spark', coords, 0xBF5FFF);
          SoundEngine.play('fail');
          updatePlayer(pIdx, { reversed: true });
          addMessage(`${p.name} was afflicted with a Reverse Curse on tile ${tile}!`);
        } else if (item === 'REDUCED') {
          showToast("REDUCED MOVEMENT!", "#FF2D78");
          triggerVFX('spark', coords, 0xFF2D78);
          SoundEngine.play('fail');
          updatePlayer(pIdx, { sluggish: true });
          addMessage(`${p.name}'s movement was reduced on tile ${tile}.`);
        } else {
          const itemName = ITEMS[item].name;
          showToast(`FOUND: ${itemName}!`, "#FFD700");
          triggerVFX('collect', coords, 0xFFD700);
          if (item === 'ROCKET') {
            SoundEngine.play('rocket');
          } else {
            SoundEngine.play('collect');
          }
          const newInv = [...p.inventory, item].slice(0, 4);
          updatePlayer(pIdx, { inventory: newInv });
          addMessage(`${p.name} found a ${itemName} on tile ${tile}.`);
        }

        setTreasureMap(prev => {
          const next = new Map(prev);
          next.delete(tile);
          return next;
        });
        setLastCollectedTile(tile);
        
        // Wait another moment for toast
        setTimeout(() => {
          updatePlayer(pIdx, { position: tile });
          nextTurn();
        }, 600);
      }, 600);
      return;
    }
    if (tile === boardSize) {
      setGameState('WON');
      SoundEngine.play('win');
      addMessage(`CONGRATULATIONS! ${p.name} reached tile ${boardSize} and WON the mission!`);
      
      // Save to leaderboard
      saveScore({
        playerName: p.name,
        level: currentLevelID,
        turns: p.turns + 1,
        coins: p.coins
      });

      const coords = getTileCoords(boardSize);
      for(let i=0; i<5; i++) {
        setTimeout(() => {
          triggerVFX('explosion', { x: coords.x + (Math.random()-0.5)*5, y: 5 + Math.random()*5, z: coords.z + (Math.random()-0.5)*5 }, Math.random() * 0xffffff);
        }, i * 500);
      }
      return;
    }
    updatePlayer(pIdx, { position: tile });
    // Add a small delay for natural transition
    setTimeout(() => {
      nextTurn();
    }, 400);
  }, [players, tntTiles, disabledTransports, treasureMap, updatePlayer, nextTurn, addMessage]);

  const animateDirectJump = useCallback((pIdx: number, targetPos: number, isPenalty: boolean = false) => {
    const coords = getTileCoords(targetPos);
    const token = playersRef.current?.children[pIdx] as THREE.Group;
    
    // Recovery: ensure gameState is updated even if token is missing
    setGameState('MOVING');

    if (token) {
      if (lastCollectedTile !== null && lastCollectedTile !== targetPos) {
        setTreasureMap(prev => {
          if (prev.has(lastCollectedTile)) return prev;
          const next = new Map(prev);
          const isCoin = Math.random() > 0.4;
          if (isCoin) { next.set(lastCollectedTile, 'COIN'); }
          else {
            const itemKeys = Object.keys(ITEMS).filter(k => k !== 'COIN') as ItemType[];
            next.set(lastCollectedTile, itemKeys[Math.floor(Math.random() * itemKeys.length)]);
          }
          return next;
        });
        setLastCollectedTile(null);
      }

      gsap.to(token.position, {
        x: coords.x,
        z: coords.z,
        duration: 0.8,
        ease: "power2.inOut",
        onComplete: () => {
          updatePlayer(pIdx, { position: targetPos });
          triggerVFX('spark', coords, isPenalty ? 0xFF2D78 : 0x00F5FF);
          checkTileEffect(pIdx, targetPos, isPenalty);
        }
      });
      gsap.to(token.position, {
        y: coords.y + 1.5,
        duration: 0.4,
        yoyo: true,
        repeat: 1,
        ease: "power1.out"
      });
    } else {
      // Safety: fallback if 3D token is mismatched or missing
      updatePlayer(pIdx, { position: targetPos });
      checkTileEffect(pIdx, targetPos, isPenalty);
    }
  }, [checkTileEffect, updatePlayer, lastCollectedTile]);

  const animatePathHopping = useCallback((pIdx: number, path: number[]) => {
    let stepIndex = 0;
    const moveNext = () => {
      if (stepIndex >= path.length) {
        const finalPos = path[path.length - 1];
        checkTileEffect(pIdx, finalPos);
        return;
      }

      const targetPos = path[stepIndex];
      const coords = getTileCoords(targetPos);
      const token = playersRef.current?.children[pIdx] as THREE.Group;
      
      SoundEngine.play('roll');
      
      if (token) {
        gsap.to(token.position, { x: coords.x, z: coords.z, duration: 0.2, ease: "none" });
        gsap.to(token.position, { 
          y: coords.y + 0.5, 
          duration: 0.1, 
          yoyo: true, 
          repeat: 1, 
          ease: "power1.out"
        });
      }
      
      stepIndex++;
      setTimeout(moveNext, 200);
    };
    moveNext();
  }, [checkTileEffect]);

  const movePlayer = useCallback((pIdx: number, steps: number) => {
    const p = players[pIdx];
    if (!p) return;
    
    let actualSteps = steps;
    if (p.speedBoost) actualSteps += 2;
    if (p.sluggish) actualSteps = Math.ceil(actualSteps / 2);
    if (p.reversed) actualSteps = -actualSteps;

    const path: number[] = [];
    let currentPosTemp = p.position;
    const absSteps = Math.abs(actualSteps);
    const direction = actualSteps >= 0 ? 1 : -1;

    for (let i = 1; i <= absSteps; i++) {
      let step = currentPosTemp + direction;
      // Bounce back logic
      if (step > boardSize) {
        step = boardSize - (step - boardSize);
      }
      if (step < 1) step = 1;
      path.push(step);
      currentPosTemp = step;
    }

    // Reset modifiers
    updatePlayer(pIdx, { 
      speedBoost: false, 
      sluggish: false, 
      reversed: false 
    });

    if (path.length > 0) {
      animatePathHopping(pIdx, path);
    } else {
      // No movement (e.g. sluggish 1/2 = 0.5 -> 1 step but if somehow 0)
      nextTurn();
    }
  }, [players, boardSize, updatePlayer, nextTurn]);

  const rollDice = useCallback(() => {
    if (gameState !== 'IDLE' || players.length === 0) return;

    if (isMultiplayer && matchId) {
      if (participants[currentPlayerIndex]?.userId !== user?.uid) {
        showToast("WAIT FOR YOUR TURN", "#FF4500");
        return;
      }
    }
    
    const currentP = players[currentPlayerIndex];
    if (currentP.cagedTurns > 0) {
      showToast(`${currentP.name} is CAGED! Skipping turn.`, uiColors.primary);
      updatePlayer(currentPlayerIndex, { cagedTurns: currentP.cagedTurns - 1 });
      setTimeout(() => nextTurn(), 1000);
      return;
    }
    
    setGameState('ROLLING');
    SoundEngine.play('roll');
    const result = Math.floor(Math.random() * 6) + 1;
    setRollResult(result);

    if (isMultiplayer && matchId) {
      updateDoc(doc(db, 'matches', matchId), { lastRoll: result });
    }
    
    const p = players[currentPlayerIndex];
    let displayResult = result;
    if (p.speedBoost) displayResult += 2;
    if (p.sluggish) displayResult = Math.ceil(displayResult / 2);

    if (diceRef.current) {
      addMessage(`${p.name} is rolling...`);
      
      triggerPulse(diceRef.current, 0xffffff);
      
      // Dice animation - simplified and shortened
      diceRef.current.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      
      // Impact flash
      triggerVFX('explosion', diceRef.current.position, 0xffffff);
      SoundEngine.play('action');
          
      setTimeout(() => {
        setGameState('MOVING');
        const directionMsg = p.reversed ? " (Reversed!)" : "";
        const targetTile = Math.max(1, Math.min(boardSize, p.position + displayResult * (p.reversed ? -1 : 1)));
        addMessage(`${p.name} moves ${displayResult} steps to tile ${targetTile}!${directionMsg}`);
        movePlayer(currentPlayerIndex, result);
      }, 200);
    } else {
      setTimeout(() => {
        setGameState('MOVING');
        movePlayer(currentPlayerIndex, result);
      }, 300);
    }
  }, [gameState, currentPlayerIndex, players, movePlayer, nextTurn, updatePlayer, uiColors]);

  const [isAutoPlay, setIsAutoPlay] = useState(false);

  // Dynamic Music Intensity
  useEffect(() => {
    if (gameState === 'WON') {
      SoundEngine.setIntensity('calm');
      return;
    }
    
    if (gameState === 'SETUP') {
       SoundEngine.setIntensity('calm');
       return;
    }

    const currentP = players[currentPlayerIndex];
    if (!currentP) return;

    // Intense music if near predator, rolling, or moving
    const isNearPredator = predators.some(pred => {
      const dist = Math.abs(pred.start - currentP.position);
      return dist <= 3;
    });

    if (isNearPredator || gameState === 'ROLLING' || gameState === 'MOVING') {
      SoundEngine.setIntensity('intense');
    } else {
      SoundEngine.setIntensity('calm');
    }
  }, [gameState, currentPlayerIndex, players]);

  useEffect(() => {
    const isBotTurn = players[currentPlayerIndex]?.isBot;
    if ((isAutoPlay || (isBotTurn && gameState === 'IDLE')) && !isStoreOpen) {
      const timer = setTimeout(() => {
        if (players[currentPlayerIndex]?.cagedTurns > 0) {
          nextTurn();
        } else {
          rollDice();
        }
      }, isBotTurn ? 1000 : 1500);
      return () => clearTimeout(timer);
    }
  }, [isAutoPlay, gameState, currentPlayerIndex, players, isStoreOpen, rollDice, nextTurn]);

  const useItem = useCallback((type: ItemType, targetId?: number) => {
    if (isSpectating) return;
    const p = players[currentPlayerIndex];
    if (!p || !p.inventory.includes(type)) return;

    // Weapon check for manual targeting
    const isWeapon = ['TANK', 'ARROW', 'ROCKET', 'CAGE'].includes(type);
    if (isWeapon && targetId === undefined) {
      setTargetingItem(type);
      return;
    }
    
    SoundEngine.play('action');

    const executeUsage = (targetPlayer?: Player) => {
      if (type === 'TANK') {
        if (targetPlayer) {
          triggerProjectile('TANK', p.position, targetPlayer.position, () => {
            showToast(`AFV HIT! ${targetPlayer.name} MOVED BACK 10 TILES`, "#FFE600");
            const newPos = Math.max(1, targetPlayer.position - 10);
            addMessage(`${p.name} deployed an AFV against ${targetPlayer.name}! ${targetPlayer.name} moved back 10 steps to tile ${newPos}!`);
            triggerDizzyEffect(targetPlayer.id, 2000);
            setTimeout(() => {
               animateDirectJump(targetPlayer.id, newPos, true);
            }, 500);
          });
        }
      } else if (type === 'TNT') {
        setTntTiles(prev => [...prev, p.position]);
        showToast("TRAP PRIMED", "#FFD700");
        addMessage(`${p.name} planted a TNT trap on tile ${p.position}.`);
        triggerVFX('explosion', getTileCoords(p.position), 0xFFD700);
      } else if (type === 'ARROW' || type === 'ROCKET') {
        if (targetPlayer) {
          const back = type === 'ARROW' ? 3 : 5;
          triggerProjectile(type, p.position, targetPlayer.position, () => {
            const newPos = Math.max(1, targetPlayer.position - back);
            showToast(`${type} HIT! ${targetPlayer.name} MOVED BACK ${back} TILES`, "#FF2D78");
            addMessage(`${p.name} fired a ${type} at ${targetPlayer.name}! ${targetPlayer.name} moved back ${back} steps to tile ${newPos}!`);
            animateDirectJump(targetPlayer.id, newPos, true);
          });
        }
      } else if (type === 'CAGE') {
        if (targetPlayer) {
          triggerVFX('cage', getTileCoords(targetPlayer.position), 0x00F5FF);
          updatePlayer(targetPlayer.id, { cagedTurns: 2 });
          showToast(`${targetPlayer.name} CAGED!`, "#00F5FF");
          addMessage(`${p.name} locked ${targetPlayer.name} in a stasis cage for 2 turns!`);
        }
      } else if (type === 'ANTI_VENOM') {
        // Anti-venom usage logic if player was poisoned (not fully implemented in state but added here for completeness)
        addMessage(`${p.name} used Anti-Venom.`);
      }
      
      const inv = [...p.inventory];
      const idx = inv.indexOf(type);
      if (idx > -1) inv.splice(idx, 1);
      updatePlayer(currentPlayerIndex, { inventory: inv });
      setTargetingItem(null);
    };

    if (isWeapon && targetId !== undefined) {
      const target = players.find(pl => pl.id === targetId);
      if (target) executeUsage(target);
    } else {
      executeUsage();
    }
  }, [currentPlayerIndex, players, updatePlayer, animateDirectJump, triggerProjectile, triggerVFX, triggerDizzyEffect, isSpectating, getTileCoords]);
  
  const buyItem = useCallback((type: ItemType) => {
    const item = ITEMS[type];
    const p = players[currentPlayerIndex];
    if (!p) return;
    if (p.coins >= item.price && p.inventory.length < 5) {
      updatePlayer(currentPlayerIndex, { 
        coins: p.coins - item.price,
        inventory: [...p.inventory, type]
      });
      SoundEngine.play('collect');
      showToast(`${item.name} PURCHASED!`, "#BF5FFF");
    } else {
      SoundEngine.play('fail');
    }
  }, [currentPlayerIndex, players, updatePlayer]);

  const buyDiceSkin = useCallback((type: DiceSkinType) => {
    const skin = DICE_SKINS[type];
    const p = players[currentPlayerIndex];
    if (!p) {
      if (unlockedDiceSkins.includes(type)) {
        setSelectedDiceSkin(type);
        showToast(`${skin.name} EQUIPPED`, "#39FF14");
      }
      return;
    }

    if (unlockedDiceSkins.includes(type)) {
      setSelectedDiceSkin(type);
      showToast(`${skin.name} EQUIPPED`, "#39FF14");
    } else if (p.coins >= skin.price) {
      updatePlayer(currentPlayerIndex, { coins: p.coins - skin.price });
      setUnlockedDiceSkins(prev => [...prev, type]);
      setSelectedDiceSkin(type);
      SoundEngine.play('collect');
      showToast(`${skin.name} DICE UNLOCKED!`, "#FFD700");
    } else {
      SoundEngine.play('fail');
    }
  }, [currentPlayerIndex, players, unlockedDiceSkins, updatePlayer]);


  useEffect(() => {
    if (currentP.coins !== undefined) {
      gsap.fromTo("#wallet-value", 
        { scale: 1.3, color: "#fff" }, 
        { scale: 1, color: "#FFE600", duration: 0.4, ease: "back.out" }
      );
    }
  }, [currentP.coins]);

  return (
    <div id="blocky-app-root" className={`relative w-full h-screen overflow-hidden font-sans text-white select-none transition-colors duration-1000 ${theme === ThemeType.BLOCKY ? 'bg-[#795548]' : 'bg-[#051a05]'}`}>
      {/* Spectator Dashboard */}
      {isSpectating && gameState !== 'SETUP' && (
        <div id="spectator-ui" className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-4">
          <div className="bg-[#111827]/90 backdrop-blur-md border border-[#5D9948]/30 rounded-2xl p-4 flex items-center gap-6 shadow-2xl">
            <div className="flex items-center gap-2 pr-4 border-r border-white/10">
              <span className="text-[10px] font-black uppercase text-[#5D9948] tracking-widest">Auto</span>
              <button 
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                className={`w-10 h-5 rounded-full relative transition-all ${isAutoPlay ? 'bg-[#5D9948]' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isAutoPlay ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-[#5D9948] tracking-widest">Angle</span>
              <div className="flex bg-black/40 p-1 rounded-lg">
                {(['FREE', 'TOP', 'ISO', 'FOLLOW'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setCameraMode(mode)}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${cameraMode === mode ? 'bg-[#5D9948] text-black shadow-[0_0_10px_rgba(93,153,72,0.4)]' : 'text-white/40 hover:text-white'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {cameraMode === 'FOLLOW' && (
              <div className="flex items-center gap-2 border-l border-white/10 pl-6">
                <span className="text-[10px] font-black uppercase text-[#5D9948] tracking-widest">Target</span>
                <div className="flex gap-2">
                  {players.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => setFollowedPlayerIndex(idx)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${followedPlayerIndex === idx ? 'scale-110 shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'opacity-40 grayscale'}`}
                      style={{ backgroundColor: p.color, borderColor: followedPlayerIndex === idx ? '#fff' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            )}
            
            <button 
              onClick={() => { setIsSpectating(false); window.location.reload(); }}
              className="ml-4 px-4 py-1.5 bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] font-black uppercase rounded-lg hover:bg-red-500 hover:text-white transition-all"
            >
              Exit
            </button>
          </div>
          <div className="px-4 py-1 bg-[#5D9948] text-black text-[9px] font-black uppercase tracking-[0.3em] rounded-full animate-pulse">Spectator Perspective Active</div>
        </div>
      )}

      {gameState === 'SETUP' && (
        <div id="setup-overlay" className="fixed inset-0 z-[110] flex items-start justify-center bg-[#0a0a0c]/80 backdrop-blur-md p-4 sm:p-8 overflow-y-auto">
          <div className="absolute inset-0 opacity-10 pointer-events-none fixed">
             <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5D9948] rounded-full blur-[150px]"></div>
             <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#866043] rounded-full blur-[150px]"></div>
          </div>
          <div id="setup-modal" className="w-full max-w-lg bg-[#111827] border border-[#5D9948]/30 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6 relative z-10 scale-in my-auto">
            <div className="text-center">
              <div className="flex justify-between items-center mb-2">
                <button 
                  onClick={() => setIsAboutOpen(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#5D9948] hover:bg-[#5D9948] hover:text-black transition-all shadow-xl"
                  title="About Game"
                >
                  <Compass size={20} />
                </button>
                <h2 className="text-3xl font-black italic uppercase text-[#5D9948] tracking-tighter">RetroX Odyssey</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsTutorialOpen(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#5D9948] hover:bg-[#5D9948] hover:text-black transition-all shadow-xl"
                    title="Tutorial"
                  >
                    <Settings size={20} />
                  </button>
                  <button 
                    onClick={() => setIsLeaderboardOpen(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#5D9948] hover:bg-[#5D9948] hover:text-black transition-all shadow-xl"
                    title="Hall of Fame"
                  >
                    <Trophy size={20} />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-white/50 uppercase tracking-[0.3em]">Dice ignite sparks, beasts strike back, and every roll rewrites destiny.</p>
            </div>

            <div className="space-y-6">
              {/* Online & Account Section */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user ? (
                    <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-[#5D9948]" />
                  ) : (
                    <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                      <UserIcon size={20} className="text-white/40" />
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Logged in as</p>
                    <p className="text-sm font-bold">{user?.displayName || 'Guest User'}</p>
                  </div>
                </div>
                {user ? (
                  <button onClick={handleLogout} className="p-2 text-white/40 hover:text-red-400 transition-colors">
                    <LogOut size={18} />
                  </button>
                ) : (
                  <button 
                    onClick={handleLogin}
                    className="px-4 py-2 bg-white text-black text-xs font-black uppercase italic rounded-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    Sign In
                  </button>
                )}
              </div>

              {/* Multiplayer Controls */}
              {!isMultiplayer ? (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={hostMatch}
                    disabled={loadingMatch}
                    className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl hover:bg-emerald-500/20 transition-all group"
                  >
                    <Share2 className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-[10px] font-black uppercase text-emerald-400">Host Online</span>
                  </button>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      placeholder="JOIN CODE"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center font-black uppercase tracking-widest text-sm focus:border-cyan-500/50 outline-none text-white"
                    />
                    <button 
                      onClick={() => joinMatch(joinCodeInput)}
                      disabled={loadingMatch || !joinCodeInput}
                      className="flex-1 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-[10px] font-black uppercase text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                    >
                      Join Match
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Connected Match</p>
                      <p className="text-2xl font-black italic tracking-widest text-white">{matchId}</p>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={handleShare}
                        className={`p-2 rounded-xl border transition-all ${copied ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-white/5 border-white/10 text-emerald-400 hover:bg-emerald-400 hover:text-black'}`}
                        title="Copy Invite Link"
                      >
                        <Share2 size={18} />
                      </button>
                      <button onClick={() => { setIsMultiplayer(false); setMatchId(null); }} className="text-[10px] text-white/40 hover:text-white underline uppercase font-black">Disconnect</button>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {participants.map((p: any) => (
                        <img key={p.userId} src={p.photoURL} alt={p.name} title={p.name} className="w-8 h-8 rounded-full border-2 border-[#111827]" style={{ borderColor: p.color }} />
                    ))}
                  </div>
                  {isHost && (
                    <button 
                      onClick={async () => {
                        const matchRef = doc(db, 'matches', matchId!);
                        await updateDoc(matchRef, { status: 'PLAYING' });
                      }}
                      className="w-full py-3 bg-emerald-500 text-black font-black uppercase italic rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    >
                      Start Online Match
                    </button>
                  )}
                  {!isHost && (
                    <p className="text-center text-[10px] font-black uppercase text-emerald-400 animate-pulse">Waiting for Host to start...</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.25em] text-[#5D9948] mb-3 block">Environmental Mission Layer</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.values(LEVELS)).map(lvl => (
                    <button 
                      key={lvl.id}
                      onClick={() => setCurrentLevelID(lvl.id)}
                      className={`relative flex flex-col p-4 rounded-2xl border-2 text-left transition-all ${currentLevelID === lvl.id ? 'bg-[#5D9948] text-black border-[#5D9948] shadow-[0_0_20px_rgba(93,153,72,0.3)]' : 'bg-white/5 border-white/10 text-white hover:border-white/20'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-black italic uppercase text-xs tracking-tighter">{lvl.id}</span>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase ${currentLevelID === lvl.id ? 'bg-black/20' : 'bg-[#5D9948]/20 text-[#5D9948]'}`}>
                          {lvl.difficultyLabel}
                        </span>
                      </div>
                      <p className={`text-[9px] leading-tight mb-2 ${currentLevelID === lvl.id ? 'text-black/70' : 'text-white/50'}`}>{lvl.description}</p>
                      <div className="flex gap-3 text-[8px] font-bold uppercase mt-auto">
                        <span className="flex items-center gap-1">📏 {lvl.boardSize} Tiles</span>
                        <span className="flex items-center gap-1">🎨 {lvl.theme}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-[0.25em] text-[#5D9948] mb-3 block">Number of Players</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(count => (
                    <button 
                      id={`player-count-${count}`}
                      key={count} 
                      onClick={() => setSetupPlayerCount(count)}
                      className={`flex-1 py-4 rounded-xl border-2 font-black transition-all ${setupPlayerCount === count ? 'bg-[#5D9948] text-black border-[#5D9948] shadow-[0_0_20px_rgba(93,153,72,0.3)]' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30 hover:text-white'}`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase tracking-[0.25em] text-[#5D9948] mb-3 block">Participant Identities</label>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {Array.from({ length: setupPlayerCount }).map((_, i) => (
                    <div id={`player-input-container-${i}`} key={i} className="flex flex-col gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 focus-within:border-[#5D9948]/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <button 
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-black shrink-0 shadow-lg transition-transform active:scale-90" 
                          style={{ backgroundColor: setupPlayerColors[i] }}
                          onClick={() => setActivePaletteIndex(activePaletteIndex === i ? null : i)}
                        >
                          {i + 1}
                        </button>
                        <input 
                          id={`player-name-input-${i}`}
                          type="text" 
                          value={setupPlayerNames[i] || ''} 
                          onChange={(e) => {
                            const newNames = [...setupPlayerNames];
                            newNames[i] = e.target.value;
                            setSetupPlayerNames(newNames);
                          }}
                          className="flex-1 bg-transparent border-none outline-none font-bold text-white placeholder:text-white/20"
                          placeholder={`Name ${i + 1}`}
                          maxLength={15}
                        />
                      </div>
                      
                      <AnimatePresence>
                        {activePaletteIndex === i && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-4 gap-2 mt-2 p-2 bg-black/20 rounded-xl">
                              {PLAYER_COLORS.slice(0, 8).map((color) => {
                                const isTaken = setupPlayerColors.slice(0, setupPlayerCount).some((c, idx) => c === color && idx !== i);
                                return (
                                  <button
                                    key={color}
                                    disabled={isTaken}
                                    onClick={() => {
                                      const newColors = [...setupPlayerColors];
                                      newColors[i] = color;
                                      setSetupPlayerColors(newColors);
                                      setActivePaletteIndex(null);
                                    }}
                                    className={`w-full aspect-square rounded-lg border-2 transition-all ${isTaken ? 'opacity-10 cursor-not-allowed scale-75' : setupPlayerColors[i] === color ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
                                    style={{ backgroundColor: color }}
                                  />
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button 
                id="start-mission-btn"
                onClick={startGame}
                className="w-full py-6 bg-[#A1643F] text-black font-black text-2xl uppercase italic rounded-2xl shadow-[0_0_40px_rgba(161,100,63,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                <Compass size={28} />
                Start Safari
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-20 w-1 h-1 bg-[#A1643F] rounded-full shadow-[0_0_10px_#A1643F]"></div>
        <div className="absolute top-40 left-80 w-1 h-1 bg-[#866043] rounded-full shadow-[0_0_10px_#866043]"></div>
        <div className="absolute top-80 left-1/4 w-1 h-1 bg-[#64F2F2] rounded-full shadow-[0_0_10px_#64F2F2]"></div>
        <div className="absolute top-1/2 left-3/4 w-1 h-1 bg-[#8B4513] rounded-full shadow-[0_0_10px_#8B4513]"></div>
      </div>
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {targetingItem && (
        <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center pointer-events-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-white uppercase italic tracking-widest mb-2">Select Target</h2>
            <p className="text-emerald-400 font-bold opacity-60">CHOOSE A PLAYER TO ATTACK WITH {targetingItem}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 max-w-2xl px-4">
            {players.map((p, i) => (
              i !== currentPlayerIndex && (
                <button 
                  key={p.id}
                  onClick={() => useItem(targetingItem, p.id)}
                  className="group relative flex flex-col items-center gap-4 transition-all duration-300 hover:scale-110 active:scale-95"
                >
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl border-4 border-white/20 flex items-center justify-center text-5xl sm:text-6xl shadow-2xl transition-all duration-300 group-hover:border-red-500 overflow-hidden" style={{ backgroundColor: p.color }}>
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    <span className="relative z-10">{p.skinIcon}</span>
                  </div>
                  <span className="text-white font-black uppercase italic tracking-widest group-hover:text-red-500 transition-colors">{p.name}</span>
                </button>
              )
            ))}
          </div>
          <button 
            onClick={() => setTargetingItem(null)}
            className="mt-16 px-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/50 font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      {gameState === 'PLAYING' && <CameraControls />}
      
      <header className={`relative z-20 flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 border-b bg-black/40 backdrop-blur-md ${uiColors.border}`}>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#5D9948] to-[#866043] shadow-[0_0_15px_rgba(93,153,72,0.4)]">
            <Compass className="text-black" size={24} />
          </div>
          <h1 className={`text-xl sm:text-4xl font-black tracking-tighter italic uppercase font-display whitespace-nowrap`} style={{ textShadow: `0 0 15px ${uiColors.primary}80`, color: uiColors.primary }}>
            VoltRun: Path of Chaos
          </h1>
        </div>
        <div className="flex items-center gap-4 sm:gap-4">
          <button 
            onClick={() => setIsTutorialOpen(true)}
            className="p-2 sm:px-6 sm:py-2 border border-white/20 hover:border-white rounded-full text-sm font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <Compass className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Help</span>
          </button>
          <button className="p-2 sm:px-6 sm:py-2 border border-white/20 hover:border-white rounded-full text-sm font-bold uppercase tracking-widest transition-all">
            <Settings className="w-5 h-5 sm:hidden" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>
      
      <main className="absolute inset-0 top-[60px] sm:top-[80px] z-10 pointer-events-none p-4 sm:p-6 flex flex-col justify-between">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start">
          {/* Player Info HUD */}
          <section className="w-full lg:w-72 pointer-events-none">
            <div className={`p-3 sm:p-6 rounded-2xl border-l-4 shadow-xl pointer-events-auto backdrop-blur-md scale-90 sm:scale-100 origin-top-left ${uiColors.bg}`} style={{ borderLeftColor: uiColors.primary }}>
              <div className="flex items-center gap-3 mb-2 sm:mb-4">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full shadow-[0_0_10px_white]" style={{ backgroundColor: currentP.color, border: '2px solid white' }}></div>
                <h2 className="text-base sm:text-xl font-bold uppercase tracking-tight truncate text-white">{currentP.name}</h2>
              </div>
              <div className="flex lg:flex-col gap-4 lg:gap-4 justify-between lg:justify-start">
                <div className="flex flex-col">
                  <span className="text-[8px] sm:text-xs uppercase opacity-50">Wallet</span>
                  <span id="wallet-value" className="text-lg sm:text-2xl font-display text-[#FFE600] flex items-center gap-1 sm:gap-2">
                    {currentP.coins} <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] sm:text-xs uppercase opacity-50">Inventory ({currentP.inventory.length}/5)</span>
                  <div className="flex gap-1 sm:gap-2">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className={`w-8 h-8 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-lg sm:text-2xl transition-all ${currentP.inventory[i] ? 'bg-black/40 border border-white/10 hover:scale-110 cursor-pointer pointer-events-auto' : 'bg-black/20 border border-dashed border-white/10'} ${isSpectating ? 'cursor-default' : ''}`}
                           onClick={() => !isSpectating && currentP.inventory[i] && useItem(currentP.inventory[i])}>
                        {currentP.inventory[i] ? ITEMS[currentP.inventory[i]].icon : ''}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Standings Overlay */}
          <section className="hidden sm:flex flex-col gap-4 pointer-events-none lg:w-72">
            <div className="p-4 rounded-2xl bg-[#111827]/80 border border-white/5 pointer-events-auto backdrop-blur-md">
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-50">Standings</h3>
              <div className="space-y-3">
                {players.map((p, idx) => (
                  <div key={p.id} className={`flex items-center justify-between text-xs ${idx !== currentPlayerIndex ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                      <span className="font-bold truncate max-w-[80px]">{p.name}</span>
                    </div>
                    <span className="font-display font-black text-xs sm:text-xl opacity-90 tracking-widest">TIL {p.position}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Notification Feed - Single Box Centered */}
        <div 
          className={`absolute top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm pointer-events-none px-4 transition-all duration-700 ${showNotification ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
        >
           {messages.length > 0 && (
             <div 
               className="bg-black/70 backdrop-blur-2xl px-8 py-4 rounded-3xl border border-white/20 text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
             >
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                  {messages[0]}
                </p>
             </div>
           )}
        </div>

        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 pointer-events-none">
          {/* Theme & Store Controls */}
          {!isSpectating && (
            <section className="flex gap-2 sm:flex-col sm:gap-3 pointer-events-auto order-2 sm:order-1">
              <button 
                onClick={() => setIsStoreOpen(true)} 
                className={`px-4 py-2 sm:px-0 sm:w-24 sm:h-20 border rounded-xl flex items-center sm:flex-col justify-center gap-2 group transition-all backdrop-blur-md`}
                style={{ backgroundColor: `${uiColors.secondary}15`, borderColor: `${uiColors.secondary}40` }}
              >
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: uiColors.secondary }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: uiColors.secondary }}>Store</span>
              </button>
            </section>
          )}

          {/* Roll Controls */}
          {(!isSpectating || isAutoPlay) ? (
            <section className="relative flex flex-col items-center gap-4 pointer-events-auto order-1 sm:order-2 flex-1">
              <div className="text-center mb-[-8px] scale-in">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 text-white">Current Player</span>
                <p className="text-lg sm:text-xl font-black uppercase italic tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  {currentP.name}
                </p>
              </div>
      {gameState === 'ROLLING' && rollResult && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center pointer-events-none bg-black/30 backdrop-blur-[2px]">
          <div className="relative">
            {/* Theme Decorative Overlays */}
            {theme === ThemeType.BLOCKY ? (
              <>
                <div className="absolute -top-10 -left-10 text-4xl animate-bounce delay-100">⛏️</div>
                <div className="absolute -bottom-10 -right-10 text-4xl animate-bounce delay-300">💎</div>
                <div className="absolute -top-12 -right-12 text-4xl animate-pulse">🪵</div>
              </>
            ) : (
              <>
                <div className="absolute -top-10 -left-10 text-4xl animate-bounce delay-100">🌿</div>
                <div className="absolute -bottom-10 -right-10 text-4xl animate-bounce delay-300">🍃</div>
                <div className="absolute -top-12 -right-12 text-4xl animate-pulse">🌴</div>
              </>
            )}

            {/* Pulsing Glow Background */}
            <div className={`absolute inset-0 blur-[80px] opacity-25 animate-pulse rounded-full scale-110 ${theme === ThemeType.BLOCKY ? 'bg-amber-700' : 'bg-emerald-500'}`} />
            
            <div className={`relative w-32 h-32 sm:w-48 sm:h-48 bg-black/80 backdrop-blur-2xl border-4 sm:border-8 rounded-[2.5rem] flex items-center justify-center text-7xl sm:text-9xl font-black scale-in ring-1 ring-white/10 ${theme === ThemeType.BLOCKY ? 'border-amber-600/60 shadow-[0_0_80px_rgba(161,100,63,0.4)] text-amber-400' : 'border-emerald-500/60 shadow-[0_0_80px_rgba(16,185,129,0.4)] text-emerald-400'}`}>
                <div className="animate-bounce">
                  {rollResult}
                </div>
            </div>
            
            <div className={`mt-8 text-center backdrop-blur-xl px-8 py-2.5 rounded-full border uppercase tracking-[0.4em] font-black italic scale-in delay-200 shadow-xl ${theme === ThemeType.BLOCKY ? 'bg-amber-900/40 border-amber-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>
              <span className={`text-sm sm:text-lg drop-shadow-[0_0_10px_rgba(161,100,63,0.5)] ${theme === ThemeType.BLOCKY ? 'text-amber-200' : 'text-emerald-300'}`}>{theme === ThemeType.BLOCKY ? 'Blocky Roll' : 'Jungle Roll'}</span>
            </div>
          </div>
        </div>
      )}
              <button 
                onClick={rollDice}
                disabled={gameState !== 'IDLE' || isSpectating}
                className={`px-10 py-4 sm:px-16 sm:py-6 font-black text-2xl sm:text-4xl uppercase italic rounded-full transition-all duration-300 scale-90 sm:scale-100 ${gameState === 'IDLE' && !isSpectating ? 'text-black shadow-xl hover:scale-110 active:scale-95 animate-pulse' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                style={gameState === 'IDLE' && !isSpectating ? { backgroundColor: currentP.color, boxShadow: `0 0 30px ${currentP.color}` } : {}}
              >
                {isSpectating ? 'Watching' : currentP.cagedTurns > 0 ? 'Wait' : 'Roll'}
              </button>
            </section>
          ) : (
            <div className="flex-1" />
          )}

          {/* Standings for mobile (Bottom list) */}
          <div className="sm:hidden w-full flex justify-center gap-2 pointer-events-auto order-3">
             {players.map((p, idx) => (
                <div key={p.id} className={`px-2 py-1 bg-black/40 rounded-md border flex items-center gap-1 ${idx === currentPlayerIndex ? 'bg-white/10' : 'opacity-50'}`} style={{ borderColor: idx === currentPlayerIndex ? uiColors.primary : 'rgba(255,255,255,0.1)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                  <span className="text-[8px] font-bold">{p.position}</span>
                </div>
             ))}
          </div>
        </div>
      </main>

      {isStoreOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6 backdrop-blur-xl bg-black/80 pointer-events-auto">
          <div className={`w-full max-w-2xl max-h-[95vh] border rounded-3xl overflow-hidden shadow-2xl flex flex-col scale-in ${uiColors.bg} ${uiColors.border}`}>
            <div className={`p-4 sm:p-6 border-b border-white/5 flex justify-between items-center shrink-0`} style={{ backgroundColor: `${uiColors.secondary}15` }}>
              <h2 className="font-display text-xl sm:text-2xl italic font-black uppercase" style={{ color: uiColors.secondary }}>Weapon Store</h2>
              <button 
                onClick={() => setIsStoreOpen(false)} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                aria-label="Close store"
              >
                <X className="w-6 sm:w-8 h-6 sm:h-8" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2" style={{ color: uiColors.secondary }}>
                    <span className="w-8 h-[1px]" style={{ backgroundColor: uiColors.secondary }}></span> Gear & Gadgets
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                    {(Object.keys(ITEMS).filter(k => ITEMS[k as ItemType].price > 0) as ItemType[]).map(key => (
                      <button 
                        key={key} 
                        onClick={() => buyItem(key)} 
                        disabled={currentP.coins < ITEMS[key].price || currentP.inventory.length >= 4} 
                        className={`p-4 sm:p-6 bg-white/5 border border-white/10 rounded-2xl transition-all disabled:opacity-30 disabled:grayscale group flex flex-col items-center relative overflow-hidden`}
                      >
                        <div className="text-4xl sm:text-5xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform">{ITEMS[key].icon}</div>
                        <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white/50 mb-1 sm:mb-2 text-center leading-tight">{ITEMS[key].name}</div>
                        <div className="text-base sm:text-lg font-display text-[#FFE600] flex items-center gap-1">{ITEMS[key].price} 🪙</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2" style={{ color: uiColors.primary }}>
                    <span className="w-8 h-[1px]" style={{ backgroundColor: uiColors.primary }}></span> Dice Customization
                  </h3>
                  <div className="grid grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                    {(Object.keys(DICE_SKINS) as DiceSkinType[]).map(key => (
                      <button 
                        key={key} 
                        onClick={() => buyDiceSkin(key)} 
                        className={`p-2 sm:p-4 border rounded-xl flex flex-col items-center transition-all ${selectedDiceSkin === key ? 'bg-white/10' : unlockedDiceSkins.includes(key) ? 'border-white/20 bg-white/5 hover:border-white/40' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                        style={{ borderColor: selectedDiceSkin === key ? uiColors.primary : undefined }}
                      >
                        <span className="text-xl sm:text-2xl mb-1">{DICE_SKINS[key].icon}</span>
                        {!unlockedDiceSkins.includes(key) && <span className="text-[10px] font-bold text-[#FFD700]">{DICE_SKINS[key].price}</span>}
                        {selectedDiceSkin === key && <span className="text-[8px] font-black" style={{ color: uiColors.primary }}>ACTV</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-black/60 border-t border-white/5 flex items-center justify-between shrink-0">
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-widest opacity-50">Remaining Balance</span>
                <span className="text-xl font-display text-[#FFE600]">{currentP.coins} 🪙</span>
              </div>
              <div className="flex items-center gap-1">
                {currentP.inventory.map((item, idx) => (
                  <div key={idx} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm grayscale mb-0.5">
                    {ITEMS[item].icon}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState === 'WON' && (
        <div className={`fixed inset-0 z-[110] flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-3xl transition-all duration-1000`}>
          <ConfettiPopper />
          
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative mb-16 text-center z-[130]"
          >
            <div className="absolute inset-0 blur-[100px] opacity-40 animate-pulse bg-white rounded-full scale-150" />
            <h2 className="font-display text-7xl sm:text-9xl font-black italic uppercase text-white/10 leading-none mb-[-2rem] sm:mb-[-4rem]">WINNER</h2>
            <div className="relative">
              <motion.h2 
                animate={{ scale: [1, 1.05, 1], rotate: [-1, 1, -1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="font-display text-5xl sm:text-8xl text-center font-black uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(0,0,0,1)]"
                style={{ 
                  color: currentP.color, 
                  textShadow: `0 0 40px ${currentP.color}aa, 0 10px 0 #000` 
                }}
              >
                {currentP.name}
              </motion.h2>
              <p className="mt-4 text-[#39FF14] font-black uppercase tracking-[0.5em] text-sm sm:text-base animate-pulse">Mission Accomplished</p>
            </div>
          </motion.div>

          <motion.button 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={resetToSetup} 
            className={`px-20 py-8 text-black font-black text-3xl sm:text-4xl uppercase italic rounded-full transition-all hover:scale-110 active:scale-95 shadow-[0_0_50px_rgba(57,255,20,0.5)] z-[130] cursor-pointer pointer-events-auto`} 
            style={{ backgroundColor: uiColors.primary }}
          >
            Play Again
          </motion.button>
          
          <motion.button 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            onClick={() => setIsLeaderboardOpen(true)} 
            className="mt-6 px-10 py-4 bg-white/5 border border-white/10 text-[#5D9948] font-black text-xl uppercase italic rounded-full transition-all hover:bg-white/10 z-[130]"
          >
            View Hall of Fame
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {isLeaderboardOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-gray-900 border border-[#5D9948]/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#5D9948]/20 rounded-lg">
                    <Trophy className="text-[#5D9948]" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic uppercase text-white tracking-widest">Hall of Fame</h2>
                    <p className="text-[12px] text-[#5D9948] font-bold uppercase tracking-widest">{currentLevelID}</p>
                  </div>
                </div>
                <button onClick={() => setIsLeaderboardOpen(false)} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingLeaderboard ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                    <div className="w-12 h-12 border-4 border-[#5D9948]/20 border-t-[#5D9948] rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase text-white/40 animate-pulse tracking-[0.3em]">Accessing Neural Records</p>
                  </div>
                ) : leaderboardData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 py-20 text-center">
                    <BarChart3 size={48} className="text-white/10" />
                    <p className="text-sm font-bold text-white/30 uppercase tracking-widest">No legends recorded for this layer yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaderboardData.map((entry, idx) => (
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx} 
                        className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:bg-[#5D9948]/10 hover:border-[#5D9948]/20 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 flex items-center justify-center font-black rounded-lg ${idx === 0 ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.5)]' : idx === 1 ? 'bg-gray-300 text-black' : idx === 2 ? 'bg-amber-600 text-black' : 'bg-white/10 text-white'}`}>
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-black uppercase tracking-tight text-white group-hover:text-[#5D9948] mb-0.5">{entry.playerName}</p>
                            <p className="text-[9px] text-white/30 uppercase font-bold">{new Date(entry.timestamp?.seconds * 1000 || entry.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-6">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-white/30 uppercase mb-1">Duration</p>
                            <div className="flex items-center gap-1.5 text-[#5D9948] font-black">
                              <Clock size={12} />
                              <span>{entry.turns} <small className="text-[9px] opacity-70">TURNS</small></span>
                            </div>
                          </div>
                          <div className="text-right w-20">
                            <p className="text-[10px] font-black text-white/30 uppercase mb-1">Asset</p>
                            <div className="flex items-center justify-end gap-1.5 text-yellow-500 font-black">
                              <Coins size={12} />
                              <span>{entry.coins}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-black/40 border-t border-white/5 flex gap-4">
                 {Object.values(LevelID).map(lvl => (
                   <button 
                    key={lvl}
                    onClick={() => fetchLeaderboard(lvl)}
                    className={`flex-1 py-3 px-2 rounded-xl border text-[9px] font-black uppercase transition-all tracking-tighter ${currentLevelID === lvl ? 'bg-[#5D9948] text-black border-[#5D9948]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                   >
                     {lvl.split(' ')[0]}
                   </button>
                 ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAboutOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-3xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-emerald-500/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                    <Info className="text-emerald-400" size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black italic uppercase text-white tracking-widest">VoltRun</h3>
                    <p className="text-emerald-400/60 font-black uppercase text-[10px] tracking-[0.3em]">Path of Chaos</p>
                  </div>
                </div>
                <button onClick={() => setIsAboutOpen(false)} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group">
                  <X className="text-white/40 group-hover:text-white transition-colors" size={24} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                <p className="text-white/80 leading-relaxed font-medium">
                  Roll the dice, spark the chaos, and dive into a cinematic 3D adventure board game built for the next generation. Inspired by Linear Track path games but reimagined with aesthetics and dynamic paths, every match is a thrilling journey where strategy meets spectacle.
                </p>
                <p className="text-white/80 leading-relaxed font-medium">
                  Choose your style — <span className="text-emerald-400">Whispering Woods</span>, <span className="text-amber-400">Voxel valley</span>, <span className="text-cyan-400">Abbyssal void</span> and <span className="text-emerald-400">Miner Maze</span>— and race across winding boards filled with treasures, vehicles, and ferocious beasts. Ride jets or trains to leap ahead, face dinosaurs and rhinos that drag you back, and unleash weapons like the Army Tank to blast rivals with shockwaves.
                </p>
                <p className="text-white/80 leading-relaxed font-medium">
                  With smooth multiplayer sync, free‑roam spectator mode, cinematic camera angles, and replay highlights, <span className="italic font-bold">VoltRun</span> transforms every roll into a show. Earn coins, unlock skins, and level up your dice in a vibrant store economy. Whether you’re chasing victory or just enjoying the chaos, this is board gaming evolved for Gen‑Z and Gen‑X players alike.
                </p>
              </div>

              <div className="p-8 bg-black/40 border-t border-white/5">
                <button 
                  onClick={() => setIsAboutOpen(false)}
                  className="w-full py-4 bg-white text-black font-black uppercase italic rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                >
                  Understood, Let's Roll!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTutorialOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-3xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-cyan-500/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-2xl flex items-center justify-center border border-cyan-500/30">
                    <Compass className="text-cyan-400" size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black italic uppercase text-white tracking-widest">Tutorial</h3>
                    <p className="text-cyan-400/60 font-black uppercase text-[10px] tracking-[0.3em]">Master the Chaos</p>
                  </div>
                </div>
                <button onClick={() => setIsTutorialOpen(false)} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group">
                  <X className="text-white/40 group-hover:text-white transition-colors" size={24} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { title: "Goal", icon: "🏆", desc: "Reach the last tile of the board first to win the match." },
                  { title: "Movement", icon: "🎲", desc: "Roll the dice to move. Boosts can add +2 steps, while status effects might slow you down." },
                  { title: "Store", icon: "🛒", desc: "Spend coins on items. Use them strategically during your turn." },
                  { title: "Hazards", icon: "🦖", desc: "Beasts like Rhinos and Dinos will drag you back if you land on their territory." },
                  { title: "Transports", icon: "🚀", desc: "Land on Flight or Train tiles to skip large sections of the board." },
                  { title: "Tactics", icon: "🛡️", desc: "Use Stasis Cages to freeze rivals or Armor to minimize the impact of traps." }
                ].map((step, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/10 transition-colors">
                    <div className="text-3xl mb-3">{step.icon}</div>
                    <h4 className="text-white font-black uppercase tracking-widest mb-1">{step.title}</h4>
                    <p className="text-white/50 text-xs leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>

              <div className="p-8 bg-black/40 border-t border-white/5">
                <button 
                  onClick={() => setIsTutorialOpen(false)}
                  className="w-full py-4 bg-cyan-500 text-black font-black uppercase italic rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                >
                  Got It!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-3xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-gray-900 border-2 border-emerald-500/50 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.3)] flex flex-col"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/30">
                  <Palmtree className="text-emerald-400" size={40} />
                </div>
                <h3 className="text-2xl font-black italic uppercase text-white mb-2 tracking-widest">Jungle Warning</h3>
                <p className="text-white/60 font-bold uppercase text-[10px] tracking-widest mb-8">Do you want to quit the current game?</p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                        setShowExitConfirm(false);
                        resetToSetup();
                    }}
                    className="w-full py-4 bg-emerald-500 text-black font-black uppercase italic rounded-xl hover:scale-105 active:scale-95 transition-all"
                  >
                    Yes, Exit Safari
                  </button>
                  <button 
                    onClick={() => setShowExitConfirm(false)}
                    className="w-full py-4 bg-white/5 border border-white/10 text-white font-black uppercase italic rounded-xl hover:bg-white/10 transition-all"
                  >
                    No, Stay Here
                  </button>
                  <button 
                    onClick={() => setShowExitConfirm(false)}
                    className="w-full py-2 text-white/30 hover:text-white/50 font-black uppercase text-[10px] tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 w-full max-w-2xl px-4">
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-3xl bg-black/50 backdrop-blur-lg border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-4xl md:text-7xl font-black italic uppercase text-white/10 leading-none select-none break-words w-full px-2 absolute -z-10">{toast.text}</h2>
            <p className="font-bold tracking-[0.2em] md:tracking-[0.5em] uppercase text-lg md:text-2xl mt-2 drop-shadow-2xl text-center" style={{ color: toast.color }}>{toast.text}</p>
          </div>
        </div>
      )}
      <style>{`
        @keyframes scale-in { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .scale-in { animation: scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
}
