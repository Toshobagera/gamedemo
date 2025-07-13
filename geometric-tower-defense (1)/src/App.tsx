
import React, { useState, useCallback } from 'react';
import Game from './components/Game';
import ProgressionTree from './components/ProgressionTree';
import { useProgression } from './hooks/useProgression';
import { getTranslator, Language } from './i18n';

type View = 'menu' | 'game' | 'progression';

const App: React.FC = () => {
  const [view, setView] = useState<View>('menu');
  const [currentStage, setCurrentStage] = useState<number | null>(null);
  const [gameId, setGameId] = useState(1); // Key to force remount
  const [language, setLanguage] = useState<Language>('en');
  const [cheatCode, setCheatCode] = useState('');
  const progression = useProgression();

  const t = getTranslator(language);

  const handleCheatSubmit = useCallback(() => {
    if (cheatCode.toLowerCase() === 't0sh0bag3ra') {
      progression.addResearchPoints(20);
      setCheatCode('');
    } else {
      setCheatCode('');
    }
  }, [cheatCode, progression]);

  const handleGameEnd = useCallback((result: { researchPointsEarned: number; victory: boolean }) => {
    progression.addResearchPoints(result.researchPointsEarned);
    if (result.victory && currentStage !== null) {
      progression.completeStage(currentStage);
    }
    setView('progression');
  }, [progression, currentStage]);

  const handleStartGame = (stageIndex: number) => {
    setCurrentStage(stageIndex);
    setGameId(id => id + 1); // Increment key to force a new game instance
    setView('game');
  };

  const renderView = () => {
    switch (view) {
      case 'game':
        return <Game key={gameId} onGameEnd={handleGameEnd} progression={progression} stageIndex={currentStage!} t={t} />;
      case 'progression':
        return <ProgressionTree progression={progression} onStartGame={() => setView('menu')} t={t} />;
      case 'menu':
      default:
        const stage2Unlocked = progression.completedStages.includes(0);
        return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-slate-50 font-mono">
            <h1 className="text-6xl font-bold text-cyan-400 tracking-wider mb-4">Geometric TD</h1>
            <p className="text-slate-400 mb-8">{t('app_subtitle')}</p>
            <div className="flex flex-col space-y-4">
              <button
                onClick={() => handleStartGame(0)}
                className="px-8 py-3 bg-cyan-500 text-white font-bold rounded-lg shadow-lg hover:bg-cyan-600 transition-all duration-200 transform hover:scale-105"
              >
                {t('stage_1')}
              </button>
              <button
                onClick={() => stage2Unlocked && handleStartGame(1)}
                disabled={!stage2Unlocked}
                className={`px-8 py-3 text-white font-bold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 ${
                  stage2Unlocked
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-slate-700 cursor-not-allowed'
                }`}
                title={!stage2Unlocked ? t('stage_2_unlock_tooltip') : t('stage_2_tooltip')}
              >
                {t('stage_2')} {!stage2Unlocked && '🔒'}
              </button>
            </div>
            <div className="mt-8 flex space-x-4">
                 <button
                    onClick={() => setView('progression')}
                    className="px-8 py-3 bg-slate-700 text-slate-200 font-bold rounded-lg shadow-lg hover:bg-slate-600 transition-all duration-200"
                  >
                    {t('progression')}
                  </button>
                  <button
                    onClick={progression.resetProgression}
                    className="px-8 py-3 bg-rose-800 text-slate-200 font-bold rounded-lg shadow-lg hover:bg-rose-700 transition-all duration-200"
                  >
                    {t('reset_progress')}
                  </button>
            </div>
             <div className="absolute top-4 right-4 flex space-x-2">
                <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-sm font-bold rounded ${language === 'en' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'}`}>EN</button>
                <button onClick={() => setLanguage('bg')} className={`px-3 py-1 text-sm font-bold rounded ${language === 'bg' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300'}`}>BG</button>
            </div>
            <div className="absolute bottom-4 left-4 flex">
                <input
                    type="text"
                    value={cheatCode}
                    onChange={(e) => setCheatCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCheatSubmit(); }}
                    placeholder={t('enter_cheat_code')}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-l-md px-2 py-1 outline-none w-48"
                />
                <button
                    onClick={handleCheatSubmit}
                    className="bg-slate-700 text-slate-300 text-sm font-bold rounded-r-md px-3 py-1 border border-l-0 border-slate-700 hover:bg-slate-600"
                >
                    {t('submit_cheat')}
                </button>
            </div>
          </div>
        );
    }
  };

  return <div className="w-full h-full">{renderView()}</div>;
};

export default App;
