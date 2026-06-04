export async function generateFeedbackAI(context, apiKey) {
  if (!apiKey) throw new Error("API Key no configurada.");
  
  const prompt = `
Eres un profesor de inglés muy empático y profesional del "Colegio Umbral de Curauma". 
Tu tarea es redactar un párrafo de retroalimentación pedagógica (en inglés o español, dependiendo del nivel, pero priorizando un tono alentador) para un estudiante o grupo de estudiantes.
No saludes ni te despidas, solo entrega el párrafo de feedback que irá directamente en su reporte de notas.

Contexto del estudiante/grupo:
- Nombre: ${context.name}
- Nivel de desempeño: ${context.score} de ${context.maxScore}
- Puntos Fuertes (Criterios donde sacó puntaje perfecto): ${context.strengths.join(', ') || 'Ninguno específico'}
- Áreas de mejora (Criterios donde sacó bajo puntaje): ${context.weaknesses.join(', ') || 'Ninguno específico'}
- Notas rápidas del profesor: "${context.teacherNotes || 'Buen trabajo en general.'}"

Instrucciones críticas de formato:
1. Escribe exactamente 1 o 2 oraciones. Ni una más.
2. Tono: Eres un profesor de colegio hablándole directamente al alumno (o grupo) de forma cercana, simple y natural. 
3. PROHIBIDO usar lenguaje corporativo o robótico como "muestra oportunidades de mejora", "potenciará significativamente", "áreas de enfoque", etc.
4. Usa un vocabulario escolar cotidiano y directo. Ejemplo bueno: "Ignacio, hiciste un buen trabajo, pero te sugiero practicar más la pronunciación de las palabras nuevas."
5. Usa las "Notas rápidas del profesor" como base principal. Si están vacías, menciona un punto fuerte y algo específico que debe estudiar o repasar.
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Error conectando con la IA de Google Gemini");
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
