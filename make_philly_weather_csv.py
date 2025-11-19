import csv
import datetime as dt
import requests

LAT = 39.95
LON = -75.16
START_DATE = "1945-01-01"
END_DATE   = "2024-12-31"
OUT_FILE   = "philly_weather_monthly_1945_2024.csv"

API_URL = (
    "https://archive-api.open-meteo.com/v1/archive"
    f"?latitude={LAT}&longitude={LON}"
    f"&start_date={START_DATE}&end_date={END_DATE}"
    "&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max"
    "&hourly=relative_humidity_2m"
    "&timezone=America%2FNew_York"
)

def main():
    print("Requesting:", API_URL)
    r = requests.get(API_URL, timeout=60)
    r.raise_for_status()
    data = r.json()

    daily = data.get("daily", {})
    hourly = data.get("hourly", {})

    # 1) Build daily mean humidity from hourly data
    rh_by_day = {}  # "YYYY-MM-DD" -> (sum, n)
    times_h = hourly.get("time", [])
    rh_vals = hourly.get("relative_humidity_2m", [])
    for t, rh in zip(times_h, rh_vals):
        if rh is None:
            continue
        day = t[:10]  # "YYYY-MM-DD"
        s, n = rh_by_day.get(day, (0.0, 0))
        rh_by_day[day] = (s + rh, n + 1)

    # 2) Group daily into months
    groups = {}  # "YYYY-MM" -> list of dicts
    times_d = daily.get("time", [])
    tmax = daily.get("temperature_2m_max", [])
    wind = daily.get("wind_speed_10m_max", [])
    rain = daily.get("precipitation_sum", [])

    for day, t, w, p in zip(times_d, tmax, wind, rain):
        ym = day[:7]  # "YYYY-MM"

        rh = None
        if day in rh_by_day:
            s, n = rh_by_day[day]
            if n > 0:
                rh = s / n

        groups.setdefault(ym, []).append({
            "temp": t,
            "humidity": rh,
            "wind": w,
            "precip": p,
        })

    # 3) Reduce to monthly stats
    monthly_rows = []

    for ym in sorted(groups.keys()):
        entries = groups[ym]

        def mean_key(k, default=None):
            vals = [e[k] for e in entries if e[k] is not None]
            if not vals:
                return default
            return sum(vals) / len(vals)

        def sum_key(k, default=0.0):
            vals = [e[k] for e in entries if e[k] is not None]
            if not vals:
                return default
            return sum(vals)

        temp = mean_key("temp", None)
        if temp is None:
            continue  # skip months with no temp

        humidity = mean_key("humidity", 60.0)
        wind = mean_key("wind", 3.0)
        precip = sum_key("precip", 0.0)

        monthly_rows.append({
            "time": ym,        # "YYYY-MM"
            "temp": temp,      # deg C
            "humidity": humidity,  # %
            "wind": wind,      # m/s
            "precip": precip,  # mm per month
        })

    # 4) Write CSV
    print(f"Writing {OUT_FILE} with {len(monthly_rows)} rows...")
    with open(OUT_FILE, "w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["time", "temp", "humidity", "wind", "precip"]
        )
        writer.writeheader()
        writer.writerows(monthly_rows)

    print("Done.")

if __name__ == "__main__":
    main()
