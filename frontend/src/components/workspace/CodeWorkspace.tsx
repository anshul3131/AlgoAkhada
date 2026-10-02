import { Sun, Moon } from "lucide-react";

import { useState, useRef, useEffect } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { useTheme } from '../../hooks/useTheme';
import js_beautify from 'js-beautify';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { GlowPanel } from '../shared/GlowPanel';
import { executionApi, type ProblemRecord, type LanguageRecord, type ExecutionResponse } from '../../lib/api';

export const boilerplates: Record<string, string> = {
  'C++': `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your solution\n    return 0;\n}`,
  'PYTHON': `def solve():\n    # your solution\n    pass\n\nif __name__ == '__main__':\n    solve()`,
};

interface CodeWorkspaceProps {
  problemId: string;
  problem: ProblemRecord | null;
  languages: LanguageRecord[];
  
  isSubmitting: boolean;
  isTimingOut?: boolean;
  submitLabel?: string;
  onSubmit: (language: string, code: string) => void;
  onCodeChange?: (code: string, language: string) => void;
  
  verdict: string;
  setVerdict: (v: string) => void;
  error: string | null;
  setError: (err: string | null) => void;
  
  activeTab: 'output' | 'tests' | 'opponent' | 'rankings';
  setActiveTab: (t: 'output' | 'tests' | 'opponent' | 'rankings') => void;
  
  showOpponentTab?: boolean;
  opponentStatus?: string;
  leaderboard?: any[];

  initialCode?: string | null;
  initialLanguage?: string | null;
}

