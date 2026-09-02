import { db } from "@/lib/firebase";
import { collection } from "firebase/firestore";

export const supabase = {
  from: (collectionName: string) => {
    return collection(db, collectionName);
  },
};
