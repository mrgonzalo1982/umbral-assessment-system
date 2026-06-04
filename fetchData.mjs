import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCHnMsKLG9Wv7Fh4MBsewJv0UudIA9lFkQ",
  projectId: "umbral-rubrics",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const registryDoc = await getDoc(doc(db, 'assessments_data', 'teachers_registry'));
  if (registryDoc.exists()) {
    const teachers = registryDoc.data().teachers;
    const gonzalo = teachers.find(t => t.name.includes('Gonzalo') || t.email.includes('gonzalo'));
    console.log("Gonzalo Teacher info:", gonzalo);
    
    if (gonzalo) {
      const gDoc = await getDoc(doc(db, 'assessments_data', gonzalo.id));
      if (gDoc.exists()) {
        const data = gDoc.data();
        console.log("Projects count:", data.projects ? data.projects.length : 0);
        console.log("Rubrics keys:", Object.keys(data.rubrics || {}));
        // Print projects summary
        if (data.projects) {
          data.projects.forEach(p => {
             console.log(`- Project: ${p.name} (${p.course}) | Evaluated: ${Object.keys(p.assessments?.individualScores || {}).length}`);
          });
        }
      } else {
        console.log("No document found for id:", gonzalo.id);
      }

      // Special case: check 'me' document
      const meDoc = await getDoc(doc(db, 'assessments_data', 'me'));
      if (meDoc.exists()) {
         const mData = meDoc.data();
         console.log("\n'me' document Projects count:", mData.projects ? mData.projects.length : 0);
         if (mData.projects) {
           mData.projects.forEach(p => {
              console.log(`- Project: ${p.name} (${p.course}) | Evaluated: ${Object.keys(p.assessments?.individualScores || {}).length}`);
           });
         }
      }
    }
  } else {
    console.log("No teachers registry found");
  }
}

run().then(() => process.exit(0)).catch(console.error);
