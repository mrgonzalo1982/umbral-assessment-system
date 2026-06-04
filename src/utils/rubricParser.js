/**
 * Advanced State-Machine Rubric Parser.
 * Handles both "Excel style" (tab-separated) and "PDF style" (newline-separated)
 * by collecting chunks of text and grouping them aggressively into blocks of 5.
 */
export const parseRawRubric = (text) => {
  const rubrics = { group: [], individual: [] };
  if (!text || !text.trim()) return rubrics;

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let currentSection = 'group'; 
  let buffer = [];

  const flushBuffer = () => {
    while (buffer.length >= 5) {
      // 1. Limpiar el título (remover números sueltos o puntajes)
      let title = buffer[0]
        .replace(/\(\d+\s*points?\)/i, '')
        .replace(/_{2,}\s*\/\d+/, '')
        .replace(/^\d+\s*[-.)]\s*/, '') // Remover "1.", "1-", "1)"
        .replace(/points?$/i, '')
        .trim();

      // 2. Si el título es válido, construimos el criterio
      if (title.length > 2 && !/^\d+$/.test(title)) {
        const desc = {
          4: buffer[1],
          3: buffer[2],
          2: buffer[3],
          1: buffer[4]
        };

        rubrics[currentSection].push({
          id: `cr_ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          title, 
          weight: 1, 
          desc
        });
      }

      // 3. Avanzamos el buffer sacando los 5 elementos que ya usamos
      buffer = buffer.slice(5);

      // 4. Limpieza post-criterio: A veces el PDF pega el "Puntaje máximo" (ej: "4") al final de la fila.
      // Si el siguiente elemento es un número suelto o la palabra "puntos", lo descartamos para no desfasar el siguiente título.
      while (buffer.length > 0 && (/^\d+$/.test(buffer[0]) || buffer[0].toLowerCase().includes('point') || buffer[0].toLowerCase().includes('punto') || /^_+[/\s\d]*$/.test(buffer[0]) || /^\/?\d+$/.test(buffer[0]))) {
        buffer.shift();
      }
    }
  };

  lines.forEach(line => {
    const l = line.toLowerCase();
    
    // Dividir por Tabulación o Múltiples Espacios (Para soportar copiado desde Excel/Word tables)
    // Si es un PDF roto, simplemente devolverá la línea entera como 1 solo elemento.
    const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p.length > 0);

    // Detectar Cambio de Sección (Ignorando mayúsculas)
    if (parts.length <= 2 && (l.includes('section 2') || l.includes('individual') || l.includes('oral presentation'))) {
      flushBuffer();
      currentSection = 'individual';
      buffer = []; 
      return;
    } 
    if (parts.length <= 2 && (l.includes('section 1') || l.includes('group product') || l.includes('poster'))) {
      flushBuffer();
      currentSection = 'group';
      buffer = [];
      return;
    }

    // Ignorar encabezados y basura común
    if (l.includes('criteria') && l.includes('demonstrated')) return;
    if (l.includes('subtotal') || l.startsWith('total') || l.includes('final score') || l.includes('puntaje final')) return;
    
    parts.forEach(p => {
       // Omitir columnas vacías o columnas que solo digan "Pts"
       if (p.toLowerCase() === 'pts' || p === '-') return;
       buffer.push(p);
    });

    // Si el buffer ya tiene 5 o más elementos, intentamos procesar.
    // Esto es vital para el caso de Excel (donde 1 línea llena los 5 elementos de golpe).
    if (buffer.length >= 5) {
       flushBuffer();
    }
  });

  // Limpiar cualquier residuo que haya quedado
  flushBuffer();

  return rubrics;
};
