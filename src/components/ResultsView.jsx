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
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Send
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
import autoTable from 'jspdf-autotable';

export default function ResultsView({ students = [], rubrics = { group: [], individual: [] }, assessments = {}, evaluationType = 'grupal-individual' }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // LOGGING FOR DEBUGGING - If the screen is still blank, these logs will help if the user takes a screenshot of the console.
  useEffect(() => {
    console.log("ResultsView Mounted:", { studentsLength: students?.length, rubrics, assessments });
  }, [students, rubrics, assessments]);

  // Robust Guards
  const safeRubricGroup = useMemo(() => Array.isArray(rubrics?.group) ? rubrics.group : [], [rubrics]);
  const safeRubricIndividual = useMemo(() => Array.isArray(rubrics?.individual) ? rubrics.individual : [], [rubrics]);
  const safeAssessments = assessments || {};
  const safeStudentGroups = safeAssessments.studentGroups || {};

   const maxTotal = useMemo(() => {
    try {
      let g = 0;
      let i = 0;
      
      if (evaluationType !== 'individual') {
        g = safeRubricGroup.reduce((t, c) => t + (4 * (parseFloat(c?.weight) || 1)), 0);
      }
      
      if (evaluationType !== 'grupal') {
        i = safeRubricIndividual.reduce((t, c) => t + (4 * (parseFloat(c?.weight) || 1)), 0);
      }
      
      return Math.max(1, g + i);
    } catch (e) { 
      console.error("Error calculating maxTotal:", e);
      return 1; 
    }
  }, [safeRubricGroup, safeRubricIndividual, evaluationType]);

  const results = useMemo(() => {
    if (!Array.isArray(students) || students.length === 0) return [];
    
    return students.map(s => {
      if (!s) return null;
      try {
        const groupId = safeStudentGroups[s.id];
        const gScores = safeAssessments?.groupScores?.[groupId] || {};
        const iScores = safeAssessments?.individualScores?.[s.id] || {};
        
        let gScoreTotal = 0;
        if (evaluationType !== 'individual') {
           gScoreTotal = safeRubricGroup.reduce((t, cr) => t + (((parseFloat(gScores[cr?.id])) || 0) * (parseFloat(cr?.weight) || 1)), 0);
        }

        let iScoreTotal = 0;
        if (evaluationType !== 'grupal') {
           iScoreTotal = safeRubricIndividual.reduce((t, cr) => t + (((parseFloat(iScores[cr?.id])) || 0) * (parseFloat(cr?.weight) || 1)), 0);
        }

        const total = gScoreTotal + iScoreTotal;
        const mark = calculateChileanMark(total, maxTotal);
        const isPassing = parseFloat(mark) >= 4.0;

        let gMaxTotal = 0;
        if (evaluationType !== 'individual') {
          gMaxTotal = safeRubricGroup.reduce((t, c) => t + (4 * (parseFloat(c?.weight) || 1)), 0);
        }
        const gMark = gMaxTotal > 0 ? calculateChileanMark(gScoreTotal, gMaxTotal) : null;

        let iMaxTotal = 0;
        if (evaluationType !== 'grupal') {
          iMaxTotal = safeRubricIndividual.reduce((t, c) => t + (4 * (parseFloat(c?.weight) || 1)), 0);
        }
        const iMark = iMaxTotal > 0 ? calculateChileanMark(iScoreTotal, iMaxTotal) : null;

        return {
          id: s.id,
          name: s.name ? String(s.name).toUpperCase() : 'ESTUDIANTE SIN NOMBRE',
          email: s.email || '',
          groupId: groupId,
          group: groupId ? (safeAssessments.groups?.find(g => g.id === groupId)?.name?.toUpperCase() || 'GRUPO DESCONOCIDO') : 'SIN GRUPO',
          gScoreTotal,
          iScoreTotal,
          total,
          mark: mark || "1.0",
          gMark,
          iMark,
          isPassing,
          gScores,
          iScores
        };
      } catch (err) {
        console.error("Error computing student result for:", s.name, err);
        return null;
      }
    }).filter(r => r !== null);
  }, [students, safeRubricGroup, safeRubricIndividual, safeAssessments, maxTotal]);

  const selectedStudent = useMemo(() => results.find(r => r.id === selectedStudentId), [results, selectedStudentId]);

  const radarData = useMemo(() => {
    if (!selectedStudent) return [];
    try {
      const groupData = safeRubricGroup.map(cr => ({
        subject: cr.title || 'Criterio',
        A: parseFloat(selectedStudent.gScores?.[cr.id]) || 0,
        fullMark: 4
      }));
      const indivData = safeRubricIndividual.map(cr => ({
        subject: cr.title || 'Criterio',
        A: parseFloat(selectedStudent.iScores?.[cr.id]) || 0,
        fullMark: 4
      }));
      return [...groupData, ...indivData];
    } catch (e) { 
      console.error("Error calculating radarData:", e);
      return []; 
    }
  }, [selectedStudent, safeRubricGroup, safeRubricIndividual]);

  const generateFeedback = (res) => {
    if (!res || res.total === 0) return "Evaluación pendiente.";
    try {
      let text = `En tu evaluación de ${res.group}, has obtenido un ${res.mark}. `;
      const gObs = safeAssessments?.groupObservations?.[res.groupId];
      if (gObs) text += `\nComentario Grupal: ${gObs}. `;
      const obs = safeAssessments?.observations?.[res.id];
      if (obs) text += `\nComentario Individual: ${obs}. `;
      return text;
    } catch (e) { return "Reporte generado con éxito."; }
  };

  const generatePDFContent = (doc, res) => {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const startPage = (doc.internal.getNumberOfPages && typeof doc.internal.getNumberOfPages === 'function') ? doc.internal.getNumberOfPages() : (doc.internal.pages && doc.internal.pages.length ? doc.internal.pages.length - 1 : 1);
    
    // 1. Header (Dark block)
    doc.setFillColor(30, 27, 75); // Indigo 950
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("PUNTAJES Y COMENTARIOS", pageWidth / 2, 14, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(244, 63, 94); // Rose 500
    doc.text("COLEGIO UMBRAL DE CURAUMA", pageWidth / 2, 20, { align: 'center' });

    // 2. Student Info Card
    let currentY = 32;
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.roundedRect(15, currentY, pageWidth - 30, 24, 3, 3, 'FD');
    
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("ESTUDIANTE:", 20, currentY + 8);
    doc.setFont("helvetica", "normal");
    doc.text(res.name, 45, currentY + 8);
    
    doc.setFont("helvetica", "bold");
    doc.text("CURSO/GRUPO:", 20, currentY + 16);
    doc.setFont("helvetica", "normal");
    doc.text(res.group, 50, currentY + 16);
    
    // Mark block
    doc.setFillColor(res.isPassing ? 37 : 244, res.isPassing ? 99 : 63, res.isPassing ? 235 : 94); // Blue or Rose
    doc.roundedRect(pageWidth - 45, currentY + 3, 26, 18, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("NOTA FINAL", pageWidth - 32, currentY + 9, { align: 'center' });
    doc.setFontSize(14);
    doc.text(res.mark, pageWidth - 32, currentY + 17, { align: 'center' });

    currentY += 28;

    // Sub-grades if applicable
    if (evaluationType !== 'individual' && res.gMark) {
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.text(`Nota Grupal: ${res.gMark}`, 20, currentY);
      currentY += 5;
    }
    if (evaluationType !== 'grupal' && res.iMark) {
      doc.setTextColor(100);
      doc.setFontSize(9);
      doc.text(`Nota Individual: ${res.iMark}`, 20, currentY);
      currentY += 5;
    }
    currentY += 3;

    // 3. Feedback box
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Observación / Retroalimentación:", 15, currentY);
    currentY += 4;

    const feedbackText = generateFeedback(res);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    
    const splitText = doc.splitTextToSize(feedbackText, pageWidth - 40);
    const feedbackHeight = splitText.length * 4 + 6;
    
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(241, 245, 249); 
    doc.roundedRect(15, currentY, pageWidth - 30, feedbackHeight, 2, 2, 'FD');
    doc.setTextColor(71, 85, 105); 
    doc.text(splitText, 20, currentY + 5);
    
    currentY += feedbackHeight + 8;

    // 4. AutoTable for Criteria
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Desglose de Puntajes:", 15, currentY);
    currentY += 3;

    const tableData = [];
    if (evaluationType !== 'individual' && safeRubricGroup.length > 0) {
      tableData.push([{ content: 'Criterios Grupales', colSpan: 2, styles: { fillColor: [226, 232, 240], textColor: [30, 27, 75], fontStyle: 'bold' } }]);
      safeRubricGroup.forEach(cr => {
        tableData.push([cr.title, `${res.gScores?.[cr.id] || 0} / 4`]);
      });
    }

    if (evaluationType !== 'grupal' && safeRubricIndividual.length > 0) {
      tableData.push([{ content: 'Criterios Individuales', colSpan: 2, styles: { fillColor: [226, 232, 240], textColor: [30, 27, 75], fontStyle: 'bold' } }]);
      safeRubricIndividual.forEach(cr => {
        tableData.push([cr.title, `${res.iScores?.[cr.id] || 0} / 4`]);
      });
    }

    if (tableData.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [['Criterio', 'Puntaje Obtenido']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 27, 75], textColor: 255, fontSize: 8, cellPadding: 2 },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
        columnStyles: {
          1: { halign: 'center', cellWidth: 40, fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 }
      });
    }
    
    // Add footers from startPage to the new endPage
    const endPage = (doc.internal.getNumberOfPages && typeof doc.internal.getNumberOfPages === 'function') ? doc.internal.getNumberOfPages() : (doc.internal.pages && doc.internal.pages.length ? doc.internal.pages.length - 1 : 1);
    for (let i = startPage; i <= endPage; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.setFont("helvetica", "normal");
      doc.text(`Generado el: ${new Date().toLocaleDateString()} - Departamento de Inglés, Colegio Umbral de Curauma`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
    doc.setPage(endPage);
  };

  const exportPDF = (res) => {
    try {
      const doc = new jsPDF();
      generatePDFContent(doc, res);
      doc.save(`Reporte_${res.name}.pdf`);
    } catch (e) { 
      console.error(e);
      alert("Error PDF: " + e.message); 
    }
  };

  const exportAllPDFs = () => {
    try {
      const doc = new jsPDF();
      const validResults = results.filter(r => r.total > 0);
      
      if (validResults.length === 0) return alert("No hay evaluaciones completadas para exportar.");
      
      validResults.forEach((res, index) => {
        if (index > 0) doc.addPage();
        generatePDFContent(doc, res);
      });
      
      doc.save(`Reportes_Curso_Completo.pdf`);
    } catch (e) { 
      console.error(e);
      alert("Error generando PDF masivo: " + e.message); 
    }
  };

  const sendEmail = (res) => {
    if (!res.email) return alert("Sin email");
    const subject = encodeURIComponent(`English Assessment Results - ${res.name}`);
    const body = encodeURIComponent(`Hello ${res.name.split(' ')[0]},\n\nHere are your results for the latest English assessment:\n\nFINAL GRADE: ${res.mark}\n\nFEEDBACK:\n${generateFeedback(res)}\n\nSCORE BREAKDOWN:\n${[...safeRubricGroup, ...safeRubricIndividual].map(cr => `- ${cr.title}: ${res.gScores?.[cr.id] || res.iScores?.[cr.id] || 0}/4`).join('\n')}\n\nBest regards,\nEnglish Department`);
    window.location.href = `mailto:${res.email}?subject=${subject}&body=${body}`;
  };

  const sendAllEmails = async () => {
    if (!window.confirm("¿Enviar reportes por correo a todos los estudiantes con email registrado?")) return;
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      let count = 0;
      for (const res of results.filter(r => r.total > 0 && r.email)) {
        await addDoc(collection(db, 'mail'), {
          to: res.email,
          message: {
            subject: `English Assessment Results - ${res.name}`,
            html: `
              <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
                <!-- Header -->
                <div style="background-color: #1e1b4b; padding: 40px 30px; text-align: center; border-bottom: 5px solid #f43f5e;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-style: italic; font-weight: 900; letter-spacing: -1px;">English Department</h1>
                  <p style="color: #f43f5e; margin: 5px 0 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Colegio Umbral de Curauma</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                  <h2 style="color: #1e1b4b; font-size: 20px; margin-top: 0;">Hello ${res.name.split(' ')[0]},</h2>
                  <p style="color: #64748b; font-size: 16px; line-height: 1.6;">Here are your results for the latest English assessment. Keep up the great work!</p>
                  
                  <!-- Grade Card -->
                  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 15px; padding: 25px; text-align: center; margin: 30px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Final Grade</p>
                    <p style="margin: 10px 0 0 0; font-size: 48px; font-weight: 900; color: ${res.isPassing ? '#2563eb' : '#f43f5e'};">${res.mark}</p>
                  </div>
                  
                  <!-- Feedback Section -->
                  <h3 style="color: #1e1b4b; font-size: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-top: 40px;">Pedagogical Feedback</h3>
                  <div style="background-color: #e0e7ff; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 0 10px 10px 0; margin-top: 15px;">
                    <p style="margin: 0; color: #312e81; font-size: 15px; line-height: 1.6; font-style: italic;">
                      ${generateFeedback(res).replace(/\n/g, '<br>')}
                    </p>
                  </div>
                  
                  <!-- Detail Score -->
                  <h3 style="color: #1e1b4b; font-size: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-top: 40px;">Score Breakdown</h3>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    ${[...safeRubricGroup, ...safeRubricIndividual].map(cr => {
                      const s = (res.gScores?.[cr.id] || res.iScores?.[cr.id] || 0);
                      return `
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 14px;">${cr.title}</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #1e1b4b; font-size: 14px; font-weight: bold; text-align: right;">${s} / 4</td>
                      </tr>
                      `;
                    }).join('')}
                  </table>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f1f5f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">This is an automated message from the English Department Evaluation System.</p>
                  <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} Colegio Umbral de Curauma</p>
                </div>
              </div>
            `
          }
        });
        count++;
      }
      alert(`¡Éxito! ${count} correos encolados para envío. (Requiere extensión Trigger Email en Firebase)`);
    } catch (e) {
      console.error(e);
      alert("Error encolando correos: " + e.message);
    }
  };

  const exportToCSV = () => {
    if (!results || results.length === 0) return alert("No hay datos para exportar.");
    
    const validResults = results.filter(r => r.total > 0);
    if (validResults.length === 0) return alert("No hay evaluaciones completadas para exportar.");

    const activeCriteria = [
      ...(evaluationType !== 'individual' ? safeRubricGroup : []),
      ...(evaluationType !== 'grupal' ? safeRubricIndividual : [])
    ];
    
    let csvContent = "\uFEFFsep=;\n"; // BOM for Excel UTF-8 support + Excel separator indicator
    
    let headers = ["Estudiante", "Grupo/Curso", "Nota Final", "Puntaje Total", "Feedback IA", ...activeCriteria.map(c => c.title)];
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(";") + "\n";
    
    validResults.forEach(res => {
      const row = [
        res.name,
        res.group,
        res.mark,
        res.total.toFixed(1),
        generateFeedback(res).replace(/\n/g, ' ')
      ];
      
      activeCriteria.forEach(cr => {
        const s = res.gScores?.[cr.id] || res.iScores?.[cr.id] || 0;
        row.push(s);
      });
      
      csvContent += row.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(";") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Resultados_Evaluacion.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 print:p-0 print:space-y-0">
      
      {/* ECO-PRINT View (Only visible when printing) */}
      <div className="hidden print:block w-full text-black bg-white">
         {results.filter(r => r.total > 0).map(res => (
            <div key={res.id} className="print-page-break-after p-8 border border-black mb-8 rounded-xl break-inside-avoid">
               <h1 className="text-3xl font-black text-center mb-2">COLEGIO UMBRAL DE CURAUMA</h1>
               <h2 className="text-xl text-center mb-6 uppercase border-b-2 border-black pb-4">REPORTE PEDAGÓGICO DE INGLÉS</h2>
               
               <div className="flex justify-between items-end mb-6">
                  <div>
                     <p><strong>ESTUDIANTE:</strong> {res.name}</p>
                     <p><strong>GRUPO/CURSO:</strong> {res.group}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-5xl font-black">{res.mark}</p>
                     <p className="text-sm">CALIFICACIÓN FINAL</p>
                  </div>
               </div>

               <div className="mb-6 p-4 bg-gray-100 rounded-xl border border-gray-300">
                  <h3 className="font-bold mb-2">Retroalimentación IA:</h3>
                  <p className="text-sm whitespace-pre-wrap">{generateFeedback(res)}</p>
               </div>

               <h3 className="font-bold border-b border-black mb-2">Detalle de Rúbrica (Puntajes)</h3>
               <table className="w-full text-xs text-left mb-4 border-collapse">
                 <thead>
                   <tr className="border-b border-black">
                     <th className="py-1">Criterio (Grupo)</th>
                     <th className="py-1">Puntaje</th>
                   </tr>
                 </thead>
                 <tbody>
                   {safeRubricGroup.map(cr => (
                     <tr key={cr.id} className="border-b border-gray-300">
                       <td className="py-1 pr-4">{cr.title}</td>
                       <td className="py-1 font-bold">{res.gScores[cr.id] || 0} / 4</td>
                     </tr>
                   ))}
                 </tbody>
               </table>

               <table className="w-full text-xs text-left border-collapse">
                 <thead>
                   <tr className="border-b border-black">
                     <th className="py-1">Criterio (Individual)</th>
                     <th className="py-1">Puntaje</th>
                   </tr>
                 </thead>
                 <tbody>
                   {safeRubricIndividual.map(cr => (
                     <tr key={cr.id} className="border-b border-gray-300">
                       <td className="py-1 pr-4">{cr.title}</td>
                       <td className="py-1 font-bold">{res.iScores[cr.id] || 0} / 4</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
         ))}
      </div>

      {/* Main UI (Hidden when printing) */}
      <div className="print:hidden space-y-10">
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
               <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={sendAllEmails}
                    title="Enviar correos a todos"
                    className="h-11 px-4 bg-white/15 hover:bg-white/25 text-white rounded-2xl transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border border-white/20"
                  >
                    <Send size={16} /> Enviar
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="h-11 px-5 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg"
                  >
                    <FileSpreadsheet size={16} /> Excel
                  </button>
                  <button
                    onClick={exportAllPDFs}
                    className="h-11 px-5 bg-white text-indigo-950 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-rose-500 hover:text-white transition-all shadow-lg"
                  >
                    <FileText size={16} /> Descargar PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="h-11 px-5 bg-white/15 hover:bg-white/25 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest items-center gap-2 transition-all border border-white/20 hidden lg:flex"
                  >
                    <Printer size={16} /> Eco-Print
                  </button>
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
                           {[
                             ...(evaluationType !== 'individual' ? safeRubricGroup : []),
                             ...(evaluationType !== 'grupal' ? safeRubricIndividual : [])
                           ].map(cr => {
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
    </div>
  );
}
