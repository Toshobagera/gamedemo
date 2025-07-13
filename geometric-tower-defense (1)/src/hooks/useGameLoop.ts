
import React, { useCallback, useRef, useEffect } from 'react';
import { Enemy, Tower, Projectile, Effect, Vector2D, DamageType } from '../types';
import { ENEMY_STATS, BOSS_DEFINITIONS } from '../constants';

type GameStateRefs = {
  towersRef: React.RefObject<Tower[]>;
  enemiesRef: React.RefObject<Enemy[]>;
  projectilesRef: React.RefObject<Projectile[]>;
  effectsRef: React.RefObject<Effect[]>;
  // Wave state refs
  waveTimeRef: React.RefObject<number>;
  spawnQueueRef: React.RefObject<{type: Enemy['type'], time: number}[]>;
  currentWaveIndexRef: React.RefObject<number>;
  postBossDifficultyRef: React.RefObject<number>;
  bossModifiersRef: React.RefObject<{ armor: number; resistance: number }>;
}

type GameStateSetters = {
  setEnemies: React.Dispatch<React.SetStateAction<Enemy[]>>;
  setTowers: React.Dispatch<React.SetStateAction<Tower[]>>;
  setProjectiles: React.Dispatch<React.SetStateAction<Projectile[]>>;
  setEffects: React.Dispatch<React.SetStateAction<Effect[]>>;
  setWaveTime: React.Dispatch<React.SetStateAction<number>>;
  setSpawnQueue: React.Dispatch<React.SetStateAction<{type: Enemy['type'], time: number}[]>>;
  addEffects: (effects: Effect[]) => void;
  onEnemyReachedEnd: (enemy: Enemy) => void;
  onEnemyKilled: (enemy: Enemy) => void;
};

