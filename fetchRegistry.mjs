import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
    console.log("Teachers Registry:", JSON.stringify(teachers, null, 2));
  }
}

run().then(() => process.exit(0)).catch(console.error);
