
import React, { useMemo } from 'react';
import { PROGRESSION_TREE } from '../constants';
import { UpgradeNode as UpgradeNodeType } from '../types';
import { ProgressionHook } from '../hooks/useProgression';
import { ResearchIcon } from './icons';

interface NodeProps {
  node: UpgradeNodeType;
  isUnlocked: boolean;
  canUnlock: boolean;
  onClick: (id: string) => void;
  t: (key: string) => string;
}

const Node: React.FC<NodeProps> = ({ node, isUnlocked, canUnlock, onClick, t }) => {
  const baseStyle = "absolute w-24 h-24 p-2 border-2 rounded-lg flex flex-col items-center justify-center text-center transform transition-all duration-300";
  const stateStyle = isUnlocked
    ? "bg-cyan-500 border-cyan-300 shadow-lg shadow-cyan-500/30"
    : canUnlock
    ? "bg-slate-600 border-slate-400 hover:bg-cyan-700 hover:border-cyan-500 cursor-pointer"
    : "bg-slate-800 border-slate-700 opacity-60";

  return (
    <div
      style={{ left: `calc(${node.position.x}% - 48px)`, top: `calc(${node.position.y}% - 48px)` }}
      className={`${baseStyle} ${stateStyle}`}
      onClick={() => canUnlock && onClick(node.id)}
    >
      <div className="text-xs font-bold leading-tight">{t(node.nameKey)}</div>
      <div className="text-[10px] text-slate-300 mt-1 leading-tight">{t(node.descriptionKey)}</div>
      {!isUnlocked && node.cost > 0 && (
         <div className="absolute -bottom-5 flex items-center text-sm font-bold bg-slate-900 px-2 py-1 rounded-full border border-slate-700">
            <ResearchIcon className="w-4 h-4 mr-1 text-yellow-400" />
            <span className="text-yellow-300">{node.cost}</span>
        </div>
      )}
    </div>
  );
};

interface ProgressionTreeProps {
  progression: ProgressionHook;
  onStartGame: () => void;
  t: (key: string) => string;
}

const ProgressionTree: React.FC<ProgressionTreeProps> = ({ progression, onStartGame, t }) => {
  const { researchPoints, unlockedUpgrades, unlockUpgrade } = progression;

  const nodes = useMemo(() => {
    return PROGRESSION_TREE.map(node => {
      const isUnlocked = unlockedUpgrades.includes(node.id);
      const dependenciesMet = node.dependencies.every(depId => unlockedUpgrades.includes(depId));
      const canUnlock = !isUnlocked && dependenciesMet && researchPoints >= node.cost;
      return { ...node, isUnlocked, canUnlock };
    });
  }, [unlockedUpgrades, researchPoints]);

  const nodeMap = useMemo(() => {
      const map = new Map<string, UpgradeNodeType>();
      PROGRESSION_TREE.forEach(node => map.set(node.id, node));
      return map;
  }, []);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-slate-900 font-mono p-4 overflow-x-hidden">
      <div className="w-full max-w-screen-xl">
        <div className="flex justify-between items-center mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <div>
                <h1 className="text-3xl font-bold text-cyan-400">{t('progression_tree_title')}</h1>
                <p className="text-slate-400">{t('progression_tree_subtitle')}</p>
            </div>
            <div className="flex items-center space-x-6">
                <div className="flex items-center bg-slate-700 px-4 py-2 rounded-lg">
                    <ResearchIcon className="w-8 h-8 mr-3 text-yellow-400"/>
                    <span className="text-3xl font-bold text-yellow-300">{researchPoints}</span>
                </div>
                 <button onClick={onStartGame} className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg shadow-lg hover:bg-green-600 transition-all duration-200 transform hover:scale-105">
                    {t('start_game')}
                </button>
            </div>
        </div>
      
        <div className="relative w-full h-[140vh] bg-slate-800/50 border-2 border-slate-700 rounded-lg">
          <svg className="absolute inset-0 w-full h-full" width="100%" height="100%">
            <defs>
                <marker id="arrow-unlocked" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                </marker>
                <marker id="arrow-locked" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
            </defs>
            {nodes.map(node =>
              node.dependencies.map(depId => {
                const parent = nodeMap.get(depId);
                if (!parent) return null;
                const isUnlocked = unlockedUpgrades.includes(node.id);
                const fromX = `${parent.position.x}%`;
                const fromY = `${parent.position.y}%`;
                const toX = `${node.position.x}%`;
                const toY = `${node.position.y}%`;
                
                return (
                    <line
                      key={`${depId}-${node.id}`}
                      x1={fromX} y1={fromY} x2={toX} y2={toY}
                      stroke={isUnlocked ? "#06b6d4" : "#64748b"}
                      strokeWidth="3"
                      markerEnd={isUnlocked ? "url(#arrow-unlocked)" : "url(#arrow-locked)"}
                    />
                );
              })
            )}
          </svg>
          {nodes.map(node => (
            <Node
              key={node.id}
              node={node}
              isUnlocked={node.isUnlocked}
              canUnlock={node.canUnlock}
              onClick={unlockUpgrade}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressionTree;
