import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, FeatureGroup, useMap, Polygon, Polyline, Marker } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Navigation, Map as MapIcon, MousePointer2, Play, Square, Save, Trash2, Info, X, Target, Maximize2, Minimize2 } from 'lucide-react';
import { FieldPolygon } from '../services/storage';

// Fix Leaflet icon issue
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  onPolygonCreated: (geojson: any) => void;
  selectedField?: FieldPolygon | null;
  currentStatus?: string | null;
}

const ZoomToField = ({ geojson }: { geojson: any }) => {
  const map = useMap();
  useEffect(() => {
    if (geojson) {
      try {
        const layer = L.geoJSON(geojson);
        map.fitBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 18 });
      } catch (e) {
        console.error("Error zooming to field:", e);
      }
    }
  }, [geojson, map]);
  return null;
};

const LocationMarker = ({ setPosition, autoZoom }: { setPosition: (pos: L.LatLng) => void, autoZoom?: boolean }) => {
  const map = useMap();
  const firstPos = useRef(true);

  useEffect(() => {
    const onLocationFound = (e: L.LocationEvent) => {
      setPosition(e.latlng);
      if (autoZoom && firstPos.current) {
        map.flyTo(e.latlng, 18);
        firstPos.current = false;
      }
    };

    map.locate({ watch: true, enableHighAccuracy: true }).on("locationfound", onLocationFound);
    
    return () => {
      map.stopLocate();
      map.off("locationfound", onLocationFound);
    };
  }, [map, autoZoom, setPosition]);

  return null;
};

const InvalidateSize = ({ isFullScreen }: { isFullScreen: boolean }) => {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 400); // Wait for transition
  }, [isFullScreen, map]);
  return null;
};

