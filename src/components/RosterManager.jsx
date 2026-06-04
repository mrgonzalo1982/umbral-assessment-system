import React, { useState } from 'react';
import { Users, Upload, Plus, Trash2, UserPlus, Save, Search, Filter } from 'lucide-react';
import { normalizeCourse, formatCourseDisplay } from '../utils/teachers';

export default function RosterManager({ students, onUpdateStudents, teacher }) {
  const [newName, setNewName] = useState('');
  const [newCurso, setNewCurso] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const addStudent = () => {
    if (!newName.trim()) return;
    const newStudent = { 
      id: `s_${Date.now()}`, 
      name: newName.trim().toUpperCase(), 
      curso: formatCourseDisplay(newCurso)
    };
    onUpdateStudents([...students, newStudent]);
    setNewName('');
  };

  const removeStudent = (id) => {
    onUpdateStudents(students.filter(s => s.id !== id));
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.curso.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Header Card */}
      <div className="liquid-glass p-6 md:p-10 flex flex-col sm:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
           <div className="bg-rose-500 p-5 rounded-[2rem] shadow-2xl shadow-rose-500/20 text-white">
              <Users size={32} />
           </div>
           <div>
              <h2 className="text-3xl md:text-4xl font-black text-indigo-950 italic tracking-tighter">Roster Maestro</h2>
              <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mt-1">Gestión de Matrícula</p>
           </div>
        </div>
        
        <div className="flex bg-indigo-950/5 p-2 rounded-3xl border border-white shadow-inner">
           <div className="px-6 py-2 border-r border-slate-200 flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase">Lista</span>
              <span className="text-3xl font-black text-indigo-950 italic">{students.length}</span>
           </div>
           <div className="px-6 py-2 flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase">Match</span>
              <span className="text-3xl font-black text-rose-500 italic">{filteredStudents.length}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Bar */}
        <div className="lg:col-span-1 space-y-6">
           <div className="liquid-glass p-8 md:p-10 space-y-6">
              <h3 className="text-xl font-black text-indigo-950 uppercase italic tracking-tight flex items-center gap-4 mb-4">
                 <UserPlus className="text-rose-500" /> Registro Manual
              </h3>
              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="JUAN PEREZ"
                      className="w-full px-6 py-5 rounded-3xl bg-white border-2 border-slate-50 focus:border-rose-500 focus:outline-none transition-all font-black text-sm uppercase shadow-inner"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Sigla de Curso</label>
                    <input 
                      type="text" 
                      value={newCurso}
                      onChange={(e) => setNewCurso(e.target.value)}
                      placeholder="7B"
                      className="w-full px-6 py-5 rounded-3xl bg-white border-2 border-slate-50 focus:border-rose-500 focus:outline-none transition-all font-black text-sm uppercase shadow-inner"
                    />
                 </div>
                 <button 
                   onClick={addStudent} 
                   className="w-full py-5 rounded-[2rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-950/20 hover:bg-rose-500 transition-all flex items-center justify-center gap-4"
                 >
                   <Plus size={22} /> Guardar Ficha
                 </button>
              </div>
           </div>

           <div className="liquid-glass p-10 bg-indigo-950 text-white relative overflow-hidden group">
              <div className="relative z-10">
                 <h3 className="text-2xl font-black mb-6 italic tracking-tight">Filtrar Roster</h3>
                 <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Nombre o Curso..."
                      className="w-full pl-16 pr-8 py-5 rounded-[2rem] bg-white/10 border border-white/10 focus:bg-white focus:text-indigo-950 focus:border-white focus:outline-none transition-all font-bold text-sm placeholder:text-slate-600"
                    />
                 </div>
              </div>
              <Filter className="absolute -bottom-10 -right-10 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-1000" size={150} />
           </div>
        </div>

        {/* Roster List Card */}
        <div className="lg:col-span-2 liquid-glass overflow-hidden flex flex-col min-h-[600px] border-none">
          <div className="p-8 md:p-10 border-b border-slate-50 flex justify-between items-center bg-white/50 backdrop-blur-md">
            <h3 className="text-2xl font-black text-indigo-950 flex items-center gap-4 italic tracking-tighter">
              <Users className="text-rose-500" size={32} /> Lista de Matrícula
            </h3>
            <button 
              onClick={() => { if (confirm('¿Borrar todo?')) onUpdateStudents([]); }}
              className="text-[10px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest transition-colors"
            >
              Vaciar Lista
            </button>
          </div>
          
          <div className="flex-1 max-h-[700px] overflow-y-auto p-8 md:p-10 space-y-4 custom-scrollbar bg-slate-50/20">
            {filteredStudents.map(student => (
              <div key={student.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-[2.5rem] bg-white border border-slate-100 hover:border-rose-200 transition-all group hover:scale-[1.01] hover:shadow-2xl hover:shadow-indigo-950/5">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 rounded-2xl bg-indigo-950 text-white flex items-center justify-center font-black text-2xl shadow-xl italic">
                      {student.name.charAt(0)}
                   </div>
                   <div className="flex flex-col">
                      <span className="font-black text-indigo-950 text-xl italic tracking-tighter mb-1">{student.name.toUpperCase()}</span>
                      <div className="flex items-center gap-3">
                         <span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest">{student.curso}</span>
                      </div>
                   </div>
                </div>
                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                  <button 
                    onClick={() => removeStudent(student.id)}
                    className="p-4 text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 rounded-2xl"
                  >
                    <Trash2 size={22} />
                  </button>
                </div>
              </div>
            ))}
            {filteredStudents.length === 0 && (
               <div className="text-center py-40 text-slate-200 flex flex-col items-center">
                  <Users size={100} className="opacity-10 mb-6" />
                  <p className="font-black text-2xl italic uppercase tracking-widest">Sin Coincidencias</p>
                  <p className="text-sm mt-2 font-medium">No se encontraron estudiantes registrados.</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
