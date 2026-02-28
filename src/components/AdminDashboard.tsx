import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Users, Map as MapIcon, Activity, Calendar, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFields: 0,
    totalAnalyses: 0,
    recentUsers: [] as any[],
    recentFields: [] as any[]
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch Users
      const usersQuery = query(collection(db, 'users'), orderBy('registeredAt', 'desc'), limit(10));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch Fields
      const fieldsQuery = query(collection(db, 'fields'), orderBy('timestamp', 'desc'), limit(10));
      const fieldsSnapshot = await getDocs(fieldsQuery);
      const fields = fieldsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate totals (For large apps, use aggregation queries, but for now we'll fetch all or use size)
      const allUsersSnapshot = await getDocs(collection(db, 'users'));
      const allFieldsSnapshot = await getDocs(collection(db, 'fields'));
      
      let totalAnalyses = 0;
      allFieldsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.analyses && Array.isArray(data.analyses)) {
          totalAnalyses += data.analyses.length;
        }
      });

      setStats({
        totalUsers: allUsersSnapshot.size,
        totalFields: allFieldsSnapshot.size,
        totalAnalyses,
        recentUsers: users,
        recentFields: fields
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-stone-800 uppercase italic">Admin Dashboard</h2>
        <button 
          onClick={fetchAnalytics}
          className={`p-2 bg-white rounded-full shadow-sm border border-stone-200 text-stone-500 hover:text-agri-green transition-colors ${isLoading ? 'animate-spin' : ''}`}
        >
          <RefreshCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-4 rounded-2xl text-blue-500">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Registered Users</p>
            <p className="text-3xl font-black text-stone-800">{isLoading ? '-' : stats.totalUsers}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-500">
            <MapIcon className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Mapped Fields</p>
            <p className="text-3xl font-black text-stone-800">{isLoading ? '-' : stats.totalFields}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
          <div className="bg-amber-50 p-4 rounded-2xl text-amber-500">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-black text-stone-400 uppercase tracking-widest">AI Analyses Run</p>
            <p className="text-3xl font-black text-stone-800">{isLoading ? '-' : stats.totalAnalyses}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-stone-50 p-4 border-b border-stone-100">
            <h3 className="font-black text-stone-700 uppercase italic">Recent Users</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {isLoading ? (
              <div className="p-8 text-center text-stone-400 font-medium">Loading...</div>
            ) : stats.recentUsers.length === 0 ? (
              <div className="p-8 text-center text-stone-400 font-medium">No users found.</div>
            ) : (
              stats.recentUsers.map(u => (
                <div key={u.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-stone-800">{u.name}</p>
                    <p className="text-xs text-stone-500">{u.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-stone-400 uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(u.registeredAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Fields */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-stone-50 p-4 border-b border-stone-100">
            <h3 className="font-black text-stone-700 uppercase italic">Recent Fields Mapped</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {isLoading ? (
              <div className="p-8 text-center text-stone-400 font-medium">Loading...</div>
            ) : stats.recentFields.length === 0 ? (
              <div className="p-8 text-center text-stone-400 font-medium">No fields found.</div>
            ) : (
              stats.recentFields.map(f => (
                <div key={f.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-stone-800">{f.name}</p>
                    <p className="text-xs text-stone-500">{f.area?.toFixed(2)} hectares</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-stone-400 uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(f.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
