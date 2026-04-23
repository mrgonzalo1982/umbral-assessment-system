import React from 'react';
import { User, ShieldCheck, ChevronRight, BookOpen, Settings } from 'lucide-react';
import { TEACHERS } from '../utils/teachers';

export default function TeacherSelector({ onSelect, onAdmin }) {
  return (
    <div className="fixed inset-0 overflow-hidden z-[100] flex items-center justify-center p-6 bg-slate-50">
      {/* Liquid Blobs */}
      <div className="absolute inset-0 -z-10 bg-white">
         <div className="blob bg-rose-200/50 -top-40 -left-40 scale-150" />
         <div className="blob bg-indigo-200/30 -bottom-40 -right-40 scale-150" />
      </div>

      <div className="max-w-6xl w-full">
        <div className="text-center mb-16 animate-in fade-in zoom-in duration-700">
           <div className="flex justify-center mb-8">
              <div className="inline-flex bg-gradient-to-tr from-indigo-950 to-slate-800 p-6 rounded-[2.5rem] shadow-2xl relative">
                <BookOpen size={64} className="text-white" />
                <div className="absolute -top-4 -right-4 bg-rose-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg border-4 border-white animate-bounce">
                    V2.0 PRO
                </div>
              </div>
           </div>
           <h2 className="text-6xl font-black text-indigo-950 mb-3 tracking-tighter italic">Umbral Assessment</h2>
           <p className="text-slate-400 text-xl font-medium max-w-2xl mx-auto leading-relaxed">
             Sistema de Evaluación de Inglés • <span className="text-rose-500 font-bold">Colegio Umbral</span>
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {TEACHERS.map((teacher, index) => (
            <button
              key={teacher.id}
              onClick={() => onSelect(teacher)}
              style={{ animationDelay: `${index * 100}ms` }}
              className="liquid-glass group p-8 text-left hover:scale-105 active:scale-95 transition-all duration-500 overflow-hidden relative animate-in fade-in slide-in-from-bottom-8"
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-8 text-slate-400 group-hover:bg-rose-500 group-hover:text-white transition-all duration-500 shadow-inner">
                <User size={28} />
              </div>
              <h3 className="text-xl font-black text-indigo-950 mb-2 group-hover:text-rose-600 transition-colors leading-none tracking-tight">{teacher.name.toUpperCase()}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Docente Titular</p>
              
              <div className="flex items-center gap-3 text-rose-500 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-500">
                Entrar al Portal <ChevronRight size={14} />
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-8 mt-12 border-t border-slate-200 pt-12">
            <button 
              onClick={onAdmin}
              className="px-10 py-4 rounded-[2rem] bg-indigo-950/5 hover:bg-rose-500 hover:text-white text-indigo-950/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3 transition-all border border-indigo-950/5 hover:border-rose-500 hover:shadow-2xl shadow-rose-500/20"
            >
               <Settings size={18} /> Administración de Colegio
            </button>
            <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.4em]">
                Curauma • Valparaíso • Chile
            </p>
        </div>
      </div>
    </div>
  );
}
