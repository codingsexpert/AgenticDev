"""
tools.py — Real-Time Tools for AI Chat Assistant (Live Weather, Search, Calculations)
"""

import requests
from typing import Dict, Any

def get_current_weather(city_name: str) -> Dict[str, Any]:
    """Fetches real-time live weather for any city using Open-Meteo API."""
    try:
        # Geocode city name to lat/lon
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city_name}&count=1"
        geo_res = requests.get(geo_url, timeout=5).json()

        if not geo_res.get("results"):
            return {"error": f"City '{city_name}' not found."}

        loc = geo_res["results"][0]
        lat, lon = loc["latitude"], loc["longitude"]
        city_full = f"{loc.get('name')}, {loc.get('country')}"

        # Fetch current weather
        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
        w_res = requests.get(weather_url, timeout=5).json()

        cw = w_res.get("current_weather", {})
        temp = cw.get("temperature")
        wind = cw.get("windspeed")
        code = cw.get("weathercode")

        return {
            "city": city_full,
            "temperature_celsius": temp,
            "temperature_fahrenheit": round(temp * 9/5 + 32, 1) if temp else None,
            "windspeed_kmh": wind,
            "weather_code": code,
            "status": "success"
        }
    except Exception as e:
        return {"error": f"Failed to fetch weather: {str(e)}"}
