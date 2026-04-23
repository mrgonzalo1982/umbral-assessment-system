import React, { useState } from 'react';
import { ClipboardList, Plus, Trash2, Hash, Sparkles, X, ChevronRight, Info } from 'lucide-react';
import { parseRawRubric } from '../utils/rubricParser';

export default function RubricManager({ rubrics, onUpdateRubrics }) {
  const [activeType, setActiveType] = useState('group'); // 'group' or 'individual'
  const [showAiModal, setShowAiModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [importTarget, setImportTarget] = useState('both'); // 'group', 'individual', 'both'

  const handleAiImport = () => {
    if (!pastedText.trim()) return;
    const parsed = parseRawRubric(pastedText);
    
    let newRubrics = { ...rubrics };

    if (importTarget === 'group' || importTarget === 'both') {
      if (parsed.group.length > 0) newRubrics.group = parsed.group;
      else if (parsed.individual.length > 0 && importTarget === 'group') newRubrics.group = parsed.individual;
    }

    if (importTarget === 'individual' || importTarget === 'both') {
      if (parsed.individual.length > 0) newRubrics.individual = parsed.individual;
      else if (parsed.group.length > 0 && importTarget === 'individual') newRubrics.individual = parsed.group;
    }
    
    onUpdateRubrics(newRubrics);
    setShowAiModal(false);
    setPastedText('');
  };

  const addCriteria = (type) => {
    const newCriteria = {
      id: `cr_${Date.now()}`,
      title: 'Nuevo Criterio',
      weight: 1,
      desc: { 4: 'Excelente', 3: 'Bueno', 2: 'Suficiente', 1: 'Insuficiente' }
    };
    onUpdateRubrics({
      ...rubrics,
      [type]: [...rubrics[type], newCriteria]
    });
  };

  const updateCriteria = (type, id, updates) => {
    onUpdateRubrics({
      ...rubrics,
      [type]: rubrics[type].map(cr => cr.id === id ? { ...cr, ...updates } : cr)
    });
  };

  const removeCriteria = (type, id) => {
    onUpdateRubrics({
      ...rubrics,
      [type]: rubrics[type].filter(cr => cr.id !== id)
    });
  };

  const currentRubric = rubrics[activeType] || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex gap-4 p-1.5 bg-indigo-950/5 rounded-3xl w-fit backdrop-blur-xl border border-indigo-950/5">
        <button 
          onClick={() => setActiveType('group')}
          className={`px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeType === 'group' ? 'bg-indigo-950 shadow-xl text-white' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Rúbrica Grupal
        </button>
        <button 
          onClick={() => setActiveType('individual')}
          className={`px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeType === 'individual' ? 'bg-indigo-950 shadow-xl text-white' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Rúbrica Individual
        </button>
      </div>

      <div className="liquid-glass p-8">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-black text-indigo-950 flex items-center gap-4 italic tracking-tight capitalize">
            <ClipboardList className="text-rose-500" size={32} /> {activeType === 'group' ? 'Evaluación Grupal' : 'Evaluación Individual'}
          </h3>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowAiModal(true)}
              className="px-6 py-3 rounded-2xl text-xs font-black text-indigo-950 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-2 transition-all border border-indigo-100 uppercase tracking-widest"
            >
              <Sparkles size={16} className="text-rose-500" /> Importador IA
            </button>
            <button 
              onClick={() => addCriteria(activeType)}
              className="px-6 py-3 rounded-2xl bg-indigo-950 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-rose-500 hover:shadow-rose-500/20 transition-all"
            >
              <Plus size={18} /> Nuevo Criterio
            </button>
          </div>
        </div>

        {/* AI IMPORT MODAL */}
        {showAiModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
             <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-md" onClick={() => setShowAiModal(false)} />
             <div className="liquid-glass w-full max-w-5xl relative z-10 flex flex-col max-h-[90vh] shadow-[0_0_100px_rgba(0,0,0,0.3)] border-indigo-950/10">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-xl">
                   <div className="flex items-center gap-4">
                      <div className="bg-rose-500 p-3 rounded-2xl text-white shadow-xl">
                         <Sparkles size={24} />
                      </div>
                      <div>
                         <h4 className="font-black text-2xl text-indigo-950 tracking-tight leading-none italic">Importador Inteligente</h4>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Parser de Rúbricas v2.5</p>
                      </div>
                   </div>
                   <button onClick={() => setShowAiModal(false)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 transition-all">
                      <X size={24} />
                   </button>
                </div>
                
                <div className="p-10 overflow-y-auto bg-white/30 backdrop-blur-sm">
                    <div className="mb-10 flex flex-col md:flex-row gap-8">
                       <div className="flex-1">
                          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Destino de la Rúbrica</label>
                          <div className="flex gap-2 p-1.5 bg-indigo-950/5 rounded-3xl">
                             {[
                               { id: 'both', label: 'Auto (Ambas)' },
                               { id: 'group', label: 'Solo Grupal' },
                               { id: 'individual', label: 'Solo Individual' }
                             ].map(opt => (
                               <button 
                                 key={opt.id}
                                 onClick={() => setImportTarget(opt.id)}
                                 className={`flex-1 py-4 px-6 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all ${importTarget === opt.id ? 'bg-indigo-950 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                               >
                                 {opt.label}
                               </button>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="mb-8 bg-rose-50/50 border border-rose-100 p-6 rounded-[2.5rem] flex gap-5 italic text-rose-800 text-sm">
                       <Info size={24} className="shrink-0 text-rose-500" />
                       <div className="leading-relaxed">
                          Pega el texto de tu rúbrica. El sistema detectará automáticamente los <strong>Criterios</strong> y los descriptores para los niveles <strong>4, 3, 2 y 1</strong>. Funciona mejor con formato de lista o tabla.
                       </div>
                    </div>
                    
                    <textarea 
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      className="w-full h-[400px] p-10 rounded-[3rem] border-2 border-slate-100 focus:border-rose-500 focus:outline-none transition-all font-mono text-xs shadow-inner bg-white/40 leading-relaxed custom-scrollbar"
                      placeholder="Ejemplo:
CRITERIO: Grammar Accuracy
4 - 0-2 grammar/spelling errors...
3 - 3-4 errors...
2 - 5-6 errors...
1 - 7+ errors..."
                    />
                </div>

                <div className="p-8 border-t border-slate-100 flex justify-end items-center gap-6 bg-white/50 backdrop-blur-xl">
                   <button onClick={() => setShowAiModal(false)} className="text-xs font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest">Cancelar</button>
                   <button onClick={handleAiImport} className="px-12 py-5 rounded-[2.5rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-950/30 hover:bg-rose-500 transition-all flex items-center gap-4 active:scale-95">
                      Procesar Rúbrica <ChevronRight size={20} />
                   </button>
                </div>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {currentRubric.length === 0 ? (
            <div className="text-center py-20 text-slate-300 italic flex flex-col items-center">
               <ClipboardList size={64} className="opacity-10 mb-4" />
               <p className="font-bold">No hay criterios definidos</p>
               <button onClick={() => addCriteria(activeType)} className="mt-4 text-indigo-950 hover:text-rose-500 font-black text-[10px] uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-full">Crear Manualmente</button>
            </div>
          ) : (
            currentRubric.map((cr) => (
              <div key={cr.id} className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 group hover:border-rose-200 transition-all duration-500">
                <div className="flex gap-6 items-start mb-8">
                   <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-rose-500 shadow-sm group-hover:bg-rose-500 group-hover:text-white transition-all">
                      <Hash size={20} />
                   </div>
                   <div className="flex-1 space-y-3">
                    <input 
                      type="text" 
                      value={cr.title}
                      onChange={(e) => updateCriteria(activeType, cr.id, { title: e.target.value })}
                      className="w-full bg-transparent font-black text-2xl text-indigo-950 border-b-2 border-transparent hover:border-slate-200 focus:border-rose-500 focus:outline-none transition-all italic tracking-tighter"
                      placeholder="Título del Criterio"
                    />
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                       Factor de Peso:
                      <input 
                        type="number" 
                        value={cr.weight}
                        onChange={(e) => updateCriteria(activeType, cr.id, { weight: parseFloat(e.target.value) || 0 })}
                        className="w-16 bg-white border border-slate-200 rounded-xl px-3 py-1 text-indigo-950 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => removeCriteria(activeType, cr.id)}
                    className="p-3 text-slate-200 hover:text-rose-500 transition-colors bg-white rounded-2xl border border-slate-100 shadow-sm"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[4, 3, 2, 1].map(level => (
                    <div key={level} className="space-y-2">
                       <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${level === 4 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Logro • {level} pts</div>
                       </div>
                      <textarea 
                        value={cr.desc[level]}
                        onChange={(e) => updateCriteria(activeType, cr.id, { desc: { ...cr.desc, [level]: e.target.value } })}
                        className="w-full text-xs p-5 rounded-2xl border border-slate-100 bg-white min-h-[100px] focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-medium leading-relaxed custom-scrollbar shadow-inner"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
