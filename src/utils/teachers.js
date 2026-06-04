/**
 * Teacher and Course Access Configuration
 */

export const DEFAULT_TEACHERS = [
  {
    id: 'me',
    name: 'Mr. Gonzalo Flores',
    email: 'gonzalo.flores@colegioumbral.com',
    courses: ['1° Medio A', '1° Medio C', '2° Medio B', '3° Medio B', '4° Medio B']
  },
  {
    id: 'carla',
    name: 'Miss Carla Ramirez',
    email: 'carla.ramirez@colegioumbral.com',
    courses: ['7° Básico B', '8° Básico B', '2° Medio A', '3° Medio A', '4° Medio A', 'Pre-Kinder', '2° Básico A', 'Kinder']
  },
  {
    id: 'javiera',
    name: 'Miss Javiera Lizama',
    email: 'javiera.lizama@colegioumbral.com',
    courses: ['6° Básico B', '7° Básico A', '8° Básico A', '5° Básico B', '3° Básico A', '4° Básico A']
  },
  {
    id: 'valentina',
    name: 'Miss Valentina Cornejo',
    email: 'valentina.cornejo@colegioumbral.com',
    courses: [], 
    isBackup: true
  }
];

/**
 * Normalizes a course name for comparison
 * @param {string} course - Course name
 * @returns {string} - Normalized course name
 */
export const normalizeCourse = (course) => {
  if (!course) return '';
  let norm = course
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[°º]/g, '') // Remove degree symbols
    .replace(/transicion\s*1/g, 'prekinder')
    .replace(/transicion\s*2/g, 'kinder')
    .replace(/\bnt1\b/g, 'prekinder')
    .replace(/\bnt2\b/g, 'kinder')
    .replace(/\bprimero\b/g, '1')
    .replace(/\bsegundo\b/g, '2')
    .replace(/\btercero\b/g, '3')
    .replace(/\bcuarto\b/g, '4')
    .replace(/\bquinto\b/g, '5')
    .replace(/\bsexto\b/g, '6')
    .replace(/\bseptimo\b/g, '7')
    .replace(/\boctavo\b/g, '8')
    .replace(/\bbasico\b/g, '')
    .replace(/\bmedio\b/g, 'm')
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .trim();
    
    // Alias common combinations
    if (norm.includes('prekinder')) return 'prekinder';
    if (norm.includes('kinder') && !norm.includes('pre')) return 'kinder';
    
    return norm;
};

/**
 * Formats a course name for display (e.g., NT1 -> Pre-Kinder)
 * @param {string} course - Course name
 * @returns {string} - Formatted course name
 */
export const formatCourseDisplay = (course) => {
  if (!course) return 'General';
  let c = course.trim();
  const cu = c.toUpperCase();
  
  if (cu.includes('TRANSICI') && cu.includes('1')) return 'Pre-Kinder';
  if (cu.includes('TRANSICI') && cu.includes('2')) return 'Kinder';
  if (cu.includes('NT1')) return 'Pre-Kinder';
  if (cu.includes('NT2')) return 'Kinder';
  if (cu === 'KINDER') return 'Kinder';
  if (cu === 'PRE-KINDER' || cu === 'PREKINDER') return 'Pre-Kinder';

  // Standardize casing: "1° Básico A"
  const parts = c.split(' ');
  if (parts.length > 1) {
    const formattedParts = parts.map((p, index) => {
      if (index === 0) return p.toUpperCase(); // "1°"
      if (p.length === 1 && /[a-zA-Z]/.test(p)) return p.toUpperCase(); // Section "A"
      // "Básico" or "Medio"
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    });
    return formattedParts.join(' ');
  }

  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
};

/**
 * Checks if a teacher has access to a specific course
 * @param {Object} teacher - Teacher object
 * @param {string} courseName - Name of the course
 * @returns {boolean}
 */
export const hasAccess = (teacher, courseName, allTeachers = DEFAULT_TEACHERS) => {
  if (!teacher) return false;
  if (!teacher.courses) teacher.courses = [];
  
  const normalizedCourseName = normalizeCourse(courseName);

  // If it's the backup teacher, she has access to anything 
  // NOT assigned to others
  if (teacher.isBackup) {
    const isAssignedToOthers = allTeachers
      .filter(t => !t.isBackup && t.id !== teacher.id)
      .some(t => (t.courses || []).some(c => normalizeCourse(c) === normalizedCourseName));
    return !isAssignedToOthers;
  }

  return teacher.courses.some(c => normalizeCourse(c) === normalizedCourseName);
};
