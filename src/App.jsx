import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  ClipboardCheck, 
  FileSpreadsheet, 
  LayoutDashboard, 
  Settings,
  BookOpen,
  Save,
  CloudOff,
  ChevronRight,
  LogOut,
  ShieldCheck,
  LayoutGrid,
  ChevronLeft,
  ArrowLeft,
  FolderOpen,
  Plus,
  Download,
  Upload,
  Pencil,
  Trash2,
  Calendar,
  Layers,
  Target,
  ArrowRight,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage } from './utils/grading';
import { TEACHERS, hasAccess, normalizeCourse } from './utils/teachers';

// Components
import TeacherSelector from './components/TeacherSelector';
import RosterManager from './components/RosterManager';
import RubricManager from './components/RubricManager';
import AssessmentEngine from './components/AssessmentEngine';
import ResultsView from './components/ResultsView';

const DEFAULT_RUBRIC_GROUP = [
  { id: 'g1', title: 'Content Accuracy', weight: 1.5, desc: { 4: 'Excellent', 3: 'Good', 2: 'Fair', 1: 'Poor' } },
  { id: 'g2', title: 'Group Collaboration', weight: 1, desc: { 4: 'Seamless', 3: 'Fluid', 2: 'Messy', 1: 'Individualist' } }
];

const DEFAULT_RUBRIC_INDIVIDUAL = [
  { id: 'i1', title: 'Pronunciation', weight: 1, desc: { 4: 'Clear', 3: 'Mostly clear', 2: 'Difficult', 1: 'Inaudible' } },
  { id: 'i2', title: 'Grammar', weight: 1, desc: { 4: 'No errors', 3: '1-2 errors', 2: '3-5 errors', 1: '7+ errors' } }
];

