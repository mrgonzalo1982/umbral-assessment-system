/**
 * Utility to parse raw rubric text into the system's format
 */

export const parseRawRubric = (text) => {
  const rubrics = {
    group: [],
    individual: []
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let currentSection = null;

  lines.forEach(line => {
    // Detect Sections
    if (line.toLowerCase().includes('section 1') || line.toLowerCase().includes('group product')) {
      currentSection = 'group';
      return;
    }
    if (line.toLowerCase().includes('section 2') || line.toLowerCase().includes('individual')) {
      currentSection = 'individual';
      return;
    }

    // Detect Criteria (Common pattern: Name + Levels)
    // Example: Pronunciation 4 Levels 3 2 1
    // Better pattern: Split by tabs or multiple spaces if it's a table copy-paste
    const parts = line.split(/\t| {3,}/);
    
    if (parts.length >= 5 && currentSection) {
      const title = parts[0].replace(/Criterion|Criteria/i, '').trim();
      if (title.toLowerCase() === 'criteria' || title.toLowerCase() === 'student') return;

      const desc = {
        4: parts[1] || 'Excelente',
        3: parts[2] || 'Bueno',
        2: parts[3] || 'Regular',
        1: parts[4] || 'Insufiente'
      };

      // Extract points if present (e.g. ___/2)
      let weight = 1;
      const pointsMatch = line.match(/___?\/(\d+)/);
      if (pointsMatch) {
         const maxPts = parseInt(pointsMatch[1]);
         weight = maxPts / 4; // Assuming 4 is the max level
      } else if (currentSection === 'individual') {
         // Default individual from user example seems to be 4 pts each (20 total / 5 criteria)
         weight = 1; 
      } else if (currentSection === 'group') {
         // Default group from user example seems to be 2 pts each (8 total / 4 criteria)
         weight = 0.5;
      }

      rubrics[currentSection].push({
        id: `cr_ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title,
        weight,
        desc
      });
    }
  });

  return rubrics;
};
