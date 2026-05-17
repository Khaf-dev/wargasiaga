import httpx
import logging
import json

from app.core.config import settings

GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json"
logger = logging.getLogger(__name__)

async def validate_connection() -> dict:
    """Melakukan tes reverse geocode ke API Google Maps untuk validasi koneksi."""
    try:
        # Koordinat Monas, Jakarta
        test_lat, test_lng = -6.175, 106.827
        result = await reverse_geocode(test_lat, test_lng)
        
        if result and result.get("formatted_address"):
            return {
                "status": "ok",
                "test_address": result["formatted_address"]
            }
        else:
            return {
                "status": "error",
                "error": "Respons valid tapi tidak ada alamat yang ditemukan."
            }
    except Exception as e:
        logger.error(f"Validasi koneksi Geocoding gagal: {e}")
        return {"status": "error", "error": str(e)}

async def reverse_geocode(lat: float, lng: float) -> dict | None:
    """Mengubah koordinat (lat, lng) menjadi alamat yang bisa dibaca manusia."""
    params = {
        "latlng": f"{lat},{lng}",
        "key": settings.GOOGLE_GEOCODING_API_KEY,
        "language": "id",
        "result_type": "street_address|route|neighborhood|sublocality|locality"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(GEOCODING_API_URL, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()

        if data["status"] == "OK" and data["results"]:
            first_result = data["results"][0]
            address_components = first_result.get("address_components", [])
            
            # Helper untuk mengekstrak komponen alamat
            def get_component(comp_type):
                for comp in address_components:
                    if comp_type in comp.get("types", []):
                        return comp.get("long_name")
                return None

            city = get_component("administrative_area_level_2") or get_component("locality")
            province = get_component("administrative_area_level_1")
            country = get_component("country")
            
            logger.info(f"Reverse geocode berhasil untuk {lat},{lng}")
            return {
                "formatted_address": first_result.get("formatted_address"),
                "city": city,
                "province": province,
                "country": country
            }
        elif data["status"] == "ZERO_RESULTS":
            logger.warning(f"Reverse geocode tidak menemukan hasil untuk {lat},{lng}")
            return None
        else:
            logger.error(f"Error dari Google Geocoding API: {data['status']} - {data.get('error_message', '')}")
            return None

    except httpx.RequestError as e:
        logger.error(f"Network error saat menghubungi Geocoding API: {e}")
        return None
    except json.JSONDecodeError:
        logger.error("Gagal parse JSON dari respons Geocoding API.")
        return None
    except Exception as e:
        logger.error(f"Error tidak diketahui saat reverse geocoding: {e}")
        return None