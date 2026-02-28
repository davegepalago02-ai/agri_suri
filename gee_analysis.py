/**
 * Section B: The Firebase Cloud Function (Python) for the GEE analysis.
 * 
 * Note: This code is intended to be deployed as a Google Cloud Function.
 * It uses the Google Earth Engine (GEE) Python API.
 */

import ee
import json
from datetime import datetime, timedelta

def analyze_field(polygon_coords, analysis_type='health'):
    """
    Analyzes a field using Sentinel-1 (SAR) and Sentinel-2 imagery.
    Logic: If Cloud Cover > 20%, use Sentinel-1 Radar.
    """
    # Initialize Earth Engine
    # ee.Initialize() # Should be handled by service account in cloud function
    
    aoi = ee.Geometry.Polygon(polygon_coords)
    now = datetime.now()
    start_date = (now - timedelta(days=30)).strftime('%Y-%m-%d')
    end_date = now.strftime('%Y-%m-%d')

    # 1. Fetch Sentinel-2 (Optical)
    s2_collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                    .filterBounds(aoi)
                    .filterDate(start_date, end_date)
                    .sort('CLOUDY_PIXEL_PERCENTAGE'))
    
    latest_s2 = s2_collection.first()
    cloud_cover = latest_s2.get('CLOUDY_PIXEL_PERCENTAGE').getInfo()

    if cloud_cover > 20:
        # 2. FORCE SENTINEL-1 (SAR) - All Weather
        s1_collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                        .filterBounds(aoi)
                        .filterDate(start_date, end_date)
                        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                        .filter(ee.Filter.eq('instrumentMode', 'IW')))
        
        latest_s1 = s1_collection.first()
        
        # Apply Speckle Filter (Refined Lee or simple boxcar)
        s1_filtered = latest_s1.focal_mean(30, 'circle', 'meters')
        
        # Radar-based Moisture Index (RMI) proxy
        # Simple VH/VV ratio or backscatter analysis
        rmi = s1_filtered.select('VH').divide(s1_filtered.select('VV')).rename('RMI')
        
        stats = rmi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=10
        ).getInfo()
        
        return {
            "source": "Sentinel-1 (Radar)",
            "cloud_cover": cloud_cover,
            "moisture_index": stats.get('RMI', 0),
            "ndvi_proxy": 0.45, # Simulated for radar
            "timestamp": now.isoformat()
        }
    else:
        # 3. USE SENTINEL-2 (NDVI)
        ndvi = latest_s2.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        stats = ndvi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=10
        ).getInfo()
        
        return {
            "source": "Sentinel-2 (Optical)",
            "cloud_cover": cloud_cover,
            "ndvi": stats.get('NDVI', 0),
            "moisture_index": 0.6, # Default
            "timestamp": now.isoformat()
        }

# Example Usage:
# result = analyze_field([[[121.0, 14.0], [121.1, 14.0], [121.1, 14.1], [121.0, 14.1]]])
