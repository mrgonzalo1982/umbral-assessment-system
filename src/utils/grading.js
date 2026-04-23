/**
 * Calculates the Chilean mark (1.0 to 7.0) based on the score, max score and passing percentage.
 * 
 * @param {number} score - The score obtained.
 * @param {number} maxScore - The maximum possible score.
 * @param {number} passingPercentage - The passing percentage (default 60%).
 * @returns {string} - The formatted mark (e.g., "4.0").
 */
export const calculateChileanMark = (score, maxScore, passingPercentage = 0.6) => {
  if (score === 0 || maxScore === 0) return "1.0";
  
  const passingScore = maxScore * passingPercentage;
  let mark;
  
  if (score < passingScore) {
    // Range 1.0 - 4.0
    mark = 3.0 * (score / passingScore) + 1.0;
  } else {
    // Range 4.0 - 7.0
    mark = 3.0 * ((score - passingScore) / (maxScore - (maxScore * passingPercentage))) + 4.0;
  }
  
  // Cap between 1.0 and 7.0
  mark = Math.max(1.0, Math.min(7.0, mark));
  
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
  }
};