export const useGameLoop = (
  pathCoords: Vector2D[],
  gameState: 'running' | 'paused',
  gameSpeed: number,
  projectileSpeedModifier: number,
  critChance: number,
  critDamage: number,
  gameTime: number,
  refs: GameStateRefs,
  setters: GameStateSetters
) => {
  const animationFrameId = useRef<number | null>(null);
  const lastTime = useRef<number>(0);
  
  const settersRef = useRef(setters);
  useEffect(() => { settersRef.current = setters; }, [setters]);
  
  const gameSpeedRef = useRef(gameSpeed);
  useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);
  
  const projectileSpeedModifierRef = useRef(projectileSpeedModifier);
  useEffect(() => { projectileSpeedModifierRef.current = projectileSpeedModifier; }, [projectileSpeedModifier]);
  
  const critChanceRef = useRef(critChance);
  useEffect(() => { critChanceRef.current = critChance; }, [critChance]);
  
  const critDamageRef = useRef(critDamage);
  useEffect(() => { critDamageRef.current = critDamage; }, [critDamage]);
  
  const gameTimeRef = useRef(gameTime);
  useEffect(() => { gameTimeRef.current = gameTime; }, [gameTime]);

  const gameLoop = useCallback((time: number) => {
    if (lastTime.current === 0) {
      lastTime.current = time;
      animationFrameId.current = requestAnimationFrame(gameLoop);
      return;
    }

    const deltaTime = ((time - lastTime.current) / 1000) * gameSpeedRef.current;
    if (deltaTime === 0) {
        animationFrameId.current = requestAnimationFrame(gameLoop);
        return;
    }
    lastTime.current = time;
    const currentTime = gameTimeRef.current;

    const {
      onEnemyKilled,
      onEnemyReachedEnd,
      addEffects,
      setTowers,
      setEnemies,
      setProjectiles,
      setEffects,
      setWaveTime,
      setSpawnQueue,
    } = settersRef.current;
    
    // --- READ PHASE ---
    const towers = refs.towersRef.current!;
    const enemies = refs.enemiesRef.current!;
    const projectiles = refs.projectilesRef.current!;
    const effects = refs.effectsRef.current!;
    const waveTime = refs.waveTimeRef.current!;
    const spawnQueue = refs.spawnQueueRef.current!;
    
    // --- CALCULATION PHASE ---
    let createdProjectiles: Projectile[] = [];
    let damageMap = new Map<string, number>();
    let createdEffects: Effect[] = [];
    let enemiesWithNewStatuses: Enemy[] = JSON.parse(JSON.stringify(enemies));
    let newEnemiesFromAbilities: Enemy[] = [];
    let newEnemiesFromSpawns: Enemy[] = [];

    // 1. Update Wave Spawning
    const newWaveTime = waveTime + deltaTime;
    const toSpawn = spawnQueue.filter(s => s.time <= newWaveTime);

    if (toSpawn.length > 0) {
        const currentWaveIndex = refs.currentWaveIndexRef.current!;
        const postBossDifficulty = refs.postBossDifficultyRef.current!;
        const bossModifiers = refs.bossModifiersRef.current!;

        newEnemiesFromSpawns = toSpawn.map((s, i) => {
             const baseStats = ENEMY_STATS[s.type];
             let finalEnemy: Enemy;

             if (s.type === 'boss') {
                 const bossIndex = Math.floor(currentWaveIndex / 5);
                 const bossDef = BOSS_DEFINITIONS[bossIndex % BOSS_DEFINITIONS.length];
                 const finalArmor = Math.min(0.9, bossDef.armor + bossModifiers.armor);
                 const finalResistances = { ...bossDef.resistances };
                 for (const key in finalResistances) {
                     const typedKey = key as DamageType;
                     finalResistances[typedKey] = Math.min(0.9, (finalResistances[typedKey] || 0) + bossModifiers.resistance);
                 }
                 const health = bossDef.baseHealth * (1 + (postBossDifficulty > 0 ? 0.2 : 0));

                 finalEnemy = {
                     ...baseStats,
                     ...bossDef,
                     id: `enemy_${currentWaveIndex}_${Date.now()}_${i}`,
                     position: {...pathCoords[0]},
                     pathIndex: 1,
                     health: health,
                     maxHealth: health,
                     reward: bossDef.baseReward,
                     armor: finalArmor,
                     resistances: finalResistances,
                     burns: [], 
                     distanceTraveled: 0,
                     bossIndex: bossIndex,
                     abilityActiveTimer: 0,
                     nextAbilityTriggerDistance: bossDef.specialAbility.triggerDistance,
                 };
             } else {
                 let health = baseStats.health;
                 if (postBossDifficulty > 0) {
                     health *= 1.2;
                 }
                 finalEnemy = {
                     ...baseStats,
                     id: `enemy_${currentWaveIndex}_${Date.now()}_${i}`,
                     position: {...pathCoords[0]},
                     pathIndex: 1,
                     maxHealth: health,
                     health: health,
                     burns: [], 
                     distanceTraveled: 0,
                 };
             }
             return finalEnemy;
        });
    }

    // 2. Update Towers
    const nextTowers = towers.map(tower => {
      let newTower = { ...tower, fireCooldown: tower.fireCooldown - deltaTime };

      if (tower.type === 'COLD' && tower.slowFactor) {
          for (const enemy of enemiesWithNewStatuses) {
              const dx = enemy.position.x - tower.position.x;
              const dy = enemy.position.y - tower.position.y;
              if ((dx * dx + dy * dy) < tower.range * tower.range) {
                  enemy.slow = { factor: tower.slowFactor, expires: currentTime + 0.25 };
              }
          }
      }

      if (newTower.fireCooldown <= 0 && newTower.fireRate > 0) {
        let target = enemies.reduce((acc: Enemy | null, enemy) => {
            const dx = enemy.position.x - newTower.position.x;
            const dy = enemy.position.y - newTower.position.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < (acc ? (acc as any).distSq : newTower.range * newTower.range)) {
                (enemy as any).distSq = distanceSq;
                return enemy;
            }
            return acc;
        }, null);

        if (target) {
          newTower.fireCooldown = 1 / newTower.fireRate;
          createdProjectiles.push({
            id: `proj_${Date.now()}_${Math.random()}`,
            sourceTowerId: newTower.id,
            position: { ...newTower.position },
            targetId: target.id,
            speed: 600 * projectileSpeedModifierRef.current,
            damage: newTower.damage,
            damageType: newTower.damageType,
            chain: (tower.type === 'ELECTRIC' && tower.chain) ? { remaining: tower.chain.initialCount - 1, alreadyHit: [target.id] } : undefined,
            isChain: tower.type === 'ELECTRIC',
          });
        }
      }
      return newTower;
    });
    
    // 3. Update Projectiles
    const allProjectiles = [...projectiles, ...createdProjectiles];
    let nextProjectiles: Projectile[] = [];
    
    for (const p of allProjectiles) {
      const target = enemiesWithNewStatuses.find(e => e.id === p.targetId);
      if (!target) continue;

      const dx = target.position.x - p.position.x;
      const dy = target.position.y - p.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const hitThreshold = 5 + p.speed * deltaTime;

      if (dist < hitThreshold) { // Hit!
        let finalDamage = p.damage;
        
        const isCrit = Math.random() < critChanceRef.current;
        if (isCrit) {
            finalDamage *= (1 + critDamageRef.current);
        }

        const resistance = target.resistances?.[p.damageType] ?? 0;
        finalDamage *= (1 - resistance);
        if (p.damageType === 'PHYSICAL') {
            finalDamage *= (1 - (target.armor ?? 0));
        }
        finalDamage = Math.max(0, finalDamage);

        damageMap.set(p.targetId, (damageMap.get(p.targetId) || 0) + finalDamage);
        
        createdEffects.push({
            id: `effect_${Date.now()}_${Math.random()}`,
            position: target.position,
            radius: 0,
            age: 0,
            maxAge: isCrit ? 0.4 : 0.2,
            color: isCrit ? '#fef08a' : '#fff'
        });
        
        const sourceTower = towers.find(t => t.id === p.sourceTowerId);
        const hitTarget = enemiesWithNewStatuses.find(e => e.id === p.targetId);
        if (hitTarget && sourceTower?.type === 'FIRE' && sourceTower.burn) {
            hitTarget.burns = hitTarget.burns.filter(b => b.sourceId !== sourceTower.id);
            hitTarget.burns.push({ dps: sourceTower.burn.dps, expires: currentTime + sourceTower.burn.duration, sourceId: sourceTower.id });
        }
        
        if (p.chain && p.chain.remaining > 0) {
            const nextTarget = enemiesWithNewStatuses.reduce((acc: Enemy | null, potentialTarget) => {
                if(p.chain!.alreadyHit.includes(potentialTarget.id)) return acc;
                const cDx = potentialTarget.position.x - target.position.x;
                const cDy = potentialTarget.position.y - target.position.y;
                const chainDistSq = cDx * cDx + cDy * cDy;
                if (chainDistSq < (acc ? (acc as any).distSq : 40000)) { // 200px
                    (potentialTarget as any).distSq = chainDistSq;
                    return potentialTarget;
                }
                return acc;
            }, null);

            if (nextTarget) {
                createdEffects.push({ id: `chain_${Date.now()}`, position: target.position, radius: 0, age: 0, maxAge: 0.1, color: '#67e8f9' });
                nextProjectiles.push({
                   ...p,
                   id: `proj_${Date.now()}_${Math.random()}`,
                   position: {...target.position},
                   targetId: nextTarget.id,
                   chain: { remaining: p.chain.remaining - 1, alreadyHit: [...p.chain.alreadyHit, nextTarget.id] }
                });
            }
        }
      } else {
        nextProjectiles.push({ ...p, position: { x: p.position.x + (dx / dist) * p.speed * deltaTime, y: p.position.y + (dy / dist) * p.speed * deltaTime } });
      }
    }
    
    // 4. Update Enemies
    let killedEnemies: Enemy[] = [];
    let enemiesReachedEnd: Enemy[] = [];

    let tempNextEnemies = enemiesWithNewStatuses.map(enemy => {
      let newHealth = enemy.health - (damageMap.get(enemy.id) || 0);

      enemy.burns = enemy.burns.filter(b => b.expires > currentTime);
      newHealth -= enemy.burns.reduce((acc, b) => acc + (b.dps * deltaTime), 0);
      
      if (enemy.slow && enemy.slow.expires < currentTime) enemy.slow = undefined;

      if (newHealth <= 0) {
        killedEnemies.push(enemy);
        return null;
      }

      if (enemy.abilityActiveTimer && enemy.abilityActiveTimer > 0) {
          enemy.abilityActiveTimer -= deltaTime;
          return { ...enemy, health: newHealth };
      }

      if (enemy.pathIndex >= pathCoords.length) {
        enemiesReachedEnd.push(enemy);
        return null;
      }

      const currentSpeed = enemy.speed * (1 - (enemy.slow?.factor ?? 0));
      const distanceToMove = currentSpeed * deltaTime;
      let newPos = { ...enemy.position };
      let newPathIndex = enemy.pathIndex;
      let movedDistance = 0;
      
      const dx = pathCoords[newPathIndex].x - newPos.x;
      const dy = pathCoords[newPathIndex].y - newPos.y;
      const distanceToWaypoint = Math.sqrt(dx * dx + dy * dy);

      if (distanceToMove >= distanceToWaypoint) {
        newPos = { ...pathCoords[newPathIndex] };
        newPathIndex++;
        movedDistance = distanceToWaypoint;
      } else {
        newPos.x += (dx / distanceToWaypoint) * distanceToMove;
        newPos.y += (dy / distanceToWaypoint) * distanceToMove;
        movedDistance = distanceToMove;
      }
      enemy.distanceTraveled += movedDistance;
      
      if (enemy.specialAbility?.type === 'SPAWN_CRITTERS' && enemy.nextAbilityTriggerDistance && enemy.distanceTraveled >= enemy.nextAbilityTriggerDistance) {
          enemy.abilityActiveTimer = enemy.specialAbility.duration;
          enemy.nextAbilityTriggerDistance += enemy.specialAbility.triggerDistance;
          
          for (let i = 0; i < enemy.specialAbility.spawnCount; i++) {
               newEnemiesFromAbilities.push({
                  ...ENEMY_STATS.critter,
                  id: `enemy_${currentTime}_critter_${i}`,
                  position: { x: enemy.position.x + Math.random()*20-10, y: enemy.position.y + Math.random()*20-10 },
                  pathIndex: enemy.pathIndex,
                  maxHealth: ENEMY_STATS.critter.health,
                  health: ENEMY_STATS.critter.health,
                  burns: [],
                  distanceTraveled: enemy.distanceTraveled,
              });
          }
      }
      
      if (newPathIndex >= pathCoords.length) {
        enemiesReachedEnd.push(enemy);
        return null;
      }

      return { ...enemy, health: newHealth, position: newPos, pathIndex: newPathIndex };
    }).filter((e): e is Enemy => e !== null);
    
    // 5. Update Effects
    const nextEffects = effects.map(e => ({ ...e, age: e.age + deltaTime })).filter(e => e.age < e.maxAge);

    // --- COMMIT PHASE ---
    if (createdEffects.length > 0) addEffects(createdEffects);
    if (toSpawn.length > 0) {
        setSpawnQueue(sq => sq.filter(s => s.time > newWaveTime));
    }
    
    setWaveTime(newWaveTime);
    killedEnemies.forEach(onEnemyKilled);
    enemiesReachedEnd.forEach(onEnemyReachedEnd);
    
    setTowers(nextTowers);
    setEnemies([...tempNextEnemies, ...newEnemiesFromAbilities, ...newEnemiesFromSpawns]);
    setProjectiles(nextProjectiles);
    setEffects(nextEffects);

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [pathCoords]);

  useEffect(() => {
    if (gameState === 'running') {
      lastTime.current = performance.now();
      animationFrameId.current = requestAnimationFrame(gameLoop);
    } else if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState, gameLoop]);
};