const INITIAL_ASSESSMENT_STATE = {
  groups: [],
  studentGroups: {},
  groupScores: {},
  individualScores: {}
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Form State
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', unit: '', objective: '' });

  // Core State
  const [students, setStudents] = useState([]);
  const [rubrics, setRubrics] = useState({}); // { [course]: { group, individual } }
  const [projects, setProjects] = useState([]); // [ { id, name, unit, objective, course, date, assessments, rubrics } ]

  // Load Data
  useEffect(() => {
    const savedStudents = storage.load('students') || [];
    const savedRubrics = storage.load('rubrics') || {};
    const savedProjects = storage.load('projects_v3') || [];
    const savedTeacherId = storage.load('currentTeacherId');

    const oldAssessments = storage.load('assessments');
    if (oldAssessments && savedProjects.length === 0) {
       const legacyProject = {
          id: 'legacy_1',
          name: 'Evaluación Inicial',
          course: 'General',
          date: new Date().toISOString(),
          assessments: oldAssessments,
          rubrics: savedRubrics['General'] || { group: DEFAULT_RUBRIC_GROUP, individual: DEFAULT_RUBRIC_INDIVIDUAL }
       };
       setProjects([legacyProject]);
    } else {
       setProjects(savedProjects);
    }
    setStudents(savedStudents);
    setRubrics(savedRubrics);
    if (savedTeacherId) {
      const teacher = TEACHERS.find(t => t.id === savedTeacherId);
      if (teacher) setCurrentTeacher(teacher);
    }
    setIsLoaded(true);
  }, []);

  // Save Data
  useEffect(() => {
    if (!isLoaded) return;
    storage.save('students', students);
    storage.save('rubrics', rubrics);
    storage.save('projects_v3', projects);
  }, [students, rubrics, projects, isLoaded]);

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const handleUpdateAssessments = (newAssessments) => {
    setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, assessments: newAssessments } : p));
  };

  const handleUpdateRubrics = (newRubricsForProject) => {
    setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, rubrics: newRubricsForProject } : p));
  };

  const createNewProject = () => {
    if (!selectedCourse || !newProjectData.name) return;
    const newProject = {
      id: `p_${Date.now()}`,
      name: newProjectData.name,
      unit: newProjectData.unit,
      objective: newProjectData.objective,
      course: selectedCourse,
      date: new Date().toISOString(),
      assessments: { ...INITIAL_ASSESSMENT_STATE },
      rubrics: rubrics[selectedCourse] || { group: DEFAULT_RUBRIC_GROUP, individual: DEFAULT_RUBRIC_INDIVIDUAL }
    };
    setProjects(prev => [...prev, newProject]);
    setNewProjectData({ name: '', unit: '', objective: '' });
    setShowNewProjectForm(false);
    setSelectedProjectId(newProject.id);
    setActiveTab('rubrics');
  };

  const renameProject = (id) => {
    const p = projects.find(p => p.id === id);
    const newName = prompt('Nuevo nombre para la actividad:', p.name);
    if (newName) {
       setProjects(prev => prev.map(item => item.id === id ? { ...item, name: newName } : item));
    }
  };

  const deleteProject = (id) => {
    if (confirm('¿Eliminar esta actividad y todas sus notas evaluadas?')) {
       setProjects(prev => prev.filter(p => p.id !== id));
       if (selectedProjectId === id) setSelectedProjectId(null);
    }
  };

  const logout = () => {
    setCurrentTeacher(null);
    setSelectedCourse(null);
    setSelectedProjectId(null);
    setIsAdminMode(false);
  };

  const filteredStudents = useMemo(() => {
    if (!selectedCourse || !students) return [];
    return students.filter(s => normalizeCourse(s.curso) === normalizeCourse(selectedCourse));
  }, [students, selectedCourse]);

  const courseProjects = useMemo(() => {
    if (!selectedCourse) return [];
    return projects.filter(p => normalizeCourse(p.course) === normalizeCourse(selectedCourse));
  }, [projects, selectedCourse]);

  const exportSystemData = () => {
    const data = { students, rubrics, projects, version: '3.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_umbral_${selectedCourse || 'full'}.json`;
    link.click();
  };

  if (!isLoaded) return null;

  if (!currentTeacher && !isAdminMode) {
    return <TeacherSelector 
      onSelect={setCurrentTeacher} 
      onAdmin={() => setIsAdminMode(true)} 
    />;
  }

  if (isAdminMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-indigo-950 text-white p-8 flex justify-between items-center shadow-2xl">
           <div className="flex items-center gap-4">
              <div className="bg-rose-500 p-3 rounded-2xl">
                 <ShieldCheck size={28} />
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase">Admin Console</h2>
           </div>
           <button onClick={logout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-all font-bold uppercase text-[10px] tracking-widest">
              <LogOut size={16} /> Salir
           </button>
        </header>
        <main className="flex-1 p-12 max-w-7xl mx-auto w-full space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="liquid-glass-dark p-12 text-white relative overflow-hidden">
                  <h3 className="text-3xl font-black mb-6 italic tracking-tight flex items-center gap-4">
                     <Users className="text-rose-500" /> Carga Maestra (Full Roster)
                  </h3>
                  <label className="px-10 py-5 rounded-[2.5rem] bg-rose-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-rose-500/30 hover:scale-105 transition-all cursor-pointer inline-flex items-center gap-3">
                     Subir CSV
                     <input type="file" accept=".csv" className="hidden" onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (f) => {
                          const lines = f.target.result.split('\n').filter(l => l.trim().length > 0);
                          const header = lines[0].split(',');
                          
                          const idxCurso = header.findIndex(h => h.toLowerCase().includes('curso'));
                          const idxNombre = header.findIndex(h => h.toLowerCase().includes('nombre'));
                          const idxApellido1 = header.findIndex(h => h.toLowerCase().includes('primer apellido') || h.toLowerCase().includes('apellido paterno'));
                          const idxApellido2 = header.findIndex(h => h.toLowerCase().includes('segundo apellido') || h.toLowerCase().includes('apellido materno'));
                          const idxEmail = header.findIndex(h => h.toLowerCase().includes('email') || h.toLowerCase().includes('correo'));

                          const newStudents = lines.slice(1).map((row, i) => {
                            const cells = row.split(',').map(c => c.replace(/^"|"$/g, '').trim());
                            let name = '';
                            if (idxApellido1 !== -1) name += cells[idxApellido1] + ' ';
                            if (idxApellido2 !== -1) name += cells[idxApellido2] + ', ';
                            if (idxNombre !== -1) name += cells[idxNombre];
                            if (!name.trim()) name = cells[0];
                            
                            return { 
                               id: `s_${Date.now()}_${i}`, 
                               name: name.trim().toUpperCase(), 
                               curso: idxCurso !== -1 ? cells[idxCurso] : 'General',
                               email: idxEmail !== -1 ? cells[idxEmail] : ''
                            };
                          });
                          setStudents(newStudents);
                          alert(`${newStudents.length} Estudiantes cargados con éxito.`);
                        };
                        reader.readAsText(file, 'ISO-8859-1');
                     }} />
                  </label>
               </div>
               <div className="liquid-glass p-12 text-indigo-950">
                  <h3 className="text-3xl font-black mb-6 italic tracking-tight flex items-center gap-4">
                     <Save className="text-rose-500" /> Backup del Sistema
                  </h3>
                  <div className="flex flex-col gap-4">
                    <button onClick={exportSystemData} className="w-full py-5 rounded-[2rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                        <Download size={20} /> Exportar JSON
                    </button>
                    <label className="w-full py-5 rounded-[2rem] border-2 border-slate-100 text-indigo-950 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 transition-all">
                        <Upload size={20} /> Importar JSON
                        <input type="file" accept=".json" className="hidden" onChange={(e) => {
                           const file = e.target.files[0];
                           if (file) {
                             const reader = new FileReader();
                             reader.onload = (f) => {
                               try {
                                 const data = JSON.parse(f.target.result);
                                 setStudents(data.students || []);
                                 setProjects(data.projects || []);
                                 setRubrics(data.rubrics || {});
                                 alert('Sistema restaurado con éxito.');
                               } catch(e) { alert('Error al procesar el archivo JSON.'); }
                             };
                             reader.readAsText(file);
                           }
                        }} />
                    </label>
                  </div>
               </div>
            </div>
        </main>
      </div>
    );
  }

  if (!selectedCourse) {
    const configCourses = currentTeacher.courses || [];
    const dataCourses = [...new Set(students.filter(s => hasAccess(currentTeacher, s.curso)).map(s => s.curso))];
    const courseMap = new Map();
    configCourses.forEach(c => { if (c !== 'General') courseMap.set(normalizeCourse(c), c); });
    dataCourses.forEach(c => { if (c !== 'General') courseMap.set(normalizeCourse(c), c); });
    const allCourses = Array.from(courseMap.values());

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
          <header className="fixed top-0 left-0 right-0 z-50 h-24 flex justify-between items-center px-12 border-b border-indigo-950/5 backdrop-blur-3xl bg-white/70">
             <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-950 text-white flex items-center justify-center font-black text-2xl italic shadow-2xl">
                   {currentTeacher.name.charAt(0)}
                </div>
                <h2 className="text-xl font-black text-indigo-950">{currentTeacher.name.toUpperCase()}</h2>
             </div>
             <button onClick={logout} className="flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-all">
                <LogOut size={16} /> Salir
             </button>
          </header>
          <main className="flex-1 pt-40 p-12 max-w-7xl mx-auto w-full">
             <h3 className="text-5xl font-black text-indigo-950 italic tracking-tighter mb-12">Mis Cursos</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {allCourses.map((curso, i) => (
                  <button key={i} onClick={() => setSelectedCourse(curso)} className="liquid-glass p-12 text-left group hover:scale-[1.03] transition-all duration-500 animate-in fade-in slide-in-from-bottom-8">
                     <div className="w-16 h-16 rounded-[2rem] bg-indigo-50 text-indigo-950 flex items-center justify-center mb-8 group-hover:bg-rose-500 group-hover:text-white transition-all shadow-inner">
                        <BookOpen size={32} />
                     </div>
                     <span className="text-4xl font-black text-indigo-950 uppercase italic tracking-tighter block mb-2">{curso}</span>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrar Aula <ChevronRight className="inline" size={14} /></span>
                  </button>
                ))}
             </div>
          </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 h-24 flex justify-between items-center px-12 border-b border-indigo-950/5 backdrop-blur-3xl bg-white/70">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => { 
               if (selectedProjectId) setSelectedProjectId(null);
               else setSelectedCourse(null);
            }} 
            className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-all shadow-sm"
          >
             <ArrowLeft size={24} />
          </button>
          <div>
            <h3 className="text-xl font-black text-indigo-950 leading-none">
              {selectedCourse.toUpperCase()}
              {currentProject && <span className="text-rose-500 mx-3 opacity-30">/</span>}
              {currentProject && <span className="text-slate-500 font-bold uppercase text-xs italic">{currentProject.name}</span>}
            </h3>
            <div className="flex gap-2 mt-2">
               {['dashboard', 'rosters', 'rubrics', 'assess', 'results'].map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all px-3 py-1.5 rounded-xl ${activeTab === tab ? 'text-white bg-indigo-950 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                   {tab === 'dashboard' ? 'Proyectos' : tab === 'rosters' ? 'Roster' : tab === 'rubrics' ? 'Rúbrica' : tab === 'assess' ? 'Evaluar' : 'Resultados'}
                 </button>
               ))}
            </div>
          </div>
        </div>
        <button onClick={logout} className="p-3 text-slate-300 hover:text-rose-500 transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 pt-32 p-12 max-w-7xl mx-auto w-full mb-24">
         <AnimatePresence mode="wait">
            <motion.div key={activeTab + (selectedProjectId || '')} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
               
               {activeTab === 'dashboard' && !selectedProjectId && (
                  <div className="space-y-12">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                        <div>
                           <h4 className="text-4xl font-black text-indigo-950 italic tracking-tighter">Panel de Proyectos</h4>
                           <p className="text-slate-400 font-medium">Primer Paso: Crea una actividad evaluativa para este curso.</p>
                        </div>
                        {!showNewProjectForm && (
                           <button onClick={() => setShowNewProjectForm(true)} className="px-10 py-5 rounded-[2.5rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl hover:bg-rose-500 transition-all">
                              <Plus size={20} /> Nueva Evaluación
                           </button>
                        )}
                     </div>

                     {showNewProjectForm && (
                        <div className="liquid-glass p-10 animate-in slide-in-from-top-4 duration-500 border-indigo-950/10">
                           <div className="flex justify-between items-center mb-8">
                              <h5 className="text-xl font-black text-indigo-950 uppercase italic tracking-tight flex items-center gap-3">
                                 <Plus className="text-rose-500" /> Configuración de Actividad
                              </h5>
                              <button onClick={() => setShowNewProjectForm(false)} className="text-slate-300 hover:text-rose-500 transition-colors uppercase font-black text-[10px]">Cancelar</button>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block pl-2">Título de Evaluación</label>
                                 <div className="relative">
                                    <Layers className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="text" value={newProjectData.name} onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})} placeholder="Ej: Oral Quiz Unit 1" className="w-full pl-14 pr-6 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-rose-500 outline-none transition-all font-bold text-sm" />
                                 </div>
                              </div>
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block pl-2">Unidad</label>
                                 <div className="relative">
                                    <Layers className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="text" value={newProjectData.unit} onChange={(e) => setNewProjectData({...newProjectData, unit: e.target.value})} placeholder="Ej: Unit 1" className="w-full pl-14 pr-6 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-rose-500 outline-none transition-all font-bold text-sm" />
                                 </div>
                              </div>
                              <div className="space-y-3">
                                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block pl-2">Objetivo Pedagógico</label>
                                 <div className="relative">
                                    <Target className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="text" value={newProjectData.objective} onChange={(e) => setNewProjectData({...newProjectData, objective: e.target.value})} placeholder="Ej: Use of Second Conditional" className="w-full pl-14 pr-6 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-rose-500 outline-none transition-all font-bold text-sm" />
                                 </div>
                              </div>
                           </div>
                           <button onClick={createNewProject} className="mt-10 px-12 py-5 rounded-[2.5rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-rose-500 transition-all flex items-center gap-3">
                              Siguiente: Definir Rúbrica <ChevronRight size={20} />
                           </button>
                        </div>
                     )}

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
                        {courseProjects.length === 0 ? (
                           <div className="col-span-full py-40 text-center liquid-glass border-dashed border-2 flex flex-col items-center">
                              <FolderOpen size={100} className="opacity-10 mb-6" />
                              <p className="text-slate-400 font-bold mb-6 text-xl">Sin actividades registradas.</p>
                           </div>
                        ) : (
                           courseProjects.map(p => (
                              <div key={p.id} className="liquid-glass p-10 flex flex-col justify-between group hover:border-rose-500/20 transition-all min-h-[320px]">
                                 <div 
                                    className="cursor-pointer flex-1"
                                    onClick={() => { setSelectedProjectId(p.id); setActiveTab('dashboard'); }}
                                 >
                                    <div className="flex justify-between items-start mb-8">
                                       <div className="w-14 h-14 rounded-[2rem] bg-indigo-50 text-rose-500 flex items-center justify-center group-hover:bg-indigo-950 group-hover:text-white transition-all shadow-inner">
                                          <ClipboardCheck size={28} />
                                       </div>
                                       <div className="flex flex-col items-end">
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{new Date(p.date).toLocaleDateString()}</span>
                                          {p.unit && <span className="bg-indigo-50 text-indigo-950 text-[8px] font-black px-2 py-1 rounded-lg mt-2 uppercase tracking-widest">{p.unit}</span>}
                                       </div>
                                    </div>
                                    <h5 className="text-3xl font-black text-indigo-950 uppercase italic tracking-tighter leading-tight group-hover:text-rose-500 transition-colors">{p.name}</h5>
                                    {p.objective && <p className="text-[10px] text-slate-400 font-black mt-3 uppercase tracking-widest opacity-60 leading-relaxed italic">{p.objective}</p>}
                                 </div>
                                 <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-50">
                                    <button onClick={(e) => { e.stopPropagation(); renameProject(p.id); }} className="p-4 text-slate-400 hover:text-indigo-950 transition-colors bg-slate-50 hover:bg-slate-100 rounded-2xl"><Pencil size={18} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} className="p-4 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 hover:bg-rose-50 rounded-2xl"><Trash2 size={18} /></button>
                                 </div>
                              </div>
                           ))
                        )}
                     </div>
                  </div>
               )}

               {activeTab === 'dashboard' && selectedProjectId && (
                  <div className="space-y-12">
                     <div className="flex items-center gap-4">
                        <div className="bg-rose-500 p-4 rounded-3xl text-white shadow-xl shadow-rose-500/20"><LayoutDashboard size={28} /></div>
                        <div>
                           <h4 className="text-4xl font-black text-indigo-950 italic tracking-tighter uppercase">Ruta de Evaluación</h4>
                           <p className="text-slate-400 font-medium">Sigue los pasos lógicos para calificar a este proyecto.</p>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         <div className="liquid-glass p-10 group cursor-pointer border-l-8 border-amber-500 hover:scale-[1.03] transition-all" onClick={() => setActiveTab('rubrics')}>
                            <div className="flex justify-between items-start mb-6">
                               <Settings size={40} className="text-amber-500" />
                               <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Paso 1</span>
                            </div>
                            <h4 className="text-2xl font-black text-indigo-950 mb-2 uppercase italic tracking-tighter">Configurar Rúbrica</h4>
                            <p className="text-slate-500 text-sm">Define criterios grupal e individual antes de evaluar.</p>
                            <ArrowRight className="mt-8 text-slate-200 group-hover:text-amber-500 transition-colors" />
                         </div>
                         <div className="liquid-glass p-10 group cursor-pointer border-l-8 border-emerald-500 hover:scale-[1.03] transition-all" onClick={() => setActiveTab('assess')}>
                            <div className="flex justify-between items-start mb-6">
                               <ClipboardCheck size={40} className="text-emerald-500" />
                               <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Paso 2</span>
                            </div>
                            <h4 className="text-2xl font-black text-indigo-950 mb-2 uppercase italic tracking-tighter">Calificar Grupos</h4>
                            <p className="text-slate-500 text-sm">Asigna alumnos a grupos y aplica la rúbrica en pantalla.</p>
                            <ArrowRight className="mt-8 text-slate-200 group-hover:text-emerald-500 transition-colors" />
                         </div>
                         <div className="liquid-glass p-10 group cursor-pointer border-l-8 border-rose-500 hover:scale-[1.03] transition-all" onClick={() => setActiveTab('results')}>
                            <div className="flex justify-between items-start mb-6">
                               <FileSpreadsheet size={40} className="text-rose-500" />
                               <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Paso 3</span>
                            </div>
                            <h4 className="text-2xl font-black text-indigo-950 mb-2 uppercase italic tracking-tighter">Ver Resultados</h4>
                            <p className="text-slate-500 text-sm">Genera promedios, feedback IA y certificados PDF.</p>
                            <ArrowRight className="mt-8 text-slate-200 group-hover:text-rose-500 transition-colors" />
                         </div>
                     </div>
                  </div>
               )}

               {activeTab === 'rosters' && (
                 <RosterManager students={filteredStudents} onUpdateStudents={(newList) => setStudents(newList)} teacher={currentTeacher} />
               )}

               {(activeTab === 'rubrics' || activeTab === 'assess' || activeTab === 'results') && !selectedProjectId && (
                 <div className="text-center py-40 liquid-glass border-dashed border-2 flex flex-col items-center">
                    <FolderOpen size={100} className="opacity-10 mb-8" />
                    <h5 className="text-3xl font-black text-indigo-950 italic uppercase tracking-tighter mb-4">Selecciona un Proyecto Primero</h5>
                    <p className="text-slate-400 mb-10 font-medium">Debes estar dentro de una actividad específica para evaluar o ver resultados.</p>
                    <button onClick={() => setActiveTab('dashboard')} className="px-12 py-5 rounded-[2.5rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-widest shadow-2xl">Ir al Panel de Actividades</button>
                 </div>
               )}

               {activeTab === 'rubrics' && selectedProjectId && (
                 <RubricManager rubrics={currentProject?.rubrics || {group:[], individual:[]}} onUpdateRubrics={handleUpdateRubrics} />
               )}

               {activeTab === 'assess' && selectedProjectId && (
                 <AssessmentEngine students={filteredStudents} rubrics={currentProject?.rubrics || {group:[], individual:[]}} assessments={currentProject?.assessments || INITIAL_ASSESSMENT_STATE} onUpdateAssessments={handleUpdateAssessments} selectedCourse={selectedCourse} />
               )}

               {activeTab === 'results' && selectedProjectId && (
                 <ResultsView students={filteredStudents} rubrics={currentProject?.rubrics || {group:[], individual:[]}} assessments={currentProject?.assessments || INITIAL_ASSESSMENT_STATE} />
               )}

            </motion.div>
         </AnimatePresence>
      </main>
    </div>
  );
}
