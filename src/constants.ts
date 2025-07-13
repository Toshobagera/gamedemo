
import { Vector2D, Tower, Enemy, Wave, UpgradeNode, TowerType, DamageType, BossSpecialAbility } from './types';

export const GAME_WIDTH = 1000;
export const GAME_HEIGHT = 750;
export const TILE_SIZE = 50;
const GRID_WIDTH = GAME_WIDTH / TILE_SIZE; // 20
const GRID_HEIGHT = GAME_HEIGHT / TILE_SIZE; // 15

export const INITIAL_PLAYER_HEALTH = 20;
export const INITIAL_MONEY = 150;
export const TOWER_SELL_RATIO = 0.75;
export const TOWER_PRICE_INCREASE_RATE = 0.15; // 15% increase per tower built

// --- Stage Configurations ---

interface StageConfig {
    path: [number, number][];
    waves: Wave[];
}

const generateWaves = (isHard: boolean): Wave[] => {
    const waves: Wave[] = [];
    for (let i = 1; i <= 20; i++) {
        const difficulty = i + (isHard ? 5 : 0);
        const spawns: Wave['spawns'] = [];

        if (i % 5 === 0) { // Boss Wave
            spawns.push({ type: 'boss', count: 1, interval: 0 });
        } else {
            // Increased enemy count scaling, especially for later waves
            if (difficulty > 0) spawns.push({ type: 'triangle', count: Math.min(35, 5 + Math.floor(i * 2.2)), interval: Math.max(0.15, 0.8 - i * 0.02) });
            if (difficulty > 5) spawns.push({ type: 'square', count: Math.min(25, 3 + Math.floor(i * 1.2)), interval: Math.max(0.7, 1.5 - i * 0.05) });
            if (difficulty > 10) spawns.push({ type: 'pentagon', count: Math.min(20, 2 + Math.floor(i * 0.9)), interval: Math.max(0.5, 1.2 - i * 0.04) });
        }
        waves.push({ spawns });
    }
    return waves;
}

const STAGE_CONFIGS: StageConfig[] = [
    { // Stage 1
        path: [
            [-1, 7], [3, 7], [3, 3], [8, 3], [8, 12], [15, 12], [15, 5], [18, 5], [18, -1]
        ],
        waves: generateWaves(false)
    },
    { // Stage 2
        path: [
            [-1, 2], [5, 2], [5, 10], [14, 10], [14, 1], [19, 1], [19, 16]
        ],
        waves: generateWaves(true)
    }
];

export const MAX_STAGES = STAGE_CONFIGS.length;

// This function generates all the necessary constants for a given stage
export const getStageData = (stageIndex: number) => {
    const config = STAGE_CONFIGS[stageIndex];
    if (!config) throw new Error(`Invalid stage index: ${stageIndex}`);

    const pathWaypointsGrid: [number, number][] = config.path;

    const getPathWorldCoords = (): Vector2D[] => {
        return pathWaypointsGrid.map(([gx, gy]) => ({
            x: gx * TILE_SIZE + TILE_SIZE / 2,
            y: gy * TILE_SIZE + TILE_SIZE / 2
        }));
    };

    const getPathTiles = (): Set<string> => {
        const pathTiles = new Set<string>();
        for (let i = 0; i < pathWaypointsGrid.length - 1; i++) {
            let [x, y] = pathWaypointsGrid[i];
            const [endX, endY] = pathWaypointsGrid[i+1];

            pathTiles.add(`${x},${y}`);
            while(x !== endX || y !== endY) {
                if (x < endX) x++;
                else if (x > endX) x--;
                else if (y < endY) y++;
                else if (y > endY) y--;
                pathTiles.add(`${x},${y}`);
            }
        }
        return pathTiles;
    };

    const pathTiles = getPathTiles();

    const generateTowerSlots = (): Vector2D[] => {
        const slotCandidates = new Set<string>();

        pathTiles.forEach(tileKey => {
            const [gx, gy] = tileKey.split(',').map(Number);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = gx + dx;
                    const ny = gy + dy;
                    if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT && !pathTiles.has(`${nx},${ny}`)) {
                        slotCandidates.add(`${nx},${ny}`);
                    }
                }
            }
        });

        const finalSlots: Vector2D[] = Array.from(slotCandidates).map(slotKey => {
            const [gx, gy] = slotKey.split(',').map(Number);
            return {
                x: gx * TILE_SIZE + TILE_SIZE / 2,
                y: gy * TILE_SIZE + TILE_SIZE / 2
            };
        });

        finalSlots.sort((a, b) => (a.y !== b.y) ? a.y - b.y : a.x - b.x);
        return finalSlots;
    };

    return {
        PATH_COORDS: getPathWorldCoords(),
        TOWER_SLOTS: generateTowerSlots(),
        WAVES: config.waves
    };
};

