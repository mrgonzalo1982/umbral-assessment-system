import { parseRawRubric } from './src/utils/rubricParser.js';
import fs from 'fs';

const text = `SECTION 1: GROUP PRODUCT – POSTER (12 POINTS)
Content (Project Requirements)	Includes 6/6 elements: history, people, location, how they build/live, interesting facts, present situation	Includes 5/6 elements	Includes 3–4 elements	Includes 0–2 elements	____/2
Organization & Structure	Includes title + 3 clearly separated sections (introduction, body, conclusion); information grouped logically in all sections	Includes title + 3 sections but 1 section is unclear or mixed	Includes title + only 2 clear sections OR information is partially disorganized	Missing title OR only 1 section OR information is not grouped	____/2
Accuracy of Information	0 incorrect facts; all information matches topic and project requirements	1 incorrect or unclear fact	2–3 incorrect or unclear facts	4+ incorrect facts or very limited information	____/2
Grammar & Spelling	0–2 errors in the full poster	3–4 errors	5–6 errors	7+ errors	____/2
Visual Elements (Support of Content)	Includes ≥3 relevant visuals (images, maps, drawings) directly related to at least 3 content sections	Includes 2 relevant visuals related to content	Includes 1 visual OR visuals not clearly related to content	Includes 0 visuals OR visuals do not relate to content	____/2
Work in class and responsibility	Group works during 90-100% of class time. 0 reminders of behavior or phone use. 	Works 75-89% of time. 1 or 2 reminders.	Works 50-74% of time. 3 or 4 reminders.	Works <50% of time. +5 reminders.	____/2
Subtotal: /12
SECTION 2: INDIVIDUAL ORAL PRESENTATION (24 POINTS PER STUDENT)
Criteria	4 – Consistently Demonstrated	3 – Mostly Demonstrated	2 – Developing	1 – Beginning	Points
Pronunciation (Intelligibility)	Listener understands 100% of speech without repetition	Listener understands 75–99% (1–2 repetitions needed)	Listener understands 50–74% (3–4 repetitions needed)	Listener understands <50% (5+ repetitions needed)	___ /4
Fluency (Reading vs Speaking)	Speaks ≥90% of the time without reading	Speaks 60–89% without reading	Speaks 30–59% without reading	Speaks <30% without reading (reads most/all)	___ /4
Content Knowledge (Own Section)	Explains ≥4 key ideas from their section clearly	Explains 3 key ideas	Explains 2 key ideas	Explains 0–1 ideas	___ /4
Use of Target Language (Unit 5 + Conditionals)	Uses ≥3 Unit 5 vocabulary words + at least 1 correct use of adjectives + as … as, enough, have to/don’t have to.	Uses 2 vocabulary words + at least 1 correct use of adjectives + as … as, enough, have to/don’t have to.	Uses 1 vocabulary word OR attempts of adjectives + as … as, enough, have to/don’t have to.	Does not use target language	___ /4
Grammar Accuracy (Oral Production)	0–2 errors	3–4 errors	5–6 errors	7+ errors	___ /4
Classwork and responsible phone use	Uses phone only for task. 0 reminders; stays on task 90-100% of time.	1-2 reminders; stays on task 75-89% of time.	3-4 reminders; stays on task 50-74% of time.	+5 reminders; stays on task <50% of time.	___ /4
Subtotal per student: /24`;

// To debug, we will copy the parser here and add console logs
const rubrics = { group: [], individual: [] };
let currentSection = 'group';
let buffer = [];

const flushBuffer = () => {
    while (buffer.length >= 5) {
      let title = buffer[0]
        .replace(/\(\d+\s*points?\)/i, '')
        .replace(/_{2,}\s*\/\d+/, '')
        .replace(/^\d+\s*[-.)]\s*/, '')
        .replace(/points?$/i, '')
        .trim();

      console.log('--- PROCESSING 5 CHUNK ---');
      console.log('Title extracted:', title);
      console.log('Desc 4:', buffer[1]);

      if (title.length > 2 && !/^\d+$/.test(title)) {
        console.log('>>> ACCEPTED CRITERION');
      } else {
        console.log('>>> REJECTED CRITERION', title);
      }

      buffer = buffer.slice(5);

      while (buffer.length > 0 && (/^\d+$/.test(buffer[0]) || buffer[0].toLowerCase().includes('point') || buffer[0].toLowerCase().includes('punto') || /^_+[/\s\d]*$/.test(buffer[0]) || /^\/?\d+$/.test(buffer[0]))) {
        console.log('DROPPING GARBAGE:', buffer[0]);
        buffer.shift();
      }
    }
};

text.split('\n').forEach(line => {
    const l = line.toLowerCase();
    const parts = line.split(/\t| {2,}/).map(p => p.trim()).filter(p => p.length > 0);
    
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
    if (l.includes('criteria') && l.includes('demonstrated')) return;
    if (l.includes('subtotal') || l.startsWith('total') || l.includes('final score') || l.includes('puntaje final')) return;
    parts.forEach(p => {
       if (p.toLowerCase() === 'pts' || p === '-') return;
       buffer.push(p);
    });

    if (buffer.length >= 5) {
       flushBuffer();
    }
});

flushBuffer();
