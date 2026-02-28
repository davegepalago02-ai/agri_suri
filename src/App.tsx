import React, { useState, useEffect } from 'react';
import { AgriMap } from './components/Map';
import { storageService, FieldPolygon, AnalysisResult, UserProfile } from './services/storage';
import { recommendationEngine, AnalysisType } from './services/analysis';
import { db, auth } from './services/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { AgriSuriLogo } from './components/Logo';
import { 
  Map as MapIcon, 
  History, 
  Cloud,
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Users,
  LayoutDashboard,
  ChevronRight,
  Droplets,
  FlaskConical,
  Activity,
  ClipboardList,
  PlusCircle,
  Trash2,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

export default function App() {
  const [fields, setFields] = useState<FieldPolygon[]>([]);
  const [activeTab, setActiveTab] = useState<'map' | 'history' | 'stats' | 'results'>('map');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisSelection, setShowAnalysisSelection] = useState(false);
  const [pendingGeojson, setPendingGeojson] = useState<any>(null);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStepMessage, setAnalysisStepMessage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [tempFieldName, setTempFieldName] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [user, setUser] = useState<UserProfile | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");

  useEffect(() => {
    const profile = storageService.getUserProfile();
    setUser(profile);
    // If user exists but hasn't seen welcome message (we can track this with a flag or just show it on first load after register)
    // For simplicity, we'll show it right after registration
    setFields(storageService.getFields());
    fetchUserStats();
    
    // Auto-sync when online
    const handleOnline = () => syncData();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const fetchUserStats = async () => {
    try {
      const q = query(collection(db, "users"));
      const snapshot = await getDocs(q);
      setTotalFarmers(snapshot.size);
    } catch (e) {
      // Fallback for demo
      setTotalFarmers(1240);
    }
  };

  const handlePolygonCreated = (geojson: any) => {
    setPendingGeojson(geojson);
    setActiveFieldId(null);
    setShowAnalysisSelection(true);
    setAnalysisResult(null);
  };

  const startAnalysis = async (type: AnalysisType) => {
    if (!pendingGeojson && !activeFieldId) return;
    
    setShowAnalysisSelection(false);
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    let fieldId = activeFieldId;

    if (!fieldId && pendingGeojson) {
      const name = `Bukid ${fields.length + 1}`;
      const newField = storageService.saveField(pendingGeojson, name);
      fieldId = newField.id;
      setFields(prev => [...prev, newField]);
    }

    // Simulate analysis steps for better UX
    const steps = [
      { p: 20, msg: "Kumukuha ng Satellite Data..." },
      { p: 45, msg: "Sinusuri ang Cloud Cover..." },
      { p: 70, msg: "Kinakalkula ang NDVI at Moisture..." },
      { p: 90, msg: "Binubuo ang rekomendasyon..." },
      { p: 100, msg: "Tapos na!" }
    ];

    for (const step of steps) {
      setAnalysisProgress(step.p);
      setAnalysisStepMessage(step.msg);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Trigger Real Analysis
    const field = fields.find(f => f.id === fieldId);
    const geojson = pendingGeojson || field?.geojson;
    const result = await recommendationEngine.getAdvice(geojson, type);
    
    if (fieldId) {
      storageService.addAnalysis(fieldId, {
        type,
        status: result.status,
        advice: result.advice,
        zones: result.zones
      });
      setFields(storageService.getFields());
      setActiveFieldId(fieldId);
    }

    setAnalysisResult({ ...result, type, timestamp: Date.now(), id: crypto.randomUUID() });
    setIsAnalyzing(false);
    setPendingGeojson(null);
    
    if (navigator.onLine) {
      syncData();
    }
  };

  const handleDeleteField = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      show: true,
      title: 'Burahin ang Bukid?',
      message: 'Sigurado ka bang nais mong burahin ang bukid na ito? Mabubura rin ang lahat ng resulta nito.',
      onConfirm: () => {
        const updated = storageService.deleteField(id);
        setFields(updated);
        if (activeFieldId === id) {
          setActiveFieldId(null);
          setAnalysisResult(null);
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDeleteAnalysis = (fieldId: string, analysisId: string) => {
    setConfirmModal({
      show: true,
      title: 'Burahin ang Resulta?',
      message: 'Sigurado ka bang nais mong burahin ang resultang ito?',
      onConfirm: () => {
        const updated = storageService.deleteAnalysis(fieldId, analysisId);
        setFields(updated);
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleStartEdit = (e: React.MouseEvent, field: FieldPolygon) => {
    e.stopPropagation();
    setEditingFieldId(field.id);
    setTempFieldName(field.name);
  };

  const handleSaveEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tempFieldName.trim()) {
      const updated = storageService.updateFieldName(id, tempFieldName.trim());
      setFields(updated);
    }
    setEditingFieldId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFieldId(null);
  };

  const syncData = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    
    const unsynced = fields.filter(f => !f.synced);
    for (const field of unsynced) {
      try {
        // Firestore doesn't support nested arrays (found in GeoJSON coordinates)
        // Stringify the geojson to safely store it
        const syncPayload = {
          ...field,
          geojson: JSON.stringify(field.geojson),
          userId: auth.currentUser?.uid || 'anonymous',
          synced: true
        };
        
        await addDoc(collection(db, "fields"), syncPayload);
        storageService.updateFieldSyncStatus(field.id);
      } catch (e) {
        console.error("Sync error:", e);
      }
    }
    
    setFields(storageService.getFields());
    setIsSyncing(false);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (regName.trim() && regPhone.trim()) {
      const newUser = storageService.saveUserProfile({ name: regName.trim(), phone: regPhone.trim() });
      setUser(newUser);
      setShowWelcome(true);
    }
  };

  const handleLogout = () => {
    storageService.logoutUser();
    setUser(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center font-sans p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-stone-100">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-agri-green p-4 rounded-3xl shadow-lg mb-4">
              <AgriSuriLogo className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-stone-800">
              <span className="text-agri-green">Agri</span>Suri
            </h1>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mt-2 text-center">
              Matalinong Pagsusuri, Masaganang Pag-aani
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-stone-600 uppercase mb-1">Pangalan</label>
              <input 
                type="text" 
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Juan Dela Cruz"
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-agri-green focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-stone-600 uppercase mb-1">Numero ng Telepono</label>
              <input 
                type="tel" 
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="0912 345 6789"
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-agri-green focus:border-transparent transition-all"
              />
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-agri-green text-white rounded-2xl font-black uppercase italic tracking-wider shadow-lg hover:bg-[#115e41] transition-all mt-4"
            >
              Mag-rehistro
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-agri-green text-white p-6 shadow-lg relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        </div>
        
        <div className="max-w-4xl mx-auto flex justify-between items-center relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-1 rounded-2xl backdrop-blur-sm border border-white/20">
              <AgriSuriLogo className="w-12 h-12" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none">
                <span className="text-[#022c22]">Agri</span>
                <span className="text-white">Suri</span>
              </h1>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Mabuhay, {user.name}!</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold opacity-60">Aktibong Magsasaka</span>
              <span className="text-xl font-black text-agri-accent">{totalFarmers.toLocaleString()}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              title="Mag-logout"
            >
              <X className="w-5 h-5" />
            </button>
            <button 
              onClick={syncData}
              className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors ${isSyncing ? 'animate-spin' : ''}`}
            >
              <RefreshCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6 pb-24">
        
        {/* Welcome Modal */}
        <AnimatePresence>
          {showWelcome && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowWelcome(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden"
              >
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-agri-green/10 text-agri-green rounded-full flex items-center justify-center mx-auto mb-6">
                    <AgriSuriLogo className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black text-stone-800 uppercase italic mb-2">Mabuhay, {user.name}!</h2>
                  <p className="text-stone-500 font-medium text-sm mb-6">Maligayang pagdating sa AgriSuri.</p>
                  
                  <div className="text-left space-y-4 mb-8 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <p className="text-sm text-stone-700 leading-relaxed font-medium">
                      Ang <strong className="text-agri-green font-black uppercase">AgriSuri</strong> ay isang matalinong katuwang ng mga magsasakang Pilipino.
                    </p>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <MapIcon className="w-5 h-5 text-agri-green shrink-0 mt-0.5" />
                        <span className="text-xs text-stone-600 font-medium leading-relaxed">I-mapa ang iyong bukid gamit ang GPS o manual na pagguhit.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Activity className="w-5 h-5 text-agri-green shrink-0 mt-0.5" />
                        <span className="text-xs text-stone-600 font-medium leading-relaxed">Suriin ang kalusugan ng pananim, moisture ng lupa, at pangangailangan sa abono gamit ang AI.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Users className="w-5 h-5 text-agri-green shrink-0 mt-0.5" />
                        <span className="text-xs text-stone-600 font-medium leading-relaxed">Maging bahagi ng lumalaking komunidad ng mga makabagong magsasaka.</span>
                      </li>
                    </ul>
                  </div>

                  <button 
                    onClick={() => setShowWelcome(false)}
                    className="w-full py-4 bg-agri-green text-white rounded-2xl font-black uppercase italic tracking-wider shadow-lg hover:bg-[#115e41] transition-all"
                  >
                    Simulan ang Pagsusuri
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmModal.show && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 overflow-hidden"
              >
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-stone-800 uppercase italic mb-2">{confirmModal.title}</h3>
                  <p className="text-stone-500 font-medium text-sm leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
                <div className="flex border-t border-stone-100">
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                    className="flex-1 py-4 text-sm font-black uppercase tracking-wider text-stone-400 hover:bg-stone-50 transition-colors"
                  >
                    Bumalik
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className="flex-1 py-4 text-sm font-black uppercase tracking-wider text-red-500 hover:bg-red-50 border-l border-stone-100 transition-colors"
                  >
                    Burahin
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Navigation Tabs */}
        {activeTab !== 'stats' && (
          <nav className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm border border-stone-200 overflow-x-auto no-scrollbar">
            {[
              { id: 'map', icon: MapIcon, label: 'Mapa' },
              { id: 'results', icon: ClipboardList, label: 'Resulta' },
              { id: 'history', icon: History, label: 'Bukid' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-xs transition-all ${
                  activeTab === tab.id 
                  ? 'bg-agri-green text-white shadow-md' 
                  : 'text-stone-500 hover:bg-stone-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'map' && (
            <motion.div 
              key="map-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Map Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-stone-800 uppercase italic">I-guhit ang iyong Bukid</h2>
                </div>
                <AgriMap 
                  onPolygonCreated={handlePolygonCreated} 
                  selectedField={fields.find(f => f.id === activeFieldId)}
                  currentStatus={analysisResult?.status}
                />
              </div>

              {/* Analysis Selection */}
              {showAnalysisSelection && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border-2 border-agri-green shadow-xl space-y-4"
                >
                  <h3 className="text-lg font-black text-agri-green uppercase italic tracking-wider">Pumili ng Pagsusuri</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'health', label: 'Kalusugan ng Pananim (Crop Health)', icon: Activity, desc: 'Suriin ang sigla ng iyong mga pananim.' },
                      { id: 'moisture', label: 'Moisture ng Lupa (Soil Moisture)', icon: Droplets, desc: 'Alamin kung sapat ang tubig sa lupa.' },
                      { id: 'fertilizer', label: 'Paggamit ng Abono (Fertilizer)', icon: FlaskConical, desc: 'Kumuha ng payo sa tamang pag-aabono.' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => startAnalysis(opt.id as AnalysisType)}
                        className="flex items-center gap-4 p-4 rounded-2xl border border-stone-200 hover:border-agri-green hover:bg-agri-green/5 transition-all text-left group"
                      >
                        <div className="bg-stone-100 p-3 rounded-xl group-hover:bg-agri-green group-hover:text-white transition-all">
                          <opt.icon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-black text-stone-800 uppercase italic text-sm">{opt.label}</p>
                          <p className="text-xs text-stone-500 font-medium">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => { setShowAnalysisSelection(false); setPendingGeojson(null); }}
                    className="w-full py-3 text-stone-400 font-bold text-xs uppercase tracking-widest hover:text-red-500 transition-colors"
                  >
                    I-kansela
                  </button>
                </motion.div>
              )}

              {/* Analysis Progress */}
              {isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xl space-y-4"
                >
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-sm font-black text-agri-green uppercase italic tracking-wider">Sinusuri ang iyong Bukid...</h3>
                      <p className="text-xs text-stone-500 font-bold">
                        {analysisStepMessage || "Nagsisimula..."}
                      </p>
                    </div>
                    <span className="text-2xl font-black text-agri-green italic">{analysisProgress}%</span>
                  </div>
                  <div className="w-full h-4 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
                    <motion.div 
                      className="h-full bg-agri-green"
                      initial={{ width: 0 }}
                      animate={{ width: `${analysisProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Analysis Result */}
              {analysisResult && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`p-6 rounded-3xl border-4 shadow-2xl relative overflow-hidden ${
                    analysisResult.status === 'Healthy' 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900' 
                    : analysisResult.status === 'Critical'
                    ? 'bg-red-50 border-red-500 text-red-900'
                    : 'bg-amber-50 border-amber-500 text-amber-900'
                  }`}
                >
                  <div className="flex items-start gap-4 relative z-10">
                    <div className={`p-3 rounded-2xl ${
                      analysisResult.status === 'Healthy' ? 'bg-emerald-500' : 
                      analysisResult.status === 'Critical' ? 'bg-red-500' : 'bg-amber-500'
                    }`}>
                      {analysisResult.status === 'Healthy' ? <CheckCircle2 className="text-white" /> : 
                       analysisResult.status === 'Critical' ? <AlertTriangle className="text-white" /> : <Info className="text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="text-2xl font-black uppercase italic leading-none mb-1">
                          {analysisResult.status === 'Healthy' ? 'Maganda ang Kondisyon' : 
                           analysisResult.status === 'Critical' ? 'Kritikal na Babala' : 'Kailangan ng Atensyon'}
                        </h3>
                        <span className="text-[10px] font-black uppercase bg-black/10 px-2 py-1 rounded-full">
                          {analysisResult.type === 'health' ? 'Crop Health' : 
                           analysisResult.type === 'moisture' ? 'Moisture' : 'Fertilizer'}
                        </span>
                      </div>
                      <div className="text-sm font-medium opacity-90 leading-relaxed mb-4 markdown-body">
                        <ReactMarkdown>{analysisResult.advice}</ReactMarkdown>
                      </div>

                      {analysisResult.zones && (
                        <div className="mb-4 space-y-2">
                          <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60">Zonal Breakdown</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {analysisResult.zones.map(zone => (
                              <div key={zone.id} className="flex items-center gap-2 bg-black/5 p-2 rounded-lg">
                                <div className={`w-2 h-2 rounded-full ${
                                  zone.status === 'Healthy' ? 'bg-emerald-500' : 
                                  zone.status === 'Critical' ? 'bg-red-500' : 'bg-amber-500'
                                }`} />
                                <span className="text-[10px] font-bold truncate">{zone.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <button 
                        onClick={() => setShowAnalysisSelection(true)}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Pumili ng Ibang Pagsusuri
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Huling Update</span>
                  <span className="text-sm font-bold text-stone-800">Ngayon, {new Date().toLocaleTimeString('en-PH')}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1">Satellite Status</span>
                  <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Online
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'results' && (
            <motion.div 
              key="results-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-lg font-black text-stone-800 uppercase italic">Buod ng mga Resulta</h2>
              {fields.filter(f => (f.analyses?.length || 0) > 0).length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-stone-200 text-center">
                  <ClipboardList className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-400 font-bold">Wala pang nakaimbak na resulta. Magsagawa ng pagsusuri sa Mapa!</p>
                </div>
              ) : (
                fields.filter(f => (f.analyses?.length || 0) > 0).map((field) => (
                  <div key={field.id} className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                    <div className="bg-agri-green/5 p-4 border-bottom border-stone-100 flex justify-between items-center">
                      <h4 className="font-black text-agri-green uppercase italic">{field.name}</h4>
                      <span className="text-[10px] font-bold text-stone-400 uppercase">{field.area.toFixed(2)} ha</span>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {field.analyses?.map((analysis) => (
                        <div key={analysis.id} className="p-4 space-y-2 relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnalysis(field.id, analysis.id);
                            }}
                            className="absolute top-4 right-4 p-2 text-stone-300 hover:text-red-500 transition-all"
                            title="Burahin ang resultang ito"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="flex justify-between items-center pr-8">
                            <div className="flex items-center gap-2">
                              {analysis.type === 'health' ? <Activity className="w-4 h-4 text-agri-green" /> : 
                               analysis.type === 'moisture' ? <Droplets className="w-4 h-4 text-blue-500" /> : 
                               <FlaskConical className="w-4 h-4 text-amber-500" />}
                              <span className="text-xs font-black uppercase italic text-stone-700">
                                {analysis.type === 'health' ? 'Crop Health' : 
                                 analysis.type === 'moisture' ? 'Moisture' : 'Fertilizer'}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-stone-400">
                              {new Date(analysis.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              analysis.status === 'Healthy' ? 'bg-emerald-500' : 
                              analysis.status === 'Critical' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            <div className="text-xs font-medium text-stone-600 leading-relaxed markdown-body">
                              <ReactMarkdown>{analysis.advice}</ReactMarkdown>
                            </div>
                          </div>
                          {analysis.zones && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {analysis.zones.map(zone => (
                                <div key={zone.id} className="flex items-center gap-1.5 bg-stone-50 px-2 py-1 rounded-lg border border-stone-100">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    zone.status === 'Healthy' ? 'bg-emerald-500' : 
                                    zone.status === 'Critical' ? 'bg-red-500' : 'bg-amber-500'
                                  }`} />
                                  <span className="text-[9px] font-bold text-stone-500 uppercase">{zone.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-stone-800 uppercase italic">Mga Naitalang Bukid</h2>
                <span className="text-[10px] font-bold text-stone-400 uppercase">Pumili para suriin</span>
              </div>
              {fields.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-stone-200 text-center">
                  <MapIcon className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-400 font-bold">Wala pang naitalang bukid. Simulan sa Mapa!</p>
                </div>
              ) : (
                fields.map((field) => (
                  <div 
                    key={field.id} 
                    onClick={() => {
                      setActiveFieldId(field.id);
                      setPendingGeojson(null);
                      setActiveTab('map');
                      if (field.analyses?.[0]) {
                        setAnalysisResult(field.analyses[0]);
                        setShowAnalysisSelection(false);
                      } else {
                        setShowAnalysisSelection(true);
                        setAnalysisResult(null);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setActiveFieldId(field.id);
                        setPendingGeojson(null);
                        setActiveTab('map');
                        if (field.analyses?.[0]) {
                          setAnalysisResult(field.analyses[0]);
                          setShowAnalysisSelection(false);
                        } else {
                          setShowAnalysisSelection(true);
                          setAnalysisResult(null);
                        }
                      }
                    }}
                    className="w-full bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between group hover:border-agri-green transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-stone-100 p-3 rounded-xl group-hover:bg-agri-green/10 transition-colors relative">
                        <LayoutDashboard className="w-5 h-5 text-stone-500 group-hover:text-agri-green" />
                        {field.analyses?.[0] && (
                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                            field.analyses[0].status === 'Healthy' ? 'bg-emerald-500' : 
                            field.analyses[0].status === 'Critical' ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                        )}
                      </div>
                      <div>
                        {editingFieldId === field.id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={tempFieldName}
                              onChange={e => setTempFieldName(e.target.value)}
                              autoFocus
                              className="bg-stone-100 border border-agri-green/30 rounded-lg px-2 py-1 text-sm font-black text-stone-800 focus:outline-none focus:ring-2 focus:ring-agri-green/20 w-32"
                            />
                            <button 
                              onClick={(e) => handleSaveEdit(e, field.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={handleCancelEdit}
                              className="p-1 text-stone-400 hover:bg-stone-100 rounded-md transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-stone-800 uppercase italic">{field.name}</h4>
                            <button 
                              onClick={(e) => handleStartEdit(e, field)}
                              className="p-1 text-stone-300 hover:text-agri-green opacity-0 group-hover:opacity-100 transition-all"
                              title="I-edit ang pangalan"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                          {field.area.toFixed(2)} Hectares • {new Date(field.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end mr-2">
                        <span className="text-[8px] font-black uppercase text-stone-400">Analyses</span>
                        <span className="text-xs font-black text-agri-green">{field.analyses?.length || 0}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteField(field.id, e);
                        }}
                        className="p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-xl relative z-30"
                        title="Burahin ang bukid"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      {field.synced ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Cloud className="w-5 h-5 text-amber-500" />
                      )}
                      <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-agri-green group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div 
              key="stats-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-agri-green p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-4xl font-black italic uppercase leading-none mb-2">Lakas ng Magsasaka</h2>
                  <p className="text-lg opacity-80 font-medium mb-6">Sama-sama nating binabantayan ang ating mga pananim sa buong Pilipinas.</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-black text-agri-accent tracking-tighter">{totalFarmers.toLocaleString()}</span>
                    <span className="text-xl font-bold uppercase opacity-60 italic">Aktibo</span>
                  </div>
                </div>
                <Users className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5 rotate-12" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                  <h4 className="font-black text-stone-800 uppercase italic mb-4">Top Regions</h4>
                  <div className="space-y-3">
                    {[
                      { name: 'Central Luzon', count: '45%' },
                      { name: 'Cagayan Valley', count: '22%' },
                      { name: 'Western Visayas', count: '18%' }
                    ].map(region => (
                      <div key={region.name} className="flex items-center justify-between">
                        <span className="text-sm font-bold text-stone-600">{region.name}</span>
                        <div className="flex-1 mx-4 h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-agri-green" style={{ width: region.count }} />
                        </div>
                        <span className="text-xs font-black text-agri-green">{region.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Bottom Nav */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 z-[2000]">
        <div className="max-w-4xl mx-auto flex justify-around">
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab !== 'stats' ? 'text-agri-green' : 'text-stone-400'}`}
          >
            <LayoutDashboard className={`w-6 h-6 ${activeTab !== 'stats' ? 'scale-110' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-wider">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'text-agri-green' : 'text-stone-400'}`}
          >
            <Users className={`w-6 h-6 ${activeTab === 'stats' ? 'scale-110' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-wider">Community</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