type TowerStatBlock = Omit<Tower, 'id' | 'position' | 'fireCooldown' | 'slotIndex' | 'purchaseCost' | 'targetId'>;

export const TOWER_STATS: Record<TowerType, TowerStatBlock> = {
  CIRCLE: { type: 'CIRCLE', nameKey: 'tower_circle_name', descriptionKey: 'tower_circle_desc', damageType: 'PHYSICAL', range: 150, damage: 10, fireRate: 2, cost: 50 },
  SQUARE: { type: 'SQUARE', nameKey: 'tower_square_name', descriptionKey: 'tower_square_desc', damageType: 'PHYSICAL', range: 100, damage: 35, fireRate: 0.8, cost: 120 },
  TRIANGLE: { type: 'TRIANGLE', nameKey: 'tower_triangle_name', descriptionKey: 'tower_triangle_desc', damageType: 'PHYSICAL', range: 200, damage: 8, fireRate: 3, cost: 150 },
  FIRE: { type: 'FIRE', nameKey: 'tower_fire_name', descriptionKey: 'tower_fire_desc', damageType: 'FIRE', range: 120, damage: 5, fireRate: 1, cost: 100, burn: { dps: 10, duration: 3 } },
  COLD: { type: 'COLD', nameKey: 'tower_cold_name', descriptionKey: 'tower_cold_desc', damageType: 'COLD', range: 100, damage: 0, fireRate: 0, cost: 120, slowFactor: 0.4 },
  ELECTRIC: { type: 'ELECTRIC', nameKey: 'tower_electric_name', descriptionKey: 'tower_electric_desc', damageType: 'ELECTRIC', range: 160, damage: 25, fireRate: 1, cost: 180, chain: { initialCount: 2 } },
};

type EnemyStatBlock = Omit<Enemy, 'id' | 'position' | 'pathIndex' | 'maxHealth' | 'burns' | 'slow' | 'distanceTraveled' | 'abilityActiveTimer' | 'nextAbilityTriggerDistance' | 'bossIndex' | 'nameKey'>;

export const ENEMY_STATS: Record<Enemy['type'], EnemyStatBlock> = {
  triangle: { type: 'triangle', health: 40, speed: 80, reward: 5 },
  square: { type: 'square', health: 250, speed: 40, reward: 10 },
  pentagon: { type: 'pentagon', health: 100, speed: 60, reward: 8 },
  boss: { type: 'boss', health: 800, speed: 30, reward: 100 },
  critter: { type: 'critter', health: 1, speed: 120, reward: 1 },
};

interface BossDefinition {
    nameKey: string;
    baseHealth: number;
    baseReward: number;
    armor: number; // 0-1
    resistances: Partial<Record<DamageType, number>>; // 0-1, can be negative
    specialAbility: BossSpecialAbility;
}