export function CodeWorkspace({
  problemId,
  problem,
  languages,
  isSubmitting,
  isTimingOut = false,
  submitLabel = 'Submit',
  onSubmit,
  onCodeChange,
  verdict,
  setVerdict,
  error,
  setError,
  activeTab,
  setActiveTab,
  showOpponentTab = false,
  opponentStatus = 'Waiting',
  leaderboard = undefined,
  initialCode,
  initialLanguage
}: CodeWorkspaceProps) {
  const [language, setLanguage] = useState('C++');
  const [codeMap, setCodeMap] = useState<Record<string, string>>(boilerplates);
  const code = codeMap[language] ?? boilerplates[language] ?? '';
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCode = (val: string) => { 
    setCodeMap(prev => ({ ...prev, [language]: val })); 
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onCodeChange?.(val, language);
    }, 500);
  };
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (initialLanguage && initialCode) {
      setLanguage(initialLanguage);
      setCodeMap(prev => ({ ...prev, [initialLanguage]: initialCode }));
    }
  }, [initialCode, initialLanguage]);

  const [testMode, setTestMode] = useState<'samples' | 'custom'>('samples');
  const [customInputs, setCustomInputs] = useState<string[]>(['']);
  const [runResults, setRunResults] = useState<ExecutionResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { isDark } = useTheme();

  const defineThemes = (monaco: Monaco) => {
    monaco.editor.defineTheme('algo-dark', {
      base: 'vs-dark', inherit: true, rules: [],
      colors: {
        'editor.background': '#13131A',
        'editorGutter.background': '#13131A',
        'editor.lineHighlightBackground': '#1B1B25',
        'editorLineNumber.foreground': '#4A4A5C',
        'editorCursor.foreground': '#00FF9C',
        'editor.selectionBackground': '#00FF9C30',
      },
    });
    monaco.editor.defineTheme('algo-light', {
      base: 'vs', inherit: true, rules: [],
      colors: {
        'editor.background': '#FFFFFF',
        'editorGutter.background': '#FFFFFF',
        'editor.lineHighlightBackground': '#F6F8FA',
        'editorLineNumber.foreground': '#8C959F',
        'editorCursor.foreground': '#059669',
        'editor.selectionBackground': '#05966928',
      },
    });
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const formatCode = () => {
    if (!editorRef.current) return;
    const action = editorRef.current.getAction('editor.action.formatDocument');
    if (action && action.isSupported()) {
      action.run();
    } else {
      const formatted = js_beautify(code, { indent_size: 4, space_in_empty_paren: true });
      setCode(formatted);
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setError(null);
    setRunResults(null);
    setActiveTab('output');
    try {
      const response = await executionApi.executeCode({
        problemId,
        language,
        code,
        runMode: testMode,
        sampleIds: testMode === 'samples' && problem?.samples ? problem.samples.map(s => s.id) : undefined,
        inputs: testMode === 'custom' ? customInputs.filter(i => i.trim() !== '') : undefined,
      });
      setRunResults(response);
      
      if (response.compileError) {
        setError(response.compileError);
      }

      if (testMode === 'custom' && customInputs.every(i => i.trim() === '')) {
         setError("Please enter at least one custom input.");
         setRunResults(null);
      }
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setIsRunning(false);
    }
  };

  const monacoLanguage = language.toLowerCase() === 'python' ? 'python' : 'cpp';
  const tabs = leaderboard ? ['tests', 'output', 'rankings'] : (showOpponentTab ? ['tests', 'output', 'opponent'] : ['tests', 'output']);

  return (
    <div className="space-y-4">
      <GlowPanel className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="appearance-none w-28 rounded-md pl-3 pr-8 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest border border-border-strong bg-bg-panel text-text-primary hover:border-text-muted hover:bg-bg-hover transition-all cursor-pointer outline-none focus:border-accent shadow-sm">
              {languages.length > 0 ? languages.map(lang => <option key={lang.id} value={lang.id}>{lang.name}</option>) : <option value="C++">C++</option>}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-secondary">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          <button onClick={formatCode} className="rounded-md px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest border border-border-strong bg-bg-panel text-text-secondary hover:text-text-primary hover:border-text-muted hover:bg-bg-hover transition-all">BEAUTIFY</button>
          
          {isSubmitting && <Badge label="Evaluating" tone="warn" />}
        </div>
        <div className="flex gap-2">
          <button onClick={runCode} disabled={isRunning || isSubmitting || isTimingOut} className="rounded-md px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest border border-border-strong bg-bg-panel text-text-secondary hover:text-text-primary hover:border-text-muted hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {isRunning ? 'Running...' : 'Run Code'}
          </button>
          <button onClick={() => { setRunResults(null); onSubmit(language, code); }} disabled={isSubmitting || isTimingOut} className="rounded-md px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest border border-border-strong bg-bg-panel text-text-secondary hover:text-text-primary hover:border-text-muted hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {isTimingOut ? 'Resolving...' : isSubmitting ? 'Submitting...' : submitLabel}
          </button>
        </div>
      </GlowPanel>
      
      <GlowPanel className="p-0 overflow-hidden min-h-[390px] border border-border-hairline">
          <Editor
            height="400px"
            beforeMount={defineThemes}
            theme={isDark ? 'algo-dark' : 'algo-light'}
            language={monacoLanguage}
            value={code}
            onChange={(val) => setCode(val || '')}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontLigatures: true,
              padding: { top: 16 },
              scrollBeyondLastLine: false,
            }}
          />
      </GlowPanel>
      
      <GlowPanel>
        <div className="mb-4 flex gap-2">
          {tabs.map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab as any)} 
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${activeTab === tab ? 'border-b-2 border-accent text-text-primary bg-bg-elevated' : 'border-transparent text-text-muted hover:text-text-primary'}`}
            >
              {tab === 'tests' ? 'Test Cases' : tab === 'output' ? 'Run Results' : 'Opponent'}
            </button>
          ))}
        </div>

        {activeTab === 'tests' && (
          <div className="space-y-4">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setTestMode('samples')} className={`text-xs uppercase tracking-widest ${testMode === 'samples' ? 'text-accent-primary' : 'text-text-secondary'}`}>Samples</button>
                <span className="text-border-hairline">|</span>
                <button onClick={() => setTestMode('custom')} className={`text-xs uppercase tracking-widest ${testMode === 'custom' ? 'text-accent-primary' : 'text-text-secondary'}`}>Custom Input</button>
              </div>
              
              {testMode === 'samples' && (
                <div className="space-y-3 font-mono text-sm text-text-secondary">
                  {problem?.samples && problem.samples.length > 0 ? problem.samples.map((sample, i) => (
                    <div key={sample.id} className="rounded-lg border border-border-hairline p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-text-primary">Sample {i + 1}</span>
                          <button className="text-xs text-accent-electric hover:text-white" onClick={() => navigator.clipboard.writeText(sample.input)}>Copy Input</button>
                        </div>
                        <div className="bg-bg-elevated transition-colors duration-300 p-2 rounded mb-2 overflow-x-auto"><pre>{sample.input}</pre></div>
                        <span className="text-text-primary text-xs">Expected Output</span>
                        <div className="bg-bg-elevated transition-colors duration-300 p-2 rounded overflow-x-auto"><pre>{sample.output}</pre></div>
                    </div>
                  )) : <p>No samples available.</p>}
                </div>
              )}

              {testMode === 'custom' && (
                <div className="space-y-3">
                  {customInputs.map((input, index) => (
                    <div key={index} className="flex flex-col gap-2 relative">
                        <div className="flex justify-between">
                          <span className="font-mono text-xs text-text-secondary">Testcase {index + 1}</span>
                          {customInputs.length > 1 && (
                            <button onClick={() => setCustomInputs(prev => prev.filter((_, i) => i !== index))} className="text-accent-danger text-xs uppercase">Remove</button>
                          )}
                        </div>
                        <textarea 
                          value={input} 
                          onChange={(e) => {
                            const newInputs = [...customInputs];
                            newInputs[index] = e.target.value;
                            setCustomInputs(newInputs);
                          }}
                          className="w-full bg-bg-elevated transition-colors duration-300 border border-border-hairline rounded p-3 font-mono text-sm text-text-mono outline-none focus:border-accent-primary min-h-[100px]" 
                          placeholder="Enter test case input..."
                        />
                    </div>
                  ))}
                  <Button variant="ghost" onClick={() => setCustomInputs([...customInputs, ''])} className="w-full text-xs">+ Add Testcase</Button>
                </div>
              )}
          </div>
        )}

        {activeTab === 'output' && (
          <div className="font-mono text-sm">
            {!runResults && !error && !isSubmitting && <span className="text-text-secondary">{verdict}</span>}
            {isSubmitting && <span className="text-accent-warn">Running against hidden tests...</span>}
            {error && <div className="mt-2 bg-bg-elevated transition-colors duration-300 p-4 rounded text-accent-danger font-mono text-xs overflow-x-auto whitespace-pre-wrap"><pre>{error}</pre></div>}
            
            {runResults && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border-hairline">
                      <span className={runResults.status.includes('Accepted') ? 'text-success font-bold' : 'text-danger font-bold'}>
                        Verdict: {runResults.status}
                      </span>
                      <span className="text-text-secondary">Passed: {runResults.aggregated.passed}/{runResults.aggregated.total}</span>
                  </div>
                  
                  <div className="space-y-3">
                    {runResults.testCaseResults?.map((tc, idx) => (
                      <div key={idx} className={`rounded-lg border p-3 ${tc.status === 'Accepted' || tc.status === 'SUCCESS' ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs uppercase text-text-secondary tracking-widest">Test Case {idx + 1}</span>
                            <span className={`text-xs ${tc.status === 'Accepted' || tc.status === 'SUCCESS' ? 'text-success' : 'text-danger'}`}>
                              {tc.status} · {tc.executionTimeMs}ms
                            </span>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-3 mt-2">
                            <div>
                              <span className="text-[10px] uppercase text-text-secondary mb-1 block">Your Output</span>
                              <div className="bg-bg-elevated transition-colors duration-300 p-2 rounded max-h-32 overflow-y-auto"><pre>{tc.output || 'No output'}</pre></div>
                            </div>
                            {tc.expectedOutput && (
                              <div>
                                <span className="text-[10px] uppercase text-text-secondary mb-1 block">Expected Output</span>
                                <div className="bg-bg-elevated transition-colors duration-300 p-2 rounded max-h-32 overflow-y-auto"><pre>{tc.expectedOutput}</pre></div>
                              </div>
                            )}
                          </div>
                      </div>
                    ))}
                  </div>
                </div>
            )}
          </div>
        )}

        {activeTab === 'opponent' && showOpponentTab && <div className="font-mono text-sm text-text-secondary">Opponent status: <span className="text-accent-primary">{opponentStatus}</span></div>}
      </GlowPanel>
    </div>
  );
}
