import pandas as pd
import os

def analyze_climate_data(file_path):
    """
    Analyzes historical weather data to calculate yearly averages and temperature anomalies.
    Matches the logic used in the WebGL Climate Terrain visualization.
    """
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.")
        print("Please ensure the CSV file is in the same directory.")
        return

    print(f"Loading data from {file_path}...")
    
    # Load the CSV data
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    # 1. Preprocessing
    # ----------------
    # Ensure column names are clean (strip whitespace)
    df.columns = [c.strip() for c in df.columns]
    
    # Extract the Year from the 'time' column (assuming format YYYY-MM or YYYY-MM-DD)
    # We treat the data as strings first to safely substring the first 4 characters
    df['year'] = df['time'].astype(str).str.slice(0, 4).astype(int)

    # 2. Aggregation
    # --------------
    # Group by 'year' and calculate the mean for relevant columns.
    # Note: For precipitation, we calculate the 'Average Monthly Precipitation' per year
    # to match the shader's intensity logic. If you wanted Total Annual Precip, you would use 'sum'.
    yearly_stats = df.groupby('year').agg({
        'temp': 'mean',   # Average Temp
        'humidity': 'mean', # Average Humidity
        'wind': 'mean',   # Average Wind Speed
        'precip': 'mean'  # Average Monthly Precipitation
    }).reset_index()

    # 3. Baseline Calculation
    # -----------------------
    # Calculate the baseline temperature using the period 1945-1975
    baseline_start = 1945
    baseline_end = 1975
    
    baseline_data = yearly_stats[
        (yearly_stats['year'] >= baseline_start) & 
        (yearly_stats['year'] <= baseline_end)
    ]
    
    if baseline_data.empty:
        print("Warning: No data found for baseline period (1945-1975). Using full average.")
        baseline_temp = yearly_stats['temp'].mean()
    else:
        baseline_temp = baseline_data['temp'].mean()

    print(f"\n--- Baseline Configuration ---")
    print(f"Period: {baseline_start} - {baseline_end}")
    print(f"Baseline Avg Temp: {baseline_temp:.4f}°C")

    # 4. Anomaly Calculation
    # ----------------------
    # Anomaly = Year's Average Temp - Baseline Temp
    yearly_stats['temp_anomaly'] = yearly_stats['temp'] - baseline_temp

    # 5. Formatting & Output
    # ----------------------
    # Round for cleaner reading
    yearly_stats = yearly_stats.round(3)
    
    # Reorder columns for readability
    output_df = yearly_stats[['year', 'temp', 'temp_anomaly', 'wind', 'precip', 'humidity']]
    
    # Display snippet
    print("\n--- Climate Analysis (First 10 Years) ---")
    print(output_df.head(10).to_string(index=False))
    
    print("\n--- Climate Analysis (Last 10 Years) ---")
    print(output_df.tail(10).to_string(index=False))

    # Save to file
    output_filename = 'yearly_climate_summary.csv'
    output_df.to_csv(output_filename, index=False)
    print(f"\nFull analysis saved to: {output_filename}")

if __name__ == "__main__":
    # Ensure this matches your actual CSV filename
    csv_file = 'weather_phl_1945_2024.csv'
    analyze_climate_data(csv_file)