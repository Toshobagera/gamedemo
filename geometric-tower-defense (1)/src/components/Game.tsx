
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tower, Enemy, Projectile, TowerType, Effect, Vector2D, DamageType } from '../types';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, getStageData, TOWER_PRICE_INCREASE_RATE, TOWER_SELL_RATIO } from '../constants';
import { useGameLoop } from '../hooks/useGameLoop';
import { ProgressionHook } from '../hooks/useProgression';
import { HeartIcon, CoinIcon, CircleIcon, SquareIcon, TriangleIcon, FireIcon, ColdIcon, ElectricIcon } from './icons';

type GameState = 'placing' | 'wave_countdown' | 'wave_in_progress' | 'game_over';
const EARLY_WAVE_BONUS = 15;

interface GameProps {
  onGameEnd: (result: { researchPointsEarned: number; victory: boolean }) => void;
  progression: ProgressionHook;
  stageIndex: number;
  t: (key: string, ...args: (string | number)[]) => string;
}

const TowerIconMap: Record<TowerType, React.FC<{className?: string}>> = {
    CIRCLE: CircleIcon,
    SQUARE: SquareIcon,
    TRIANGLE: TriangleIcon,
    FIRE: FireIcon,
    COLD: ColdIcon,
    ELECTRIC: ElectricIcon,
}

