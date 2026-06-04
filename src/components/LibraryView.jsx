import React, { useState, useMemo } from 'react';
import { 
  Library, 
  Search, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Upload, 
  BookOpen, 
  Sparkles, 
  User, 
  Calendar, 
  X, 
  ChevronRight, 
  Layers,
  Info,
  Check
} from 'lucide-react';
import { parseRawRubric } from '../utils/rubricParser';

export default function LibraryView({ 
  sharedTemplates = [], 
  publishToLibrary, 
  deleteFromLibrary, 
  importTemplateToCourse, 
  currentTeacher, 
  isAdminMode, 
  user 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [expandedTemplateId, setExpandedTemplateId] = useState(null);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [importType, setImportType] = useState('ai'); // 'ai' or 'json'
  const [templateName, setTemplateName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedCourseMap, setSelectedCourseMap] = useState({}); // { tplId: courseName }

  // Search and filter templates
  const filteredTemplates = useMemo(() => {
    return sharedTemplates.filter(tpl => {
      const nameMatch = tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        tpl.author.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Determine skill and type from rubric structure if not explicitly stored
      const hasGroup = Array.isArray(tpl.rubric?.group) && tpl.rubric.group.length > 0;
      const hasIndividual = Array.isArray(tpl.rubric?.individual) && tpl.rubric.individual.length > 0;
      
      let tplType = 'grupal-individual';
      if (hasGroup && !hasIndividual) tplType = 'grupal';
      if (!hasGroup && hasIndividual) tplType = 'individual';
      
      // Skill check (looking for markers in titles or default to Writing)
      const lowerName = tpl.name.toLowerCase();
      const tplSkill = lowerName.includes('speaking') || lowerName.includes('oral') ? 'Speaking' : 'Writing';

      const matchesSkill = skillFilter === 'All' || tplSkill === skillFilter;
      const matchesType = typeFilter === 'All' || tplType === typeFilter;

      return nameMatch && matchesSkill && matchesType;
    });
  }, [sharedTemplates, searchQuery, skillFilter, typeFilter]);

  const toggleExpand = (id) => {
    setExpandedTemplateId(expandedTemplateId === id ? null : id);
  };

  const handleJsonUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!templateName.trim()) {
      alert("Por favor ingresa un nombre para la plantilla antes de subir el archivo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rubricData = JSON.parse(event.target.result);
        
        // Validation
        if (!rubricData || (!rubricData.group && !rubricData.individual)) {
          throw new Error("El archivo JSON no tiene un formato de rúbrica válido (debe contener campos 'group' y/o 'individual').");
        }

        setIsPublishing(true);
        const success = await publishToLibrary(templateName, rubricData);
        setIsPublishing(false);

        if (success) {
          alert("✅ Plantilla importada y publicada en la biblioteca.");
          setShowAddModal(false);
          setTemplateName('');
        } else {
          alert("Error al guardar la plantilla en la base de datos.");
        }
      } catch (err) {
        alert("Error al leer el archivo JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleAiPublish = async () => {
    if (!templateName.trim()) {
      alert("Por favor ingresa un nombre para la plantilla.");
      return;
    }
    if (!pastedText.trim()) {
      alert("Pega el texto de la rúbrica primero.");
      return;
    }

    setIsPublishing(true);
    const parsedRubric = parseRawRubric(pastedText);
    
    if (parsedRubric.group.length === 0 && parsedRubric.individual.length === 0) {
      setIsPublishing(false);
      alert("No se pudieron detectar criterios válidos. Asegúrate de estructurar el texto con niveles 4, 3, 2, 1 antes de cada descriptor.");
      return;
    }

    const success = await publishToLibrary(templateName, parsedRubric);
    setIsPublishing(false);

    if (success) {
      alert(`✅ Rúbrica publicada. Se importaron ${parsedRubric.group.length + parsedRubric.individual.length} criterios.`);
      setShowAddModal(false);
      setTemplateName('');
      setPastedText('');
    } else {
      alert("Error al compartir la rúbrica.");
    }
  };

  const downloadTemplateJson = (tpl) => {
    const dataStr = JSON.stringify(tpl.rubric, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rubrica_${tpl.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCourseImport = (tpl) => {
    const course = selectedCourseMap[tpl.id];
    if (!course) {
      alert("Por favor selecciona un curso del menú desplegable.");
      return;
    }
    importTemplateToCourse(tpl.rubric, course);
  };

  const handleDelete = async (tpl) => {
    const isOwner = user && tpl.authorEmail === user.email;
    if (!isOwner && !isAdminMode) {
      alert("No tienes permisos para eliminar esta rúbrica ya que no eres su autor.");
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar la rúbrica "${tpl.name}" de la biblioteca compartida?`)) {
      await deleteFromLibrary(tpl.id);
    }
  };

  const getTemplateType = (tpl) => {
    const hasGroup = Array.isArray(tpl.rubric?.group) && tpl.rubric.group.length > 0;
    const hasIndividual = Array.isArray(tpl.rubric?.individual) && tpl.rubric.individual.length > 0;
    if (hasGroup && !hasIndividual) return 'Grupal';
    if (!hasGroup && hasIndividual) return 'Individual';
    return 'Híbrida';
  };

  const getTemplateSkill = (tpl) => {
    const lowerName = tpl.name.toLowerCase();
    return lowerName.includes('speaking') || lowerName.includes('oral') ? 'Speaking 🗣️' : 'Writing ✍️';
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto p-2">
      
      {/* HEADER CARD */}
      <div className="liquid-glass-dark p-10 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden rounded-[2.5rem] shadow-2xl">
        <div className="relative z-10">
          <h2 className="text-4xl font-black italic tracking-tighter uppercase flex items-center gap-4">
            <Library size={40} className="text-rose-500" /> Biblioteca del Departamento
          </h2>
          <p className="text-slate-300 mt-2 font-medium">Visualiza, comparte y asigna rúbricas estandarizadas a tus cursos asignados.</p>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="relative z-10 px-8 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <Plus size={16} /> Compartir Rúbrica
        </button>
        
        <Library size={220} className="absolute -bottom-10 -right-10 opacity-5" />
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre de rúbrica, autor o palabra clave..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-rose-500 focus:bg-white outline-none transition-all font-bold text-sm shadow-inner"
          />
        </div>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <select 
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="flex-1 lg:w-44 px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent font-black text-[10px] uppercase tracking-widest outline-none focus:border-rose-500 shadow-sm"
          >
            <option value="All">Habilidad: Todas</option>
            <option value="Speaking">Speaking 🗣️</option>
            <option value="Writing">Writing ✍️</option>
          </select>
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 lg:w-48 px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent font-black text-[10px] uppercase tracking-widest outline-none focus:border-rose-500 shadow-sm"
          >
            <option value="All">Tipo: Todos</option>
            <option value="grupal">Solo Grupal</option>
            <option value="individual">Solo Individual</option>
            <option value="grupal-individual">Híbrida</option>
          </select>
        </div>
      </div>

      {/* TEMPLATES GRID */}
      {filteredTemplates.length === 0 ? (
        <div className="py-28 text-center bg-white border border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center">
          <BookOpen size={64} className="text-slate-200 mb-4" />
          <p className="text-slate-500 font-bold text-lg">No se encontraron rúbricas</p>
          <p className="text-slate-400 text-sm mt-1">Prueba cambiando los filtros de búsqueda o publica una nueva rúbrica.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTemplates.map(tpl => {
            const isExpanded = expandedTemplateId === tpl.id;
            const hasGroup = Array.isArray(tpl.rubric?.group) && tpl.rubric.group.length > 0;
            const hasIndividual = Array.isArray(tpl.rubric?.individual) && tpl.rubric.individual.length > 0;
            const isAuthor = user && tpl.authorEmail === user.email;

            return (
              <div 
                key={tpl.id} 
                className={`liquid-glass overflow-hidden transition-all duration-300 border ${
                  isExpanded ? 'border-rose-200 shadow-2xl bg-white/95' : 'border-indigo-950/5 hover:border-rose-100 hover:shadow-md'
                } rounded-[2rem]`}
              >
                {/* TEMPLATE HEADER */}
                <div className="p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-indigo-950 text-white px-2.5 py-1 rounded">
                        {getTemplateSkill(tpl)}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-rose-50 text-rose-500 px-2.5 py-1 rounded">
                        {getTemplateType(tpl)}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-slate-100 text-slate-500 px-2.5 py-1 rounded">
                        Criterios: {(tpl.rubric?.group?.length || 0) + (tpl.rubric?.individual?.length || 0)}
                      </span>
                    </div>
                    
                    <h3 className="text-2xl font-black text-indigo-950 uppercase italic tracking-tighter leading-none mb-3">
                      {tpl.name}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><User size={12} className="text-slate-300" /> Por: {tpl.author}</span>
                      <span className="flex items-center gap-1"><Calendar size={12} className="text-slate-300" /> {new Date(tpl.date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* HEADER ACTIONS */}
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Course import dropdown (Only if teacher is authenticated and has courses) */}
                    {currentTeacher ? (
                      <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        <select
                          value={selectedCourseMap[tpl.id] || ''}
                          onChange={(e) => setSelectedCourseMap({ ...selectedCourseMap, [tpl.id]: e.target.value })}
                          className="bg-transparent text-[10px] font-black uppercase tracking-widest text-indigo-950 outline-none px-2.5"
                        >
                          <option value="">Selecciona Curso...</option>
                          {(currentTeacher.courses || []).map(course => (
                            <option key={course} value={course}>{course}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleCourseImport(tpl)}
                          disabled={!selectedCourseMap[tpl.id]}
                          className="px-3.5 py-2 bg-indigo-950 hover:bg-rose-500 text-white rounded-lg font-black text-[9px] uppercase tracking-widest transition-all disabled:opacity-40"
                        >
                          Asignar
                        </button>
                      </div>
                    ) : (
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider bg-slate-50 px-4 py-3.5 rounded-xl border border-slate-200">
                        Inicia sesión de docente para asignar
                      </div>
                    )}

                    <button
                      onClick={() => downloadTemplateJson(tpl)}
                      className="p-3 bg-slate-50 hover:bg-indigo-50 text-indigo-950 hover:text-indigo-950 rounded-xl transition-all border border-slate-200"
                      title="Exportar archivo JSON"
                    >
                      <Download size={16} />
                    </button>

                    {(isAuthor || isAdminMode) && (
                      <button
                        onClick={() => handleDelete(tpl)}
                        className="p-3 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all border border-slate-200"
                        title="Eliminar plantilla"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => toggleExpand(tpl.id)}
                      className="px-4 py-3 bg-white border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-black text-slate-500 hover:text-rose-500 transition-all flex items-center gap-1 shadow-sm"
                    >
                      {isExpanded ? (
                        <>Contraer <ChevronUp size={14} /></>
                      ) : (
                        <>Previsualizar <ChevronDown size={14} /></>
                      )}
                    </button>
                  </div>
                </div>

                {/* TEMPLATE DETAIL (CRITERIA PREVIEW) */}
                {isExpanded && (
                  <div className="px-8 pb-8 pt-4 border-t border-slate-100 bg-slate-50/40 animate-in slide-in-from-top-2 duration-300 space-y-8">
                    {/* Course / Spreadsheet Sync Notice */}
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3 text-rose-800 text-[11px] font-medium leading-relaxed italic">
                      <Info size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <span>
                        Nota: Al asignar esta rúbrica a un curso, se convertirá en la plantilla predeterminada para cualquier actividad nueva que crees. Recuerda que las calificaciones obtenidas con esta rúbrica quedarán organizadas automáticamente en las plantillas descargables de Excel.
                      </span>
                    </div>

                    {/* Group criteria */}
                    {hasGroup && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">Criterios Grupales</h4>
                        <div className="grid grid-cols-1 gap-4">
                          {tpl.rubric.group.map(cr => (
                            <div key={cr.id} className="p-6 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                <span className="font-bold text-indigo-950 text-sm">{cr.title}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso: {cr.weight || 1}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                                {[4, 3, 2, 1].map(level => (
                                  <div key={level} className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                                    <div className="font-black text-rose-500 uppercase text-[9px] tracking-wider mb-1">Nivel {level}</div>
                                    <p className="text-slate-600 font-medium leading-relaxed">{cr.desc[level] || 'Sin descriptor'}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Individual criteria */}
                    {hasIndividual && (
                      <div className="space-y-4 pt-4">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">Criterios Individuales</h4>
                        <div className="grid grid-cols-1 gap-4">
                          {tpl.rubric.individual.map(cr => (
                            <div key={cr.id} className="p-6 bg-white rounded-2xl border border-slate-100 space-y-4 shadow-sm">
                              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                <span className="font-bold text-indigo-950 text-sm">{cr.title}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso: {cr.weight || 1}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                                {[4, 3, 2, 1].map(level => (
                                  <div key={level} className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                                    <div className="font-black text-rose-500 uppercase text-[9px] tracking-wider mb-1">Nivel {level}</div>
                                    <p className="text-slate-600 font-medium leading-relaxed">{cr.desc[level] || 'Sin descriptor'}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SHARE / PUBLISH MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-indigo-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl relative max-h-[90vh]">
            <button 
              onClick={() => {
                setShowAddModal(false);
                setTemplateName('');
                setPastedText('');
              }} 
              className="absolute top-8 right-8 w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100"
            >
              <X size={24} />
            </button>
            
            <div className="p-10 pb-6 bg-white/50 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-4 mb-2">
                <div className="bg-rose-500 p-3.5 rounded-3xl text-white shadow-xl shadow-rose-500/20">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-indigo-950 italic tracking-tighter uppercase leading-none">Compartir Rúbrica</h3>
                  <p className="text-slate-400 text-xs font-medium mt-1">Registra una rúbrica en la biblioteca del departamento</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
              {/* Template Name */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nombre de la Plantilla</label>
                <input 
                  type="text" 
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ej: Speaking Rubric 7th Grade Unit 1"
                  className="w-full px-6 py-4 rounded-xl bg-slate-50 focus:bg-white border-2 border-slate-100 focus:border-rose-500 outline-none text-sm font-bold transition-all uppercase italic"
                />
              </div>

              {/* Import Selector */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Método de Importación</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setImportType('ai')}
                    className={`flex-1 py-4 rounded-xl border-2 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${
                      importType === 'ai' 
                        ? 'bg-indigo-950 text-white border-indigo-950 shadow-md' 
                        : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <Sparkles size={14} className="text-rose-500" /> Importador Inteligente IA
                  </button>
                  <button
                    onClick={() => setImportType('json')}
                    className={`flex-1 py-4 rounded-xl border-2 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${
                      importType === 'json' 
                        ? 'bg-indigo-950 text-white border-indigo-950 shadow-md' 
                        : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <Upload size={14} /> Subir Archivo JSON
                  </button>
                </div>
              </div>

              {/* Option A: AI Text parser */}
              {importType === 'ai' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl flex gap-3 text-[11px] text-rose-800 font-medium italic">
                    <Info size={16} className="text-rose-500 shrink-0" />
                    <span>
                      Pega tu rúbrica. El parser de IA extraerá los criterios y los descriptores para los niveles 4, 3, 2 y 1. Asegúrate de incluir un título de criterio y que cada descriptor empiece con su respectivo puntaje (ej: 4, 3, 2, 1).
                    </span>
                  </div>
                  
                  <textarea 
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full h-64 p-5 rounded-xl border-2 border-slate-100 focus:border-rose-500 outline-none font-mono text-xs shadow-inner bg-slate-50/30 leading-relaxed custom-scrollbar"
                    placeholder="Ejemplo:
Grammar Accuracy
4 - Sin errores gramaticales o de deletreo.
3 - 1 a 2 errores menores.
2 - 3 a 5 errores medianos.
1 - Más de 6 errores graves que impiden la comunicación."
                  />
                </div>
              )}

              {/* Option B: JSON File upload */}
              {importType === 'json' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex gap-3 text-[11px] text-indigo-800 font-medium italic">
                    <Info size={16} className="text-indigo-600 shrink-0" />
                    <span>
                      Sube un archivo de configuración de rúbrica en formato JSON. El formato debe ser un objeto con los arrays 'group' e 'individual' con descriptores de nivel.
                    </span>
                  </div>

                  <label className="w-full py-10 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-black text-xs uppercase tracking-widest flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 hover:text-indigo-950 hover:border-indigo-950/20 transition-all">
                    <Upload size={32} className="text-slate-300" />
                    <span>{templateName ? "Seleccionar archivo JSON" : "Primero ingresa un nombre para habilitar"}</span>
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      disabled={!templateName.trim()}
                      onChange={handleJsonUpload} 
                    />
                  </label>
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            {importType === 'ai' && (
              <div className="p-8 border-t border-slate-100 bg-white/50 shrink-0 flex justify-end items-center gap-6">
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setTemplateName('');
                    setPastedText('');
                  }} 
                  className="text-xs font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAiPublish}
                  disabled={isPublishing || !templateName || !pastedText}
                  className="px-10 py-4.5 rounded-xl bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-rose-500 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isPublishing ? 'Publicando...' : 'Publicar Plantilla'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
