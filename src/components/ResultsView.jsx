import React, { useState, useMemo, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  Award, 
  Target, 
  Trophy, 
  Sparkles, 
  ChevronRight, 
  User, 
  PieChart as PieChartIcon,
  Activity,
  Mail,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { calculateChileanMark } from '../utils/grading';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ResultsView({ students = [], rubrics = { group: [], individual: [] }, assessments = {} }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // LOGGING FOR DEBUGGING - If the screen is still blank, these logs will help if the user takes a screenshot of the console.
  useEffect(() => {
    console.log("ResultsView Mounted:", { studentsLength: students?.length, rubrics, assessments });
  }, [students, rubrics, assessments]);

  // Robust Guards
  const safeRubricGroup = Array.isArray(rubrics?.group) ? rubrics.group : [];
  const safeRubricIndividual = Array.isArray(rubrics?.individual) ? rubrics.individual : [];
  const safeAssessments = assessments || {};
  const safeStudentGroups = safeAssessments.studentGroups || {};

  const getMaxTotal = () => {
    try {
      const g = safeRubricGroup.reduce((t, c) => t + (4 * (c?.weight || 1)), 0);
      const i = safeRubricIndividual.reduce((t, c) => t + (4 * (c?.weight || 1)), 0);
      return Math.max(1, g + i);
    } catch (e) { return 1; }
  };

  const results = useMemo(() => {
    if (!Array.isArray(students) || students.length === 0) return [];
    
    return students.map(s => {
      if (!s) return null;
      try {
        const groupId = safeStudentGroups[s.id];
        const gScores = safeAssessments?.groupScores?.[groupId] || {};
        const iScores = safeAssessments?.individualScores?.[s.id] || {};
        
        const gScoreTotal = safeRubricGroup.reduce((t, cr) => t + (((gScores[cr?.id]) || 0) * (cr?.weight || 1)), 0);
        const iScoreTotal = safeRubricIndividual.reduce((t, cr) => t + (((iScores[cr?.id]) || 0) * (cr?.weight || 1)), 0);
        const total = gScoreTotal + iScoreTotal;
        const mark = calculateChileanMark(total, getMaxTotal());
        const isPassing = parseFloat(mark) >= 4.0;

        return {
          id: s.id,
          name: s.name ? String(s.name).toUpperCase() : 'ESTUDIANTE SIN NOMBRE',
          email: s.email || '',
          group: groupId ? (safeAssessments.groups?.find(g => g.id === groupId)?.name?.toUpperCase() || 'GRUPO DESCONOCIDO') : 'SIN GRUPO',
          gScoreTotal,
          iScoreTotal,
          total,
          mark,
          isPassing,
          gScores,
          iScores
        };
      } catch (err) {
        console.error("Error computing student result for:", s.name, err);
        return null;
      }
    }).filter(r => r !== null);
  }, [students, rubrics, assessments]);

  const selectedStudent = results.find(r => r.id === selectedStudentId);

  const radarData = useMemo(() => {
    if (!selectedStudent) return [];
    try {
      const groupData = safeRubricGroup.map(cr => ({
        subject: cr.title || 'Criterio',
        A: (selectedStudent.gScores[cr.id] || 0),
        fullMark: 4
      }));
      const indivData = safeRubricIndividual.map(cr => ({
        subject: cr.title || 'Criterio',
        A: (selectedStudent.individualScores?.[cr.id] || selectedStudent.iScores?.[cr.id] || 0),
        fullMark: 4
      }));
      return [...groupData, ...indivData];
    } catch (e) { return []; }
  }, [selectedStudent, rubrics]);

  const generateFeedback = (res) => {
    if (!res || res.total === 0) return "Evaluación pendiente.";
    try {
      const strengths = [];
      const improvements = [];
      
      safeRubricGroup.forEach(cr => {
        const s = res.gScores[cr.id] || 0;
        if (s === 4) strengths.push(cr.title);
        if (s <= 2) improvements.push(cr.title);
      });
      safeRubricIndividual.forEach(cr => {
        const s = res.iScores[cr.id] || 0;
        if (s === 4) strengths.push(cr.title);
        if (s <= 2) improvements.push(cr.title);
      });

      let text = `En tu evaluación de ${res.group}, has obtenido un ${res.mark}. `;
      if (strengths.length > 0) text += `Destacas en: ${strengths.join(', ')}. `;
      if (improvements.length > 0) text += `Te sugerimos reforzar: ${improvements.join(', ')}. `;
      return text;
    } catch (e) { return "Reporte generado con éxito."; }
  };

  const exportPDF = (res) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(30, 27, 75);
      doc.text("REPORTE PEDAGÓGICO", 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text("COLEGIO UMBRAL DE CURAUMA", 105, 30, { align: 'center' });
      doc.line(20, 35, 190, 35);
      doc.text(`ESTUDIANTE: ${res.name}`, 20, 50);
      doc.text(`NOTA: ${res.mark}`, 20, 60);
      doc.save(`Reporte_${res.name}.pdf`);
    } catch (e) { alert("Error PDF"); }
  };

  const sendEmail = (res) => {
    if (!res.email) return alert("Sin email");
    const subject = encodeURIComponent(`Reporte English - ${res.name}`);
    const body = encodeURIComponent(`Nota: ${res.mark}\n\n${generateFeedback(res)}`);
    window.location.href = `mailto:${res.email}?subject=${subject}&body=${body}`;
  };

  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40 liquid-glass border-dashed border-2 bg-white/50 animate-in fade-in duration-700">
         <AlertCircle size={80} className="text-slate-200 mb-8" />
         <h3 className="text-3xl font-black text-indigo-950 uppercase italic tracking-tighter">Esperando Resultados</h3>
         <p className="text-slate-400 text-sm italic font-medium max-w-sm text-center">No se encontraron datos para mostrar. Asegúrate de que los estudiantes estén asignados a grupos y calificados en el 'Motor de Evaluación'.</p>
         <button onClick={() => window.location.reload()} className="mt-8 flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest bg-white px-6 py-3 rounded-2xl shadow-xl hover:scale-105 transition-all">
            <RefreshCw size={14} /> Recargar Sistema
         </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="md:col-span-2 liquid-glass-dark p-10 text-white flex flex-col justify-between overflow-hidden relative">
            <div className="relative z-10">
               <h2 className="text-4xl font-black italic tracking-tighter mb-4">Métricas de Aula</h2>
               <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Analítica de {results.length} Alumnos
               </p>
            </div>
            <div className="mt-8 flex gap-8 items-end relative z-10">
               <div className="flex flex-col">
                  <span className="text-4xl font-black text-rose-500">{results.filter(r => r.total > 0).length}</span>
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Con Nota</span>
               </div>
               <div className="flex flex-col">
                  <span className="text-4xl font-black text-rose-500">
                     {results.filter(r => r.total > 0).length > 0 
                        ? (results.filter(r => r.total > 0).reduce((a,b) => a + parseFloat(b.mark), 0) / results.filter(r => r.total > 0).length).toFixed(1)
                        : '0.0'}
                  </span>
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Promedio</span>
               </div>
            </div>
            <Award size={200} className="absolute -bottom-10 -right-10 opacity-5" />
         </div>

         <div className="liquid-glass p-8 flex flex-col items-center justify-center border-l-4 border-blue-500 bg-white/60">
            <Trophy size={32} className="text-blue-500 mb-4" />
            <span className="text-4xl font-black text-indigo-950">{results.filter(r => r.total > 0 && r.isPassing).length}</span>
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-2">Aprobados</span>
         </div>

         <div className="liquid-glass p-8 flex flex-col items-center justify-center border-l-4 border-rose-500 bg-white/60">
            <AlertCircle size={32} className="text-rose-500 mb-4" />
            <span className="text-4xl font-black text-indigo-950">{results.filter(r => r.total > 0 && !r.isPassing).length}</span>
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-2">Reprobados</span>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
         {/* Results Table */}
         <div className="flex-1 space-y-6">
            <div className="liquid-glass overflow-hidden shadow-2xl border-none bg-white/80">
               <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white/50">
                  <h3 className="text-xl font-black text-indigo-950 uppercase italic tracking-tighter flex items-center gap-3">
                     <FileSpreadsheet className="text-rose-600" size={20} /> Calificaciones
                  </h3>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                        <tr>
                           <th className="px-8 py-4">Estudiante</th>
                           <th className="px-8 py-4 text-center">Score</th>
                           <th className="px-8 py-4 text-center">Nota</th>
                           <th className="px-8 py-4"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {results.map(res => (
                           <tr 
                              key={res.id} 
                              onClick={() => setSelectedStudentId(res.id)}
                              className={`cursor-pointer transition-all duration-300 ${selectedStudentId === res.id ? 'bg-indigo-950 text-white shadow-xl scale-[1.01] z-10 relative' : 'hover:bg-indigo-50'}`}
                           >
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all ${selectedStudentId === res.id ? 'bg-rose-500 text-white rotate-6' : 'bg-slate-100 text-slate-400'}`}>
                                       {res.name.charAt(0)}
                                    </div>
                                    <div>
                                       <p className="font-black italic tracking-tighter leading-none text-base">{res.name}</p>
                                       <div className="flex items-center gap-2 mt-2">
                                          <span className={`text-[8px] font-black uppercase tracking-widest ${selectedStudentId === res.id ? 'text-slate-400' : 'text-slate-400'}`}>{res.group}</span>
                                          {res.email && <Mail size={8} className="opacity-40" />}
                                       </div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-5 text-center font-black text-sm">{res.total.toFixed(1)}</td>
                              <td className={`px-8 py-5 text-center text-3xl font-black italic tracking-tighter ${res.total === 0 ? 'text-slate-100' : (res.isPassing ? (selectedStudentId === res.id ? 'text-white' : 'text-blue-600') : (selectedStudentId === res.id ? 'text-rose-400' : 'text-rose-600'))}`}>
                                 {res.total === 0 ? '-' : res.mark}
                              </td>
                              <td className="px-8 py-5 text-right">
                                 <ChevronRight size={18} className={selectedStudentId === res.id ? 'text-white' : 'text-slate-200'} />
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Selection Panel */}
         <div className="lg:w-[450px]">
            <AnimatePresence mode="wait">
               {selectedStudent ? (
                  <motion.div 
                     key={selectedStudent.id}
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     className="liquid-glass p-8 min-h-[700px] flex flex-col space-y-8 sticky top-32 bg-white/95 border-2 border-indigo-950/5 shadow-2xl"
                  >
                     <div className="flex justify-between items-start">
                        <div className="flex-1">
                           <h4 className="text-3xl font-black text-indigo-950 italic tracking-tighter leading-none mb-3 break-words">{selectedStudent.name}</h4>
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedStudent.group}</span>
                           </div>
                        </div>
                     </div>

                     <div className="flex gap-4">
                        <button onClick={() => exportPDF(selectedStudent)} className="flex-1 py-5 rounded-[2rem] bg-indigo-950 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95">
                           <FileText size={18} /> PDF
                        </button>
                        <button onClick={() => sendEmail(selectedStudent)} className="flex-1 py-5 rounded-[2rem] bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95">
                           <Mail size={18} /> Email
                        </button>
                     </div>

                     <div className="h-[250px] w-full bg-slate-50/80 rounded-[3rem] p-6 border border-slate-100 flex items-center justify-center overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                           <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                              <PolarGrid stroke="#e2e8f0" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }} />
                              <Radar
                                 name="Alumno"
                                 dataKey="A"
                                 stroke="#f43f5e"
                                 fill="#f43f5e"
                                 fillOpacity={0.6}
                              />
                           </RadarChart>
                        </ResponsiveContainer>
                     </div>

                     <div className="bg-indigo-950 text-white p-8 rounded-[3rem] relative overflow-hidden shadow-2xl">
                        <div className="relative z-10">
                           <div className="flex items-center gap-3 mb-5">
                              <Sparkles className="text-rose-500" size={20} />
                              <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Feedback IA</h5>
                           </div>
                           <p className="text-sm font-medium leading-relaxed italic text-slate-100">
                               "{generateFeedback(selectedStudent)}"
                           </p>
                        </div>
                        <Activity className="absolute -bottom-12 -right-12 opacity-5 scale-150" size={150} />
                     </div>

                     <div className="flex-1 pt-4">
                        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-6 pl-4">Desempeño</h5>
                        <div className="space-y-4">
                           {[...safeRubricGroup, ...safeRubricIndividual].map(cr => {
                              const s = (selectedStudent.gScores?.[cr.id] || selectedStudent.iScores?.[cr.id] || 0);
                              return (
                                 <div key={cr.id} className="flex items-center justify-between bg-white px-6 py-4 rounded-[2rem] border border-slate-100 shadow-sm">
                                    <span className="text-[10px] font-black text-indigo-950 uppercase opacity-70 truncate pr-6">{cr.title}</span>
                                    <span className="text-xs font-black text-indigo-950">{s} pts</span>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </motion.div>
               ) : (
                  <div className="liquid-glass p-12 text-center flex flex-col items-center justify-center min-h-[500px] border-2 border-indigo-950/5 bg-white/50">
                     <User size={80} className="text-slate-100 mb-8" />
                     <h4 className="text-2xl font-black text-indigo-950 h-auto">Selecciona un Alumno</h4>
                     <p className="text-slate-400 text-sm mt-2 italic font-medium">Visualiza el reporte detallado aquí.</p>
                  </div>
               )}
            </AnimatePresence>
         </div>
      </div>
    </div>
  );
}
