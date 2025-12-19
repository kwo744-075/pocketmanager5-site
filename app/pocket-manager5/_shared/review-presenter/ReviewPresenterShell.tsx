// Review Presenter Shell - main workflow UI with stepper

"use client";

import React, { useState } from 'react';
import { WorkflowState, ScopeType } from './types';
import { UploadBox } from './components/UploadBox';
import { Mapper } from './components/Mapper';
import { PresetBuilder } from './components/PresetBuilder';
import { HeatGridView } from './views/HeatGridView';
import { RankingsView } from './views/RankingsView';
import { applyMapping, calculateRankings } from './ReviewPresenterEngine';

interface ReviewPresenterShellProps {
  mode: ScopeType;
}

const STEPS = [
  'Upload Excel',
  'Map Columns',
  'KPI & Goals',
  'Review Outputs',
  'Share/Export'
];

export function ReviewPresenterShell({ mode }: ReviewPresenterShellProps) {
  const [state, setState] = useState<WorkflowState>({
    step: 0,
    file: null,
    parsedData: [],
    mapping: {},
    selectedKPIs: [],
    preset: null,
    results: [],
    rankings: null,
  });

  const updateState = (updates: Partial<WorkflowState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (state.step === 2) {
      // Apply mapping and calculate results
      const results = applyMapping(state.parsedData, state.mapping, state.selectedKPIs);
      const rankings = calculateRankings(results);
      updateState({ results, rankings, step: state.step + 1 });
    } else {
      updateState({ step: state.step + 1 });
    }
  };

  const handlePrev = () => {
    updateState({ step: state.step - 1 });
  };

  const handleDataParsed = (data: any[], columns: string[]) => {
    updateState({ parsedData: data });
  };

  const renderStepContent = () => {
    switch (state.step) {
      case 0:
        return (
          <UploadBox
            onDataParsed={handleDataParsed}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <Mapper
            availableColumns={Object.keys(state.parsedData[0] || {})}
            mapping={state.mapping}
            selectedKPIs={state.selectedKPIs}
            onMappingChange={(mapping) => updateState({ mapping })}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        );
      case 2:
        return (
          <PresetBuilder
            availableColumns={Object.keys(state.parsedData[0] || {})}
            selectedKPIs={state.selectedKPIs}
            onKPIsChange={(kpis) => updateState({ selectedKPIs: kpis })}
            preset={state.preset}
            onPresetChange={(preset) => updateState({ preset })}
            mode={mode}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        );
      case 3:
        return (
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-white">Review Results</h2>
            <HeatGridView data={state.results} />
            {state.rankings && (
              <RankingsView
                districtRankings={state.rankings.districtRankings}
                overallRankings={state.rankings.overallRankings}
              />
            )}
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium mt-4 transition-colors"
              onClick={handleNext}
            >
              Next: Share/Export
            </button>
          </div>
        );
      case 4:
        return (
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-6 shadow-lg text-center">
            <h2 className="text-xl font-semibold mb-4 text-white">Share & Export</h2>
            <p className="text-slate-300 mb-6">PPT export functionality coming soon...</p>
            <button
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              onClick={() => setState({
                step: 0,
                file: null,
                parsedData: [],
                mapping: {},
                selectedKPIs: [],
                preset: null,
                results: [],
                rankings: null,
              })}
            >
              Start New Review
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-white">DM Review Presenter</h1>
          <p className="text-slate-400 mt-1">{mode} Mode</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex justify-between items-center mb-8">
          {STEPS.map((stepName, index) => (
            <div key={stepName} className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold mb-2 ${
                index <= state.step
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-400 border border-slate-600'
              }`}>
                {index + 1}
              </div>
              <span className={`text-sm text-center ${
                index <= state.step ? 'text-indigo-400 font-medium' : 'text-slate-500'
              }`}>
                {stepName}
              </span>
              {index < STEPS.length - 1 && (
                <>
                  <style>{`.rp-line-${index}{transform: translateX(50%); z-index: -1}`}</style>
                  <div className={`absolute top-5 left-1/2 w-full h-0.5 ${
                    index < state.step ? 'bg-indigo-600' : 'bg-slate-700'
                  } rp-line-${index}`} />
                </>
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-6">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}