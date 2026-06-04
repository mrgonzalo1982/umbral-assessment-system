import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Trash2, 
  Plus, 
  ChevronRight, 
  CheckCircle, 
  ShieldCheck, 
  Info, 
  LayoutGrid,
  ChevronLeft,
  UserPlus,
  Pencil,
  ChevronRightCircle,
  Eye,
  EyeOff,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateChileanMark } from '../utils/grading';

export default function AssessmentEngine({ students, rubrics, assessments, onUpdateAssessments, selectedCourse, evaluationType = 'grupal-individual', skill = '' }) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [hoverInfo, setHoverInfo] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [showRoster, setShowRoster] = useState(true);
  const [generatingAI, setGeneratingAI] = useState({});

  // --- Logic ---
  const handleGenerateAI = async (targetId, isGroup = false) => {
    try {
      setGeneratingAI(prev => ({ ...prev, [targetId]: true }));
      const apiKey = localStorage.getItem('gemini_api_key') || 'AIzaSyAE8SoWQnBU-Lle69VxdHT0cnXO4vQVJLw';
      
      let contextInfo = {};
      if (isGroup) {
        const group = assessments?.groups?.find(g => g.id === targetId);
        const gScores = assessments?.groupScores?.[targetId] || {};
        const strengths = rubrics.group.filter(cr => gScores[cr.id] === 4).map(c => c.title);
        const weaknesses = rubrics.group.filter(cr => gScores[cr.id] <= 2).map(c => c.title);
        
        contextInfo = {
          name: `Grupo: ${group?.name || 'Desconocido'}`,
          score: getScoreTotal('group', targetId),
          maxScore: getMaxScore('group'),
          strengths,
          weaknesses,
          teacherNotes: assessments?.groupObservations?.[targetId] || ''
        };
      } else {
        const student = students.find(s => s.id === targetId);
        const iScores = assessments?.individualScores?.[targetId] || {};
        const strengths = rubrics.individual.filter(cr => iScores[cr.id] === 4).map(c => c.title);
        const weaknesses = rubrics.individual.filter(cr => iScores[cr.id] <= 2).map(c => c.title);
        
        contextInfo = {
          name: student?.name || 'Estudiante',
          score: getScoreTotal('individual', targetId),
          maxScore: getMaxScore('individual'),
          strengths,
          weaknesses,
          teacherNotes: assessments?.observations?.[targetId] || ''
        };
      }

      const { generateFeedbackAI } = await import('../lib/gemini');
      const text = await generateFeedbackAI(contextInfo, apiKey);
      
      if (isGroup) setGroupObservation(targetId, text);
      else setObservation(targetId, text);
      
    } catch (e) {
      alert("Error con IA: " + e.message);
    } finally {
      setGeneratingAI(prev => ({ ...prev, [targetId]: false }));
    }
  };
  const filteredGroups = useMemo(() => {
    const groups = assessments?.groups || [];
    if (!Array.isArray(groups)) return [];
    return groups.filter(g => g?.curso === selectedCourse);
  }, [assessments, selectedCourse]);

  const currentGroupIndex = filteredGroups.findIndex(g => g?.id === selectedGroupId);
  const nextGroup = filteredGroups[currentGroupIndex + 1];
  const prevGroup = filteredGroups[currentGroupIndex - 1];

  const currentGroup = (assessments?.groups || []).find(g => g?.id === selectedGroupId);
  const groupMembers = (students || []).filter(s => assessments?.studentGroups?.[s?.id] === selectedGroupId);
  const unassignedStudents = (students || []).filter(s => !assessments?.studentGroups?.[s?.id]);

  // Auto-hide roster if empty
  useEffect(() => {
    if (unassignedStudents.length === 0 && showRoster) {
       setShowRoster(false); // Only auto-hide if it was visible
    }
  }, [unassignedStudents.length]);

  const getScoreColor = (lvl, isSelected) => {
    if (!isSelected) return 'bg-white border-slate-100 text-slate-300 hover:border-slate-300 hover:text-slate-500';
    switch(lvl) {
      case 4: return 'bg-blue-600 border-blue-700 text-white shadow-xl shadow-blue-600/20';
      case 3: return 'bg-emerald-500 border-emerald-600 text-white shadow-xl shadow-emerald-500/20';
      case 2: return 'bg-amber-500 border-amber-600 text-white shadow-xl shadow-amber-500/20';
      case 1: return 'bg-rose-500 border-rose-600 text-white shadow-xl shadow-rose-500/20';
      default: return 'bg-slate-300';
    }
  };

  const renameGroup = (id) => {
    const group = (assessments?.groups || []).find(g => g.id === id);
    const newName = prompt('Nuevo nombre del grupo:', group?.name || 'Nuevo Grupo');
    if (!newName) return;
    onUpdateAssessments({ ...assessments, groups: (assessments?.groups || []).map(g => g.id === id ? { ...g, name: newName } : g) });
  };

  const removeGroup = (id) => {
    const newGroups = (assessments?.groups || []).filter(g => g.id !== id);
    const newStudentGroups = { ...(assessments?.studentGroups || {}) };
    Object.keys(newStudentGroups).forEach(sid => { if (newStudentGroups[sid] === id) delete newStudentGroups[sid]; });
    onUpdateAssessments({ ...assessments, groups: newGroups, studentGroups: newStudentGroups });
  };

  const removeFromGroup = (studentId) => {
    const newStudentGroups = { ...(assessments?.studentGroups || {}) };
    delete newStudentGroups[studentId];
    onUpdateAssessments({ ...assessments, studentGroups: newStudentGroups });
  };

  const generateRandomGroups = (size) => {
    if (!size || isNaN(size) || size < 1) {
      alert("Por favor ingresa un número de estudiantes válido (mayor a 0).");
      return;
    }
    const pool = [...unassignedStudents].sort(() => Math.random() - 0.5);
    const newGroups = [...(assessments?.groups || [])];
    const newStudentGroups = { ...(assessments?.studentGroups || {}) };

    while (pool.length > 0) {
      const chunk = pool.splice(0, size);
      const gid = `g_${Date.now()}_${Math.random()}`;
      newGroups.push({ id: gid, name: `Grupo ${newGroups.length + 1}`, curso: selectedCourse });
      chunk.forEach(s => { newStudentGroups[s.id] = gid; });
    }
    onUpdateAssessments({ ...assessments, groups: newGroups, studentGroups: newStudentGroups });
  };

  const toggleStudentSelection = (id) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  };

  const addSelectionToGroup = (groupId) => {
    if (selectedStudentIds.length === 0) return;
    const newStudentGroups = { ...(assessments?.studentGroups || {}) };
    selectedStudentIds.forEach(sid => { newStudentGroups[sid] = groupId; });
    onUpdateAssessments({ ...assessments, studentGroups: newStudentGroups });
    setSelectedStudentIds([]);
  };

  const createGroupFromSelection = () => {
    if (selectedStudentIds.length === 0) return;
    const gid = `g_${Date.now()}`;
    const newGroups = [...(assessments?.groups || []), { id: gid, name: `Grupo ${(assessments?.groups?.length || 0) + 1}`, curso: selectedCourse }];
    const newStudentGroups = { ...(assessments?.studentGroups || {}) };
    selectedStudentIds.forEach(sid => { newStudentGroups[sid] = gid; });
    onUpdateAssessments({ ...assessments, groups: newGroups, studentGroups: newStudentGroups });
    setSelectedStudentIds([]);
  };

  const setScore = (type, targetId, criteriaId, val) => {
    const scoreKey = type === 'group' ? 'groupScores' : 'individualScores';
    const currentScores = assessments?.[scoreKey] || {};
    onUpdateAssessments({
      ...assessments,
      [scoreKey]: {
        ...currentScores,
        [targetId]: { ...(currentScores[targetId] || {}), [criteriaId]: val }
      }
    });
  };

  const setObservation = (studentId, obs) => {
    onUpdateAssessments({
      ...assessments,
      observations: {
        ...(assessments?.observations || {}),
        [studentId]: obs
      }
    });
  };

  const setGroupObservation = (groupId, obs) => {
    onUpdateAssessments({
      ...assessments,
      groupObservations: {
        ...(assessments?.groupObservations || {}),
        [groupId]: obs
      }
    });
  };

  const getScoreTotal = (type, targetId) => {
    const scoreKey = type === 'group' ? 'groupScores' : 'individualScores';
    const scores = assessments?.[scoreKey]?.[targetId];
    if (!scores) return 0;
    const rubric = type === 'group' ? rubrics.group : rubrics.individual;
    return (rubric || []).reduce((t, cr) => t + ((scores[cr.id] || 0) * cr.weight), 0);
  };

  const getMaxScore = (type) => {
    const rubric = type === 'group' ? rubrics.group : rubrics.individual;
    return (rubric || []).reduce((t, cr) => t + (4 * cr.weight), 0);
  };

  if (evaluationType === 'individual') {
    return (
      <div className="flex flex-col gap-8 min-h-[800px] pb-32">
        <div className="flex-1 space-y-8">
          <div className="bg-white/50 p-8 rounded-[2rem] backdrop-blur-xl border border-white/50 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="bg-indigo-950 p-4 rounded-2xl text-white shadow-lg"><Users size={24} /></div>
              <div>
                <h3 className="text-3xl font-black text-indigo-950 italic tracking-tighter">Evaluación Individual</h3>
                {skill && <span className="text-[10px] font-black uppercase text-indigo-950/40 tracking-[0.2em]">{skill}</span>}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Progreso Total</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${(students.filter(s => Object.keys(assessments?.individualScores?.[s.id] || {}).length > 0).length / students.length) * 100}%` }} />
                </div>
                <span className="text-xs font-black text-rose-500">{students.filter(s => Object.keys(assessments?.individualScores?.[s.id] || {}).length > 0).length} / {students.length}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map(student => {
              const hasScore = Object.keys(assessments?.individualScores?.[student.id] || {}).length > 0;
              const isSelected = selectedStudentId === student.id;
              
              return (
                <div key={student.id} className="contents">
                  <div 
                    onClick={() => setSelectedStudentId(isSelected ? '' : student.id)}
                    className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex flex-col justify-between min-h-[140px] relative overflow-hidden ${isSelected ? 'bg-indigo-950 border-indigo-950 text-white shadow-2xl scale-[1.02]' : hasScore ? 'bg-white border-emerald-100' : 'bg-white border-slate-100 hover:border-rose-200 shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start relative z-10">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                        {(student?.name || '?').charAt(0)}
                      </div>
                      {hasScore && !isSelected && <CheckCircle className="text-emerald-500" size={20} />}
                      {isSelected && <ChevronRightCircle className="text-rose-500" size={20} />}
                    </div>
                    <div className="relative z-10 mt-4">
                      <p className={`font-black uppercase tracking-tighter leading-tight ${isSelected ? 'text-white' : 'text-indigo-950'}`}>{student?.name || 'Sin Nombre'}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>Puntaje:</span>
                          <span className={`text-sm font-black ${isSelected ? 'text-white' : 'text-indigo-950'}`}>{getScoreTotal('individual', student.id).toFixed(1)}</span>
                        </div>
                        {hasScore && (
                          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-rose-400' : 'text-rose-500'}`}>Nota:</span>
                            <span className={`text-sm font-black ${isSelected ? 'text-rose-400' : 'text-rose-500'}`}>
                              {calculateChileanMark(getScoreTotal('individual', student.id), getMaxScore('individual'))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 opacity-10">
                      <Users size={80} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="col-span-full overflow-hidden"
                      >
                        <div className="bg-slate-50 p-10 rounded-[3rem] border-2 border-indigo-950/10 my-4 space-y-10 shadow-inner">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {(rubrics?.individual || []).map(cr => (
                               <div key={cr.id} className="space-y-4">
                                  <h4 className="font-black text-indigo-950 text-sm uppercase tracking-tight flex items-center gap-3">
                                     <div className="w-1.5 h-6 bg-rose-500 rounded-full" /> {cr.title}
                                  </h4>
                                  <div className="flex gap-2">
                                     {[4,3,2,1].map(l => {
                                        const scoreSelected = assessments?.individualScores?.[student.id]?.[cr.id] === l;
                                        return (
                                           <button 
                                              key={l} 
                                              onClick={() => setScore('individual', student.id, cr.id, l)}
                                              onMouseEnter={() => setHoverInfo({ level: l, text: cr.desc[l] })}
                                              onMouseLeave={() => setHoverInfo(null)}
                                              className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all border-2 ${getScoreColor(l, scoreSelected)} ${scoreSelected ? 'scale-110 z-10' : ''}`}
                                           >
                                              {l}
                                           </button>
                                        );
                                     })}
                                  </div>
                               </div>
                            ))}
                          </div>

                          <div className="pt-8 border-t border-slate-200">
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="font-black text-indigo-950 text-sm uppercase tracking-tight flex items-center gap-3">
                                  <div className="w-1.5 h-6 bg-indigo-950 rounded-full" /> Retroalimentación para {student.name.split(' ')[0]}
                                </h4>
                                <button onClick={() => handleGenerateAI(student.id, false)} disabled={generatingAI[student.id]} className="flex items-center gap-2 bg-indigo-950 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-rose-500">
                                   {generatingAI[student.id] ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                                   IA Feedback
                                </button>
                              </div>
                              <textarea
                                value={assessments?.observations?.[student.id] || ''}
                                onChange={(e) => setObservation(student.id, e.target.value)}
                                placeholder="Escribe aquí tus observaciones o usa la IA..."
                                className="w-full bg-white border border-slate-200 rounded-2xl p-6 font-medium text-sm focus:ring-4 focus:ring-indigo-950/5 focus:outline-none resize-y min-h-[120px]"
                              />
                          </div>

                          <div className="flex justify-center">
                            <button onClick={() => setSelectedStudentId('')} className="bg-indigo-950 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-rose-500 transition-all">
                              Finalizar Evaluación
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Footer Navigation */}
        <div className="fixed bottom-10 right-10 z-[100]">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'results' }))}
              className="px-10 py-6 rounded-[2.5rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-rose-500 transition-all flex items-center gap-4 border-2 border-white/20"
            >
              <FileSpreadsheet size={20} /> Ver Resultados Finales <ChevronRight size={20} />
            </button>
        </div>

        {/* Tooltip */}
        <AnimatePresence>
          {hoverInfo && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[300] w-full max-w-lg px-6">
                <div className="bg-indigo-950 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex items-start gap-6 backdrop-blur-xl">
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shrink-0 ${hoverInfo.level === 4 ? 'bg-blue-600' : hoverInfo.level === 1 ? 'bg-rose-500' : 'bg-slate-500'}`}>{hoverInfo.level}</div>
                   <p className="text-white text-sm font-medium leading-relaxed italic">"{hoverInfo.text}"</p>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[800px] pb-32">
      
      {/* LEFT AREA: Groups and Evaluation */}
      <div className="flex-1 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white/50 p-6 rounded-[2rem] gap-4 backdrop-blur-xl border border-white/50 shadow-sm">
           <div className="flex items-center gap-4">
              <LayoutGrid size={28} className="text-rose-500" />
              <div>
                <h3 className="text-2xl font-black text-indigo-950 italic tracking-tighter">
                  {evaluationType === 'individual' ? 'Panel de Estudiantes' : 'Panel de Grupos'}
                </h3>
                {skill && <span className="text-[9px] font-black uppercase text-indigo-950/40 tracking-[0.2em]">{skill}</span>}
              </div>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => setShowRoster(!showRoster)} className={`p-3 rounded-xl transition-all ${showRoster ? 'bg-indigo-950 text-white' : 'bg-slate-100 text-slate-400'}`}>
                 {showRoster ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button 
                onClick={() => { const n = prompt('¿Cuántos estudiantes?', '4'); if(n) generateRandomGroups(parseInt(n)); }} 
                className="px-6 py-2.5 rounded-xl bg-indigo-950 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 transition-all"
              >
                 AUTO-GENERAR
              </button>
           </div>
        </div>

        {!selectedGroupId ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
             {filteredGroups.map(group => {
               const members = (students || []).filter(s => assessments?.studentGroups?.[s?.id] === group?.id);
               return (
                 <div 
                   key={group.id} 
                   className="liquid-glass p-8 group hover:scale-[1.02] active:scale-95 cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[260px] border-2 border-transparent hover:border-rose-500/20 shadow-xl"
                   onClick={() => setSelectedGroupId(group.id)}
                 >
                    <div className="flex justify-between items-start">
                       <div className="flex flex-col">
                          <h4 className="text-3xl font-black text-indigo-950 uppercase italic tracking-tighter leading-tight">{group.name}</h4>
                          <span className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">{members.length} Alumnos</span>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); renameGroup(group.id); }} className="p-2 text-slate-200 hover:text-indigo-950 bg-white/50 rounded-lg transition-all"><Pencil size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); removeGroup(group.id); }} className="p-2 text-slate-200 hover:text-rose-500 bg-white/50 rounded-lg transition-all"><Trash2 size={14} /></button>
                       </div>
                    </div>

                    <div className="flex-1 mt-6 flex flex-wrap gap-1.5 h-auto content-start">
                       {members.map(m => (
                         <div key={m.id} className="group/avatar relative">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-950 text-white border-2 border-white flex items-center justify-center font-black text-[12px] shadow-lg">
                               {(m?.name || '?').charAt(0)}
                            </div>
                            <button 
                               onClick={(e) => { e.stopPropagation(); removeFromGroup(m.id); }}
                               className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all shadow-lg hover:scale-110 hover:bg-rose-600 z-10"
                               title="Quitar estudiante del grupo"
                            >
                               <X size={10} strokeWidth={4} />
                            </button>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-indigo-950 text-white text-[8px] font-black rounded-lg opacity-0 group-hover/avatar:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap uppercase tracking-widest">
                               {m?.name || 'Sin Nombre'}
                            </div>
                         </div>
                       ))}
                       {selectedStudentIds.length > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); addSelectionToGroup(group.id); }}
                            className="w-10 h-10 rounded-2xl bg-rose-500 text-white border-2 border-white flex items-center justify-center shadow-xl animate-bounce"
                          >
                             <UserPlus size={18} />
                          </button>
                       )}
                    </div>

                    {selectedStudentIds.length > 0 && (
                       <div className="absolute inset-0 bg-rose-500/5 backdrop-blur-[2px] pointer-events-none border-2 border-rose-500/50 rounded-[2.5rem] flex items-center justify-center">
                          <span className="text-[10px] font-black text-rose-600 bg-white px-4 py-2 rounded-full uppercase tracking-widest shadow-xl">Asignar aquí (+{selectedStudentIds.length})</span>
                       </div>
                    )}

                    <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-20 transition-all">
                       <ShieldCheck size={120} />
                    </div>
                 </div>
               );
             })}
          </motion.div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Nav */}
            <div className="flex justify-between items-center">
               <button onClick={() => setSelectedGroupId('')} className="flex items-center gap-3 text-rose-500 font-black text-[10px] uppercase tracking-widest">
                  <div className="p-2 bg-rose-50 rounded-lg"><ChevronLeft size={16} /></div> Regresar
               </button>
               <div className="flex gap-2">
                  {prevGroup && <button onClick={() => setSelectedGroupId(prevGroup.id)} className="p-3 bg-white border rounded-xl text-slate-400"><ChevronLeft size={18} /></button>}
                  {nextGroup && <button onClick={() => setSelectedGroupId(nextGroup.id)} className="px-6 py-2.5 bg-indigo-950 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl">Sig. Grupo <ChevronRightCircle className="inline ml-2" size={16} /></button>}
               </div>
            </div>

            {/* Main Eval Card */}
            <div className="liquid-glass overflow-hidden shadow-2xl border-none">
               {evaluationType !== 'individual' ? (
                 <div className="bg-indigo-950 p-10 text-white flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-6">
                       <div className="bg-rose-500 p-5 rounded-[2rem] shadow-2xl"><ShieldCheck size={32} /></div>
                       <h3 className="text-4xl font-black italic uppercase tracking-tighter">{currentGroup?.name}</h3>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center md:text-right">Desempeño del Grupo</p>
                       <div className="flex items-center gap-8 justify-center md:justify-end">
                          <div className="text-center">
                            <p className="text-4xl font-black">{getScoreTotal('group', selectedGroupId).toFixed(1)} <span className="text-sm text-slate-600">/ {getMaxScore('group')}</span></p>
                            <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mt-1">Puntaje</p>
                          </div>
                          <div className="text-center border-l border-white/10 pl-8">
                            <p className="text-5xl font-black text-rose-500">{calculateChileanMark(getScoreTotal('group', selectedGroupId), getMaxScore('group'))}</p>
                            <p className="text-[8px] font-black uppercase text-rose-300 tracking-widest mt-1">Nota</p>
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="bg-indigo-950 p-10 text-white flex items-center gap-6">
                    <div className="bg-rose-500 p-5 rounded-[2rem] shadow-2xl"><Users size={32} /></div>
                    <div>
                      <h3 className="text-4xl font-black italic uppercase tracking-tighter">{currentGroup?.name}</h3>
                      <p className="text-[10px] font-black text-rose-200 uppercase tracking-widest mt-1">Evaluación Individual en Bloque</p>
                    </div>
                 </div>
               )}

               <div className="p-10 space-y-12">
                  {evaluationType !== 'individual' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       {(rubrics?.group || []).map(cr => (
                          <div key={cr.id} className="space-y-6">
                             <h4 className="font-black text-indigo-950 text-sm uppercase tracking-tight flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-rose-500 rounded-full" /> {cr.title}
                             </h4>
                             <div className="flex gap-2">
                                {[4,3,2,1].map(l => {
                                   const isSelected = assessments?.groupScores?.[selectedGroupId]?.[cr.id] === l;
                                   return (
                                      <button 
                                        key={l}
                                        onMouseEnter={() => setHoverInfo({ level: l, text: cr.desc[l] })}
                                        onMouseLeave={() => setHoverInfo(null)}
                                        onClick={() => setScore('group', selectedGroupId, cr.id, l)}
                                        className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all border-2 ${getScoreColor(l, isSelected)} ${isSelected ? 'scale-110 z-10' : ''}`}
                                      >
                                         {l}
                                      </button>
                                   );
                                })}
                             </div>
                          </div>
                       ))}
                    </div>
                  )}

                  {/* Group Observation Input */}
                  {evaluationType !== 'individual' && (
                    <div className="w-full mt-8 pt-8 border-t border-slate-200/50">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-black text-indigo-950 text-sm uppercase tracking-tight flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-rose-500 rounded-full" /> Comentarios Generales del Grupo
                          </h4>
                          <button onClick={() => handleGenerateAI(selectedGroupId, true)} disabled={generatingAI[selectedGroupId]} className="flex items-center gap-2 bg-indigo-50 hover:bg-rose-50 text-indigo-900 hover:text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                             {generatingAI[selectedGroupId] ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                             {generatingAI[selectedGroupId] ? 'Redactando...' : 'Mejorar con IA'}
                          </button>
                        </div>
                        <textarea
                          value={assessments?.groupObservations?.[selectedGroupId] || ''}
                          onChange={(e) => setGroupObservation(selectedGroupId, e.target.value)}
                          placeholder="Observaciones de la presentación o trabajo grupal. Este comentario aparecerá en los reportes de todos los integrantes del grupo."
                          className="w-full bg-white/50 border border-slate-200 rounded-xl p-4 font-medium text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none resize-y min-h-[80px]"
                        />
                    </div>
                  )}

                  {/* Individual Evaluation Section */}
                  {evaluationType !== 'grupal' && (
                    <div className="space-y-8 pt-10 border-t">
                       <h4 className="text-2xl font-black text-indigo-950 italic uppercase tracking-tighter">Evaluación Personal</h4>
                       {groupMembers.map(student => (
                          <div key={student.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col gap-4">
                             <div className="flex flex-col md:flex-row gap-8 items-center">
                                <div className="flex flex-col items-center min-w-[120px]">
                                   <div className="w-16 h-16 rounded-full bg-indigo-950 text-white flex items-center justify-center font-black text-2xl mb-2">{(student?.name || '?').charAt(0)}</div>
                                   <span className="text-xs font-black text-indigo-950 uppercase italic text-center leading-tight truncate w-full">{student?.name || 'Sin Nombre'}</span>
                                   <div className="mt-2 flex flex-col items-center">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Puntaje: {getScoreTotal('individual', student.id).toFixed(1)}</span>
                                      <span className="text-xl font-black text-rose-500">Nota: {calculateChileanMark(getScoreTotal('individual', student.id), getMaxScore('individual'))}</span>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); if(window.confirm('¿Eliminar a este estudiante del grupo?')) removeFromGroup(student.id); }}
                                        className="mt-3 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-600 transition-colors bg-rose-50 px-3 py-1.5 rounded-lg"
                                      >
                                        <X size={10} strokeWidth={3} /> Quitar del Grupo
                                      </button>
                                   </div>
                                </div>
                                <div className="flex-1">
                                  {evaluationType === 'grupal' ? (
                                    <div className="bg-white/50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evaluación por Grupo (Individual deshabilitada)</p>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {(rubrics?.individual || []).map(cr => (
                                         <div key={cr.id} className="space-y-2">
                                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">{cr.title}</span>
                                            <div className="flex gap-1.5">
                                               {[4,3,2,1].map(l => {
                                                  const isSelected = assessments?.individualScores?.[student.id]?.[cr.id] === l;
                                                  return (
                                                     <button 
                                                        key={l} 
                                                        onClick={() => setScore('individual', student.id, cr.id, l)}
                                                        onMouseEnter={() => setHoverInfo({ level: l, text: cr.desc[l] })}
                                                        onMouseLeave={() => setHoverInfo(null)}
                                                        className={`flex-1 py-3 rounded-xl font-black border-2 transition-all ${getScoreColor(l, isSelected)} ${isSelected ? 'shadow-md scale-105' : ''}`}
                                                     >
                                                        {l}
                                                     </button>
                                                  );
                                               })}
                                            </div>
                                         </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                             </div>
                             {/* Observation Input */}
                             <div className="w-full mt-2 pt-4 border-t border-slate-200/50">
                                <div className="flex justify-between items-center mb-3">
                                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-2">Notas del Profesor</span>
                                  <button onClick={() => handleGenerateAI(student.id, false)} disabled={generatingAI[student.id]} className="flex items-center gap-2 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                                     {generatingAI[student.id] ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} 
                                     IA
                                  </button>
                                </div>
                                <textarea
                                  value={assessments?.observations?.[student.id] || ''}
                                  onChange={(e) => setObservation(student.id, e.target.value)}
                                  placeholder="Comentarios individuales (aparecerá en el reporte del estudiante)"
                                  className="w-full bg-white/50 border border-slate-200 rounded-xl p-3 font-medium text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none resize-y min-h-[60px]"
                                />
                             </div>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}
      </div>

      {/* ROSTER */}
      {showRoster && (
        <div className="lg:w-96 animate-in slide-in-from-right-8 duration-500">
           <div className="liquid-glass-dark p-10 text-white min-h-[500px] flex flex-col sticky top-10">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Sin Grupo</h3>
                 <span className="bg-white/10 text-[10px] px-3 py-1 rounded-full">{unassignedStudents.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                 {unassignedStudents.map(s => (
                    <button 
                      key={s.id} 
                      onClick={() => toggleStudentSelection(s.id)} 
                      className={`w-full p-6 h-auto rounded-[1.5rem] flex items-center gap-4 text-left border-2 transition-all group/item ${selectedStudentIds.includes(s.id) ? 'bg-rose-500 border-rose-400 scale-[1.02] shadow-xl shadow-rose-500/20' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                    >
                       <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black transition-all ${selectedStudentIds.includes(s.id) ? 'bg-white text-rose-500 rotate-6' : 'bg-slate-800 text-slate-400 group-hover/item:bg-white group-hover/item:text-indigo-950'}`}>
                          {(s?.name || '?').charAt(0)}
                       </div>
                       <div className="flex-1 overflow-hidden">
                          <p className="text-xs font-black uppercase tracking-tighter leading-none mb-1 truncate">{s?.name || 'Sin Nombre'}</p>
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">Colegio Umbral</p>
                       </div>
                       {selectedStudentIds.includes(s.id) && <CheckCircle size={20} className="text-white" />}
                    </button>
                 ))}
                 {unassignedStudents.length === 0 && (
                   <div className="text-center py-24 opacity-20">
                      <Sparkles size={60} className="mx-auto text-rose-500 mb-6" />
                      <p className="text-xs font-black uppercase tracking-[0.3em]">Carga Completa</p>
                   </div>
                 )}
              </div>
              
              <div className="mt-8 pt-4 border-t border-white/10 sticky bottom-0 bg-indigo-950/90 backdrop-blur-md">
                 <button 
                   disabled={selectedStudentIds.length === 0} 
                   onClick={(e) => { e.stopPropagation(); createGroupFromSelection(); }} 
                   className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 ${selectedStudentIds.length === 0 ? 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed shadow-none' : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/30'}`}
                 >
                    <UserPlus size={18} /> ARMAR GRUPO ({selectedStudentIds.length})
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {hoverInfo && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] w-full max-w-lg px-6">
              <div className="bg-indigo-950 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex items-start gap-6 backdrop-blur-xl">
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shrink-0 ${hoverInfo.level === 4 ? 'bg-blue-600' : hoverInfo.level === 1 ? 'bg-rose-500' : 'bg-slate-500'}`}>{hoverInfo.level}</div>
                 <p className="text-white text-sm font-medium leading-relaxed italic">"{hoverInfo.text}"</p>
              </div>
           </motion.div>
        )}
      </AnimatePresence>
      {/* NEXT STEP BUTTON (Only visible if not in detail view) */}
      {!selectedGroupId && unassignedStudents.length === 0 && (
         <div className="fixed bottom-10 right-10 z-[100] animate-in slide-in-from-bottom-10 duration-700">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'results' }))}
              className="px-10 py-6 rounded-[2.5rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-rose-500 transition-all flex items-center gap-4 border-2 border-white/20 active:scale-95 translate-y-0 hover:-translate-y-2"
            >
              <FileSpreadsheet size={20} /> Ver Resultados Finales <ChevronRight size={20} />
            </button>
         </div>
      )}
    </div>
  );
}
