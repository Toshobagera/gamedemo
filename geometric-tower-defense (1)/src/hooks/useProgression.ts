
import { useState, useEffect, useCallback, useMemo } from 'react';
import { TOWER_STATS, INITIAL_MONEY, PROGRESSION_TREE, INITIAL_PLAYER_HEALTH } from '../constants';
import { UpgradeNode, TowerType } from '../types';

const PROGRESSION_KEY = 'geometric_td_progression';

interface ProgressionState {
  researchPoints: number;
  unlockedUpgrades: string[];
  completedStages: number[];
}

const getInitialState = (): ProgressionState => {
  try {
    const saved = localStorage.getItem(PROGRESSION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const upgrades = new Set<string>(Array.isArray(parsed.unlockedUpgrades) ? parsed.unlockedUpgrades : []);
      upgrades.add('ROOT');
      return {
        researchPoints: parsed.researchPoints || 0,
        unlockedUpgrades: Array.from(upgrades),
        completedStages: Array.isArray(parsed.completedStages) ? parsed.completedStages : [],
      };
    }
  } catch (error) {
    console.error("Failed to load progression:", error);
  }
  return { researchPoints: 0, unlockedUpgrades: ['ROOT'], completedStages: [] };
};

export const useProgression = () => {
  const [state, setState] = useState<ProgressionState>(getInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESSION_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save progression:", error);
    }
  }, [state]);

  const addResearchPoints = useCallback((amount: number) => {
    setState(s => ({ ...s, researchPoints: s.researchPoints + amount }));
  }, []);

  const unlockUpgrade = useCallback((upgradeId: string) => {
    const upgrade = PROGRESSION_TREE.find(u => u.id === upgradeId);
    if (!upgrade) return;

    if (state.researchPoints >= upgrade.cost && !state.unlockedUpgrades.includes(upgradeId)) {
      setState(s => ({
        ...s,
        researchPoints: s.researchPoints - upgrade.cost,
        unlockedUpgrades: [...s.unlockedUpgrades, upgradeId],
      }));
    }
  }, [state.researchPoints, state.unlockedUpgrades]);
  
  const completeStage = useCallback((stageIndex: number) => {
    setState(s => {
        if (s.completedStages.includes(stageIndex)) {
            return s; // No change needed
        }
        return {
            ...s,
            completedStages: [...s.completedStages, stageIndex].sort(),
        };
    });
  }, []);

  const resetProgression = useCallback(() => {
     const freshState = { researchPoints: 0, unlockedUpgrades: ['ROOT'], completedStages: [] };
     setState(freshState);
     localStorage.setItem(PROGRESSION_KEY, JSON.stringify(freshState));
     window.location.reload();
  },[]);

  const progressionMods = useMemo(() => {
    let startMoney = INITIAL_MONEY;
    let killBonus = 0;
    let startHealth = INITIAL_PLAYER_HEALTH;
    let towerCostModifier = 1.0;
    let sellRatioModifier = 0;
    let projectileSpeedModifier = 1.0;
    let researchPointModifier = 1.0;
    let globalCritChance = 0;
    let globalCritDamage = 0.5; // Base crit damage bonus is 50%
    const unlockedTowers = new Set<TowerType>(['CIRCLE']);
    const modifiedTowerStats = JSON.parse(JSON.stringify(TOWER_STATS));

    const unlockedNodes = state.unlockedUpgrades
        .map(id => PROGRESSION_TREE.find(u => u.id === id))
        .filter((u): u is UpgradeNode => !!u);

    let totalPointsSpent = 0;

    for (const upgrade of unlockedNodes) {
        if(upgrade.id !== 'ROOT') totalPointsSpent += upgrade.cost;
        
        // Handle unlocks from GLOBAL type nodes
        switch(upgrade.id) {
            case 'S_UNLOCK':
                unlockedTowers.add('SQUARE');
                break;
            case 'T_UNLOCK':
                unlockedTowers.add('TRIANGLE');
                break;
            case 'EL_UNLOCK_FIRE':
                unlockedTowers.add('FIRE');
                break;
            case 'EL_UNLOCK_COLD':
                unlockedTowers.add('COLD');
                break;
            case 'EL_UNLOCK_ELEC':
                unlockedTowers.add('ELECTRIC');
                break;
        }

        // Handle econ/global mods
        if (upgrade.type === 'ECONOMY' || upgrade.type === 'GLOBAL') {
            if(upgrade.globalStat === 'startMoney') startMoney += upgrade.value ?? 0;
            if(upgrade.globalStat === 'killBonus') killBonus += upgrade.value ?? 0;
            if(upgrade.globalStat === 'startHealth') startHealth += upgrade.value ?? 0;
            if(upgrade.globalStat === 'towerCostModifier') towerCostModifier *= upgrade.value ?? 1;
            if(upgrade.globalStat === 'sellRatioModifier') sellRatioModifier += upgrade.value ?? 0;
            if(upgrade.globalStat === 'projectileSpeedModifier') projectileSpeedModifier *= upgrade.value ?? 1;
            if(upgrade.globalStat === 'researchPointModifier') researchPointModifier *= upgrade.value ?? 1;
            if(upgrade.globalStat === 'globalCritChance') globalCritChance += upgrade.value ?? 0;
            if(upgrade.globalStat === 'globalCritDamage') globalCritDamage += upgrade.value ?? 0;
        }
    }
    
    // Apply TOWER_MODs
    for (const upgrade of unlockedNodes) {
        if (upgrade.type === 'TOWER_MOD' && upgrade.tower && upgrade.stat && upgrade.value != null) {
            const tower = modifiedTowerStats[upgrade.tower];
            if(tower) {
                if (upgrade.stat === 'burnDps' && tower.burn) {
                    tower.burn.dps += upgrade.value;
                } else if (upgrade.stat === 'burnDuration' && tower.burn) {
                    tower.burn.duration += upgrade.value;
                } else if (upgrade.stat === 'chainCount' && tower.chain) {
                    tower.chain.initialCount += upgrade.value;
                } else if (upgrade.stat === 'slowFactor' && tower.slowFactor !== undefined) {
                    tower.slowFactor += upgrade.value;
                } else {
                    const stat = upgrade.stat as keyof typeof tower;
                    if (typeof tower[stat] === 'number') {
                        if (upgrade.operation === 'multiply') {
                            (tower[stat] as number) *= upgrade.value;
                        } else {
                            (tower[stat] as number) += upgrade.value;
                        }
                    }
                }
            }
        }
    }
    
    // Apply global cost modifier at the end
    for (const towerKey in modifiedTowerStats) {
        modifiedTowerStats[towerKey as TowerType].cost *= towerCostModifier;
    }

    // Calculate boss modifiers based on spent points
    const bossModifiers = {
        armor: Math.min(0.5, totalPointsSpent * 0.005), // +0.5% armor per point, capped at 50%
        resistance: Math.min(0.5, totalPointsSpent * 0.002), // +0.2% resistance per point, capped at 50%
    };

    return {
        modifiedTowerStats,
        gameSettings: {
            startMoney,
            killBonus,
            startHealth,
            unlockedTowers: Array.from(unlockedTowers),
            sellRatioModifier,
            projectileSpeedModifier,
            researchPointModifier,
            globalCritChance,
            globalCritDamage,
        },
        bossModifiers,
    }
  }, [state.unlockedUpgrades]);


  return { ...state, addResearchPoints, unlockUpgrade, resetProgression, completeStage, ...progressionMods };
};

export type ProgressionHook = ReturnType<typeof useProgression>;
