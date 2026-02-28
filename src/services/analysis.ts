import { GoogleGenAI } from "@google/genai";
import * as turf from '@turf/turf';
import { AnalysisZone } from "./storage";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

export type AnalysisType = 'health' | 'moisture' | 'fertilizer';

export const recommendationEngine = {
  getAdvice: async (geojson: any, type: AnalysisType = 'health') => {
    // 1. Calculate dummy values for zones
    const bbox = turf.bbox(geojson);
    const midLng = (bbox[0] + bbox[2]) / 2;
    const midLat = (bbox[1] + bbox[3]) / 2;

    const quadrants = [
      { name: "Hilagang-Kanluran (NW)", bounds: [bbox[0], midLat, midLng, bbox[3]] },
      { name: "Hilagang-Silangan (NE)", bounds: [midLng, midLat, bbox[2], bbox[3]] },
      { name: "Timog-Kanluran (SW)", bounds: [bbox[0], bbox[1], midLng, midLat] },
      { name: "Timog-Silangan (SE)", bounds: [midLng, bbox[1], bbox[2], midLat] }
    ];

    const zones: AnalysisZone[] = quadrants.map((q, i) => {
      const qPoly = turf.bboxPolygon(q.bounds as any);
      const intersection = turf.intersect(turf.featureCollection([geojson, qPoly]));
      
      // Random value for demo
      const value = 0.3 + Math.random() * 0.6;
      let status = "Healthy";
      if (value < 0.4) status = "Critical";
      else if (value < 0.6) status = "Warning";

      return {
        id: `zone-${i}`,
        name: q.name,
        status,
        value,
        coordinates: intersection ? intersection.geometry.coordinates as any : []
      };
    }).filter(z => z.coordinates.length > 0);

    // 2. Aggregate overall status
    const criticalZones = zones.filter(z => z.status === 'Critical');
    const warningZones = zones.filter(z => z.status === 'Warning');
    
    let overallStatus = "Healthy";
    if (criticalZones.length > 0) overallStatus = "Critical";
    else if (warningZones.length > 0) overallStatus = "Warning";

    const zoneSummary = zones.map(z => `${z.name}: ${z.status} (${z.value.toFixed(2)})`).join(", ");

    let prompt = "";
    if (type === 'health') {
      prompt = `Bilang isang agricultural expert sa Pilipinas, magbigay ng maikling payo (Tagalog) para sa CROP HEALTH ng isang bukid.
      Ang bukid ay may mga sumusunod na zones: ${zoneSummary}.
      HUWAG gumamit ng talata (paragraph). Gumamit ng maikling summary at pagkatapos ay bullet points para sa mga aksyon.
      Tukuyin kung aling bahagi (zone) ang may problema at ano ang dapat gawin doon.
      Siguraduhing magsama ng payo tungkol sa **Peste Management** (pest management) kung may mga kritikal na zones.
      Gamitin ang mga terminong 'AgriSuri' at 'Magsasaka'.`;
    } else if (type === 'moisture') {
      prompt = `Bilang isang agricultural expert sa Pilipinas, magbigay ng maikling payo (Tagalog) para sa SOIL MOISTURE ng isang bukid.
      Ang bukid ay may mga sumusunod na zones: ${zoneSummary}.
      HUWAG gumamit ng talata (paragraph). Gumamit ng maikling summary at pagkatapos ay bullet points para sa mga aksyon.
      Tukuyin kung aling bahagi (zone) ang may problema sa irigasyon.
      Maaari ring magbigay ng babala kung ang sobrang tubig o tuyong lupa ay maaaring magdulot ng peste.
      Gamitin ang mga terminong 'AgriSuri' at 'Magsasaka'.`;
    } else if (type === 'fertilizer') {
      prompt = `Bilang isang agricultural expert sa Pilipinas, magbigay ng maikling payo (Tagalog) para sa FERTILIZER APPLICATION ng isang bukid.
      Ang bukid ay may mga sumusunod na zones: ${zoneSummary}.
      HUWAG gumamit ng talata (paragraph). Gumamit ng maikling summary at pagkatapos ay bullet points para sa mga aksyon.
      Tukuyin kung aling bahagi (zone) ang nangangailangan ng mas maraming abono.
      Ipaliwanag kung paano makakatulong ang tamang nutrisyon sa pag-iwas sa peste.
      Gamitin ang mga terminong 'AgriSuri' at 'Magsasaka'.`;
    }

    try {
      if (!import.meta.env.VITE_GEMINI_API_KEY) {
        throw new Error("Missing API Key");
      }
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return {
        status: overallStatus,
        advice: response.text || "Pagsusuri ay nakumpleto.",
        zones
      };
    } catch (e) {
      console.error("AI Error:", e);
      return { 
        status: overallStatus, 
        advice: "Paumanhin, hindi makakonekta sa AI ngayon. Siguraduhing nakalagay ang iyong VITE_GEMINI_API_KEY sa .env file.",
        zones
      };
    }
  }
};

