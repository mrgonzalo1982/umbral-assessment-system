/**
 * Calculates the Chilean mark (1.0 to 7.0) based on the score, max score and passing percentage.
 * 
 * @param {number} score - The score obtained.
 * @param {number} maxScore - The maximum possible score.
 * @param {number} passingPercentage - The passing percentage (default 60%).
 * @returns {string} - The formatted mark (e.g., "4.0").
 */
export const calculateChileanMark = (score, maxScore, passingPercentage = 0.6) => {
  if (maxScore === 0) return "2.0";
  if (score === 0) return "2.0";
  
  const passingScore = maxScore * passingPercentage;
  let mark;
  
  if (score < passingScore) {
    // Range 2.0 - 4.0
    // formula: mark = ((passingMark - minMark) / passingScore) * score + minMark
    mark = 2.0 * (score / passingScore) + 2.0;
  } else {
    // Range 4.0 - 7.0
    mark = 3.0 * ((score - passingScore) / (maxScore - passingScore)) + 4.0;
  }
  
  // Cap between 2.0 and 7.0
  mark = Math.max(2.0, Math.min(7.0, mark));
  
  return (Math.round(mark * 10) / 10).toFixed(1);
};

/**
 * LocalStorage Helpers
 */
export const storage = {
  save: (key, data) => {
    localStorage.setItem(`umbral_${key}`, JSON.stringify(data));
  },
  load: (key) => {
    const data = localStorage.getItem(`umbral_${key}`);
    return data ? JSON.parse(data) : null;
  },
  createBackup: (teacherId, data) => {
    if (!teacherId || !data) return;
    const backupKeyPrefix = `umbral_backup_${teacherId}_`;
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys.filter(k => k.startsWith(backupKeyPrefix)).sort();
    
    // Compare with the latest to avoid redundant identical backups
    if (backupKeys.length > 0) {
      const latest = JSON.parse(localStorage.getItem(backupKeys[backupKeys.length - 1]));
      if (JSON.stringify(latest.data) === JSON.stringify(data)) return;
    }
    
    // Save new backup
    localStorage.setItem(`${backupKeyPrefix}${Date.now()}`, JSON.stringify({ timestamp: Date.now(), data }));
    
    // Keep max 10 backups per teacher
    if (backupKeys.length >= 10) {
      localStorage.removeItem(backupKeys[0]);
    }
  },
  getBackups: (teacherId) => {
    if (!teacherId) return [];
    const backupKeyPrefix = `umbral_backup_${teacherId}_`;
    return Object.keys(localStorage)
      .filter(k => k.startsWith(backupKeyPrefix))
      .map(k => {
        try {
          return JSON.parse(localStorage.getItem(k));
        } catch(e) { return null; }
      })
      .filter(b => b !== null)
      .sort((a,b) => b.timestamp - a.timestamp);
  }
};

/**
 * Calculates a student's final grade for a specific project.
 * Returns null if the student has not been graded yet in the applicable rubrics.
 */
export const calculateProjectGrade = (studentId, project) => {
  if (!project || !project.assessments) return null;
  
  const rubrics = project.rubrics || { group: [], individual: [] };
  const groupRubrics = Array.isArray(rubrics.group) ? rubrics.group : [];
  const individualRubrics = Array.isArray(rubrics.individual) ? rubrics.individual : [];
  const evaluationType = project.evaluationType || 'grupal-individual';
  const assessments = project.assessments;
  
  const studentGroups = assessments.studentGroups || {};
  const groupId = studentGroups[studentId];
  
  // If it's not individual, a group ID is required to fetch group grades
  if (evaluationType !== 'individual' && !groupId) return null;
  
  const groupScores = assessments.groupScores || {};
  const individualScores = assessments.individualScores || {};
  
  const gScores = groupId ? (groupScores[groupId] || {}) : {};
  const iScores = individualScores[studentId] || {};
  
  const hasGroupScores = Object.keys(gScores).length > 0;
  const hasIndividualScores = Object.keys(iScores).length > 0;
  
  // Check if evaluation is pending based on type
  if (evaluationType === 'individual' && !hasIndividualScores) return null;
  if (evaluationType === 'grupal' && !hasGroupScores) return null;
  if (evaluationType === 'grupal-individual' && !hasGroupScores && !hasIndividualScores) return null;
  
  let gScoreTotal = 0;
  if (evaluationType !== 'individual') {
    gScoreTotal = groupRubrics.reduce((t, cr) => t + ((parseFloat(gScores[cr.id]) || 0) * (parseFloat(cr.weight) || 1)), 0);
  }
  
  let iScoreTotal = 0;
  if (evaluationType !== 'grupal') {
    iScoreTotal = individualRubrics.reduce((t, cr) => t + ((parseFloat(iScores[cr.id]) || 0) * (parseFloat(cr.weight) || 1)), 0);
  }
  
  let maxTotal = 0;
  if (evaluationType !== 'individual') {
    maxTotal += groupRubrics.reduce((t, cr) => t + (4 * (parseFloat(cr.weight) || 1)), 0);
  }
  if (evaluationType !== 'grupal') {
    maxTotal += individualRubrics.reduce((t, cr) => t + (4 * (parseFloat(cr.weight) || 1)), 0);
  }
  
  if (maxTotal === 0) return null;
  
  const total = gScoreTotal + iScoreTotal;
  return calculateChileanMark(total, maxTotal);
};

