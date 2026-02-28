import * as turf from '@turf/turf';

export interface AnalysisZone {
  id: string;
  name: string;
  status: string;
  value: number;
  coordinates: number[][][]; // Polygon coordinates for the zone
}

export interface AnalysisResult {
  id: string;
  type: 'health' | 'moisture' | 'fertilizer';
  status: string;
  advice: string;
  timestamp: number;
  zones?: AnalysisZone[];
}

export interface FieldPolygon {
  id: string;
  geojson: any;
  area: number; // in hectares
  timestamp: number;
  synced: boolean;
  name: string;
  analyses: AnalysisResult[];
}

export interface UserProfile {
  name: string;
  phone: string;
  registeredAt: number;
}

const STORAGE_KEY = 'agrisuri_fields';
const USER_KEY = 'agrisuri_user';

export const storageService = {
  getUserProfile: (): UserProfile | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  
  saveUserProfile: (profile: Omit<UserProfile, 'registeredAt'>): UserProfile => {
    const newProfile = { ...profile, registeredAt: Date.now() };
    localStorage.setItem(USER_KEY, JSON.stringify(newProfile));
    return newProfile;
  },

  logoutUser: () => {
    localStorage.removeItem(USER_KEY);
  },

  saveField: (geojson: any, name: string): FieldPolygon => {
    const area = turf.area(geojson) / 10000; // Convert m2 to hectares
    const newField: FieldPolygon = {
      id: crypto.randomUUID(),
      geojson,
      area,
      timestamp: Date.now(),
      synced: false,
      name,
      analyses: []
    };

    const existing = storageService.getFields();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, newField]));
    return newField;
  },

  addAnalysis: (fieldId: string, result: Omit<AnalysisResult, 'id' | 'timestamp'>) => {
    const fields = storageService.getFields();
    const updated = fields.map(f => {
      if (f.id === fieldId) {
        const newAnalysis: AnalysisResult = {
          ...result,
          id: crypto.randomUUID(),
          timestamp: Date.now()
        };
        const currentAnalyses = f.analyses || [];
        return { ...f, analyses: [newAnalysis, ...currentAnalyses] };
      }
      return f;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated.find(f => f.id === fieldId);
  },

  getFields: (): FieldPolygon[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
      const fields: any[] = JSON.parse(data);
      return fields.map(f => ({
        ...f,
        analyses: f.analyses || []
      }));
    } catch (e) {
      return [];
    }
  },

  updateFieldSyncStatus: (id: string) => {
    const fields = storageService.getFields();
    const updated = fields.map(f => f.id === id ? { ...f, synced: true } : f);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  deleteField: (id: string) => {
    const fields = storageService.getFields();
    const updated = fields.filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },

  deleteAnalysis: (fieldId: string, analysisId: string) => {
    const fields = storageService.getFields();
    const updated = fields.map(f => {
      if (f.id === fieldId) {
        return {
          ...f,
          analyses: (f.analyses || []).filter(a => a.id !== analysisId)
        };
      }
      return f;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },

  updateFieldName: (id: string, newName: string) => {
    const fields = storageService.getFields();
    const updated = fields.map(f => f.id === id ? { ...f, name: newName, synced: false } : f);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }
};
