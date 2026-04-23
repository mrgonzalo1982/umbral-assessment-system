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
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AssessmentEngine({ students, rubrics, assessments, onUpdateAssessments, selectedCourse }) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [hoverInfo, setHoverInfo] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [showRoster, setShowRoster] = useState(true);

  // --- Logic ---
  const filteredGroups = useMemo(() => {
    return assessments.groups.filter(g => g.curso === selectedCourse);
  }, [assessments.groups, selectedCourse]);

  const currentGroupIndex = filteredGroups.findIndex(g => g.id === selectedGroupId);
  const nextGroup = filteredGroups[currentGroupIndex + 1];
  const prevGroup = filteredGroups[currentGroupIndex - 1];

  const currentGroup = assessments.groups.find(g => g.id === selectedGroupId);
  const groupMembers = students.filter(s => assessments.studentGroups[s.id] === selectedGroupId);
  const unassignedStudents = students.filter(s => !assessments.studentGroups[s.id]);

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
    const group = assessments.groups.find(g => g.id === id);
    const newName = prompt('Nuevo nombre del grupo:', group.name);
    if (!newName) return;
    onUpdateAssessments({ ...assessments, groups: assessments.groups.map(g => g.id === id ? { ...g, name: newName } : g) });
  };

  const removeGroup = (id) => {
    const newGroups = assessments.groups.filter(g => g.id !== id);
    const newStudentGroups = { ...assessments.studentGroups };
    Object.keys(newStudentGroups).forEach(sid => { if (newStudentGroups[sid] === id) delete newStudentGroups[sid]; });
    onUpdateAssessments({ ...assessments, groups: newGroups, studentGroups: newStudentGroups });
  };

  const generateRandomGroups = (size) => {
    const pool = [...unassignedStudents].sort(() => Math.random() - 0.5);
    const newGroups = [...assessments.groups];
    const newStudentGroups = { ...assessments.studentGroups };

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

  const createGroupFromSelection = () => {
    if (selectedStudentIds.length === 0) return;
    const gid = `g_${Date.now()}`;
    const newGroups = [...assessments.groups, { id: gid, name: `Grupo ${assessments.groups.length + 1}`, curso: selectedCourse }];
    const newStudentGroups = { ...assessments.studentGroups };
    selectedStudentIds.forEach(sid => { newStudentGroups[sid] = gid; });
    onUpdateAssessments({ ...assessments, groups: newGroups, studentGroups: newStudentGroups });
    setSelectedStudentIds([]);
  };

  const setScore = (type, targetId, criteriaId, val) => {
    const scoreKey = type === 'group' ? 'groupScores' : 'individualScores';
    onUpdateAssessments({
      ...assessments,
      [scoreKey]: {
        ...assessments[scoreKey],
        [targetId]: { ...assessments[scoreKey][targetId], [criteriaId]: val }
      }
    });
  };

  const getScoreTotal = (type, targetId) => {
    const scores = type === 'group' ? assessments.groupScores[targetId] : assessments.individualScores[targetId];
    if (!scores) return 0;
    const rubric = type === 'group' ? rubrics.group : rubrics.individual;
    return rubric.reduce((t, cr) => t + ((scores[cr.id] || 0) * cr.weight), 0);
  };

  const getMaxScore = (type) => {
    const rubric = type === 'group' ? rubrics.group : rubrics.individual;
    return rubric.reduce((t, cr) => t + (4 * cr.weight), 0);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[800px] pb-32">
      
      {/* LEFT AREA: Groups and Evaluation */}
      <div className="flex-1 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white/50 p-6 rounded-[2rem] gap-4 backdrop-blur-xl border border-white/50 shadow-sm">
           <div className="flex items-center gap-4">
              <LayoutGrid size={28} className="text-rose-500" />
              <h3 className="text-2xl font-black text-indigo-950 italic tracking-tighter">Panel de Grupos</h3>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in duration-500">
             {filteredGroups.map(group => {
               const members = students.filter(s => assessments.studentGroups[s.id] === group.id);
               return (
                 <div 
                   key={group.id} 
                   className="liquid-glass p-8 group hover:scale-[1.02] active:scale-95 cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[240px]"
                   onClick={() => setSelectedGroupId(group.id)}
                 >
                    <div className="flex justify-between items-start">
                       <div className="flex flex-col">
                          <h4 className="text-3xl font-black text-indigo-950 uppercase italic tracking-tighter leading-tight">{group.name}</h4>
                          <span className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">{members.length} Alumnos</span>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); renameGroup(group.id); }} className="p-2 text-slate-200 hover:text-indigo-950 bg-white/50 rounded-lg"><Pencil size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); removeGroup(group.id); }} className="p-2 text-slate-200 hover:text-rose-500 bg-white/50 rounded-lg"><Trash2 size={14} /></button>
                       </div>
                    </div>
                    <div className="flex items-center gap-1 mt-6">
                       {members.map(m => (
                         <div key={m.id} className="w-8 h-8 rounded-full bg-indigo-950 text-white border-2 border-white flex items-center justify-center font-black text-[10px] shadow-lg">
                            {m.name.charAt(0)}
                         </div>
                       ))}
                    </div>
                    <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-20 transition-all">
                       <ShieldCheck size={120} />
                    </div>
                 </div>
               );
             })}
          </div>
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
               <div className="bg-indigo-950 p-10 text-white flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="flex items-center gap-6">
                     <div className="bg-rose-500 p-5 rounded-[2rem] shadow-2xl"><ShieldCheck size={32} /></div>
                     <h3 className="text-4xl font-black italic uppercase tracking-tighter">{currentGroup?.name}</h3>
                  </div>
                  <div className="text-center">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Puntaje Grupal</p>
                     <p className="text-5xl font-black">{getScoreTotal('group', selectedGroupId).toFixed(1)} <span className="text-xl text-slate-600">/ {getMaxScore('group')}</span></p>
                  </div>
               </div>

               <div className="p-10 space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     {rubrics.group.map(cr => (
                        <div key={cr.id} className="space-y-6">
                           <h4 className="font-black text-indigo-950 text-sm uppercase tracking-tight flex items-center gap-3">
                              <div className="w-1.5 h-6 bg-rose-500 rounded-full" /> {cr.title}
                           </h4>
                           <div className="flex gap-2">
                              {[4,3,2,1].map(l => {
                                 const isSelected = assessments.groupScores[selectedGroupId]?.[cr.id] === l;
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

                  {/* Individual */}
                  <div className="space-y-8 pt-10 border-t">
                     <h4 className="text-2xl font-black text-indigo-950 italic uppercase tracking-tighter">Evaluación Personal</h4>
                     {groupMembers.map(student => (
                        <div key={student.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row gap-8 items-center">
                           <div className="flex flex-col items-center min-w-[120px]">
                              <div className="w-16 h-16 rounded-full bg-indigo-950 text-white flex items-center justify-center font-black text-2xl mb-2">{student.name.charAt(0)}</div>
                              <span className="text-xs font-black text-indigo-950 uppercase italic text-center leading-tight truncate w-full">{student.name}</span>
                              <div className="mt-2 text-rose-500 font-black text-lg">{getScoreTotal('individual', student.id).toFixed(1)}</div>
                           </div>
                           <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {rubrics.individual.map(cr => (
                                 <div key={cr.id} className="space-y-2">
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-2">{cr.title}</span>
                                    <div className="flex gap-1.5">
                                       {[4,3,2,1].map(l => {
                                          const isSelected = assessments.individualScores[student.id]?.[cr.id] === l;
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
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* ROSTER */}
      {showRoster && (
        <div className="lg:w-96 animate-in slide-in-from-right-8 duration-500">
           <div className="liquid-glass-dark p-10 text-white min-h-[500px] flex flex-col sticky top-10">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-8">Roster Pendiente</h3>
              <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                 {unassignedStudents.map(s => (
                    <button key={s.id} onClick={() => toggleStudentSelection(s.id)} className={`w-full p-4 rounded-2xl flex justify-between items-center border-2 transition-all ${selectedStudentIds.includes(s.id) ? 'bg-rose-500 border-rose-400' : 'bg-white/5 border-transparent'}`}>
                       <span className="text-[10px] font-black truncate">{s.name}</span>
                       <CheckCircle size={16} className={selectedStudentIds.includes(s.id) ? 'text-white' : 'text-transparent'} />
                    </button>
                 ))}
                 {unassignedStudents.length === 0 && <div className="text-center py-20 opacity-20"><CheckCircle size={40} className="mx-auto" /><p className="text-xs uppercase mt-3">Completado</p></div>}
              </div>
              <button disabled={selectedStudentIds.length === 0} onClick={createGroupFromSelection} className="mt-8 w-full py-5 rounded-[2rem] bg-white text-indigo-950 font-black text-xs uppercase tracking-widest disabled:opacity-10 hover:bg-rose-500 hover:text-white transition-all shadow-2xl shadow-indigo-950/50">ARMAR GRUPO ({selectedStudentIds.length})</button>
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
    </div>
  );
}
