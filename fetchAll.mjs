import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCHnMsKLG9Wv7Fh4MBsewJv0UudIA9lFkQ",
  projectId: "umbral-rubrics",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching all documents in assessments_data...");
  const colSnap = await getDocs(collection(db, 'assessments_data'));
  colSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id !== 'global_roster' && doc.id !== 'teachers_registry' && doc.id !== 'shared_library') {
       console.log(`\nTeacher ID: ${doc.id}`);
       if (data.projects) {
         data.projects.forEach(p => {
           console.log(`  - Project: ${p.name} (${p.course}) | Evaluated: ${Object.keys(p.assessments?.individualScores || {}).length}`);
         });
       } else {
         console.log("  - No projects array");
       }
    }
  });
}

run().then(() => process.exit(0)).catch(console.error);
