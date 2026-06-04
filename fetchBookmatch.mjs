import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

const bookmatchConfig = {
  apiKey: "AIzaSyAjwooj-KUf9R2FSV1bOlBF_21lh6z11yc",
  projectId: "bookmatch-aeccb",
};

const app = initializeApp(bookmatchConfig);
const db = getFirestore(app);

async function run() {
  console.log("Checking Bookmatch Database...");
  const colSnap = await getDocs(collection(db, 'assessments_data'));
  colSnap.forEach(doc => {
     console.log("Found doc:", doc.id);
  });
  
  const gonzaloDoc = await getDoc(doc(db, 'assessments_data', 'me'));
  if (gonzaloDoc.exists()) {
    console.log("Bookmatch Gonzalo projects:", JSON.stringify(gonzaloDoc.data().projects, null, 2));
  } else {
    console.log("No 'me' doc in bookmatch");
  }
}

run().then(() => process.exit(0)).catch(console.error);
