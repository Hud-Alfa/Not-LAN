import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

/**
 * Kullanıcının admin olup olmadığını kontrol eder
 * @param {string} userId - Kontrol edilecek kullanıcı ID'si (opsiyonel, verilmezse current user kontrol edilir)
 * @returns {Promise<boolean>} - Admin ise true, değilse false
 */
export const isAdmin = async (userId = null) => {
  try {
    const uid = userId || auth.currentUser?.uid;
    if (!uid) return false;

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return false;

    const userData = userDoc.data();
    // Hem boolean true hem de string "True" veya "true" değerlerini kabul et
    const adminValue = userData.isAdmin;
    return adminValue === true || adminValue === 'True' || adminValue === 'true';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Kullanıcıyı admin yapar (Firebase Console'dan manuel yapılabilir veya bu fonksiyon kullanılabilir)
 * @param {string} userId - Admin yapılacak kullanıcı ID'si
 * @returns {Promise<boolean>} - Başarılı ise true
 */
export const setAdmin = async (userId) => {
  try {
    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'users', userId), {
      isAdmin: true,
    });
    return true;
  } catch (error) {
    console.error('Error setting admin:', error);
    return false;
  }
};

