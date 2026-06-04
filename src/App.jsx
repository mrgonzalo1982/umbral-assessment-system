import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Mail,
  Sparkles,
  RefreshCw,
  ClipboardList,
  UserPlus,
  X,
  Menu,
  History,
  Library
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storage, calculateProjectGrade } from './utils/grading';
import { DEFAULT_TEACHERS, hasAccess, normalizeCourse, formatCourseDisplay } from './utils/teachers';
import { db, rubricsDb, auth, googleProvider } from './lib/firebase';
import { onAuthStateChanged, signOut, getAuth, signInWithPopup, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';

// Components
import RosterManager from './components/RosterManager';
import RubricManager from './components/RubricManager';
import AssessmentEngine from './components/AssessmentEngine';
import ResultsView from './components/ResultsView';
import AuthView from './components/AuthView';
import Gradebook from './components/Gradebook';
import LibraryView from './components/LibraryView';

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
  individualScores: {},
  observations: {}
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sharedTemplates, setSharedTemplates] = useState([]);
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || 'AIzaSyAE8SoWQnBU-Lle69VxdHT0cnXO4vQVJLw');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [dbData, setDbData] = useState(null);
  const [scannedCloudData, setScannedCloudData] = useState([]);
  const [diagnosticDocId, setDiagnosticDocId] = useState('teachers_registry');
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [isDiagnosticLoading, setIsDiagnosticLoading] = useState(false);
  const [isScanningCloud, setIsScanningCloud] = useState(false);
  const isCloudUpdate = useRef(false);
  const prevDataRef = useRef('');

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
    });

    return () => {
      unsub();
    };
  }, []);

  // Form State
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', unit: '', objective: '', skill: '', evaluationType: '' });

  const [teachersList, setTeachersList] = useState(() => {
    const local = storage.load('teachersList');
    if (local && local.length > 0 && local.some(t => !t.email)) {
      // Discard legacy data from bookmatch project to use new rubrics-umbral defaults
      return DEFAULT_TEACHERS;
    }
    return local || DEFAULT_TEACHERS;
  });
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [newTeacherData, setNewTeacherData] = useState({ id: '', name: '', email: '', courses: [] });

  // Sync teachersList to Firebase so all devices share the same list
  useEffect(() => {
    if (!user) return; // Do not listen if not authenticated
    const teachersDocRef = doc(db, 'assessments_data', 'teachers_registry');
    const unsub = onSnapshot(teachersDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.teachers && data.teachers.length > 0) {
          // If the cloud data is legacy (no emails), ignore it so local defaults take over
          // and eventually sync back the correct data
          if (data.teachers.some(t => !t.email)) {
            console.log("Legacy cloud data detected, skipping sync to allow local migration.");
            return;
          }
          const mappedTeachers = data.teachers.map(t => {
            if (t.email === 'carla.ramirez@colegioumbral.com') {
              return { ...t, id: 'carla' };
            }
            return t;
          });
          setTeachersList(mappedTeachers);
          storage.save('teachersList', mappedTeachers);
        }
      } else {
        // Document doesn't exist yet — seed it with local list so other devices can read it
        const localList = storage.load('teachersList') || DEFAULT_TEACHERS;
        setDoc(teachersDocRef, { teachers: localList, lastUpdated: new Date().toISOString() });
      }
    }, (err) => {
      console.error("Error in teachers registry sync:", err);
      alert("Error de base de datos (registro de profesores): " + err.message);
    });
    return () => unsub();
  }, [user]);

  const saveTeachersToCloud = async (list) => {
    try {
      const teachersDocRef = doc(db, 'assessments_data', 'teachers_registry');
      await setDoc(teachersDocRef, { teachers: list, lastUpdated: new Date().toISOString() }, { merge: true });
    } catch(e) {
      console.warn('Could not save teachers to cloud, saving locally only.');
      storage.save('teachersList', list);
    }
  };

  const restoreBackup = async (backup) => {
    if (!backup || !backup.data || !backup.data.projects) return;
    const backupProjects = backup.data.projects;
    const backupRubrics = backup.data.rubrics || {};
    
    try {
      setIsSaving(true);
      const teacherDocRef = doc(db, 'assessments_data', currentTeacher.id);
      
      // Load current local states
      const currentProjects = storage.load(`${currentTeacher.id}_projects`) || [];
      const currentRubrics = storage.load(`${currentTeacher.id}_rubrics`) || {};
      
      // Smart project merge: add if missing, keep/update based on assessment progress
      const mergedProjects = [...currentProjects];
      backupProjects.forEach(bp => {
        const existsIdx = mergedProjects.findIndex(p => p.id === bp.id);
        if (existsIdx === -1) {
          mergedProjects.push(bp);
        } else {
          const currentP = mergedProjects[existsIdx];
          const currentEvalCount = Object.keys(currentP.assessments?.individualScores || {}).length;
          const backupEvalCount = Object.keys(bp.assessments?.individualScores || {}).length;
          
          // Overwrite local project only if backup has more completed evaluations
          if (backupEvalCount > currentEvalCount) {
            mergedProjects[existsIdx] = bp;
          }
        }
      });
      
      // Merge rubrics
      const mergedRubrics = { ...currentRubrics, ...backupRubrics };
      
      // Save locally
      const restoreTimestamp = Date.now();
      storage.save(`${currentTeacher.id}_projects`, mergedProjects);
      storage.save(`${currentTeacher.id}_rubrics`, mergedRubrics);
      localStorage.setItem(`umbral_${currentTeacher.id}_last_local_update`, restoreTimestamp.toString());
      
      // Sync to cloud inside the current teacher's document (valid path & approved flat schema fields)
      await setDoc(teacherDocRef, {
        projects: mergedProjects,
        rubrics: mergedRubrics,
        lastUpdate: restoreTimestamp,
        lastSync: new Date().toISOString()
      }, { merge: true });
      
      // Update React State immediately
      setProjects(mergedProjects);
      setRubrics(mergedRubrics);
      
      alert('✅ Datos restaurados y sincronizados con éxito para todos los cursos del respaldo.');
      setShowBackups(false);
    } catch (e) {
      console.error("Error restoring backup:", e);
      alert("Error al restaurar los datos: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getAvailableRecoverySources = () => {
    const sources = [];
    
    const extractCourses = (data) => {
      const pCourses = data?.projects ? [...new Set(data.projects.map(p => p.course))].filter(Boolean) : [];
      const rCourses = data?.rubrics ? Object.keys(data.rubrics).filter(Boolean) : [];
      return [...new Set([...pCourses, ...rCourses])];
    };

    // 1. Teacher-scoped backups
    if (currentTeacher) {
      const teacherBackups = storage.getBackups(currentTeacher.id);
      teacherBackups.forEach(b => {
        sources.push({
          type: 'backup',
          label: `Copia de seguridad (${new Date(b.timestamp).toLocaleString()})`,
          timestamp: b.timestamp,
          projectCount: b.data?.projects?.length || 0,
          rubricCount: Object.keys(b.data?.rubrics || {}).length,
          courses: extractCourses(b.data),
          data: b.data
        });
      });
    }

    // 2. Scan all localStorage keys for legacy data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith('umbral_')) continue;
      
      // Check for legacy backups without teacher ID (e.g. umbral_backup_1716940000000)
      const legacyBackupMatch = key.match(/^umbral_backup_(\d+)$/);
      if (legacyBackupMatch) {
        try {
          const b = JSON.parse(localStorage.getItem(key));
          if (b && b.data && b.data.projects) {
            if (!sources.some(s => s.timestamp === b.timestamp)) {
              sources.push({
                type: 'legacy_backup',
                label: `Copia de seguridad antigua (${new Date(b.timestamp).toLocaleString()})`,
                timestamp: b.timestamp,
                projectCount: b.data.projects.length,
                rubricCount: Object.keys(b.data.rubrics || {}).length,
                courses: extractCourses(b.data),
                data: b.data
              });
            }
          }
        } catch(e) {}
      }

      // Check for course-scoped projects (from previous course-scoped attempt, key: umbral_projects_course_...)
      const courseProjectsMatch = key.match(/^umbral_projects_course_(.+)$/);
      if (courseProjectsMatch) {
        const courseKey = courseProjectsMatch[1];
        try {
          const projectsList = JSON.parse(localStorage.getItem(key));
          if (Array.isArray(projectsList) && projectsList.length > 0) {
            const rubricsKey = `umbral_rubrics_course_${courseKey}`;
            const rubricsList = JSON.parse(localStorage.getItem(rubricsKey)) || {};
            const courseName = projectsList[0].course || courseKey;
            
            const backupData = {
              projects: projectsList,
              rubrics: { [courseName]: rubricsList }
            };
            
            sources.push({
              type: 'course_legacy',
              label: `Datos históricos locales - Curso: ${courseName}`,
              timestamp: parseInt(localStorage.getItem(`umbral_last_local_update_course_${courseKey}`)) || Date.now(),
              projectCount: projectsList.length,
              rubricCount: Object.keys(rubricsList).length,
              courses: [courseName],
              data: backupData
            });
          }
        } catch(e) {}
      }

      // Check for old global keys (umbral_projects_v3)
      if (key === 'umbral_projects_v3') {
        try {
          const projectsList = JSON.parse(localStorage.getItem(key));
          if (Array.isArray(projectsList) && projectsList.length > 0) {
            const rubricsKey = 'umbral_rubrics';
            const rubricsMap = JSON.parse(localStorage.getItem(rubricsKey)) || {};
            const backupData = {
              projects: projectsList,
              rubrics: rubricsMap
            };
            sources.push({
              type: 'global_legacy',
              label: 'Datos globales históricos (V3 - Previo a división por docente)',
              timestamp: Date.now() - 1,
              projectCount: projectsList.length,
              rubricCount: Object.keys(rubricsMap).length,
              courses: extractCourses(backupData),
              data: backupData
            });
          }
        } catch(e) {}
      }
    }

    // Sort by timestamp descending
    return sources.sort((a,b) => b.timestamp - a.timestamp);
  };

  const scanCloudData = async () => {
    setIsScanningCloud(true);
    setScannedCloudData([]);
    const scanned = [];
    for (const t of teachersList) {
      try {
        const docRef = doc(db, 'assessments_data', t.id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const pCourses = data.projects ? [...new Set(data.projects.map(p => p.course))].filter(Boolean) : [];
          const rCourses = data.rubrics ? Object.keys(data.rubrics).filter(Boolean) : [];
          const courses = [...new Set([...pCourses, ...rCourses])];
          
          scanned.push({
            teacher: t,
            projects: data.projects || [],
            rubrics: data.rubrics || {},
            courses: courses,
            lastUpdate: data.lastUpdate,
            lastSync: data.lastSync,
            exists: true
          });
        } else {
          scanned.push({
            teacher: t,
            projects: [],
            rubrics: {},
            courses: [],
            exists: false
          });
        }
      } catch (e) {
        console.error("Error scanning teacher " + t.name, e);
      }
    }
    setScannedCloudData(scanned);
    setIsScanningCloud(false);
  };

  const importSelectedCloudData = async (teacherProjects, teacherRubrics) => {
    if (!teacherProjects || teacherProjects.length === 0) {
      alert("No hay proyectos para importar en este perfil.");
      return;
    }
    
    if (window.confirm(`¿Deseas importar y fusionar estos ${teacherProjects.length} proyectos con tus datos actuales?`)) {
      try {
        setIsSaving(true);
        const currentProjects = storage.load(`${currentTeacher.id}_projects`) || [];
        const currentRubrics = storage.load(`${currentTeacher.id}_rubrics`) || {};
        
        const mergedProjects = [...currentProjects];
        teacherProjects.forEach(tp => {
          const existsIdx = mergedProjects.findIndex(p => p.id === tp.id);
          if (existsIdx === -1) {
            mergedProjects.push(tp);
          } else {
            const currentP = mergedProjects[existsIdx];
            const currentEvalCount = Object.keys(currentP.assessments?.individualScores || {}).length;
            const backupEvalCount = Object.keys(tp.assessments?.individualScores || {}).length;
            if (backupEvalCount > currentEvalCount) {
              mergedProjects[existsIdx] = tp;
            }
          }
        });
        
        const mergedRubrics = { ...currentRubrics, ...teacherRubrics };
        
        const importTimestamp = Date.now();
        storage.save(`${currentTeacher.id}_projects`, mergedProjects);
        storage.save(`${currentTeacher.id}_rubrics`, mergedRubrics);
        localStorage.setItem(`umbral_${currentTeacher.id}_last_local_update`, importTimestamp.toString());
        
        const teacherDocRef = doc(db, 'assessments_data', currentTeacher.id);
        await setDoc(teacherDocRef, {
          projects: mergedProjects,
          rubrics: mergedRubrics,
          lastUpdate: importTimestamp,
          lastSync: new Date().toISOString()
        }, { merge: true });
        
        setProjects(mergedProjects);
        setRubrics(mergedRubrics);
        
        alert("✅ Datos importados y fusionados con éxito. Revisa tu aula ahora.");
      } catch (e) {
        console.error("Import error:", e);
        alert("Error al importar datos: " + e.message);
      } finally {
        setIsSaving(false);
      }
    }
  };


  const fixCarlaId = async () => {
    if (!window.confirm("¿Estás seguro de corregir el ID de Carla Ramirez en la base de datos de 'Umbral Rubrics'? Esto vinculará su cuenta al documento histórico 'carla' con todas sus notas.")) return;
    try {
      setIsSaving(true);
      const registryDocRef = doc(db, 'assessments_data', 'teachers_registry');
      const snap = await getDoc(registryDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.teachers) {
          let found = false;
          const updated = data.teachers.map(t => {
            if (t.email === 'carla.ramirez@colegioumbral.com') {
              found = true;
              return { ...t, id: 'carla' };
            }
            return t;
          });
          
          if (!found) {
            updated.push({
              id: 'carla',
              name: 'Miss Carla Ramirez',
              email: 'carla.ramirez@colegioumbral.com',
              courses: ['7° Básico B', '8° Básico B', '2° Medio A', '3° Medio A', '4° Medio A', 'Pre-Kinder', '2° Básico A', 'Kinder']
            });
          }
          
          await setDoc(registryDocRef, { teachers: updated, lastUpdated: new Date().toISOString() }, { merge: true });
          alert("✅ ID de Carla Ramirez corregido a 'carla' con éxito en la base de datos.");
        }
      }
    } catch (err) {
      console.error("Error al corregir ID:", err);
      alert("Error al corregir ID: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const runDiagnostics = async () => {
    setIsDiagnosticLoading(true);
    setDiagnosticResult(null);
    try {
      const docRef = doc(db, 'assessments_data', diagnosticDocId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setDiagnosticResult({
          error: false,
          data: snap.data()
        });
      } else {
        setDiagnosticResult({
          error: true,
          code: 'not-found',
          message: `El documento 'assessments_data/${diagnosticDocId}' no existe en esta base de datos.`
        });
      }
    } catch (err) {
      console.error("Diagnostic query failed:", err);
      setDiagnosticResult({
        error: true,
        code: err.code || 'unknown',
        message: err.message || 'Error desconocido al consultar Firestore'
      });
    } finally {
      setIsDiagnosticLoading(false);
    }
  };

  const saveToImmutableBackup = async (teacherId, projectsData, rubricsData) => {
    if (!projectsData || projectsData.length === 0) return;
    try {
      const backupTimestamp = Date.now();
      const backupDocId = `${teacherId}_backup_${backupTimestamp}`;
      const backupDocRef = doc(db, 'assessments_history', backupDocId);
      
      await setDoc(backupDocRef, {
        teacherId,
        projects: projectsData,
        rubrics: rubricsData,
        timestamp: backupTimestamp,
        date: new Date().toISOString()
      });
      console.log(`🔒 Respaldo inmutable guardado en 'assessments_history' como ${backupDocId}`);
    } catch (e) {
      console.warn("Could not save immutable backup to cloud:", e);
    }
  };

  const exportTeacherGradesToCSV = (teacherData) => {
    if (!teacherData || !teacherData.projects || teacherData.projects.length === 0) {
      alert("No hay evaluaciones registradas para este docente.");
      return;
    }

    try {
      const projects = teacherData.projects;
      let csvContent = "\uFEFF"; // UTF-8 BOM
      
      const headers = [
        "Docente",
        "Curso",
        "Actividad",
        "ID Estudiante",
        "Nombre Estudiante",
        "Grupo",
        "Nota Final",
        "Observaciones"
      ];
      
      csvContent += headers.join(";") + "\n";
      
      const allStudentsMap = new Map();
      students.forEach(s => allStudentsMap.set(s.id, s));
      
      projects.forEach(project => {
        const course = project.course || "General";
        const projectName = project.name || "Sin nombre";
        const assessments = project.assessments || {};
        const studentGroups = assessments.studentGroups || {};
        const individualScores = assessments.individualScores || {};
        const groupScores = assessments.groupScores || {};
        const observations = assessments.observations || {};
        
        const gradedStudentIds = new Set([
          ...Object.keys(individualScores),
          ...Object.keys(studentGroups)
        ]);
        
        let projectStudents = students.filter(s => formatCourseDisplay(s.curso) === formatCourseDisplay(course));
        
        gradedStudentIds.forEach(sid => {
          if (!projectStudents.some(s => s.id === sid)) {
            const s = allStudentsMap.get(sid);
            if (s) projectStudents.push(s);
            else projectStudents.push({ id: sid, name: `Estudiante Desconocido (${sid})`, curso: course });
          }
        });
        
        projectStudents.forEach(student => {
          const studentId = student.id;
          const studentName = student.name || "Desconocido";
          const groupId = studentGroups[studentId] || "";
          
          let groupName = groupId;
          if (assessments.groups) {
            const gObj = assessments.groups.find(g => g.id === groupId);
            if (gObj) groupName = gObj.name;
          }
          
          let finalGrade = "";
          try {
            const grade = calculateProjectGrade(studentId, project);
            finalGrade = grade || "PTE";
          } catch (err) {
            finalGrade = "Error";
          }
          
          const obs = observations[studentId] || observations[groupId] || "";
          
          const row = [
            teacherData.teacher.name,
            course,
            projectName,
            studentId,
            studentName,
            groupName,
            finalGrade,
            obs.replace(/[\n\r;]/g, " ")
          ];
          
          csvContent += row.join(";") + "\n";
        });
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Notas_${teacherData.teacher.name.replace(/\s+/g, '_')}_Historial.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("CSV Export error:", e);
      alert("Error al exportar notas: " + e.message);
    }
  };

  const handleSaveTeacher = () => {
    if (!newTeacherData.name) return alert('El nombre es requerido.');
    
    // Clean and validate the custom ID or generate one
    const newId = newTeacherData.id 
      ? newTeacherData.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
      : `teacher_${Date.now()}`;

    const coursesString = newTeacherData.courses || '';
    const coursesArr = typeof coursesString === 'string' 
      ? coursesString.split(',').map(c => c.trim()).filter(Boolean)
      : (Array.isArray(newTeacherData.courses) ? newTeacherData.courses : []);

    const teacherObj = {
      id: newId,
      name: newTeacherData.name,
      email: newTeacherData.email || '',
      courses: coursesArr,
      isBackup: !!newTeacherData.isBackup
    };

    let newList;
    const oldId = newTeacherData.originalId;
    
    if (oldId) {
      // Editing an existing teacher
      if (oldId !== newId && teachersList.some(t => t.id === newId)) {
        return alert('El nuevo ID de base de datos ya está en uso por otro docente.');
      }
      newList = teachersList.map(t => t.id === oldId ? teacherObj : t);
    } else {
      // Registering a new teacher
      if (teachersList.some(t => t.id === newId)) {
        return alert('El ID de base de datos ya existe. Por favor usa uno único.');
      }
      newList = [...teachersList, teacherObj];
    }

    // Clean up reassignments: remove these courses from any other teacher
    newList = newList.map(t => {
      if (t.id === newId) return t;
      return {
        ...t,
        courses: (t.courses || []).filter(c => !teacherObj.courses.some(oc => formatCourseDisplay(oc) === formatCourseDisplay(c)))
      };
    });

    setTeachersList(newList);
    saveTeachersToCloud(newList);
    setShowTeacherForm(false);
    
    // Auto-select if it's the current user
    if (user && (teacherObj.email === user.email || (teacherObj.id === 'me' && (user.email === 'gonzalo.flores@colegioumbral.com' || user.email === 'englishdepartmentrubrics@gmail.com')))) {
      setCurrentTeacher(teacherObj);
    }
    
    setNewTeacherData({ id: '', name: '', email: '', courses: [], originalId: '' });
  };

  // Core State (Loaded dynamically based on the selected course)
  const [students, setStudents] = useState(() => {
     const loaded = storage.load('students') || [];
     return loaded.map(s => ({ ...s, curso: formatCourseDisplay(s.curso) }));
  });
  const [rubrics, setRubrics] = useState({});
  const [projects, setProjects] = useState([]);
  const [dashboardFilters, setDashboardFilters] = useState({
    search: '',
    skill: 'All',
    type: 'All'
  });

  // Auto-select Teacher by Email
  useEffect(() => {
    if (user && teachersList.length > 0 && !currentTeacher) {
      const match = teachersList.find(t => t.email === user.email || (t.id === 'me' && (user.email === 'gonzalo@colegioumbral.com' || user.email === 'englishdepartmentrubrics@gmail.com'))); // Special case for admin/main
      if (match) {
        setCurrentTeacher(match);
      }
    }
  }, [user, teachersList, currentTeacher]);

  const availableCourses = useMemo(() => {
    // Start with the standard list
    const standardCourses = [
      'Pre-Kinder', 'Kinder',
      '1° Básico A',
      '2° Básico A', '2° Básico B',
      '3° Básico A', '3° Básico B',
      '4° Básico A',
      '5° Básico A', '5° Básico B',
      '6° Básico A', '6° Básico B',
      '7° Básico A', '7° Básico B',
      '8° Básico A', '8° Básico B',
      '1° Medio A', '1° Medio B', '1° Medio C',
      '2° Medio A', '2° Medio B',
      '3° Medio A', '3° Medio B',
      '4° Medio A', '4° Medio B'
    ];

    const courseSet = new Set(standardCourses.map(c => formatCourseDisplay(c)));
    
    // Add any others found in students, but format them first
    students.forEach(s => { 
      if (s.curso && s.curso !== 'General') {
        const formatted = formatCourseDisplay(s.curso);
        if (formatted !== 'General') courseSet.add(formatted); 
      }
    });

    return Array.from(courseSet).sort((a,b) => {
      const getWeight = (name) => {
        if (name.includes('Pre-Kinder')) return 0;
        if (name.includes('Kinder') && !name.includes('Pre')) return 1;
        
        const num = parseInt(name) || 0;
        let base = 0;
        const low = name.toLowerCase();
        if (low.includes('básico') || low.includes('basico')) {
          base = 10;
        } else if (low.includes('medio')) {
          base = 20;
        } else {
          base = 30; // Fallback for any other custom courses
        }
        return base + num;
      };

      const weightA = getWeight(a);
      const weightB = getWeight(b);
      
      if (weightA !== weightB) return weightA - weightB;
      return a.localeCompare(b);
    });
  }, [students]);

  const handleToggleCourse = (course) => {
    let current = [];
    if (typeof newTeacherData.courses === 'string') {
      current = newTeacherData.courses.split(',').map(c => c.trim()).filter(Boolean);
    } else if (Array.isArray(newTeacherData.courses)) {
      current = [...newTeacherData.courses];
    }
    
    if (current.includes(course)) {
      if (!confirm(`¿Estás seguro de que deseas eliminar el curso "${course}" de este docente?`)) return;
      current = current.filter(c => c !== course);
    } else {
      // Reassignment Check
      const assignedTeacher = teachersList.find(t => t.id !== newTeacherData.id && (t.courses || []).some(c => formatCourseDisplay(c) === course));
      if (assignedTeacher) {
        if (!confirm(`El curso "${course}" ya está asignado a ${assignedTeacher.name}. ¿Deseas reasignarlo a este perfil?`)) {
          return;
        }
      }
      current.push(course);
    }
    setNewTeacherData({ ...newTeacherData, courses: current });
  };

  const currentSelectedCourses = useMemo(() => {
    if (typeof newTeacherData.courses === 'string') {
      return newTeacherData.courses.split(',').map(c => c.trim()).filter(Boolean);
    }
    return Array.isArray(newTeacherData.courses) ? newTeacherData.courses : [];
  }, [newTeacherData.courses]);

  // Load teacher-scoped projects and rubrics from local storage when currentTeacher changes
  useEffect(() => {
    if (currentTeacher) {
      const loadedProjects = storage.load(`${currentTeacher.id}_projects`) || [];
      const loadedRubrics = storage.load(`${currentTeacher.id}_rubrics`) || {};
      
      setProjects(loadedProjects);
      setRubrics(loadedRubrics);
      
      // Update prevDataRef so that the autosave effect knows this is the initial load and not a user modification
      prevDataRef.current = JSON.stringify({ rubrics: loadedRubrics, projects: loadedProjects });
    } else {
      setProjects([]);
      setRubrics({});
      prevDataRef.current = '';
    }
  }, [currentTeacher]);

  // 1. Global & Shared Listeners
  useEffect(() => {
    if (!user) return; // Do not listen if not authenticated
    setIsLoadingCloud(true);
    
    // 1. Global Roster Listener
    const globalDocRef = doc(db, 'assessments_data', 'global_roster');
    const unsubGlobal = onSnapshot(globalDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.students) {
          setStudents(data.students.map(s => ({ ...s, curso: formatCourseDisplay(s.curso) })));
        } else {
          setStudents([]);
        }
      }
      if (isAdminMode) setHasInitialLoad(true);
    }, (err) => {
      console.error("Error in global roster sync:", err);
      alert("Error de base de datos (lista de estudiantes): " + err.message);
    });

    // 2. Shared Rubrics Library Listener
    const sharedDocRef = doc(rubricsDb, 'assessments_data', 'shared_library');
    const unsubShared = onSnapshot(sharedDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSharedTemplates(data.templates || []);
      }
    });

    setIsLoaded(true);
    const timer = setTimeout(() => setIsLoadingCloud(false), 2000);

    return () => { 
      unsubGlobal(); 
      unsubShared();
      clearTimeout(timer); 
    };
  }, [isAdminMode, user]);

  // 2. Teacher-scoped Data Listener (Atomic & Protected)
  useEffect(() => {
    let unsubTeacher = () => {};
    if (currentTeacher) {
      setIsLoadingCloud(true);
      setHasInitialLoad(false);

      const teacherDocRef = doc(db, 'assessments_data', currentTeacher.id);

      unsubTeacher = onSnapshot(teacherDocRef, (snapshot) => {
        if (snapshot.exists() && !snapshot.metadata.hasPendingWrites) {
          const data = snapshot.data();
          const localProjects = storage.load(`${currentTeacher.id}_projects`) || [];
          const lastLocalUpdate = Number(localStorage.getItem(`umbral_${currentTeacher.id}_last_local_update`) || 0);
          const cloudUpdate = Number(data.lastUpdate || 0);
          
          // Defense: if local storage has projects, but cloud has none, DO NOT overwrite local storage!
          const hasLocalData = localProjects.length > 0;
          const cloudIsEmpty = !data.projects || data.projects.length === 0;
          
          const isOwner = user && user.email === currentTeacher.email;

          if (hasLocalData && cloudIsEmpty) {
            console.log("🛡️ Protección Antirresurrección Vacía: Se bloqueó un intento de borrar datos locales con una nube vacía.");
            if (isOwner) {
              console.log("📤 Sincronizando local más nuevo (nube vacía) a la nube...");
              const localRubrics = storage.load(`${currentTeacher.id}_rubrics`) || {};
              setDoc(teacherDocRef, {
                projects: localProjects,
                rubrics: localRubrics,
                lastUpdate: lastLocalUpdate,
                lastSync: new Date().toISOString()
              }, { merge: true }).catch(err => {
                console.warn("Error uploading local data on empty cloud:", err);
              });
            }
            return;
          }

          // If local storage is empty, or the cloud is genuinely newer
          if (!isOwner || localProjects.length === 0 || cloudUpdate > lastLocalUpdate) {
            console.log(`☁️ Nube ganadora para docente ${currentTeacher.id}: Actualizando estado local.`);
            isCloudUpdate.current = true;
            if (data.rubrics) setRubrics(data.rubrics);
            if (data.projects) setProjects(data.projects);
            
            // Save to local storage
            storage.save(`${currentTeacher.id}_projects`, data.projects || []);
            storage.save(`${currentTeacher.id}_rubrics`, data.rubrics || {});
          } else {
            console.log("🛡️ Protección Local: Se bloqueó una resurrección de datos antiguos.");
            if (isOwner && lastLocalUpdate > cloudUpdate) {
              console.log(`📤 Sincronizando local más nuevo (${lastLocalUpdate} > ${cloudUpdate}) a la nube...`);
              const localRubrics = storage.load(`${currentTeacher.id}_rubrics`) || {};
              setDoc(teacherDocRef, {
                projects: localProjects,
                rubrics: localRubrics,
                lastUpdate: lastLocalUpdate,
                lastSync: new Date().toISOString()
              }, { merge: true }).catch(err => {
                console.warn("Error uploading newer local data:", err);
              });
            }
          }
        }
        setHasInitialLoad(true);
        setIsLoadingCloud(false);
      }, (err) => {
        console.error("Error in teacher data sync:", err);
        alert("Error de base de datos (datos de evaluaciones): " + err.message);
      });
    } else {
      setHasInitialLoad(true);
      setIsLoadingCloud(false);
    }

    const timer = setTimeout(() => setIsLoadingCloud(false), 2000);
    return () => {
      unsubTeacher();
      clearTimeout(timer);
    };
  }, [currentTeacher]);

  // Set up global publishing function
  useEffect(() => {
    window.publishToLibrary = async (name, rubricData) => {
      try {
        const sharedDocRef = doc(rubricsDb, 'assessments_data', 'shared_library');
        const newTemplate = {
          id: `tpl_${Date.now()}`,
          name: name.toUpperCase(),
          author: currentTeacher?.name || 'Docente Colegio Umbral',
          authorEmail: user?.email || '',
          authorId: currentTeacher?.id || '',
          date: new Date().toISOString(),
          rubric: rubricData
        };
        const updatedTemplates = [newTemplate, ...(sharedTemplates || [])];
        await setDoc(sharedDocRef, { templates: updatedTemplates }, { merge: true });
        return true;
      } catch (e) {
        console.error("Error publishing to library:", e);
        return false;
      }
    };
  }, [currentTeacher, sharedTemplates, user]);

  // Autosave Teacher-Scoped Data (Projects and Rubrics)
  useEffect(() => {
    if (!currentTeacher || !isLoaded || !hasInitialLoad) return;

    const currentDataStr = JSON.stringify({ rubrics, projects });
    
    // Ignore if no meaningful data change
    if (prevDataRef.current === currentDataStr) {
      return;
    }
    prevDataRef.current = currentDataStr;

    if (isCloudUpdate.current) {
      // Change came from the cloud. Save to local storage but don't bump local update time.
      storage.save(`${currentTeacher.id}_projects`, projects);
      storage.save(`${currentTeacher.id}_rubrics`, rubrics);
      prevDataRef.current = currentDataStr; // Sync the ref!
      isCloudUpdate.current = false;
      return;
    }

    // REAL local change made by the user.
    const changeTimestamp = Date.now();
    storage.save(`${currentTeacher.id}_projects`, projects);
    storage.save(`${currentTeacher.id}_rubrics`, rubrics);
    localStorage.setItem(`umbral_${currentTeacher.id}_last_local_update`, changeTimestamp.toString());

    if (projects.length > 0) {
      storage.createBackup(currentTeacher.id, { projects, rubrics });
    }

    const syncToCloud = async () => {
      setIsSaving(true);
      try {
        const teacherDocRef = doc(db, 'assessments_data', currentTeacher.id);
        await setDoc(teacherDocRef, { 
          rubrics, 
          projects, 
          lastUpdate: changeTimestamp,
          lastSync: new Date().toISOString() 
        }, { merge: true });
        console.log(`☁️ Sincronización Cloud exitosa para docente ${currentTeacher.id}.`);
        await saveToImmutableBackup(currentTeacher.id, projects, rubrics);
      } catch (e) {
        console.warn("🛡️ Nube Saturada o Caída - Trabajando en modo Local Seguro.");
      } finally {
        setTimeout(() => setIsSaving(false), 1500);
      }
    };

    const timeout = setTimeout(syncToCloud, 2000); 
    return () => clearTimeout(timeout);
  }, [rubrics, projects, isLoaded, hasInitialLoad, currentTeacher]);

  // Warn before closing tab if there is a pending save
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isSaving) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios pendientes de guardar en la nube. ¿Estás seguro de salir?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving]);

  // Autosave Global Roster (Admin Mode Only)
  useEffect(() => {
    if (!isAdminMode || !isLoaded) return;
    
    storage.save('students', students);
    
    const syncRoster = async () => {
      setIsSaving(true);
      try {
        const globalDocRef = doc(db, 'assessments_data', 'global_roster');
        await setDoc(globalDocRef, { students, lastUpdated: new Date().toISOString() }, { merge: true });
        console.log("☁️ Roster Global sincronizado.");
      } catch (e) {
        console.warn("No se pudo sincronizar el roster global.");
      } finally {
        setTimeout(() => setIsSaving(false), 1500);
      }
    };
    
    const timeout = setTimeout(syncRoster, 2000);
    return () => clearTimeout(timeout);
  }, [students, isAdminMode, isLoaded]);

  useEffect(() => {
    const handleTabChange = (e) => setActiveTab(e.detail);
    window.addEventListener('changeTab', handleTabChange);
    return () => window.removeEventListener('changeTab', handleTabChange);
  }, []);

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const handleUpdateAssessments = (newAssessments) => {
    if (!selectedProjectId) return;
    setProjects(prev => {
      const updated = prev.map(p => p.id === selectedProjectId ? { 
        ...p, 
        assessments: { ...(p.assessments || INITIAL_ASSESSMENT_STATE), ...newAssessments } 
      } : p);
      storage.save(`${currentTeacher.id}_projects`, updated); // Forced immediate local save
      localStorage.setItem(`umbral_${currentTeacher.id}_last_local_update`, Date.now().toString());
      return updated;
    });
  };

  const handleUpdateRubrics = (newRubricsForProject) => {
    if (!selectedProjectId) return;
    setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, rubrics: newRubricsForProject } : p));
  };

  const handleUpdateProject = (updatedProject) => {
    if (!updatedProject) return;
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const createNewProject = () => {
    if (!selectedCourse || !newProjectData.name) return;
    if (!newProjectData.skill) return alert('Selecciona Speaking o Writing.');
    if (!newProjectData.evaluationType) return alert('Selecciona el tipo de evaluación.');
    const newProject = {
      id: `p_${Date.now()}`,
      name: newProjectData.name,
      unit: newProjectData.unit,
      objective: newProjectData.objective,
      skill: newProjectData.skill,
      evaluationType: newProjectData.evaluationType,
      course: selectedCourse,
      date: new Date().toISOString(),
      assessments: { ...INITIAL_ASSESSMENT_STATE },
      rubrics: rubrics[selectedCourse] || { group: DEFAULT_RUBRIC_GROUP, individual: DEFAULT_RUBRIC_INDIVIDUAL }
    };
    
    // Immediate Local Save
    const updated = [...projects, newProject];
    setProjects(updated);
    storage.save(`${currentTeacher.id}_projects`, updated);
    localStorage.setItem(`umbral_${currentTeacher.id}_last_local_update`, Date.now().toString());

    setNewProjectData({ name: '', unit: '', objective: '', skill: '', evaluationType: '' });
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
    if (!window.confirm('¿Estás seguro de eliminar este proyecto definitivamente?')) return;
    
    // 1. FORZADO LOCAL (Sin esperas ni promesas)
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      storage.save(`${currentTeacher.id}_projects`, updated);
      localStorage.setItem(`umbral_${currentTeacher.id}_last_local_update`, Date.now().toString());
      return updated;
    });

    if (selectedProjectId === id) setSelectedProjectId(null);
    console.log(`🗑️ Proyecto ${id} eliminado de memoria local.`);
  };

  const logout = () => {
    setCurrentTeacher(null);
    setSelectedCourse(null);
    setSelectedProjectId(null);
    setIsAdminMode(false);
  };

  // --- Memos and Progress Calcs ---
  const filteredStudents = useMemo(() => {
    if (!selectedCourse || !students) return [];
    return students.filter(s => {
      try {
        return normalizeCourse(s.curso) === normalizeCourse(selectedCourse);
      } catch (e) { return false; }
    });
  }, [students, selectedCourse]);

  const courseProjects = useMemo(() => {
    if (!selectedCourse || !projects) return [];
    return projects.filter(p => {
      try {
        return normalizeCourse(p.course) === normalizeCourse(selectedCourse);
      } catch (e) { return false; }
    });
  }, [projects, selectedCourse]);

  const getProjectProgress = (project) => {
    try {
      if (!project || !project.assessments || !filteredStudents.length) return 0;
      const evaluatedCount = Object.keys(project.assessments.individualScores || {}).length;
      return Math.round((evaluatedCount / filteredStudents.length) * 100);
    } catch (e) { return 0; }
  };

  const exportSystemData = () => {
    const data = { students, rubrics, projects, version: '3.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_umbral_${selectedCourse || 'full'}.json`;
    link.click();
  };

  const deleteFromLibrary = async (templateId) => {
    try {
      const sharedDocRef = doc(rubricsDb, 'assessments_data', 'shared_library');
      const updated = sharedTemplates.filter(t => t.id !== templateId);
      await setDoc(sharedDocRef, { templates: updated }, { merge: true });
      return true;
    } catch (e) {
      console.error("Error deleting template from library:", e);
      return false;
    }
  };

  const importTemplateToCourse = (rubric, courseName) => {
    if (!currentTeacher) return;
    const updatedRubrics = {
      ...rubrics,
      [courseName]: rubric
    };
    setRubrics(updatedRubrics);
    storage.save(`${currentTeacher.id}_rubrics`, updatedRubrics);
    localStorage.setItem(`umbral_${currentTeacher.id}_last_local_update`, Date.now().toString());
    alert(`✅ Rúbrica asignada con éxito como plantilla para el curso ${courseName}.`);
  };

  const forceSync = async () => {
    if (!currentTeacher && !isAdminMode) return;
    setIsSaving(true);
    try {
      if (isAdminMode) {
        const globalDocRef = doc(db, 'assessments_data', 'global_roster');
        await setDoc(globalDocRef, { students, lastUpdated: new Date().toISOString() }, { merge: true });
      }
      if (currentTeacher) {
        const syncTimestamp = Date.now();
        localStorage.setItem(`umbral_${currentTeacher.id}_last_local_update`, syncTimestamp.toString());
        const teacherDocRef = doc(db, 'assessments_data', currentTeacher.id);
        await setDoc(teacherDocRef, { 
          projects,
          rubrics,
          lastUpdate: syncTimestamp,
          lastSync: new Date().toISOString() 
        }, { merge: true });
        await saveToImmutableBackup(currentTeacher.id, projects, rubrics);
      }
    } catch (e) {
      console.error("Force sync failed:", e);
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const allCourses = useMemo(() => {
    if (!currentTeacher) return [];
    const configCourses = (currentTeacher.courses || []).map(c => formatCourseDisplay(c));
    const dataCourses = [...new Set(
      students
        .filter(s => hasAccess(currentTeacher, s.curso, teachersList))
        .map(s => formatCourseDisplay(s.curso))
    )];
    const projectCourses = projects ? projects.map(p => formatCourseDisplay(p.course)) : [];
    
    const courseMap = new Map();
    configCourses.forEach(c => { if (c !== 'General') courseMap.set(normalizeCourse(c), c); });
    dataCourses.forEach(c => { if (c !== 'General') courseMap.set(normalizeCourse(c), c); });
    projectCourses.forEach(c => { if (c !== 'General') courseMap.set(normalizeCourse(c), c); });
    return Array.from(courseMap.values());
  }, [currentTeacher, students, teachersList, projects]);

  if (!isLoaded) return null;

   if (authLoading) return (
     <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-12 h-12 border-4 border-indigo-950 border-t-rose-500 rounded-full" />
     </div>
   );

   if (!user) return <AuthView />;

   return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-indigo-950/20 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-indigo-950/5 flex flex-col h-full shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand */}
        <div 
          className="p-8 border-b border-indigo-950/5 flex items-center justify-between cursor-pointer group" 
        >
          <div className="flex items-center gap-4" onClick={() => { setCurrentTeacher(null); setIsAdminMode(false); setSelectedCourse(null); setSelectedProjectId(null); setIsMobileMenuOpen(false); }}>
            <div className="bg-white p-1 rounded-2xl shadow-lg border border-slate-100 group-hover:border-rose-500 transition-colors flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="English Department Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-black text-indigo-950 uppercase italic leading-none group-hover:text-rose-500 transition-colors">English Department</h1>
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none">Rubrics</span>
            </div>
          </div>
          <button className="lg:hidden p-2 text-slate-400 hover:text-rose-500" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Teachers List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-2 flex items-center gap-2">
            <Users size={12} /> Docentes
          </div>
          {teachersList
            .filter(teacher => {
              // Admin sees everyone
              if (user?.email === 'gonzalo@colegioumbral.com' || user?.email === 'gonzalo.flores@colegioumbral.com' || user?.email === 'englishdepartmentrubrics@gmail.com') return true;
              // Teachers only see their own profile
              return teacher.email === user?.email;
            })
            .map(teacher => (
            <div key={teacher.id} className="relative group/teacher">
              <button
                onClick={() => {
                  setCurrentTeacher(teacher);
                  setIsAdminMode(false);
                  setSelectedProjectId(null);
                  setActiveTab('dashboard');
                  setIsMobileMenuOpen(false);
                  // Auto-select course if teacher only has one
                  const teacherCourses = (teacher.courses || []).map(c => formatCourseDisplay(c));
                  const dataCourses = [...new Set(
                    students
                      .filter(s => hasAccess(teacher, s.curso, teachersList))
                      .map(s => formatCourseDisplay(s.curso))
                  )];
                  const merged = [...new Set([...teacherCourses, ...dataCourses].filter(c => c !== 'General'))];
                  if (merged.length === 1) {
                    setSelectedCourse(merged[0]);
                  } else {
                    setSelectedCourse(null);
                  }
                }}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all text-left ${currentTeacher?.id === teacher.id && !isAdminMode ? 'bg-indigo-950 text-white shadow-lg shadow-indigo-950/20 scale-[1.02]' : 'hover:bg-slate-50 text-slate-600 hover:text-indigo-950'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${currentTeacher?.id === teacher.id && !isAdminMode ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {teacher.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm tracking-tight leading-none mb-1">{teacher.name}</div>
                  <div className={`text-[9px] uppercase tracking-widest font-bold ${currentTeacher?.id === teacher.id && !isAdminMode ? 'text-indigo-200' : 'text-slate-400'}`}>
                     {teacher.isBackup ? 'Docente Reemplazo' : 'Docente Titular'}
                  </div>
                </div>
                {currentTeacher?.id === teacher.id && !isAdminMode && <ChevronRight size={16} className="opacity-50" />}
              </button>
              {isAdminMode && (
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     const coursesToEdit = (teacher.courses || []);
                      setNewTeacherData({ ...teacher, originalId: teacher.id, courses: Array.isArray(coursesToEdit) ? coursesToEdit : coursesToEdit.split(',').map(c=>c.trim()).filter(Boolean) });
                     setShowTeacherForm(true);
                   }}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white rounded-lg shadow-lg opacity-0 group-hover/teacher:opacity-100 transition-opacity z-10 text-indigo-950 hover:text-rose-500"
                 >
                    <Pencil size={14} />
                 </button>
              )}
            </div>
          ))}

          <button 
                onClick={() => { setNewTeacherData({ id: '', name: '', courses: [], isBackup: false, originalId: '' }); setShowTeacherForm(true); setIsMobileMenuOpen(false); }}
            className="w-full py-4 mt-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-indigo-950 hover:border-indigo-950/20 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <UserPlus size={16} /> Registrar Docente
          </button>

          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-8 mb-4 pl-2 flex items-center gap-2">
            <Settings size={12} /> Sistema
          </div>
          <button
            onClick={() => {
              setActiveTab('library');
              setIsAdminMode(false);
              setSelectedCourse(null);
              setSelectedProjectId(null);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all text-left mb-2 ${activeTab === 'library' && !isAdminMode ? 'bg-indigo-950 text-white shadow-lg shadow-indigo-950/20 scale-[1.02]' : 'hover:bg-slate-50 text-slate-600 hover:text-indigo-950'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === 'library' && !isAdminMode ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Library size={20} />
            </div>
            <div className="flex-1">
               <div className="font-bold text-sm tracking-tight leading-none mb-1">Biblioteca</div>
               <div className={`text-[9px] uppercase tracking-widest font-bold ${activeTab === 'library' && !isAdminMode ? 'text-indigo-200' : 'text-slate-400'}`}>Rúbricas Compartidas</div>
            </div>
            {activeTab === 'library' && !isAdminMode && <ChevronRight size={16} className="opacity-50" />}
          </button>
          <button
            onClick={() => {
              setIsAdminMode(true);
              setCurrentTeacher(null);
              setSelectedCourse(null);
              setSelectedProjectId(null);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all text-left ${isAdminMode ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-[1.02]' : 'hover:bg-rose-50 text-slate-600 hover:text-rose-500'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAdminMode ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-500'}`}>
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1">
               <div className="font-bold text-sm tracking-tight leading-none mb-1">Administración</div>
               <div className={`text-[9px] uppercase tracking-widest font-bold ${isAdminMode ? 'text-rose-200' : 'text-slate-400'}`}>Ajustes Globales</div>
            </div>
            {isAdminMode && <ChevronRight size={16} className="opacity-50" />}
          </button>
        </div>

        {/* Sync Status Footer */}
        <div className="p-6 border-t border-indigo-950/5 bg-slate-50/50 flex flex-col gap-4">
           <button 
             onClick={forceSync}
             disabled={isSaving}
             className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-indigo-950/20 transition-all shadow-sm group"
           >
              <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-950 transition-colors">{isSaving ? 'Guardando...' : 'Sincronizar Datos'}</span>
              {!isSaving && <RefreshCw size={12} className="text-slate-400 group-hover:text-indigo-950 transition-colors" />}
           </button>
           
            <button 
                onClick={async () => {
                  if (confirm('¿Cerrar sesión?')) {
                    try {
                      await signOut(auth);
                    } catch (e) {}
                    setCurrentTeacher(null);
                    setSelectedCourse(null);
                  }
                }}
               className="w-full mt-2 p-3 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest"
            >
               <LogOut size={16} /> Cerrar Sesión
            </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 h-full overflow-hidden bg-slate-50 relative flex flex-col w-full">
         {/* Global Mobile Header */}
         <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-indigo-950/5 shrink-0 relative z-30 shadow-sm">
            <div className="flex items-center gap-3">
               <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-indigo-950 hover:text-rose-500 bg-slate-50 rounded-xl">
                 <Menu size={20} />
               </button>
               <span className="font-black text-indigo-950 text-sm uppercase italic">Umbral</span>
            </div>
            {user && (
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center font-black text-xs">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
         </div>

        {/* State 1: Welcome Screen */}
        {!currentTeacher && !isAdminMode && activeTab !== 'library' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
             <div className="absolute inset-0 overflow-hidden pointer-events-none">
                 <div className="blob bg-rose-200/40 absolute top-20 right-20 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{animationDuration: '8s'}} />
                 <div className="blob bg-indigo-200/40 absolute bottom-20 left-20 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{animationDuration: '10s'}} />
             </div>
             <div className="relative z-10 animate-in fade-in zoom-in duration-700">
               <div className="inline-flex bg-white p-4 rounded-full shadow-2xl mb-8 relative border-4 border-slate-50">
                 <img src="/logo.png" alt="English Department Logo" className="w-24 h-24 object-contain" />
                 <div className="absolute -top-4 -right-4 bg-rose-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg border-4 border-white animate-bounce">
                     V2.0 PRO
                 </div>
               </div>
                <h2 className="text-6xl font-black text-indigo-950 italic tracking-tighter mb-4">English Department</h2>
                <p className="text-slate-500 text-xl font-medium max-w-md mx-auto leading-relaxed mb-10">
                  {user && teachersList.find(t => t.email === user.email) 
                    ? `¡Hola ${teachersList.find(t => t.email === user.email).name}! Tu espacio de trabajo está listo.`
                    : user && !teachersList.some(t => t.email === user.email)
                    ? "¡Hola! Tu cuenta está lista, pero aún no has configurado tu perfil de docente."
                    : "Selecciona un docente del menú lateral para gestionar sus cursos y evaluaciones."}
                </p>

                {user && !teachersList.some(t => t.email === user.email) && (
                  <button 
                    onClick={() => {
                      setNewTeacherData({ ...newTeacherData, email: user.email, name: user.displayName || '', originalId: '' });
                      setShowTeacherForm(true);
                    }}
                    className="px-10 py-5 bg-indigo-950 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-rose-500 hover:-translate-y-1 transition-all flex items-center gap-3 mx-auto"
                  >
                    <UserPlus size={20} /> Configurar Mi Perfil
                  </button>
                )}

                {user && teachersList.find(t => t.email === user.email) && (
                  <button 
                    onClick={() => {
                      const myProfile = teachersList.find(t => t.email === user.email);
                      setCurrentTeacher(myProfile);
                    }}
                    className="px-10 py-5 bg-rose-500 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-950 hover:-translate-y-1 transition-all flex items-center gap-3 mx-auto"
                  >
                    <LayoutDashboard size={20} /> Ir a mis cursos
                  </button>
                )}
             </div>
          </div>
        )}

        {/* State 2: Admin Console */}
        {isAdminMode && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
            <header className="bg-rose-500 text-white p-10 flex justify-between items-end shrink-0 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
               <div className="relative z-10">
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase flex items-center gap-4">
                     <ShieldCheck size={40} className="text-rose-200" /> Admin Console
                  </h2>
                  <p className="text-rose-100 mt-2 font-medium">Gestión global de estudiantes y respaldos del sistema</p>
               </div>
               <button
                 onClick={async () => {
                   await saveTeachersToCloud(teachersList);
                   alert(`✅ Lista de ${teachersList.length} docentes sincronizada. Todos los dispositivos se actualizarán en segundos.`);
                 }}
                 className="relative z-10 bg-white/20 hover:bg-white/30 transition-all text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-2xl flex items-center gap-2 border border-white/20"
               >
                 <RefreshCw size={14} /> Sincronizar Docentes
               </button>
            </header>
            <div className="p-10 w-full space-y-12 max-w-7xl mx-auto">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="liquid-glass border border-slate-100 p-10 text-indigo-950 relative overflow-hidden hover:border-rose-200 transition-colors">
                     <h3 className="text-2xl font-black mb-6 italic tracking-tight flex items-center gap-3">
                        <Users className="text-rose-500" /> Carga Maestra (Full Roster)
                     </h3>
                     <p className="text-sm text-slate-500 mb-8">Sube el archivo CSV oficial del colegio con todos los estudiantes. Esto actualizará los rosters de todos los docentes automáticamente.</p>
                     <label className="px-8 py-4 rounded-[2rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-rose-500 transition-all cursor-pointer inline-flex items-center gap-3 group">
                        Subir CSV
                        <Upload size={16} className="group-hover:-translate-y-1 transition-transform" />
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
                               
                               const rawCurso = idxCurso !== -1 ? cells[idxCurso] : 'General';
                               
                               return { 
                                  id: `s_${Date.now()}_${i}`, 
                                  name: name.trim().toUpperCase(), 
                                  curso: formatCourseDisplay(rawCurso),
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
                  <div className="liquid-glass border border-slate-100 p-10 text-indigo-950 relative overflow-hidden hover:border-rose-200 transition-colors">
                     <h3 className="text-2xl font-black mb-6 italic tracking-tight flex items-center gap-3">
                        <Save className="text-rose-500" /> Backup del Sistema
                     </h3>
                     <p className="text-sm text-slate-500 mb-8">Exporta o importa el estado completo del sistema (estudiantes, rúbricas y proyectos) en formato JSON.</p>
                     <div className="flex flex-col gap-4">
                       <button onClick={exportSystemData} className="w-full py-4 rounded-[2rem] bg-indigo-50 text-indigo-950 font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-indigo-100 transition-colors">
                           <Download size={18} /> Exportar JSON
                       </button>
                       <label className="w-full py-4 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 hover:text-indigo-950 hover:border-indigo-950/20 transition-all">
                           <Upload size={18} /> Importar JSON
                           <input type="file" accept=".json" className="hidden" onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (f) => {
                                  try {
                                    const data = JSON.parse(f.target.result);
                                    if (data.students) {
                                      setStudents(data.students.map(s => ({ ...s, curso: formatCourseDisplay(s.curso) })));
                                    }
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
                  <div className="liquid-glass border border-slate-100 p-10 text-indigo-950 relative overflow-hidden hover:border-rose-200 transition-colors col-span-full">
                     <h3 className="text-2xl font-black mb-6 italic tracking-tight flex items-center gap-3">
                        <Sparkles className="text-rose-500" /> Configuración Inteligencia Artificial
                     </h3>
                     <p className="text-sm text-slate-500 mb-8">Ingresa tu API Key de Google Gemini para habilitar el Asistente de Redacción IA en el Motor de Evaluación.</p>
                     <div className="flex gap-4">
                        <input 
                          type="password" 
                          value={geminiApiKey} 
                          onChange={(e) => {
                             setGeminiApiKey(e.target.value);
                             localStorage.setItem('gemini_api_key', e.target.value);
                          }}
                          placeholder="AIzaSy..." 
                          className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-200 focus:border-rose-500 outline-none text-sm font-bold bg-white"
                        />
                     </div>
                  </div>
                  <div className="liquid-glass border border-slate-100 p-10 text-indigo-950 relative overflow-hidden hover:border-rose-200 transition-colors col-span-full">
                     <h3 className="text-2xl font-black mb-6 italic tracking-tight flex items-center gap-3">
                        <History className="text-rose-500" /> Inspector de Sincronización y Recuperación de Datos
                     </h3>
                     <p className="text-sm text-slate-500 mb-8 font-medium">Escanea los documentos guardados de todos los docentes en la nube para identificar datos desplazados o restauraciones cruzadas.</p>
                     
                     <button
                       onClick={scanCloudData}
                       disabled={isScanningCloud}
                       className="px-8 py-4 rounded-[2rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-rose-500 transition-all flex items-center gap-3 disabled:opacity-50"
                     >
                       {isScanningCloud ? 'Escaneando Servidor...' : 'Escanear Datos en la Nube'}
                       <RefreshCw size={16} className={isScanningCloud ? 'animate-spin' : ''} />
                     </button>

                     {scannedCloudData && scannedCloudData.length > 0 && (
                       <div className="mt-8 space-y-6 animate-in fade-in duration-500">
                         <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Resultados del Escaneo de la Nube</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {scannedCloudData.map((d, idx) => (
                             <div key={idx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between gap-4">
                               <div>
                                 <div className="flex items-center justify-between">
                                   <span className="font-black text-indigo-950 text-base">{d.teacher.name}</span>
                                   <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${d.exists ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                     {d.exists ? 'Con Datos' : 'Sin Datos'}
                                   </span>
                                 </div>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{d.teacher.email}</p>
                                 
                                 {d.exists && (
                                   <div className="mt-4 space-y-2 text-xs text-slate-600 font-medium">
                                     <div>
                                       <span className="font-bold text-slate-500">Cursos en Nube: </span>
                                       {d.courses.length > 0 ? (
                                         <span className="text-rose-500 font-bold">{d.courses.join(', ')}</span>
                                       ) : (
                                         <span className="italic text-slate-400">Ninguno</span>
                                       )}
                                     </div>
                                     <div className="text-[11px] text-slate-400">
                                       Proyectos: {d.projects.length} | Rúbricas: {Object.keys(d.rubrics).length}
                                     </div>
                                     {d.lastSync && (
                                       <div className="text-[9px] text-slate-400 italic">
                                         Sincronizado: {new Date(d.lastSync).toLocaleString()}
                                       </div>
                                     )}
                                   </div>
                                 )}
                               </div>
                               
                               {d.exists && d.projects.length > 0 && (
                                 <button
                                   onClick={() => importSelectedCloudData(d.projects, d.rubrics)}
                                   className="w-full text-center py-3 bg-white border border-slate-200 text-indigo-950 rounded-xl hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                                 >
                                   Importar sus Proyectos
                                 </button>
                               )}
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                  </div>

                  {/* DATABASE CONTROL PANEL & DIAGNOSTICS */}
                  <div className="liquid-glass border border-slate-100 p-10 text-indigo-950 relative overflow-hidden hover:border-rose-200 transition-colors col-span-full">
                     <h3 className="text-2xl font-black mb-6 italic tracking-tight flex items-center gap-3">
                        <ShieldCheck className="text-rose-500" /> Utilidades de Base de Datos (Firestore)
                     </h3>
                     <p className="text-sm text-slate-500 mb-8 font-medium">
                        Herramientas de mantenimiento para verificar la conectividad y corregir problemas de mapeo de perfiles de docentes en la base de datos de <strong>umbral-rubrics</strong>.
                     </p>
                     
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       {/* Column 1: DB Maintenance */}
                       <div className="space-y-4">
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Acciones de Mantenimiento</h4>
                         <button
                           onClick={fixCarlaId}
                           disabled={isSaving}
                           className="w-full text-center py-4 px-8 rounded-[2rem] bg-indigo-950 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-rose-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                         >
                           Vincular Notas de Carla Ramirez
                         </button>
                         <p className="text-[11px] text-slate-400 font-medium">
                           Asegura que el correo institucional de Carla Ramírez esté mapeado correctamente a su identificador histórico en Firestore ('carla'), garantizando la carga inmediata de todas sus evaluaciones históricas.
                         </p>
                       </div>

                       {/* Column 2: Live Connection Diagnostics */}
                       <div className="space-y-4">
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Diagnóstico de Conectividad en Tiempo Real</h4>
                         <div className="flex gap-2">
                           <select
                             value={diagnosticDocId}
                             onChange={(e) => setDiagnosticDocId(e.target.value)}
                             className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-950 focus:outline-none focus:border-rose-500 transition-colors"
                           >
                             <option value="teachers_registry">teachers_registry (Registro General)</option>
                             <option value="shared_library">shared_library (Biblioteca de Rúbricas)</option>
                             <option value="carla">carla (Evaluaciones Carla Ramirez)</option>
                             <option value="me">me (Evaluaciones Gonzalo Flores)</option>
                           </select>
                           
                           <button
                             onClick={runDiagnostics}
                             disabled={isDiagnosticLoading}
                             className="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 shrink-0"
                           >
                             {isDiagnosticLoading ? 'Consultando...' : 'Probar Consulta'}
                           </button>
                         </div>

                         {diagnosticResult && (
                           <div className="mt-4 p-4 rounded-2xl text-xs font-mono max-h-48 overflow-y-auto custom-scrollbar border border-slate-100 bg-slate-50 text-slate-600">
                             {diagnosticResult.error ? (
                               <div className="text-rose-600 font-bold p-2 bg-rose-50 rounded-xl flex items-center gap-2">
                                 ⚠️ {diagnosticResult.message} (Código: {diagnosticResult.code})
                               </div>
                             ) : (
                               <pre className="text-[10px] whitespace-pre-wrap">{JSON.stringify(diagnosticResult.data, null, 2)}</pre>
                             )}
                           </div>
                         )}
                       </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}
        {currentTeacher && !selectedCourse && activeTab !== 'library' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50">
            <header className="bg-white px-10 py-12 border-b border-indigo-950/5 shrink-0 flex items-center justify-between shadow-sm sticky top-0 z-10">
               <div>
                 <h2 className="text-4xl font-black text-indigo-950 uppercase italic tracking-tighter">{currentTeacher.name}</h2>
                 <p className="text-rose-500 font-bold uppercase tracking-widest text-[10px] mt-2">Selecciona un curso para comenzar</p>
               </div>
               <div className="flex items-center gap-4">
                  <button 
                    onClick={() => exportTeacherGradesToCSV({ teacher: currentTeacher, projects })}
                    className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-md active:scale-95 border border-emerald-400/20"
                    title="Exportar todas las notas de todos los cursos asignados a este docente a un archivo Excel CSV"
                  >
                    <FileSpreadsheet size={16} /> Exportar Todo a Excel
                  </button>
                  <div className="w-16 h-16 rounded-[2rem] bg-indigo-50 text-indigo-950 flex items-center justify-center font-black text-3xl shadow-inner">
                     {currentTeacher.name.charAt(0)}
                  </div>
               </div>
            </header>
            <div className="p-10 w-full max-w-7xl mx-auto">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allCourses.map((curso, i) => (
                    <button key={i} onClick={() => setSelectedCourse(curso)} className="bg-white border border-slate-100 p-8 rounded-[2rem] text-left group hover:scale-[1.02] hover:shadow-xl hover:border-rose-200 transition-all duration-300">
                       <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mb-6 group-hover:bg-rose-500 group-hover:text-white transition-colors shadow-sm">
                          <BookOpen size={24} />
                       </div>
                       <span className="text-2xl font-black text-indigo-950 uppercase italic tracking-tighter block mb-2">{curso}</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-rose-500 transition-colors flex items-center gap-1">Entrar Aula <ChevronRight size={14} /></span>
                    </button>
                  ))}
               </div>

                <div className="mt-16 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-black italic tracking-tighter text-indigo-950 flex items-center gap-2">
                        <History className="text-rose-500" /> Time Machine
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Copias de seguridad automáticas locales.</p>
                    </div>
                    <button 
                      onClick={() => setShowBackups(!showBackups)}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 px-4 py-2 rounded-xl"
                    >
                      {showBackups ? 'Ocultar' : 'Ver Historial'}
                    </button>
                  </div>
                  
                  {showBackups && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      {getAvailableRecoverySources().length === 0 ? (
                        <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                          No hay copias de seguridad o datos históricos disponibles en este navegador.
                        </div>
                      ) : (
                        getAvailableRecoverySources().map((source, idx) => (
                          <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 rounded-2xl border border-slate-100 hover:border-rose-200 transition-colors bg-slate-50/50 gap-4">
                            <div>
                              <div className="font-black text-sm text-indigo-950 flex items-center gap-3">
                                {source.label} 
                                {idx === 0 && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full uppercase tracking-widest">Reciente</span>}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 font-medium flex flex-col gap-1">
                                <div>
                                  <span className="font-bold text-slate-600">Cursos: </span>
                                  {source.courses && source.courses.length > 0 ? (
                                    <span className="text-rose-500 font-black">{source.courses.join(', ')}</span>
                                  ) : (
                                    <span className="text-slate-400 italic">Ninguno</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Proyectos: {source.projectCount} | Rúbricas: {source.rubricCount}
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                if(window.confirm('¿Deseas fusionar estos datos con tus datos actuales? No perderás tu progreso nuevo.')) {
                                  restoreBackup({ data: source.data });
                                }
                              }}
                              className="w-full md:w-auto text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-indigo-950 px-5 py-3 rounded-xl hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                              <History size={14} /> Recuperar Datos
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'library' && !isAdminMode && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50 p-6 md:p-10">
            <LibraryView
              sharedTemplates={sharedTemplates}
              publishToLibrary={window.publishToLibrary}
              deleteFromLibrary={deleteFromLibrary}
              importTemplateToCourse={importTemplateToCourse}
              currentTeacher={currentTeacher}
              isAdminMode={isAdminMode}
              user={user}
            />
          </div>
        )}

        {/* State 4: Course Dashboard (Teacher & Course selected) */}
        {currentTeacher && selectedCourse && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
            {/* Top Navigation Bar inside Course */}
            <header className="bg-white border-b border-indigo-950/5 px-8 h-20 flex items-center justify-between shadow-sm shrink-0 relative z-10">
               {/* Breadcrumbs */}
               <nav className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      if (selectedProjectId) {
                        setSelectedProjectId(null);
                        setActiveTab('dashboard');
                      }
                      else if (selectedCourse) setSelectedCourse(null);
                    }}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest overflow-x-auto no-scrollbar py-2">
                      <button 
                        onClick={() => { setSelectedCourse(null); setSelectedProjectId(null); setActiveTab('dashboard'); }}
                        className="text-slate-400 hover:text-indigo-950 transition-colors whitespace-nowrap"
                      >
                        Inicio
                      </button>
                      
                      <ChevronRight size={10} className="text-slate-300 shrink-0" />
                      
                      <button 
                        onClick={() => { setSelectedProjectId(null); setActiveTab('dashboard'); }}
                        className={`whitespace-nowrap transition-colors ${selectedCourse && !selectedProjectId ? 'text-indigo-950 bg-slate-100 px-3 py-1 rounded-full' : 'text-slate-400 hover:text-indigo-950'}`}
                      >
                        {selectedCourse}
                      </button>

                      {selectedCourse && !selectedProjectId && (
                        <div className="ml-4 flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                          <button 
                            onClick={() => setActiveTab('dashboard')} 
                            className={`px-4 py-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest ${activeTab === 'dashboard' ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-400 hover:text-indigo-950'}`}
                          >
                            Proyectos
                          </button>
                          <button 
                            onClick={() => setActiveTab('gradebook')} 
                            className={`px-4 py-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest ${activeTab === 'gradebook' ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-400 hover:text-indigo-950'}`}
                          >
                            Notas del Curso
                          </button>
                        </div>
                      )}

                      {selectedProjectId && currentProject && (
                        <>
                           <ChevronRight size={10} className="text-slate-300 shrink-0" />
                           <div className="flex items-center gap-2 bg-indigo-950 text-white px-4 py-1.5 rounded-full shadow-lg shadow-indigo-950/20 max-w-[150px] md:max-w-[250px]">
                              <span className="truncate italic tracking-tighter">{currentProject.name}</span>
                           </div>
                           
                           <div className="ml-4 flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar max-w-[200px] md:max-w-none">
                              <button onClick={() => setActiveTab('rubrics')} className={`shrink-0 px-4 py-2 rounded-xl transition-all ${activeTab === 'rubrics' ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-400 hover:text-indigo-950 hover:bg-slate-50'}`}>Rúbrica</button>
                              <button onClick={() => setActiveTab('assess')} className={`shrink-0 px-4 py-2 rounded-xl transition-all ${activeTab === 'assess' ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-400 hover:text-indigo-950 hover:bg-slate-50'}`}>
                                {currentProject.evaluationType === 'individual' ? 'Evaluar' : 'Grupos'}
                              </button>
                              <button onClick={() => setActiveTab('results')} className={`shrink-0 px-4 py-2 rounded-xl transition-all ${activeTab === 'results' ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-400 hover:text-indigo-950 hover:bg-slate-50'}`}>Resultados</button>
                           </div>
                        </>
                      )}
                   </div>
               </nav>
            </header>

            {/* Dashboard Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-10 relative">
               <AnimatePresence mode="wait">
                  <motion.div key={activeTab + (selectedProjectId || '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                     
                     {/* Dashboard: Activities List */}
                     {activeTab === 'dashboard' && !selectedProjectId && (
                        <div className="space-y-12 max-w-6xl mx-auto">
                           <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                              <div>
                                 <h4 className="text-3xl font-black text-indigo-950 italic tracking-tighter">Panel de Proyectos</h4>
                                 <p className="text-slate-500 mt-1">Crea o selecciona una actividad evaluativa para este curso.</p>
                              </div>

                            {/* Filter Bar */}
                            <div className="bg-white/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/50 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                               <div className="relative flex-1 w-full">
                                  <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                  <input 
                                     type="text" 
                                     placeholder="Buscar por nombre o unidad..." 
                                     value={dashboardFilters.search}
                                     onChange={(e) => setDashboardFilters({...dashboardFilters, search: e.target.value})}
                                     className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white border-2 border-slate-50 focus:border-rose-500 outline-none transition-all font-bold text-sm shadow-sm"
                                  />
                               </div>
                               <div className="flex gap-2 w-full md:w-auto">
                                  <select 
                                     value={dashboardFilters.skill}
                                     onChange={(e) => setDashboardFilters({...dashboardFilters, skill: e.target.value})}
                                     className="flex-1 md:w-40 px-4 py-3.5 rounded-2xl bg-white border-2 border-slate-50 font-black text-[10px] uppercase tracking-widest outline-none focus:border-rose-500 shadow-sm"
                                  >
                                     <option value="All">Habilidad: Todas</option>
                                     <option value="Speaking">Speaking 🗣️</option>
                                     <option value="Writing">Writing ✍️</option>
                                  </select>
                                  <select 
                                     value={dashboardFilters.type}
                                     onChange={(e) => setDashboardFilters({...dashboardFilters, type: e.target.value})}
                                     className="flex-1 md:w-44 px-4 py-3.5 rounded-2xl bg-white border-2 border-slate-50 font-black text-[10px] uppercase tracking-widest outline-none focus:border-rose-500 shadow-sm"
                                  >
                                     <option value="All">Tipo: Todos</option>
                                     <option value="grupal">Grupal</option>
                                     <option value="individual">Individual</option>
                                     <option value="grupal-individual">Híbrido</option>
                                  </select>
                               </div>
                            </div>
                              {!showNewProjectForm && (
                                 <button onClick={() => setShowNewProjectForm(true)} className="px-8 py-4 rounded-[2rem] bg-indigo-950 text-white font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg hover:bg-rose-500 hover:shadow-rose-500/30 transition-all">
                                    <Plus size={16} /> Nueva Evaluación
                                 </button>
                              )}
                           </div>

                           {showNewProjectForm && (
                              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm animate-in slide-in-from-top-4 duration-500 space-y-8">
                                  <div className="flex justify-between items-center">
                                     <h5 className="text-lg font-black text-indigo-950 uppercase italic tracking-tight flex items-center gap-2">
                                        <Plus className="text-rose-500" /> Configuración de Actividad
                                     </h5>
                                     <button onClick={() => { setShowNewProjectForm(false); setNewProjectData({ name: '', unit: '', objective: '', skill: '', evaluationType: '' }); }} className="text-slate-400 hover:text-rose-500 transition-colors uppercase font-black text-[10px]">Cancelar</button>
                                  </div>

                                  {/* Step 1: Skill */}
                                  <div>
                                     <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-3">1. Habilidad a Evaluar</label>
                                     <div className="flex gap-3">
                                        {['Speaking', 'Writing'].map(skill => (
                                           <button
                                             key={skill}
                                             onClick={() => setNewProjectData({...newProjectData, skill})}
                                             className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-3 ${newProjectData.skill === skill ? 'bg-indigo-950 text-white border-indigo-950 shadow-lg shadow-indigo-950/20' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-indigo-200 hover:text-indigo-950'}`}
                                           >
                                             {skill === 'Speaking' ? <span className="text-xl">🗣️</span> : <span className="text-xl">✍️</span>}
                                             {skill}
                                           </button>
                                        ))}
                                     </div>
                                  </div>

                                  {/* Step 2: Evaluation type */}
                                  <div>
                                     <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-3">2. Tipo de Evaluación</label>
                                     <div className="flex gap-3 flex-wrap">
                                        {[
                                          { key: 'grupal', label: 'Grupal', icon: '👥', desc: 'Una nota compartida por el grupo' },
                                          { key: 'grupal-individual', label: 'Grupal + Individual', icon: '👥➕👤', desc: 'Nota grupal suma a la individual' },
                                          { key: 'individual', label: 'Individual', icon: '👤', desc: 'Cada alumno evaluado por separado' }
                                        ].map(opt => (
                                           <button
                                             key={opt.key}
                                             onClick={() => setNewProjectData({...newProjectData, evaluationType: opt.key})}
                                             className={`flex-1 min-w-[150px] py-4 px-4 rounded-2xl border-2 transition-all text-left ${newProjectData.evaluationType === opt.key ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20' : 'bg-slate-50 text-slate-600 border-slate-100 hover:border-rose-200 hover:text-rose-500'}`}
                                           >
                                             <div className="text-xl mb-1">{opt.icon}</div>
                                             <div className="font-black text-sm uppercase tracking-tight leading-none mb-1">{opt.label}</div>
                                             <div className={`text-[9px] font-bold uppercase tracking-widest ${newProjectData.evaluationType === opt.key ? 'text-rose-100' : 'text-slate-400'}`}>{opt.desc}</div>
                                           </button>
                                        ))}
                                     </div>
                                  </div>

                                  {/* Step 3: Details */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                     <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block pl-2">Título de Evaluación</label>
                                        <div className="relative">
                                           <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                           <input type="text" value={newProjectData.name} onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})} placeholder="Ej: Oral Quiz Unit 1" className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-rose-500 outline-none transition-all font-bold text-sm" />
                                        </div>
                                     </div>
                                     <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block pl-2">Unidad</label>
                                        <div className="relative">
                                           <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                           <input type="text" value={newProjectData.unit} onChange={(e) => setNewProjectData({...newProjectData, unit: e.target.value})} placeholder="Ej: Unit 1" className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-rose-500 outline-none transition-all font-bold text-sm" />
                                        </div>
                                     </div>
                                     <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block pl-2">Objetivo Pedagógico</label>
                                        <div className="relative">
                                           <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                           <input type="text" value={newProjectData.objective} onChange={(e) => setNewProjectData({...newProjectData, objective: e.target.value})} placeholder="Ej: Use of Second Conditional" className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-rose-500 outline-none transition-all font-bold text-sm" />
                                        </div>
                                     </div>
                                  </div>

                                  <div className="flex justify-end">
                                    <button onClick={createNewProject} className="px-10 py-4 rounded-[2rem] bg-indigo-950 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-rose-500 transition-all flex items-center gap-2">
                                       Crear y Definir Rúbrica <ChevronRight size={16} />
                                    </button>
                                  </div>
                               </div>
                           )}

                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
                              {courseProjects.length === 0 ? (
                                 <div className="col-span-full py-32 text-center bg-white border border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center">
                                    <FolderOpen size={64} className="text-slate-200 mb-4" />
                                    <p className="text-slate-500 font-bold text-lg">Sin actividades registradas.</p>
                                    <p className="text-slate-400 text-sm mt-2">Crea una nueva evaluación para comenzar.</p>
                                 </div>
                              ) : (
                                 courseProjects
                                   .filter(p => {
                                      const matchesSearch = !dashboardFilters.search || p.name.toLowerCase().includes(dashboardFilters.search.toLowerCase()) || (p.unit && p.unit.toLowerCase().includes(dashboardFilters.search.toLowerCase()));
                                      const matchesSkill = dashboardFilters.skill === 'All' || p.skill === dashboardFilters.skill;
                                      const matchesType = dashboardFilters.type === 'All' || p.evaluationType === dashboardFilters.type;
                                      return matchesSearch && matchesSkill && matchesType;
                                   })
                                   .map(p => (
                                    <div key={p.id} className="bg-white border border-slate-100 rounded-[2rem] p-8 flex flex-col justify-between group hover:border-rose-200 hover:shadow-xl transition-all duration-300 min-h-[280px]">
                                       <div 
                                          className="cursor-pointer flex-1"
                                          onClick={() => { setSelectedProjectId(p.id); setActiveTab('dashboard'); }}
                                       >
                                          <div className="flex justify-between items-start mb-6">
                                             <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-rose-500 flex items-center justify-center group-hover:bg-indigo-950 group-hover:text-white transition-all shadow-sm">
                                                <ClipboardCheck size={24} />
                                             </div>
                                             <div className="flex flex-col items-end gap-2">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(p.date).toLocaleDateString()}</span>
                                                <div className="flex flex-wrap justify-end gap-1">
                                                   {p.skill && <span className="bg-indigo-950 text-white text-[8px] font-black px-2 py-0.5 rounded mt-1 uppercase tracking-widest">{p.skill === 'Speaking' ? '🗣️' : '✍️'} {p.skill}</span>}
                                                   {p.evaluationType && <span className="bg-rose-100 text-rose-600 text-[8px] font-black px-2 py-0.5 rounded mt-1 uppercase tracking-widest">{p.evaluationType}</span>}
                                                   {p.unit && <span className="bg-slate-50 text-indigo-950 text-[8px] font-black px-2 py-0.5 rounded mt-1 uppercase tracking-widest">{p.unit}</span>}
                                                 </div>
                                             </div>
                                          </div>
                                          <h5 className="text-2xl font-black text-indigo-950 uppercase italic tracking-tighter leading-tight group-hover:text-rose-500 transition-colors mb-4">{p.name}</h5>
                                          <div className="flex items-center gap-3 mb-2">
                                             <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                                <div 
                                                   className="h-full bg-rose-500 transition-all duration-1000" 
                                                   style={{ width: `${getProjectProgress(p)}%` }} 
                                                />
                                             </div>
                                             <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{getProjectProgress(p)}%</span>
                                          </div>
                                          {p.objective && <p className="text-[10px] text-slate-500 font-bold mt-4 uppercase tracking-widest opacity-80 leading-relaxed italic line-clamp-2">{p.objective}</p>}
                                       </div>
                                       <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-slate-50">
                                          <button onClick={(e) => { e.stopPropagation(); renameProject(p.id); }} className="p-3 text-slate-400 hover:text-indigo-950 transition-colors bg-slate-50 hover:bg-slate-100 rounded-xl"><Pencil size={16} /></button>
                              <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} className="p-3 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                                       </div>
                                    </div>
                                 ))
                              )}
                           </div>
                        </div>
                     )}

                     {/* Dashboard: Gradebook View */}
                     {activeTab === 'gradebook' && !selectedProjectId && (
                        <div className="max-w-6xl mx-auto">
                           <Gradebook 
                              students={filteredStudents}
                              projects={projects}
                           />
                        </div>
                     )}

                     {/* Dashboard: Inside Project Steps */}
                     {activeTab === 'dashboard' && selectedProjectId && (
                        <div className="space-y-10 max-w-5xl mx-auto">
                           <div className="flex items-center gap-4 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                              <div className="bg-rose-500 p-4 rounded-2xl text-white shadow-lg shadow-rose-500/20"><LayoutDashboard size={24} /></div>
                              <div>
                                 <h4 className="text-2xl font-black text-indigo-950 italic tracking-tighter uppercase">Ruta de Evaluación</h4>
                                 <p className="text-slate-500 text-sm mt-1">Sigue los pasos para calificar a este proyecto.</p>
                              </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                               <div className="bg-white border border-slate-100 rounded-[2rem] p-8 group cursor-pointer border-l-8 border-l-amber-500 hover:shadow-xl transition-all" onClick={() => setActiveTab('rubrics')}>
                                  <div className="flex justify-between items-start mb-6">
                                     <Settings size={32} className="text-amber-500" />
                                     <span className="bg-amber-50 text-amber-700 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">Paso 1</span>
                                  </div>
                                  <h4 className="text-xl font-black text-indigo-950 mb-2 uppercase italic tracking-tighter">Configurar Rúbrica</h4>
                                  <p className="text-slate-500 text-xs">Define criterios grupal e individual antes de evaluar.</p>
                                  <ArrowRight className="mt-6 text-slate-200 group-hover:text-amber-500 transition-colors" size={20} />
                               </div>
                               <div className="bg-white border border-slate-100 rounded-[2rem] p-8 group cursor-pointer border-l-8 border-l-emerald-500 hover:shadow-xl transition-all" onClick={() => setActiveTab('assess')}>
                                  <div className="flex justify-between items-start mb-6">
                                     <ClipboardCheck size={32} className="text-emerald-500" />
                                     <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">Paso 2</span>
                                  </div>
                                   <h4 className="text-xl font-black text-indigo-950 mb-2 uppercase italic tracking-tighter">
                                      {currentProject?.evaluationType === 'individual' ? 'Calificar Estudiantes' : 'Calificar Grupos'}
                                   </h4>
                                   <p className="text-slate-500 text-xs">
                                      {currentProject?.evaluationType === 'individual' ? 'Inicia la evaluación directa de tus alumnos.' : 'Asigna alumnos a grupos y aplica la rúbrica.'}
                                   </p>
                                  <ArrowRight className="mt-6 text-slate-200 group-hover:text-emerald-500 transition-colors" size={20} />
                               </div>
                               <div className="bg-white border border-slate-100 rounded-[2rem] p-8 group cursor-pointer border-l-8 border-l-rose-500 hover:shadow-xl transition-all" onClick={() => setActiveTab('results')}>
                                  <div className="flex justify-between items-start mb-6">
                                     <FileSpreadsheet size={32} className="text-rose-500" />
                                     <span className="bg-rose-50 text-rose-700 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">Paso 3</span>
                                  </div>
                                  <h4 className="text-xl font-black text-indigo-950 mb-2 uppercase italic tracking-tighter">Ver Resultados</h4>
                                  <p className="text-slate-500 text-xs">Promedios, feedback IA y certificados PDF.</p>
                                  <ArrowRight className="mt-6 text-slate-200 group-hover:text-rose-500 transition-colors" size={20} />
                               </div>
                           </div>
                        </div>
                     )}

                     {activeTab === 'rosters' && (
                       <div className="max-w-6xl mx-auto">
                         <RosterManager students={filteredStudents} onUpdateStudents={(newList) => setStudents(newList)} teacher={currentTeacher} />
                       </div>
                     )}

                     {(activeTab === 'rubrics' || activeTab === 'assess' || activeTab === 'results') && !selectedProjectId && (
                       <div className="text-center py-32 bg-white border border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center max-w-4xl mx-auto">
                          <FolderOpen size={64} className="text-slate-200 mb-6" />
                          <h5 className="text-2xl font-black text-indigo-950 italic uppercase tracking-tighter mb-4">Selecciona un Proyecto Primero</h5>
                          <p className="text-slate-500 text-sm mb-8">Debes estar dentro de una actividad específica para evaluar o ver resultados.</p>
                          <button onClick={() => setActiveTab('dashboard')} className="px-10 py-4 rounded-[2rem] bg-indigo-950 text-white font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-rose-500 transition-all">Ir al Panel de Actividades</button>
                       </div>
                     )}

                     {activeTab === 'rubrics' && selectedProjectId && (
                       <div className="max-w-6xl mx-auto">
                         <RubricManager 
                           rubrics={currentProject?.rubrics || {group:[], individual:[]}} 
                           onUpdateRubrics={handleUpdateRubrics}
                           sharedTemplates={sharedTemplates}
                           publishToLibrary={window.publishToLibrary}
                           evaluationType={currentProject?.evaluationType}
                         />
                       </div>
                     )}

                     {activeTab === 'assess' && selectedProjectId && (
                       <div className="max-w-6xl mx-auto h-full min-h-[800px]">
                         <AssessmentEngine 
                            students={filteredStudents} 
                            rubrics={currentProject?.rubrics || {group:[], individual:[]}} 
                            assessments={currentProject?.assessments || INITIAL_ASSESSMENT_STATE} 
                            onUpdateAssessments={handleUpdateAssessments} 
                            selectedCourse={selectedCourse} 
                            evaluationType={currentProject?.evaluationType}
                            skill={currentProject?.skill}
                         />
                       </div>
                     )}

                     {activeTab === 'results' && selectedProjectId && (
                        <div className="max-w-6xl mx-auto">
                          <ResultsView 
                            students={filteredStudents} 
                            rubrics={currentProject?.rubrics || {group:[], individual:[]}} 
                            assessments={currentProject?.assessments || INITIAL_ASSESSMENT_STATE} 
                            evaluationType={currentProject?.evaluationType}
                          />
                        </div>
                     )}

                  </motion.div>
               </AnimatePresence>
            </div>
          </div>
        )}

        {/* Modal Registrar Docente */}
        <AnimatePresence>
          {showTeacherForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-indigo-950/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full relative">
                <button onClick={() => setShowTeacherForm(false)} className="absolute top-6 right-6 w-10 h-10 bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white rounded-full flex items-center justify-center transition-all">
                  <X size={18} />
                </button>
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-3xl font-black text-indigo-950 italic tracking-tighter mb-2">{newTeacherData.id ? 'Editar' : 'Registrar'} Docente</h3>
                <p className="text-slate-500 text-sm mb-8">Ingresa el nombre y selecciona los cursos asignados.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">ID de Base de Datos</label>
                    <input 
                      value={newTeacherData.id || ''} 
                      onChange={(e) => setNewTeacherData({ ...newTeacherData, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} 
                      placeholder="Autogenerado si se deja vacío (Ej: carla)" 
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-indigo-950 font-bold focus:border-rose-500 focus:bg-white outline-none transition-all" 
                    />
                    <p className="text-[9px] text-slate-400 mt-1 ml-4">
                      Este ID vincula al docente con su documento de notas en Firestore. Edítalo con cuidado.
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Nombre del Profesor</label>
                    <input autoFocus value={newTeacherData.name} onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })} placeholder="Ej: Miss Javiera Lizama" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-indigo-950 font-bold focus:border-rose-500 focus:bg-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Correo Institucional</label>
                    <input value={newTeacherData.email} onChange={(e) => setNewTeacherData({ ...newTeacherData, email: e.target.value })} placeholder="ejemplo@colegioumbral.com" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-indigo-950 font-bold focus:border-rose-500 focus:bg-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Cursos Asignados ({currentSelectedCourses.length})</label>
                    <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl custom-scrollbar">
                      {availableCourses.map(course => {
                        const isSelected = currentSelectedCourses.includes(course);
                        const assignedTeacher = teachersList.find(t => t.id !== newTeacherData.id && (t.courses || []).some(c => formatCourseDisplay(c) === course));
                        const isTakenByOther = !!assignedTeacher && !isSelected;

                        return (
                          <button 
                            key={course}
                            onClick={() => handleToggleCourse(course)}
                            title={isTakenByOther ? `Asignado a ${assignedTeacher.name}` : ''}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all relative flex flex-col items-center min-w-[80px] ${
                              isSelected 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                : isTakenByOther
                                ? 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-500 hover:shadow-md'
                            }`}
                          >
                            <span>{course}</span>
                            {isTakenByOther && (
                              <span className="text-[7px] opacity-70 truncate max-w-full">
                                {assignedTeacher.name.split(' ').pop()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button onClick={handleSaveTeacher} className="w-full bg-indigo-950 text-white font-black text-[10px] uppercase tracking-[0.2em] py-5 rounded-[2rem] shadow-xl hover:bg-rose-500 hover:-translate-y-1 transition-all mt-4">Guardar Perfil</button>
                  {newTeacherData.id && (
                     <button onClick={() => {
                       if (confirm('¿Eliminar a este docente?')) {
                         const newList = teachersList.filter(t => t.id !== newTeacherData.id);
                         setTeachersList(newList);
                         saveTeachersToCloud(newList);
                         setShowTeacherForm(false);
                         if (currentTeacher?.id === newTeacherData.id) setCurrentTeacher(null);
                       }
                     }} className="w-full bg-white text-rose-500 font-black text-[10px] uppercase tracking-[0.2em] py-5 rounded-[2rem] hover:bg-rose-50 transition-all mt-2 border-2 border-rose-100">Eliminar Docente</button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