export const BOSS_DEFINITIONS: BossDefinition[] = [
    { // Wave 5
        nameKey: "boss_1_name",
        baseHealth: 1200,
        baseReward: 100,
        armor: 0.20,
        resistances: { FIRE: 0.25, COLD: -0.10, ELECTRIC: 0.10 },
        specialAbility: { type: 'SPAWN_CRITTERS', triggerDistance: TILE_SIZE * 4, spawnCount: 2, spawnType: 'critter', duration: 3 },
    },
    { // Wave 10
        nameKey: "boss_2_name",
        baseHealth: 5000,
        baseReward: 250,
        armor: 0.15,
        resistances: { FIRE: -0.25, COLD: 0.15, ELECTRIC: 0.50 },
        specialAbility: { type: 'SPAWN_CRITTERS', triggerDistance: TILE_SIZE * 4, spawnCount: 4, spawnType: 'critter', duration: 3.5 },
    },
    { // Wave 15
        nameKey: "boss_3_name",
        baseHealth: 12000,
        baseReward: 500,
        armor: 0.35,
        resistances: { FIRE: 0.50, COLD: 0.60, ELECTRIC: -0.20 },
        specialAbility: { type: 'SPAWN_CRITTERS', triggerDistance: TILE_SIZE * 5, spawnCount: 6, spawnType: 'critter', duration: 4 },
    },
    { // Wave 20
        nameKey: "boss_4_name",
        baseHealth: 30000,
        baseReward: 1000,
        armor: 0.50,
        resistances: { FIRE: 0.30, COLD: 0.30, ELECTRIC: 0.30 },
        specialAbility: { type: 'SPAWN_CRITTERS', triggerDistance: TILE_SIZE * 5, spawnCount: 8, spawnType: 'critter', duration: 4 },
    }
];

