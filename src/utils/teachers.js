/**
 * Teacher and Course Access Configuration
 */

export const TEACHERS = [
  {
    id: 'me',
    name: 'Gonzalo Flores',
    courses: ['1° medio A', '1° medio C', '2° medio B', '3° medio B', '4° medio B']
  },
  {
    id: 'carla',
    name: 'Miss Carla Ramirez',
    courses: ['7°B', '8°B', '2 medio A', '3° medio A', '4° medio A', 'Pre-Kinder', '2° básico A', 'Kinder']
  },
  {
    id: 'javiera',
    name: 'Miss Javiera Lizama',
    courses: ['6° básico B', '7° básico A', '8° básico A', '5° básico B', '3° básico A', '4° básico A']
  },
  {
    id: 'valentina',
    name: 'Miss Valentina Cornejo',
    courses: [], // Catch-all
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
 * Checks if a teacher has access to a specific course
 * @param {Object} teacher - Teacher object
 * @param {string} courseName - Name of the course
 * @returns {boolean}
 */
export const hasAccess = (teacher, courseName) => {
  if (!teacher) return false;
  
  const normalizedCourseName = normalizeCourse(courseName);

  // If it's the backup teacher (Valentina), she has access to anything 
  // NOT assigned to others
  if (teacher.isBackup) {
    const isAssignedToOthers = TEACHERS
      .filter(t => !t.isBackup)
      .some(t => t.courses.some(c => normalizeCourse(c) === normalizedCourseName));
    return !isAssignedToOthers;
  }

  return teacher.courses.some(c => normalizeCourse(c) === normalizedCourseName);
};
