import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBOvd_TIfzxJ7gqm3qbyFdC6nby6RDLrFs",
  authDomain: "rail-gaadi-eta.firebaseapp.com",
  projectId: "rail-gaadi-eta",
  storageBucket: "rail-gaadi-eta.firebasestorage.app",
  messagingSenderId: "191793269561",
  appId: "1:191793269561:web:eedd3f6abed8489ab9b6e8",
  measurementId: "G-06D34HMKX9",
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export default app;
