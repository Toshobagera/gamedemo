
export interface Vector2D {
  x: number;
  y: number;
}

export type TowerType = 'CIRCLE' | 'SQUARE' | 'TRIANGLE' | 'FIRE' | 'COLD' | 'ELECTRIC';
export type DamageType = 'PHYSICAL' | 'FIRE' | 'COLD' | 'ELECTRIC';

export interface Tower {
  id: string;
  type: TowerType;
  position: Vector2D;
  slotIndex: number;
  range: number;
  damage: number;
  damageType: DamageType;
  fireRate: number; // shots per second
  cost: number; // Note: this is the base cost, not what was paid
  purchaseCost: number; // The actual cost paid by the player
  fireCooldown: number;
  targetId?: string;
  nameKey: string;
  descriptionKey: string;

  // For specific tower types
  slowFactor?: number; // COLD
  burn?: { dps: number; duration: number }; // FIRE
  chain?: { initialCount: number }; // ELECTRIC
}

export interface BossSpecialAbility {
    type: 'SPAWN_CRITTERS';
    triggerDistance: number;
    spawnCount: number;
    spawnType: 'critter';
    duration: number; // how long the boss stops for
}

export interface Enemy {
  id:string;
  type: 'triangle' | 'square' | 'pentagon' | 'boss' | 'critter';
  position: Vector2D;
  health: number;
  maxHealth: number;
  speed: number; // pixels per second
  pathIndex: number;
  reward: number;
  
  // Boss-specific properties
  nameKey?: string;
  armor?: number; // 0-1 percentage reduction for physical
  resistances?: Partial<Record<DamageType, number>>; // 0-1 percentage reduction
  specialAbility?: BossSpecialAbility;
  bossIndex?: number;
  
  // Status & State
  slow?: { factor: number; expires: number };
  burns: { dps: number; expires: number; sourceId: string }[];
  distanceTraveled: number;
  abilityActiveTimer?: number; // For bosses, how much time is left on the active ability (e.g., spawn pause)
  nextAbilityTriggerDistance?: number; // For bosses, the distance at which the next ability triggers
}

export interface Projectile {
  id:string;
  sourceTowerId: string;
  position: Vector2D;
  targetId: string;
  speed: number;
  damage: number;
  damageType: DamageType;
  // For ELECTRIC tower
  chain?: { remaining: number; alreadyHit: string[] };
  isChain?: boolean;
}

export interface Effect {
  id: string;
  position: Vector2D;
  radius: number;
  maxAge: number; // in seconds
  age: number;
  color: string;
}

export interface Wave {
    spawns: {
        type: Enemy['type'];
        count: number;
        interval: number; // seconds between spawns
    }[];
}

export type UpgradeNodeStat = 'damage' | 'range' | 'fireRate' | 'cost' | 'slowFactor' | 'burnDps' | 'burnDuration' | 'chainCount';
export type UpgradeNodeType = 'TOWER_MOD' | 'ECONOMY' | 'GLOBAL';

export interface UpgradeNode {
    id: string;
    nameKey: string;
    descriptionKey: string;
    cost: number;
    dependencies: string[];
    position: Vector2D; // percentage-based position
    type: UpgradeNodeType;
    // For TOWER_MOD
    tower?: TowerType;
    stat?: UpgradeNodeStat;
    value?: number; // can be additive or multiplicative
    operation?: 'add' | 'multiply';
    // For ECONOMY / GLOBAL
    globalStat?: 'startMoney' | 'killBonus' | 'startHealth' | 'towerCostModifier' | 'sellRatioModifier' | 'projectileSpeedModifier' | 'researchPointModifier' | 'globalCritChance' | 'globalCritDamage';
}