export const PROGRESSION_TREE: UpgradeNode[] = [
    // --- Core & Economy Branch (Center) ---
    { id: 'ROOT', nameKey: 'upgrade_root_name', descriptionKey: 'upgrade_root_desc', cost: 0, dependencies: [], position: { x: 50, y: 5 }, type: 'GLOBAL' },
    { id: 'E_START_1', nameKey: 'upgrade_e_start_1_name', descriptionKey: 'upgrade_e_start_1_desc', cost: 1, dependencies: ['ROOT'], position: { x: 50, y: 15 }, type: 'ECONOMY', globalStat: 'startMoney', value: 50, operation: 'add' },
    { id: 'E_KILL_1', nameKey: 'upgrade_e_kill_1_name', descriptionKey: 'upgrade_e_kill_1_desc', cost: 2, dependencies: ['E_START_1'], position: { x: 40, y: 25 }, type: 'ECONOMY', globalStat: 'killBonus', value: 1, operation: 'add' },
    { id: 'E_START_2', nameKey: 'upgrade_e_start_2_name', descriptionKey: 'upgrade_e_start_2_desc', cost: 3, dependencies: ['E_START_1'], position: { x: 60, y: 25 }, type: 'ECONOMY', globalStat: 'startMoney', value: 75, operation: 'add'},
    { id: 'G_HEALTH_1', nameKey: 'upgrade_g_health_1_name', descriptionKey: 'upgrade_g_health_1_desc', cost: 3, dependencies: ['E_KILL_1'], position: { x: 40, y: 35 }, type: 'GLOBAL', globalStat: 'startHealth', value: 10, operation: 'add'},
    { id: 'G_COST_1', nameKey: 'upgrade_g_cost_1_name', descriptionKey: 'upgrade_g_cost_1_desc', cost: 4, dependencies: ['E_START_2'], position: { x: 60, y: 35 }, type: 'GLOBAL', globalStat: 'towerCostModifier', value: 0.95, operation: 'multiply'},
    { id: 'G_SELL_1', nameKey: 'upgrade_g_sell_1_name', descriptionKey: 'upgrade_g_sell_1_desc', cost: 2, dependencies: ['G_COST_1'], position: { x: 60, y: 45 }, type: 'ECONOMY', globalStat: 'sellRatioModifier', value: 0.10, operation: 'add'},

    // --- Scholar Branch (Top Right) ---
    { id: 'E_RP_1', nameKey: 'upgrade_e_rp_1_name', descriptionKey: 'upgrade_e_rp_1_desc', cost: 8, dependencies: ['G_SELL_1'], position: { x: 75, y: 45 }, type: 'ECONOMY', globalStat: 'researchPointModifier', value: 1.1, operation: 'multiply' },
    { id: 'E_RP_2', nameKey: 'upgrade_e_rp_2_name', descriptionKey: 'upgrade_e_rp_2_desc', cost: 12, dependencies: ['E_RP_1'], position: { x: 85, y: 45 }, type: 'ECONOMY', globalStat: 'researchPointModifier', value: 1.1, operation: 'multiply' },
    
    // --- Global Modifiers Branch (Center Bottom) ---
    { id: 'G_PROJ_SPEED_1', nameKey: 'upgrade_g_proj_speed_1_name', descriptionKey: 'upgrade_g_proj_speed_1_desc', cost: 4, dependencies: ['G_HEALTH_1', 'G_COST_1'], position: { x: 50, y: 45 }, type: 'GLOBAL', globalStat: 'projectileSpeedModifier', value: 1.2, operation: 'multiply' },
    { id: 'G_CRIT_CHANCE_1', nameKey: 'upgrade_g_crit_chance_1_name', descriptionKey: 'upgrade_g_crit_chance_1_desc', cost: 5, dependencies: ['G_PROJ_SPEED_1'], position: { x: 50, y: 55 }, type: 'GLOBAL', globalStat: 'globalCritChance', value: 0.02, operation: 'add' },
    { id: 'G_CRIT_DMG_1', nameKey: 'upgrade_g_crit_dmg_1_name', descriptionKey: 'upgrade_g_crit_dmg_1_desc', cost: 5, dependencies: ['G_CRIT_CHANCE_1'], position: { x: 50, y: 65 }, type: 'GLOBAL', globalStat: 'globalCritDamage', value: 0.25, operation: 'add' },
    { id: 'G_CRIT_CHANCE_2', nameKey: 'upgrade_g_crit_chance_2_name', descriptionKey: 'upgrade_g_crit_chance_2_desc', cost: 8, dependencies: ['G_CRIT_DMG_1'], position: { x: 50, y: 75 }, type: 'GLOBAL', globalStat: 'globalCritChance', value: 0.03, operation: 'add' },

    // --- Physical Towers Branch (Left Side) ---
    { id: 'P_BRANCH_ROOT', nameKey: 'upgrade_p_branch_root_name', descriptionKey: 'upgrade_p_branch_root_desc', cost: 1, dependencies: ['ROOT'], position: { x: 25, y: 15 }, type: 'GLOBAL' },
    // Circle
    { id: 'C_DMG_1', nameKey: 'upgrade_c_dmg_1_name', descriptionKey: 'upgrade_c_dmg_1_desc', cost: 1, dependencies: ['P_BRANCH_ROOT'], position: { x: 15, y: 25 }, type: 'TOWER_MOD', tower: 'CIRCLE', stat: 'damage', value: 3, operation: 'add' },
    { id: 'C_RATE_1', nameKey: 'upgrade_c_rate_1_name', descriptionKey: 'upgrade_c_rate_1_desc', cost: 2, dependencies: ['C_DMG_1'], position: { x: 15, y: 35 }, type: 'TOWER_MOD', tower: 'CIRCLE', stat: 'fireRate', value: 1.15, operation: 'multiply' },
    { id: 'C_RANGE_1', nameKey: 'upgrade_c_range_1_name', descriptionKey: 'upgrade_c_range_1_desc', cost: 3, dependencies: ['C_DMG_1'], position: { x: 25, y: 35 }, type: 'TOWER_MOD', tower: 'CIRCLE', stat: 'range', value: 1.1, operation: 'multiply'},
    { id: 'C_DMG_2', nameKey: 'upgrade_c_dmg_2_name', descriptionKey: 'upgrade_c_dmg_2_desc', cost: 4, dependencies: ['C_RATE_1', 'C_RANGE_1'], position: { x: 20, y: 45 }, type: 'TOWER_MOD', tower: 'CIRCLE', stat: 'damage', value: 5, operation: 'add' },
    // Square
    { id: 'S_UNLOCK', nameKey: 'upgrade_s_unlock_name', descriptionKey: 'upgrade_s_unlock_desc', cost: 2, dependencies: ['P_BRANCH_ROOT'], position: { x: 35, y: 25 }, type: 'GLOBAL'},
    { id: 'S_DMG_1', nameKey: 'upgrade_s_dmg_1_name', descriptionKey: 'upgrade_s_dmg_1_desc', cost: 3, dependencies: ['S_UNLOCK'], position: { x: 35, y: 35 }, type: 'TOWER_MOD', tower: 'SQUARE', stat: 'damage', value: 10, operation: 'add' },
    { id: 'S_RANGE_1', nameKey: 'upgrade_s_range_1_name', descriptionKey: 'upgrade_s_range_1_desc', cost: 4, dependencies: ['S_DMG_1'], position: { x: 25, y: 45 }, type: 'TOWER_MOD', tower: 'SQUARE', stat: 'range', value: 1.15, operation: 'multiply' },
    { id: 'S_DMG_2', nameKey: 'upgrade_s_dmg_2_name', descriptionKey: 'upgrade_s_dmg_2_desc', cost: 5, dependencies: ['S_DMG_1'], position: { x: 35, y: 45 }, type: 'TOWER_MOD', tower: 'SQUARE', stat: 'damage', value: 1.15, operation: 'multiply' },
    { id: 'S_DMG_3', nameKey: 'upgrade_s_dmg_3_name', descriptionKey: 'upgrade_s_dmg_3_desc', cost: 6, dependencies: ['S_DMG_2'], position: { x: 35, y: 55 }, type: 'TOWER_MOD', tower: 'SQUARE', stat: 'damage', value: 25, operation: 'add' },
    // Triangle
    { id: 'T_UNLOCK', nameKey: 'upgrade_t_unlock_name', descriptionKey: 'upgrade_t_unlock_desc', cost: 5, dependencies: ['S_DMG_3'], position: { x: 35, y: 65 }, type: 'GLOBAL' },
    { id: 'T_RATE_1', nameKey: 'upgrade_t_rate_1_name', descriptionKey: 'upgrade_t_rate_1_desc', cost: 4, dependencies: ['T_UNLOCK'], position: { x: 25, y: 75 }, type: 'TOWER_MOD', tower: 'TRIANGLE', stat: 'fireRate', value: 1.25, operation: 'multiply' },
    { id: 'T_RANGE_1', nameKey: 'upgrade_t_range_1_name', descriptionKey: 'upgrade_t_range_1_desc', cost: 4, dependencies: ['T_UNLOCK'], position: { x: 45, y: 75 }, type: 'TOWER_MOD', tower: 'TRIANGLE', stat: 'range', value: 1.2, operation: 'multiply' },
    { id: 'T_DMG_1', nameKey: 'upgrade_t_dmg_1_name', descriptionKey: 'upgrade_t_dmg_1_desc', cost: 6, dependencies: ['T_RATE_1', 'T_RANGE_1'], position: { x: 35, y: 85 }, type: 'TOWER_MOD', tower: 'TRIANGLE', stat: 'damage', value: 2, operation: 'add' },

    // --- Elemental Towers Branch (Right Side) ---
    { id: 'EL_BRANCH_ROOT', nameKey: 'upgrade_el_branch_root_name', descriptionKey: 'upgrade_el_branch_root_desc', cost: 1, dependencies: ['ROOT'], position: { x: 75, y: 15 }, type: 'GLOBAL' },
    // Fire
    { id: 'EL_UNLOCK_FIRE', nameKey: 'upgrade_el_unlock_fire_name', descriptionKey: 'upgrade_el_unlock_fire_desc', cost: 2, dependencies: ['EL_BRANCH_ROOT'], position: { x: 65, y: 25 }, type: 'GLOBAL' },
    { id: 'EL_FIRE_DPS_1', nameKey: 'upgrade_el_fire_dps_1_name', descriptionKey: 'upgrade_el_fire_dps_1_desc', cost: 3, dependencies: ['EL_UNLOCK_FIRE'], position: { x: 65, y: 35 }, type: 'TOWER_MOD', tower: 'FIRE', stat: 'burnDps', value: 5, operation: 'add' },
    { id: 'EL_FIRE_DUR_1', nameKey: 'upgrade_el_fire_dur_1_name', descriptionKey: 'upgrade_el_fire_dur_1_desc', cost: 3, dependencies: ['EL_FIRE_DPS_1'], position: { x: 65, y: 45 }, type: 'TOWER_MOD', tower: 'FIRE', stat: 'burnDuration', value: 1, operation: 'add' },
    { id: 'EL_FIRE_DMG_1', nameKey: 'upgrade_el_fire_dmg_1_name', descriptionKey: 'upgrade_el_fire_dmg_1_desc', cost: 4, dependencies: ['EL_FIRE_DUR_1'], position: { x: 65, y: 55 }, type: 'TOWER_MOD', tower: 'FIRE', stat: 'damage', value: 1.25, operation: 'multiply' },
    // Cold
    { id: 'EL_UNLOCK_COLD', nameKey: 'upgrade_el_unlock_cold_name', descriptionKey: 'upgrade_el_unlock_cold_desc', cost: 2, dependencies: ['EL_BRANCH_ROOT'], position: { x: 85, y: 25 }, type: 'GLOBAL' },
    { id: 'EL_COLD_SLOW_1', nameKey: 'upgrade_el_cold_slow_1_name', descriptionKey: 'upgrade_el_cold_slow_1_desc', cost: 3, dependencies: ['EL_UNLOCK_COLD'], position: { x: 85, y: 35 }, type: 'TOWER_MOD', tower: 'COLD', stat: 'slowFactor', value: 0.1, operation: 'add' },
    { id: 'EL_COLD_RANGE_1', nameKey: 'upgrade_el_cold_range_1_name', descriptionKey: 'upgrade_el_cold_range_1_desc', cost: 3, dependencies: ['EL_COLD_SLOW_1'], position: { x: 85, y: 45 }, type: 'TOWER_MOD', tower: 'COLD', stat: 'range', value: 1.15, operation: 'multiply' },
    { id: 'EL_COLD_SLOW_2', nameKey: 'upgrade_el_cold_slow_2_name', descriptionKey: 'upgrade_el_cold_slow_2_desc', cost: 5, dependencies: ['EL_COLD_RANGE_1'], position: { x: 85, y: 55 }, type: 'TOWER_MOD', tower: 'COLD', stat: 'slowFactor', value: 0.15, operation: 'add' },
    // Electric
    { id: 'EL_UNLOCK_ELEC', nameKey: 'upgrade_el_unlock_elec_name', descriptionKey: 'upgrade_el_unlock_elec_desc', cost: 4, dependencies: ['EL_FIRE_DMG_1', 'EL_COLD_SLOW_2'], position: { x: 75, y: 65 }, type: 'GLOBAL' },
    { id: 'EL_ELEC_CHAIN_1', nameKey: 'upgrade_el_elec_chain_1_name', descriptionKey: 'upgrade_el_elec_chain_1_desc', cost: 5, dependencies: ['EL_UNLOCK_ELEC'], position: { x: 65, y: 75 }, type: 'TOWER_MOD', tower: 'ELECTRIC', stat: 'chainCount', value: 1, operation: 'add' },
    { id: 'EL_ELEC_DMG_1', nameKey: 'upgrade_el_elec_dmg_1_name', descriptionKey: 'upgrade_el_elec_dmg_1_desc', cost: 4, dependencies: ['EL_UNLOCK_ELEC'], position: { x: 85, y: 75 }, type: 'TOWER_MOD', tower: 'ELECTRIC', stat: 'damage', value: 1.15, operation: 'multiply' },
    { id: 'EL_ELEC_DMG_2', nameKey: 'upgrade_el_elec_dmg_2_name', descriptionKey: 'upgrade_el_elec_dmg_2_desc', cost: 6, dependencies: ['EL_ELEC_CHAIN_1', 'EL_ELEC_DMG_1'], position: { x: 75, y: 85 }, type: 'TOWER_MOD', tower: 'ELECTRIC', stat: 'damage', value: 1.20, operation: 'multiply' },
];