const Game: React.FC<GameProps> = ({ onGameEnd, progression, stageIndex, t }) => {
  const { modifiedTowerStats, gameSettings, bossModifiers } = progression;

  const { PATH_COORDS, TOWER_SLOTS, WAVES } = useMemo(() => getStageData(stageIndex), [stageIndex]);
  
  const [gameState, setGameState] = useState<GameState>('placing');
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [effects, setEffects] = useState<Effect[]>([]);
  
  const [health, setHealth] = useState(gameSettings.startHealth);
  const [money, setMoney] = useState(gameSettings.startMoney);
  
  const [currentWaveIndex, setCurrentWaveIndex] = useState(0);
  const [researchPointsEarned, setResearchPointsEarned] = useState(0);
  
  const [spawnQueue, setSpawnQueue] = useState<{type: Enemy['type'], time: number}[]>([]);
  const [waveTime, setWaveTime] = useState(0);
  const [gameTime, setGameTime] = useState(0);

  const [towerBuildCount, setTowerBuildCount] = useState<Record<TowerType, number>>({ CIRCLE: 0, SQUARE: 0, TRIANGLE: 0, FIRE: 0, COLD: 0, ELECTRIC: 0 });
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  
  const [placementPopover, setPlacementPopover] = useState<{ slotIndex: number; position: Vector2D } | null>(null);
  const [hoveredPopoverTowerType, setHoveredPopoverTowerType] = useState<TowerType | null>(null);
  const [popoverVisible, setPopoverVisible] = useState(false);

  const [gameSpeed, setGameSpeed] = useState(1);
  const [waveStartCountdown, setWaveStartCountdown] = useState<number | null>(null);
  const [postBossDifficulty, setPostBossDifficulty] = useState(0);
  const [gameOverVisible, setGameOverVisible] = useState(false);


  const occupiedSlots = useMemo(() => new Set(towers.map(t => t.slotIndex)), [towers]);
  const selectedTower = useMemo(() => towers.find(t => t.id === selectedTowerId), [towers, selectedTowerId]);
  const currentBoss = useMemo(() => enemies.find(e => e.type === 'boss') || null, [enemies]);

  // --- Refs for Game Loop ---
  const towersRef = useRef(towers);
  useEffect(() => { towersRef.current = towers; }, [towers]);
  const enemiesRef = useRef(enemies);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  const projectilesRef = useRef(projectiles);
  useEffect(() => { projectilesRef.current = projectiles; }, [projectiles]);
  const effectsRef = useRef(effects);
  useEffect(() => { effectsRef.current = effects; }, [effects]);
  const waveTimeRef = useRef(waveTime);
  useEffect(() => { waveTimeRef.current = waveTime; }, [waveTime]);
  const spawnQueueRef = useRef(spawnQueue);
  useEffect(() => { spawnQueueRef.current = spawnQueue; }, [spawnQueue]);
  const currentWaveIndexRef = useRef(currentWaveIndex);
  useEffect(() => { currentWaveIndexRef.current = currentWaveIndex; }, [currentWaveIndex]);
  const postBossDifficultyRef = useRef(postBossDifficulty);
  useEffect(() => { postBossDifficultyRef.current = postBossDifficulty; }, [postBossDifficulty]);
  const bossModifiersRef = useRef(bossModifiers);
  useEffect(() => { bossModifiersRef.current = bossModifiers; }, [bossModifiers]);


  const onEnemyKilled = useCallback((enemy: Enemy) => {
    setMoney(m => m + enemy.reward + gameSettings.killBonus);
    if(enemy.type === 'boss' && enemy.bossIndex !== undefined) {
        const basePoints = enemy.bossIndex + 3;
        const pointsToEarn = Math.floor(basePoints * gameSettings.researchPointModifier);
        setResearchPointsEarned(rp => rp + pointsToEarn);
        setPostBossDifficulty(4);
    }
  }, [gameSettings.killBonus, gameSettings.researchPointModifier]);

  const onEnemyReachedEnd = useCallback((enemy: Enemy) => {
    setHealth(h => {
        const damage = enemy.type === 'boss' ? 5 : 1;
        const newHealth = h - damage;
        if(newHealth <= 0) {
            setGameState('game_over');
        }
        return Math.max(0, newHealth);
    });
  }, []);

  const addEffects = useCallback((newEffects: Effect[]) => {
      setEffects(e => [...e, ...newEffects]);
  }, []);

  const getTowerCost = useCallback((type: TowerType) => {
    const baseCost = modifiedTowerStats[type].cost;
    const count = towerBuildCount[type];
    return baseCost * (1 + (count * TOWER_PRICE_INCREASE_RATE));
  }, [modifiedTowerStats, towerBuildCount]);
  
  const getSellValue = useCallback((tower: Tower) => {
      const baseSellRatio = TOWER_SELL_RATIO;
      const bonusRatio = gameSettings.sellRatioModifier || 0;
      return tower.purchaseCost * (baseSellRatio + bonusRatio);
  }, [gameSettings.sellRatioModifier]);

  useGameLoop(
    PATH_COORDS,
    gameState === 'wave_in_progress' ? 'running' : 'paused',
    gameSpeed,
    gameSettings.projectileSpeedModifier,
    gameSettings.globalCritChance,
    gameSettings.globalCritDamage,
    gameTime,
    { towersRef, enemiesRef, projectilesRef, effectsRef, waveTimeRef, spawnQueueRef, currentWaveIndexRef, postBossDifficultyRef, bossModifiersRef },
    { setTowers, setEnemies, setProjectiles, setEffects, setWaveTime, setSpawnQueue, addEffects, onEnemyKilled, onEnemyReachedEnd }
  );

  const startWave = useCallback(() => {
    const waveIndexToStart = gameState === 'placing' ? 0 : currentWaveIndex + 1;
    const wave = WAVES[waveIndexToStart];
    if (!wave) {
        setGameState('game_over');
        return;
    };
    
    if (postBossDifficulty > 0) {
        setPostBossDifficulty(d => d - 1);
    }
    
    setCurrentWaveIndex(waveIndexToStart);

    let scheduledSpawns: {type: Enemy['type'], time: number}[] = [];
    let currentTime = 0;
    wave.spawns.forEach(spawnGroup => {
        let groupStartTime = currentTime;
        const isBoss = spawnGroup.type === 'boss';
        let count = spawnGroup.count;
        if (!isBoss && postBossDifficulty > 0) {
            count = Math.floor(count * 1.4);
        }

        for(let i = 0; i < count; i++) {
            scheduledSpawns.push({ type: spawnGroup.type, time: groupStartTime });
            groupStartTime += spawnGroup.interval;
        }
        currentTime = groupStartTime + 0.5;
    });
    
    setSpawnQueue(scheduledSpawns.sort((a,b) => a.time - b.time));
    setWaveTime(0);
    setGameState('wave_in_progress');
    setSelectedTowerId(null);
    setPlacementPopover(null);
  }, [gameState, currentWaveIndex, WAVES, postBossDifficulty]);
  
  useEffect(() => {
    if (gameState === 'wave_in_progress') {
        const timer = setInterval(() => {
            setGameTime(gt => gt + 0.1 * gameSpeed);
        }, 100);
        return () => clearInterval(timer);
    }
  }, [gameState, gameSpeed]);

  useEffect(() => {
    if (gameState === 'wave_in_progress' && enemies.length === 0 && spawnQueue.length === 0) {
      if(currentWaveIndex === WAVES.length - 1) {
        setGameState('game_over');
      } else {
        setGameState('wave_countdown');
        setWaveStartCountdown(5);
      }
    }
  }, [gameState, enemies, spawnQueue, currentWaveIndex, WAVES.length]);

  useEffect(() => {
    if (gameState === 'wave_countdown' && waveStartCountdown !== null) {
      if (waveStartCountdown <= 0) {
        startWave();
      } else {
        const timerId = setTimeout(() => {
          setWaveStartCountdown(c => c !== null ? c - 1 : null);
        }, 1000);
        return () => clearTimeout(timerId);
      }
    }
  }, [gameState, waveStartCountdown, startWave]);

  useEffect(() => {
    if (placementPopover) {
        const timer = setTimeout(() => setPopoverVisible(true), 10);
        return () => clearTimeout(timer);
    } else {
        setPopoverVisible(false);
    }
  }, [placementPopover]);

  useEffect(() => {
    if (gameState === 'game_over') {
        const timer = setTimeout(() => setGameOverVisible(true), 10);
        return () => clearTimeout(timer);
    } else {
        setGameOverVisible(false);
    }
  }, [gameState]);

  const handleEarlyStart = () => {
    if (gameState !== 'wave_countdown' || waveStartCountdown === null) return;
    setMoney(m => m + EARLY_WAVE_BONUS);
    setWaveStartCountdown(null);
    startWave();
  };
  
  const handleSlotClick = (slotIndex: number, position: Vector2D) => {
    if (occupiedSlots.has(slotIndex)) return;
    
    setSelectedTowerId(null);
    setPlacementPopover({ slotIndex, position });
  };
  
  const handlePlaceTower = (towerType: TowerType) => {
    if (!placementPopover) return;
    
    const { slotIndex, position } = placementPopover;
    const towerStats = modifiedTowerStats[towerType];
    const currentCost = getTowerCost(towerType);

    if (money < currentCost) return;

    setTowers(t => [...t, {
      ...towerStats,
      id: `tower_${Date.now()}`,
      position,
      slotIndex,
      purchaseCost: currentCost,
      fireCooldown: 1 / towerStats.fireRate,
    }]);
    setMoney(m => m - currentCost);
    setTowerBuildCount(counts => ({ ...counts, [towerType]: counts[towerType] + 1 }));
    
    setPlacementPopover(null);
    setHoveredPopoverTowerType(null);
  };
  
  const handleSellTower = (towerId: string) => {
    const towerToSell = towers.find(t => t.id === towerId);
    if (!towerToSell) return;

    const refundAmount = getSellValue(towerToSell);
    setMoney(m => m + refundAmount);
    setTowers(t => t.filter(tower => tower.id !== towerId));
    setSelectedTowerId(null);
  };
  
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
        setSelectedTowerId(null);
        setPlacementPopover(null);
        setHoveredPopoverTowerType(null);
    }
  };
  
  const renderWaveButton = () => {
    if (gameState === 'placing' || (gameState === 'wave_in_progress' && enemies.length === 0 && spawnQueue.length === 0 && currentWaveIndex === -1)) {
      return (
        <button onClick={startWave} className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg shadow-lg hover:bg-green-600 transition-all duration-200 transform hover:scale-105">
          {t('start_wave', currentWaveIndex + 1)}
        </button>
      );
    }
    if (gameState === 'wave_countdown') {
      return (
        <button onClick={handleEarlyStart} className="px-6 py-3 bg-cyan-500 text-white font-bold rounded-lg shadow-lg hover:bg-cyan-600 transition-all duration-200 transform hover:scale-105">
          {t('start_early', waveStartCountdown ?? 0)}
          <span className="text-xs ml-2 text-yellow-200 bg-black/20 px-1.5 py-0.5 rounded-full">(+${EARLY_WAVE_BONUS})</span>
        </button>
      );
    }
    return <div className="px-6 py-3 text-slate-400 font-bold">{t('wave_in_progress')}</div>;
  };
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 font-mono text-slate-200">
      <div className="flex justify-between w-full max-w-5xl px-4 py-2 z-10">
        <div className="flex space-x-6 text-xl items-center bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700">
          <div className="flex items-center">
            <HeartIcon className="w-6 h-6 mr-2 text-rose-500"/>
            <span className="font-bold text-rose-400">{health}</span>
          </div>
          <div className="flex items-center">
            <CoinIcon className="w-6 h-6 mr-2 text-yellow-400"/>
            <span className="font-bold text-yellow-300">{money.toFixed(0)}</span>
          </div>
          <div className="flex items-center">
            <span className="text-slate-400 mr-2">{t('wave')}:</span>
            <span className="font-bold text-slate-200">{Math.min(currentWaveIndex + 1, WAVES.length)} / {WAVES.length}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
             <button onClick={() => setGameSpeed(s => s === 3 ? 1 : s + 1)} className="px-4 py-2 bg-slate-700 text-slate-200 font-bold rounded-lg shadow-lg hover:bg-slate-600 transition-colors w-28">
                {t('speed')} x{gameSpeed}
            </button>
            {renderWaveButton()}
        </div>
      </div>
      
      <div className="relative bg-slate-800 border-2 border-slate-700 rounded-lg shadow-2xl">
          <svg width={GAME_WIDTH} height={GAME_HEIGHT} onClick={handleBackgroundClick}>
              <defs>
                  <filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  <filter id="chainGlow"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <path d={PATH_COORDS.map((p,i) => `${i===0?'M':'L'}${p.x} ${p.y}`).join(' ')} stroke="#475569" strokeWidth="40" fill="none" />
              <path d={PATH_COORDS.map((p,i) => `${i===0?'M':'L'}${p.x} ${p.y}`).join(' ')} stroke="#586578" strokeWidth="38" fill="none" />
              
              {TOWER_SLOTS.map((slot, index) => {
                  if(occupiedSlots.has(index)) return null;
                  const isPopoverTarget = placementPopover?.slotIndex === index;
                  return (
                      <g key={`slot_${index}`} onClick={() => handleSlotClick(index, slot)} className="cursor-pointer">
                         <rect x={slot.x - TILE_SIZE / 2} y={slot.y - TILE_SIZE / 2} width={TILE_SIZE} height={TILE_SIZE} fill={isPopoverTarget ? "rgba(107, 237, 249, 0.2)" : "rgba(107, 237, 249, 0.05)"} stroke="rgba(107, 237, 249, 0.5)" strokeWidth={isPopoverTarget ? 2 : 1} className="hover:fill-[rgba(107,237,249,0.15)] transition-colors"/>
                      </g>
                  )
              })}
              
              {placementPopover && hoveredPopoverTowerType && (<circle cx={placementPopover.position.x} cy={placementPopover.position.y} r={modifiedTowerStats[hoveredPopoverTowerType].range} fill="rgba(255, 255, 255, 0.1)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" strokeDasharray="4" pointerEvents="none" />)}

              {towers.map(tower => {
                  const isSelected = selectedTowerId === tower.id;
                  return (
                    <g key={tower.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedTowerId(tower.id); setPlacementPopover(null); }}>
                        {isSelected && <g pointerEvents="none">
                            <circle cx={tower.position.x} cy={tower.position.y} r={tower.range} fill="rgba(255, 255, 255, 0.1)" />
                            <circle cx={tower.position.x} cy={tower.position.y} r={tower.range} stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1" fill="none" />
                        </g>}
                        {tower.type === 'COLD' && tower.slowFactor && <g pointerEvents="none"><circle cx={tower.position.x} cy={tower.position.y} r={tower.range} fill="rgba(59, 130, 246, 0.1)" /></g>}
                        
                        {tower.type === 'CIRCLE' && <g><circle cx={tower.position.x} cy={tower.position.y} r="16" fill="#475569" stroke={isSelected ? "#0ea5e9" : "#64748b"} strokeWidth="2"/><circle cx={tower.position.x} cy={tower.position.y} r="9" fill="#0891b2"/><circle cx={tower.position.x} cy={tower.position.y} r="5" fill="#67e8f9"/></g>}
                        {tower.type === 'SQUARE' && <g><rect x={tower.position.x-16} y={tower.position.y-16} width="32" height="32" rx="4" fill="#6b21a8" stroke={isSelected ? "#c084fc" : "#9333ea"} strokeWidth="2"/><rect x={tower.position.x-8} y={tower.position.y-8} width="16" height="16" fill="#a855f7"/></g>}
                        {tower.type === 'TRIANGLE' && <g transform={`translate(${tower.position.x}, ${tower.position.y})`}><path d="M0 -16 L14 8 L-14 8 Z" fill="#0d9488" stroke={isSelected ? "#5eead4" : "#14b8a6"} strokeWidth="2"/></g>}
                        
                        {tower.type === 'FIRE' && <g>
                            <circle cx={tower.position.x} cy={tower.position.y} r="16" fill="#7f1d1d" stroke={isSelected ? "#fb7185" : "#f43f5e"} strokeWidth="2"/>
                            <circle cx={tower.position.x} cy={tower.position.y} r="8" fill="#f97316" filter="url(#glow)"/>
                        </g>}
                        {tower.type === 'COLD' && <g>
                            <circle cx={tower.position.x} cy={tower.position.y} r="16" fill="#1e3a8a" stroke={isSelected ? "#60a5fa" : "#3b82f6"} strokeWidth="2"/>
                             <circle cx={tower.position.x} cy={tower.position.y} r="8" fill="#38bdf8" filter="url(#glow)"/>
                        </g>}
                        {tower.type === 'ELECTRIC' && <g transform={`translate(${tower.position.x}, ${tower.position.y})`}>
                            <path d="M-5 -16 L-15 0 L-5 0 L5 16 L15 0 L5 0 Z" fill="#581c87" stroke={isSelected ? "#d8b4fe" : "#a855f7"} strokeWidth="2"/>
                            <path d="M7 2v11h3v9l7-12h-4l4-8z" transform="scale(0.5) translate(-7, -12)" fill="#facc15" filter="url(#glow)"/>
                        </g>}
                    </g>
                  );
              })}

              {enemies.map(enemy => {
                  const isBoss = enemy.type === 'boss';
                  const isCritter = enemy.type === 'critter';
                  const size = isBoss ? 20 : (isCritter ? 6 : 10);
                  const isImmobile = !!(enemy.abilityActiveTimer && enemy.abilityActiveTimer > 0);
                  return (
                  <g key={enemy.id} transform={`translate(${enemy.position.x}, ${enemy.position.y})`}>
                      {enemy.slow && <circle r={size+4} fill="rgba(59, 130, 246, 0.4)" filter="url(#glow)" />}
                      {enemy.burns.length > 0 && <circle r={size+4} fill="rgba(239, 68, 68, 0.5)" filter="url(#glow)" />}
                      
                      {!isBoss && <><rect x={-size*1.5/2} y={-size-7} width={size*1.5} height="5" fill="#334155" rx="2"/><rect x={-size*1.5/2} y={-size-7} width={size*1.5 * (enemy.health / enemy.maxHealth)} height="5" fill={isCritter ? "#f59e0b" : "#16a34a"} rx="2"/></>}
                      
                      {enemy.type === 'triangle' && <path d="M0 -10 L10 10 L-10 10 Z" fill="#facc15" stroke="#ca8a04" strokeWidth={2}/>}
                      {enemy.type === 'square' && <rect x="-10" y="-10" width="20" height="20" fill="#f43f5e" stroke="#be123c" strokeWidth={2}/>}
                      {enemy.type === 'pentagon' && <path d="M0 -12 L11.4 -3.7 L7 9.7 H-7 L-11.4 -3.7 Z" fill="#ec4899" stroke="#be185d" strokeWidth={2}/>}
                      {isBoss && <path d="M0 -22 L21 -7.4 L13 19 H-13 L-21 -7.4 Z" fill="#1e293b" stroke={isImmobile ? "#38bdf8" : "#475569"} strokeWidth={3} />}
                      {isCritter && <path d="M0 -6 L5 0 L0 6 L-5 0Z" fill="#f59e0b" />}
                  </g>
              )})}

              {projectiles.map(p => <circle key={p.id} cx={p.position.x} cy={p.position.y} r={p.isChain ? 4 : 5} fill={p.damageType === 'ELECTRIC' ? "#a78bfa" : (p.damageType === 'FIRE' ? '#f97316' : '#fff')} filter={p.isChain ? "url(#chainGlow)" : "url(#glow)" }/>)}
              {effects.map(effect => (<circle key={effect.id} cx={effect.position.x} cy={effect.position.y} r={2 + (effect.color === '#fef08a' ? 25 : 15) * (effect.age / effect.maxAge)} fill="none" stroke={effect.color} strokeWidth="3" opacity={1 - (effect.age / effect.maxAge)} />))}
              
              {placementPopover && (
                <foreignObject x={placementPopover.position.x - 120} y={placementPopover.position.y - 100} width="240" height="170" style={{ pointerEvents: 'none' }}>
                    <div className={`flex flex-col items-center transition-all duration-150 ease-out ${popoverVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} style={{ pointerEvents: 'auto' }}>
                      <div className="h-16 w-full mb-2 flex items-center justify-center">
                        {hoveredPopoverTowerType && (
                          <div className="bg-slate-900/80 border border-slate-600 p-2 rounded-md w-full text-center pointer-events-none">
                            <p className="text-xs text-slate-300 leading-tight">{t(modifiedTowerStats[hoveredPopoverTowerType].descriptionKey)}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center space-x-2 bg-slate-800/80 backdrop-blur-sm p-2 rounded-full border border-slate-700">
                        {gameSettings.unlockedTowers.map(type => {
                          const Icon = TowerIconMap[type];
                          const currentCost = getTowerCost(type);
                          const canAfford = money >= currentCost;
                          return (
                            <button key={type} onClick={() => handlePlaceTower(type)} onMouseEnter={() => setHoveredPopoverTowerType(type)} onMouseLeave={() => setHoveredPopoverTowerType(null)} disabled={!canAfford} className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 ${canAfford ? 'bg-slate-700 border-slate-500 hover:bg-cyan-600 hover:border-cyan-400' : 'bg-slate-800 border-slate-700 cursor-not-allowed opacity-60'}`}>
                              <Icon className="w-6 h-6 text-slate-100" />
                              <div className="absolute -bottom-1 text-xs font-bold text-yellow-300 bg-slate-900 px-1 rounded-sm">{Math.floor(currentCost)}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                </foreignObject>
              )}

              {selectedTower && (<foreignObject x={selectedTower.position.x - 45} y={selectedTower.position.y + selectedTower.range + 5} width="90" height="40" style={{textAlign: 'center'}}><button onClick={(e) => { e.stopPropagation(); handleSellTower(selectedTower.id); }} className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded shadow-lg hover:bg-rose-700 transition-colors">{t('sell')} ({Math.floor(getSellValue(selectedTower))})</button></foreignObject>)}
              
              {gameState === 'game_over' && (
                <g className={`transition-opacity duration-500 ${gameOverVisible ? 'opacity-100' : 'opacity-0'}`}>
                  <rect x="0" y="0" width={GAME_WIDTH} height={GAME_HEIGHT} fill="rgba(15, 23, 42, 0.8)"/>
                  <text x="50%" y="40%" dominantBaseline="middle" textAnchor="middle" fontSize="60" fontWeight="bold" fill="#f8fafc">{health > 0 ? t('victory') : t('game_over')}</text>
                  <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="24" fill="#94a3b8">{t('rp_earned', researchPointsEarned)}</text>
                </g>
              )}
          </svg>
           {gameState === 'game_over' && (
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${gameOverVisible ? 'opacity-100' : 'opacity-0'}`}>
              <button onClick={() => onGameEnd({ researchPointsEarned, victory: health > 0 })} className="mt-24 px-8 py-4 bg-cyan-500 text-white font-bold rounded-lg shadow-lg hover:bg-cyan-600 transition-all text-xl">{t('to_progression_tree')}</button>
            </div>
           )}
      </div>

      {currentBoss && currentBoss.nameKey && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-slate-900/80 border-2 border-slate-700 rounded-lg p-3 text-center shadow-2xl backdrop-blur-sm">
          <div className="text-xl font-bold text-rose-400 mb-2">{t(currentBoss.nameKey)}</div>
          <div className="w-full bg-slate-700 rounded-full h-5 border border-slate-600"><div className="bg-rose-600 h-full rounded-full transition-all duration-300" style={{width: `${(currentBoss.health / currentBoss.maxHealth) * 100}%`}}></div></div>
          <div className="text-xs mt-2 text-slate-400 flex justify-center space-x-4">
              <span>{t('armor')}: <span className="font-bold text-slate-200">{(currentBoss.armor! * 100).toFixed(0)}%</span></span>
              {Object.entries(currentBoss.resistances!).map(([type, value]) => (
                  <span key={type}>{t(type.toLowerCase())}: <span className={`font-bold ${value > 0 ? 'text-green-400' : 'text-red-400'}`}>{(value * 100).toFixed(0)}%</span></span>
              ))}
          </div>
      </div>}
    </div>
  );
};

export default Game;
