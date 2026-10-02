import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp,
  DocumentChange
} from 'firebase/firestore';
import { db } from '../firebase';

export interface DonationAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  targetRole?: 'volunteer' | 'admin' | 'all';
  foodName?: string;
  donorName?: string;
  organization?: string;
  quantity?: string;
  city?: string;
  createdAt: string;
  isRead?: boolean;
}

/**
 * Gets the current active role from FoodBridge platform session
 */
export function getCurrentPlatformRole(): 'volunteer' | 'admin' | 'donor' | 'guest' {
  try {
    const adminSess = localStorage.getItem('foodbridge_admin_session');
    if (adminSess) {
      const parsed = JSON.parse(adminSess);
      if (parsed?.profile?.role === 'admin' || parsed?.user?.role === 'admin') {
        return 'admin';
      }
    }

    const curSess = localStorage.getItem('foodbridge_current_session');
    if (curSess) {
      const parsed = JSON.parse(curSess);
      if (parsed?.role) return parsed.role;
      if (parsed?.profile?.role) return parsed.profile.role;
      if (parsed?.user?.role) return parsed.user.role;
    }

    // Check URL path as fallback
    if (window.location.pathname.includes('/admin')) return 'admin';
    if (window.location.pathname.includes('/volunteer')) return 'volunteer';
  } catch (e) {
    console.warn('Could not determine platform role:', e);
  }
  return 'guest';
}

/**
 * Real-time Firestore snapshot listener for donation notifications.
 * Alert triggers whenever a new food donation is created in Cloud Firestore.
 */
export function listenToDonationSnapshots(
  onNewAlert: (alert: DonationAlert) => void,
  onListUpdate?: (alerts: DonationAlert[]) => void
): () => void {
  let isInitialLoad = true;

  try {
    const notifsRef = collection(db, 'notifications');
    // Order by createdAt descending and limit to the last 25 notifications
    const q = query(notifsRef, orderBy('createdAt', 'desc'), limit(25));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const alertsList: DonationAlert[] = [];

        snapshot.docChanges().forEach((change: DocumentChange) => {
          const data = change.doc.data();
          const alert: DonationAlert = {
            id: change.doc.id,
            type: data.type || 'new_donation',
            title: data.title || 'New Food Donation Available',
            description: data.description || '',
            targetRole: data.targetRole || 'all',
            foodName: data.foodName || '',
            donorName: data.donorName || '',
            organization: data.organization || '',
            quantity: data.quantity || '',
            city: data.city || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            isRead: Boolean(data.isRead),
          };

          // On new additions after initial load, trigger immediate real-time alert
          if (change.type === 'added' && !isInitialLoad) {
            const currentRole = getCurrentPlatformRole();
            const target = String(alert.targetRole || 'all');
            const isTarget = 
              target === 'all' || 
              currentRole === 'admin' ||
              (currentRole === 'volunteer' && (target === 'volunteer' || target === 'all')) ||
              (currentRole === target);

            if (isTarget) {
              onNewAlert(alert);
              // Dispatch standard window event for the SPA components
              window.dispatchEvent(
                new CustomEvent('foodbridge_new_donation_notification', { detail: alert })
              );
            }
          }
        });

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          alertsList.push({
            id: doc.id,
            type: data.type || 'new_donation',
            title: data.title || 'New Food Donation',
            description: data.description || '',
            targetRole: data.targetRole || 'all',
            foodName: data.foodName || '',
            donorName: data.donorName || '',
            organization: data.organization || '',
            quantity: data.quantity || '',
            city: data.city || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            isRead: Boolean(data.isRead),
          });
        });

        if (onListUpdate) {
          onListUpdate(alertsList);
        }

        isInitialLoad = false;
      },
      (error) => {
        console.warn('Firestore real-time notifications snapshot listener warning:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to attach Firestore snapshot listener:', err);
    return () => {};
  }
}

/**
 * Creates donation notification in Cloud Firestore so all listening volunteers and admins get instant snapshot alerts
 */
export async function pushDonationToFirestore(donation: {
  food_name: string;
  quantity: string | number;
  quantity_unit?: string;
  organization?: string;
  donor_name?: string;
  city?: string;
  category?: string;
  address?: string;
  meals_count?: number;
}): Promise<void> {
  try {
    const notifsRef = collection(db, 'notifications');
    const unit = donation.quantity_unit || 'servings';
    const org = donation.organization || donation.donor_name || 'Community Donor';
    const city = donation.city || 'Local area';

    // 1. Volunteer notification
    await addDoc(notifsRef, {
      type: 'new_donation',
      targetRole: 'volunteer',
      title: '🚨 New Food Donation Available!',
      description: `${donation.food_name} (${donation.quantity} ${unit}) posted by ${org} in ${city}. Available for immediate pickup!`,
      foodName: donation.food_name,
      donorName: donation.donor_name || '',
      organization: org,
      quantity: `${donation.quantity} ${unit}`,
      city,
      isRead: false,
      createdAt: serverTimestamp(),
    });

    // 2. Admin notification
    await addDoc(notifsRef, {
      type: 'new_donation',
      targetRole: 'admin',
      title: '📋 New Donation Listed',
      description: `${org} listed ${donation.food_name} (${donation.quantity} ${unit}) in ${city}.`,
      foodName: donation.food_name,
      donorName: donation.donor_name || '',
      organization: org,
      quantity: `${donation.quantity} ${unit}`,
      city,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Could not push donation notification to Firestore:', error);
  }
}
