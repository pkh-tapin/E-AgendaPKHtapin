import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, update, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDWVkNEOaRDE_wEvGmqTioT-Mxyl4srdhI",
  authDomain: "apppkhtapin.firebaseapp.com",
  databaseURL: "https://apppkhtapin-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "apppkhtapin",
  storageBucket: "apppkhtapin.firebasestorage.app",
  messagingSenderId: "100952526834",
  appId: "1:100952526834:web:e7617bd5a3bb974439a56b"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, push, onValue, update, remove };