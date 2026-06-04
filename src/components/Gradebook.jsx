import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Search, 
  Award, 
  Users, 
  BookOpen, 
  TrendingUp 
} from 'lucide-react';
import { calculateProjectGrade } from '../utils/grading';

export default function Gradebook({ students = [], projects = [] }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    return students.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  // Calculate grades matrix
  const gradebookData = useMemo(() => {
    return filteredStudents.map(student => {
      const projectGrades = {};
      let totalGradesSum = 0;
      let gradedProjectsCount = 0;

      projects.forEach(project => {
        const grade = calculateProjectGrade(student.id, project);
        projectGrades[project.id] = grade;
        
        if (grade) {
          totalGradesSum += parseFloat(grade);
          gradedProjectsCount++;
        }
      });

      const average = gradedProjectsCount > 0 
        ? (totalGradesSum / gradedProjectsCount).toFixed(1) 
        : null;

      return {
        student,
        grades: projectGrades,
        average,
        isPassing: average ? parseFloat(average) >= 4.0 : null
      };
    });
  }, [filteredStudents, projects]);

  // Class statistics
  const stats = useMemo(() => {
    let sumAverages = 0;
    let countAverages = 0;
    let passingCount = 0;

    gradebookData.forEach(row => {
      if (row.average) {
        sumAverages += parseFloat(row.average);
        countAverages++;
        if (row.isPassing) {
          passingCount++;
        }
      }
    });

    const courseAverage = countAverages > 0 
      ? (sumAverages / countAverages).toFixed(1) 
      : '0.0';
      
    const passingRate = countAverages > 0 
      ? Math.round((passingCount / countAverages) * 100) 
      : 0;

    return {
      courseAverage,
      passingRate,
      gradedCount: countAverages,
      totalStudents: students.length
    };
  }, [gradebookData, students]);

  // Export to Excel (CSV)
  const exportToCSV = () => {
    if (students.length === 0) return alert("No hay estudiantes para exportar.");
    
    let csvContent = "\uFEFFsep=;\n"; // UTF-8 BOM + Excel separator indicator
    
    // Headers
    const headers = ["Estudiante", ...projects.map(p => p.name), "Promedio Final"];
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(";") + "\n";
    
    // Rows
    students.forEach(student => {
      const row = [student.name];
      let sum = 0;
      let count = 0;
      
      projects.forEach(p => {
        const grade = calculateProjectGrade(student.id, p);
        row.push(grade || "-");
        if (grade) {
          sum += parseFloat(grade);
          count++;
        }
      });
      
      const avg = count > 0 ? (sum / count).toFixed(1) : "-";
      row.push(avg);
      csvContent += row.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(";") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Libro_de_Notas_${projects[0]?.course || 'Curso'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="liquid-glass-dark p-8 text-white flex flex-col justify-between overflow-hidden relative col-span-2 rounded-[2rem]">
          <div className="relative z-10">
            <h4 className="text-3xl font-black italic tracking-tighter">Resumen de Calificaciones</h4>
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Consolidado general de notas del curso</p>
          </div>
          <div className="mt-8 flex gap-6 items-end relative z-10">
            <button 
              onClick={exportToCSV}
              className="h-12 px-6 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg active:scale-95"
            >
              <Download size={16} /> Exportar Excel
            </button>
          </div>
          <Award size={160} className="absolute -bottom-6 -right-6 opacity-5" />
        </div>

        <div className="liquid-glass p-6 flex flex-col items-center justify-center border-l-4 border-blue-500 bg-white/60 rounded-[2rem]">
          <TrendingUp size={28} className="text-blue-500 mb-2" />
          <span className="text-3xl font-black text-indigo-950">{stats.courseAverage}</span>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Promedio Curso</span>
        </div>

        <div className="liquid-glass p-6 flex flex-col items-center justify-center border-l-4 border-emerald-500 bg-white/60 rounded-[2rem]">
          <Users size={28} className="text-emerald-500 mb-2" />
          <span className="text-3xl font-black text-indigo-950">{stats.passingRate}%</span>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Aprobación</span>
        </div>
      </div>

      {/* Main Gradebook Card */}
      <div className="liquid-glass overflow-hidden shadow-2xl border-none bg-white/80 rounded-[2rem]">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center bg-white/50 gap-4">
          <h3 className="text-xl font-black text-indigo-950 uppercase italic tracking-tighter flex items-center gap-3">
            <FileSpreadsheet className="text-rose-600" size={22} /> Libro de Notas
          </h3>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar estudiante..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-white border-2 border-slate-100 focus:border-rose-500 outline-none transition-all font-bold text-xs shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {projects.length === 0 ? (
            <div className="py-24 text-center text-slate-400 italic">
              <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
              Aún no hay evaluaciones creadas para este curso.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                <tr className="border-b border-slate-100">
                  <th className="px-8 py-4 min-w-[200px]">Estudiante</th>
                  {projects.map(p => (
                    <th key={p.id} className="px-6 py-4 text-center min-w-[120px] max-w-[180px] truncate" title={p.name}>
                      {p.name}
                    </th>
                  ))}
                  <th className="px-8 py-4 text-center min-w-[100px] bg-slate-100/50">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {gradebookData.map(({ student, grades, average, isPassing }) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-indigo-950 text-sm tracking-tight">{student.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest">{student.email || 'Sin correo'}</p>
                        </div>
                      </div>
                    </td>
                    {projects.map(p => {
                      const grade = grades[p.id];
                      const isPassingGrade = grade ? parseFloat(grade) >= 4.0 : null;
                      return (
                        <td 
                          key={p.id} 
                          className={`px-6 py-4 text-center font-black text-sm ${
                            grade 
                              ? (isPassingGrade ? 'text-blue-600' : 'text-rose-600') 
                              : 'text-slate-300 font-normal'
                          }`}
                        >
                          {grade || '-'}
                        </td>
                      );
                    })}
                    <td 
                      className={`px-8 py-4 text-center text-lg font-black bg-slate-50/30 ${
                        average 
                          ? (isPassing ? 'text-blue-600 bg-blue-50/10' : 'text-rose-600 bg-rose-50/10') 
                          : 'text-slate-300 font-normal'
                      }`}
                    >
                      {average || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