export const AgriMap: React.FC<MapProps> = ({ onPolygonCreated, selectedField, currentStatus }) => {
  const [mode, setMode] = useState<'manual' | 'gps'>('manual');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPoints, setRecordedPoints] = useState<L.LatLng[]>([]);
  const [currentPosition, setCurrentPosition] = useState<L.LatLng | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [persistedPolygon, setPersistedPolygon] = useState<L.LatLng[] | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const lastRecordedPos = useRef<L.LatLng | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'Healthy': return '#10b981';
      case 'Critical': return '#ef4444';
      case 'Warning': return '#f59e0b';
      default: return '#fbbf24';
    }
  };

  const latestStatus = currentStatus || selectedField?.analyses?.[0]?.status;
  const polygonColor = getStatusColor(latestStatus);

  // Auto-record points when walking
  useEffect(() => {
    if (isRecording && currentPosition) {
      if (!lastRecordedPos.current) {
        setRecordedPoints([currentPosition]);
        lastRecordedPos.current = currentPosition;
      } else {
        const dist = currentPosition.distanceTo(lastRecordedPos.current);
        // Only record if moved more than 2 meters to avoid jitter
        if (dist > 2) {
          setRecordedPoints(prev => [...prev, currentPosition]);
          lastRecordedPos.current = currentPosition;
        }
      }
    }
  }, [isRecording, currentPosition]);

  const _onCreate = (e: any) => {
    const { layerType, layer } = e;
    if (layerType === 'polygon') {
      const geojson = layer.toGeoJSON();
      onPolygonCreated(geojson);
      setPersistedPolygon(layer.getLatLngs()[0]);
    }
  };

  const startGpsRecording = () => {
    setRecordedPoints([]);
    lastRecordedPos.current = null;
    setIsRecording(true);
    setPersistedPolygon(null);
  };

  const addPoint = () => {
    if (currentPosition) {
      setRecordedPoints(prev => [...prev, currentPosition]);
    }
  };

  const stopAndSaveGps = () => {
    if (recordedPoints.length < 3) {
      alert("Kailangan ng kahit tatlong (3) puntos para makabuo ng polygon. Maglakad pa nang kaunti.");
      return;
    }
    
    setIsRecording(false);
    setPersistedPolygon([...recordedPoints]);
    
    // Convert points to GeoJSON
    const coordinates = [...recordedPoints, recordedPoints[0]].map(p => [p.lng, p.lat]);
    const geojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      }
    };
    
    onPolygonCreated(geojson);
    setRecordedPoints([]);
    lastRecordedPos.current = null;
  };

  const clearGps = () => {
    setRecordedPoints([]);
    setIsRecording(false);
    lastRecordedPos.current = null;
    setPersistedPolygon(null);
  };

  const mapContent = (
    <div className={`${
      isFullScreen 
      ? 'fixed inset-0 z-[9999] bg-white w-screen h-screen' 
      : 'h-[50vh] md:h-[60vh] w-full rounded-2xl border-4 border-white shadow-xl'
    } overflow-hidden relative transition-all duration-300`}>
      <MapContainer
        // @ts-ignore
        center={[12.8797, 121.7740]} // Center of Philippines
        // @ts-ignore
        zoom={6}
        className="h-full w-full"
      >
        {/* Satellite View Layer */}
        <TileLayer
          // @ts-ignore
          attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          // @ts-ignore
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        
        {mode === 'manual' && (
          <FeatureGroup>
            <EditControl
              position="topright"
              onCreated={_onCreate}
              draw={{
                rectangle: false,
                circle: false,
                polyline: false,
                circlemarker: false,
                marker: false,
                polygon: {
                  allowIntersection: false,
                  drawError: {
                    color: '#e1e1e1',
                    message: '<strong>Error:</strong> Hindi pwedeng mag-overlap ang linya!'
                  },
                  shapeOptions: {
                    color: '#fbbf24',
                    fillOpacity: 0.4
                  }
                }
              }}
            />
          </FeatureGroup>
        )}

        {mode === 'gps' && (
          <>
            {recordedPoints.length > 0 && (
              <Polyline positions={recordedPoints} pathOptions={{ color: "#fbbf24", weight: 4, dashArray: "10, 10" }} />
            )}
            {recordedPoints.length >= 3 && (
              <Polygon positions={recordedPoints} pathOptions={{ color: "#fbbf24", fillOpacity: 0.4 }} />
            )}
            {persistedPolygon && (
              <Polygon positions={persistedPolygon} pathOptions={{ color: "#fbbf24", fillOpacity: 0.4, weight: 2 }} />
            )}
            {currentPosition && (
              <Marker position={currentPosition} />
            )}
          </>
        )}

        {selectedField && (
          <>
            <ZoomToField geojson={selectedField.geojson} />
            {/* Render Zones if they exist in the latest analysis */}
            {selectedField.analyses?.[0]?.zones ? (
              selectedField.analyses[0].zones.map((zone) => (
                <Polygon 
                  key={zone.id}
                  positions={zone.coordinates as any}
                  pathOptions={{
                    color: getStatusColor(zone.status),
                    fillOpacity: 0.6,
                    weight: 1
                  }}
                >
                  <Marker 
                    // @ts-ignore
                    position={L.geoJSON({ type: "Polygon", coordinates: zone.coordinates } as any).getBounds().getCenter()}
                    // @ts-ignore
                    icon={L.divIcon({
                      className: 'bg-transparent',
                      html: `<div class="bg-black/60 backdrop-blur text-white text-[8px] px-1 rounded font-black uppercase whitespace-nowrap">${zone.name}</div>`
                    })}
                  />
                </Polygon>
              ))
            ) : (
              <Polygon 
                positions={(L.geoJSON(selectedField.geojson).getLayers()[0] as L.Polygon).getLatLngs() as L.LatLng[]} 
                pathOptions={{
                  color: polygonColor, 
                  fillOpacity: 0.5, 
                  weight: 3
                }}
              />
            )}
          </>
        )}

        <LocationMarker setPosition={setCurrentPosition} autoZoom={mode === 'gps'} />
        <InvalidateSize isFullScreen={isFullScreen} />
      </MapContainer>

      {/* Map Controls Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-xl text-stone-700 hover:text-agri-green transition-all border border-stone-200"
          title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
        >
          {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* GPS Controls Overlay */}
      {mode === 'gps' && (
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
          {!isRecording ? (
            <button
              onClick={startGpsRecording}
              className="bg-agri-green text-white px-6 py-3 rounded-full font-black uppercase italic text-xs flex items-center gap-2 shadow-xl hover:bg-agri-green/90 border-2 border-white/20"
            >
              <Play className="w-4 h-4" />
              Simulan ang Lakad
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-lg border border-agri-green/20 mb-2">
                <div className="flex items-center gap-2 text-agri-green">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Naka-record: {recordedPoints.length} puntos</span>
                </div>
              </div>
              <button
                onClick={stopAndSaveGps}
                className="bg-agri-green text-white px-6 py-3 rounded-full font-black uppercase italic text-xs flex items-center gap-2 shadow-xl hover:bg-agri-green/90 border-2 border-white/20"
              >
                <Square className="w-4 h-4" />
                Tapusin at I-save Bukid
              </button>
              <button
                onClick={clearGps}
                className="bg-white text-red-500 px-6 py-3 rounded-full font-black uppercase italic text-xs flex items-center gap-2 shadow-xl hover:bg-stone-50 border-2 border-red-100"
              >
                <Trash2 className="w-4 h-4" />
                I-kansela
              </button>
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-[1000] bg-black/50 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white border border-white/20">
        Satellite View (Esri)
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm border border-stone-200">
        <button
          onClick={() => { setMode('manual'); clearGps(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs transition-all ${
            mode === 'manual' ? 'bg-agri-green text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'
          }`}
        >
          <MousePointer2 className="w-4 h-4" />
          I-guhit (Manual)
        </button>
        <button
          onClick={() => { setMode('gps'); setShowInstructions(true); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-xs transition-all ${
            mode === 'gps' ? 'bg-agri-green text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'
          }`}
        >
          <Navigation className="w-4 h-4" />
          GPS Walk (Lakad)
        </button>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-agri-green/10 text-agri-green rounded-full flex items-center justify-center mx-auto mb-4">
                <Info className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-stone-800 uppercase italic mb-4">Paano gamitin ang GPS Walk?</h3>
              <ul className="text-left space-y-4 mb-6">
                <li className="flex gap-3 items-start">
                  <div className="w-6 h-6 bg-agri-green text-white rounded-full flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p className="text-stone-600 text-sm font-medium">Maglakad nang dahan-dahan sa paligid ng iyong bukid.</p>
                </li>
                <li className="flex gap-3 items-start">
                  <div className="w-6 h-6 bg-agri-green text-white rounded-full flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p className="text-stone-600 text-sm font-medium">Tumigil nang 5 segundo sa bawat kanto o kurbada.</p>
                </li>
                <li className="flex gap-3 items-start">
                  <div className="w-6 h-6 bg-agri-green text-white rounded-full flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p className="text-stone-600 text-sm font-medium">Hawakan ang phone sa labas na bahagi ng hangganan (boundary).</p>
                </li>
              </ul>
              <button 
                onClick={() => setShowInstructions(false)}
                className="w-full py-4 bg-agri-green text-white rounded-2xl font-black uppercase italic tracking-wider shadow-lg hover:bg-agri-green/90 transition-all"
              >
                Naintindihan ko
              </button>
            </div>
          </div>
        </div>
      )}

      {isFullScreen ? createPortal(mapContent, document.body) : mapContent}
    </div>
  );
};
