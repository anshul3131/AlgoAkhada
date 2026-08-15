import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
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
  
  verdict: string;
  setVerdict: (v: string) => void;
  error: string | null;
  setError: (err: string | null) => void;
  
  activeTab: 'output' | 'tests' | 'opponent';
  setActiveTab: (t: 'output' | 'tests' | 'opponent') => void;
  
  showOpponentTab?: boolean;
  opponentStatus?: string;

  initialCode?: string | null;
  initialLanguage?: string | null;
}

export function CodeWorkspace({
  problemId,
  problem,
  languages,
  isSubmitting,
  isTimingOut = false,
  submitLabel = 'Submit Solution',
  onSubmit,
  verdict,
  setVerdict,
  error,
  setError,
  activeTab,
  setActiveTab,
  showOpponentTab = false,
  opponentStatus = '',
  initialCode,
  initialLanguage
}: CodeWorkspaceProps) {
  const [language, setLanguage] = useState('C++');
  const [codeMap, setCodeMap] = useState<Record<string, string>>(boilerplates);
  const code = codeMap[language] ?? boilerplates[language] ?? '';
  const setCode = (val: string) => setCodeMap(prev => ({ ...prev, [language]: val }));
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

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('hackerDark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0A0A0F', 
        'editor.lineHighlightBackground': '#13131A',
      }
    });
    monaco.editor.setTheme('hackerDark');
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
  const tabs = showOpponentTab ? ['tests', 'output', 'opponent'] : ['tests', 'output'];

  return (
    <div className="space-y-4">
      <GlowPanel className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 font-mono text-sm text-text-primary uppercase">
            {languages.length > 0 ? languages.map(lang => <option key={lang.id} value={lang.id}>{lang.name}</option>) : <option value="C++">C++</option>}
          </select>
          <Button variant="ghost" onClick={formatCode} className="px-3 text-xs">Beautify</Button>
          <Badge label={isSubmitting ? 'Evaluating' : 'Draft saved locally'} tone={isSubmitting ? 'warn' : 'primary'} />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={runCode} disabled={isRunning || isSubmitting || isTimingOut}>
            {isRunning ? 'Running...' : 'Run Code'}
          </Button>
          <Button variant="danger" onClick={() => onSubmit(language, code)} disabled={isSubmitting || isTimingOut}>
            {isTimingOut ? 'Resolving...' : isSubmitting ? 'Submitting...' : submitLabel}
          </Button>
        </div>
      </GlowPanel>
      
      <GlowPanel className="p-0 overflow-hidden min-h-[390px] border border-border-hairline">
          <Editor
            height="400px"
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
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${activeTab === tab ? 'border-accent-primary text-accent-primary' : 'border-border-hairline text-text-secondary'}`}
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
                        <div className="bg-bg-void p-2 rounded mb-2 overflow-x-auto"><pre>{sample.input}</pre></div>
                        <span className="text-text-primary text-xs">Expected Output</span>
                        <div className="bg-bg-void p-2 rounded overflow-x-auto"><pre>{sample.output}</pre></div>
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
                          className="w-full bg-bg-void border border-border-hairline rounded p-3 font-mono text-sm text-text-mono outline-none focus:border-accent-primary min-h-[100px]" 
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
            {error && <div className="mt-2 bg-bg-panel-raised p-4 rounded text-accent-danger font-mono text-xs overflow-x-auto whitespace-pre-wrap"><pre>{error}</pre></div>}
            
            {runResults && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border-hairline">
                      <span className={runResults.status.includes('Accepted') ? 'text-accent-primary' : 'text-accent-danger'}>
                        Verdict: {runResults.status}
                      </span>
                      <span className="text-text-secondary">Passed: {runResults.aggregated.passed}/{runResults.aggregated.total}</span>
                  </div>
                  
                  <div className="space-y-3">
                    {runResults.testCaseResults?.map((tc, idx) => (
                      <div key={idx} className={`rounded-lg border p-3 ${tc.status === 'Accepted' || tc.status === 'SUCCESS' ? 'border-accent-primary/30' : 'border-accent-danger/30'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs uppercase text-text-secondary tracking-widest">Test Case {idx + 1}</span>
                            <span className={`text-xs ${tc.status === 'Accepted' || tc.status === 'SUCCESS' ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {tc.status} · {tc.executionTimeMs}ms
                            </span>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-3 mt-2">
                            <div>
                              <span className="text-[10px] uppercase text-text-secondary mb-1 block">Your Output</span>
                              <div className="bg-bg-void p-2 rounded max-h-32 overflow-y-auto"><pre>{tc.output || 'No output'}</pre></div>
                            </div>
                            {tc.expectedOutput && (
                              <div>
                                <span className="text-[10px] uppercase text-text-secondary mb-1 block">Expected Output</span>
                                <div className="bg-bg-void p-2 rounded max-h-32 overflow-y-auto"><pre>{tc.expectedOutput}</pre></div>
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
