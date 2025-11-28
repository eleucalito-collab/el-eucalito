import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc,
  writeBatch,
  getDocs,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { Transaction, Booking } from '../types';

// --- CONFIGURACIÓN DE FIREBASE ---
// Configuración inyectada para "El Eucalito"
const firebaseConfig = {
  apiKey: "AIzaSyCaEOOs48MegU848nzbMid0JXObM-Bm_6I",
  authDomain: "el-eucalito-46ffb.firebaseapp.com",
  projectId: "el-eucalito-46ffb",
  storageBucket: "el-eucalito-46ffb.firebasestorage.app",
  messagingSenderId: "846324274804",
  appId: "1:846324274804:web:5f7439099cb3cc8e21e321"
};

// Initialize Firebase
let db: any = null;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase inicializado correctamente");
} catch (e) {
    console.error("Error inicializando Firebase:", e);
}

export const isFirebaseConfigured = () => db !== null;

// --- GLOBAL SETTINGS (API KEY SYNC) ---

export const subscribeToGlobalSettings = (callback: (apiKey: string | null) => void) => {
  if (!db) {
    callback(localStorage.getItem('gemini_api_key'));
    return () => {};
  }
  
  // Listen to the 'config' collection, document 'main'
  const unsub = onSnapshot(doc(db, "config", "main"), (doc) => {
    if (doc.exists()) {
        const data = doc.data();
        callback(data.geminiApiKey || null);
    } else {
        callback(null);
    }
  }, (error) => {
      console.error("Error obteniendo config global:", error);
      // Fallback a local si falla
      callback(localStorage.getItem('gemini_api_key'));
  });

  return unsub;
};

export const saveGlobalApiKey = async (apiKey: string) => {
    if (!db) {
        localStorage.setItem('gemini_api_key', apiKey);
        return;
    }
    // Save to Firestore so everyone gets it
    await setDoc(doc(db, "config", "main"), { 
        geminiApiKey: apiKey,
        updatedAt: Date.now()
    }, { merge: true });
};


// --- DATA SERVICE ---

export const subscribeToTransactions = (callback: (data: Transaction[]) => void) => {
  if (!db) {
    const local = localStorage.getItem('local_transactions');
    callback(local ? JSON.parse(local) : []);
    return () => {};
  }
  const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    callback(data);
  }, (error) => {
      console.error("Error suscribiendo a transacciones:", error);
      const local = localStorage.getItem('local_transactions');
      if (local) callback(JSON.parse(local));
  });
};

export const subscribeToBookings = (callback: (data: Booking[]) => void) => {
  if (!db) {
    const local = localStorage.getItem('local_bookings');
    callback(local ? JSON.parse(local) : []);
    return () => {};
  }
  const q = query(collection(db, 'bookings'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
    callback(data);
  }, (error) => {
      console.error("Error suscribiendo a reservas:", error);
  });
};

export const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
  if (!db) {
    const local = JSON.parse(localStorage.getItem('local_transactions') || '[]');
    const newTx = { ...transaction, id: Date.now().toString() };
    local.unshift(newTx);
    localStorage.setItem('local_transactions', JSON.stringify(local));
    return;
  }
  await addDoc(collection(db, 'transactions'), transaction);
};

export const deleteTransaction = async (id: string) => {
  if (!db) {
    const local = JSON.parse(localStorage.getItem('local_transactions') || '[]');
    const filtered = local.filter((t: Transaction) => t.id !== id);
    localStorage.setItem('local_transactions', JSON.stringify(filtered));
    return;
  }
  await deleteDoc(doc(db, 'transactions', id));
};

export const addBooking = async (booking: Omit<Booking, 'id'>) => {
  if (!db) {
    const local = JSON.parse(localStorage.getItem('local_bookings') || '[]');
    const newBk = { ...booking, id: Date.now().toString() };
    local.push(newBk);
    localStorage.setItem('local_bookings', JSON.stringify(local));
    return;
  }
  await addDoc(collection(db, 'bookings'), booking);
};

export const updateBooking = async (id: string, updates: Partial<Booking>) => {
  if (!db) {
      const local = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      const index = local.findIndex((b: Booking) => b.id === id);
      if (index !== -1) {
          local[index] = { ...local[index], ...updates };
          localStorage.setItem('local_bookings', JSON.stringify(local));
      }
      return;
  }
  await updateDoc(doc(db, 'bookings', id), updates);
};

export const deleteBooking = async (id: string) => {
    if (!db) {
        const local = JSON.parse(localStorage.getItem('local_bookings') || '[]');
        const filtered = local.filter((b: Booking) => b.id !== id);
        localStorage.setItem('local_bookings', JSON.stringify(filtered));
        return;
    }
    await deleteDoc(doc(db, 'bookings', id));
};


export const nukeDatabase = async () => {
    if (!db) {
        localStorage.removeItem('local_transactions');
        localStorage.removeItem('local_bookings');
        window.location.reload();
        return;
    }
    // Batch delete (limit 500 per batch)
    const tBatch = writeBatch(db);
    const bBatch = writeBatch(db);
    
    const tSnaps = await getDocs(collection(db, 'transactions'));
    tSnaps.forEach(d => tBatch.delete(d.ref));
    
    const bSnaps = await getDocs(collection(db, 'bookings'));
    bSnaps.forEach(d => bBatch.delete(d.ref));

    await tBatch.commit();
    await bBatch.commit();
}

export const restoreDatabase = async (transactions: Transaction[], bookings: Booking[]) => {
    if(!db) {
        localStorage.setItem('local_transactions', JSON.stringify(transactions));
        localStorage.setItem('local_bookings', JSON.stringify(bookings));
        window.location.reload();
        return;
    }
    
    for (const t of transactions) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...data } = t;
        await addDoc(collection(db, 'transactions'), data);
    }
    for (const b of bookings) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...data } = b;
        await addDoc(collection(db, 'bookings'), data);
    }
}