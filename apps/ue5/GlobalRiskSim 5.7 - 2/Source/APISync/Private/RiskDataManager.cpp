// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "RiskDataManager.h"

ARiskDataManager::ARiskDataManager()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickInterval = 1.0f; // tick every second for timer

    // Default to NYC
    CurrentCity.CityId = TEXT("newyork");
    CurrentCity.DisplayName = TEXT("New York City");
    CurrentCity.Center.Latitude = 40.7128;
    CurrentCity.Center.Longitude = -74.0060;
    CurrentCity.Center.HeightMeters = 200.0;
    CurrentCity.CesiumIonAssetId = 75343;
}

void ARiskDataManager::BeginPlay()
{
    Super::BeginPlay();

    // Create API client
    APIClient = NewObject<URiskAPIClient>(this, URiskAPIClient::StaticClass());
    check(APIClient);

    // Bind delegates
    APIClient->OnFloodDataReceived.AddDynamic(this, &ARiskDataManager::HandleFloodData);
    APIClient->OnWindDataReceived.AddDynamic(this, &ARiskDataManager::HandleWindData);
    APIClient->OnStressZonesReceived.AddDynamic(this, &ARiskDataManager::HandleStressZones);
    APIClient->OnActiveIncidentsReceived.AddDynamic(this, &ARiskDataManager::HandleIncidents);
    APIClient->OnInfrastructureReceived.AddDynamic(this, &ARiskDataManager::HandleInfrastructure);
    APIClient->OnMetroFloodReceived.AddDynamic(this, &ARiskDataManager::HandleMetroFlood);
    APIClient->OnBuildingDamageReceived.AddDynamic(this, &ARiskDataManager::HandleBuildings);
    APIClient->OnScenarioBundleReceived.AddDynamic(this, &ARiskDataManager::HandleScenarioBundle);

    UE_LOG(LogRiskAPI, Log, TEXT("RiskDataManager: City=%s, API=%s"),
        *CurrentCity.DisplayName, *APIClient->BaseURL);

    if (bAutoFetchOnStart)
    {
        FetchAllData();
    }
}

void ARiskDataManager::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    Super::EndPlay(EndPlayReason);
}

void ARiskDataManager::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    PollTimer += DeltaTime;
    if (PollTimer >= PollIntervalSeconds)
    {
        PollTimer = 0.0f;
        // Re-fetch live data
        if (APIClient)
        {
            APIClient->FetchActiveIncidents();
            APIClient->FetchFloodForecast(CurrentCity.Center.Latitude, CurrentCity.Center.Longitude);
            APIClient->FetchWindForecast(CurrentCity.Center.Latitude, CurrentCity.Center.Longitude);
        }
    }
}

// ============================================================================
// Commands
// ============================================================================

void ARiskDataManager::FetchAllData()
{
    if (!APIClient) return;

    const double Lat = CurrentCity.Center.Latitude;
    const double Lng = CurrentCity.Center.Longitude;

    // Core forecasts
    if (ActiveScenarioId.IsEmpty())
    {
        APIClient->FetchFloodForecast(Lat, Lng);
        APIClient->FetchWindForecast(Lat, Lng);
    }
    else
    {
        APIClient->FetchHighFidelityFlood(ActiveScenarioId);
        APIClient->FetchHighFidelityWind(ActiveScenarioId);
    }

    // Metro flood
    APIClient->FetchMetroFlood(Lat, Lng);

    // Infrastructure
    APIClient->FetchInfrastructure(CurrentCity.CityId);

    // Active incidents (global)
    APIClient->FetchActiveIncidents();

    // Earthquake zones
    APIClient->FetchEarthquakeZones();

    // Stress test zones
    if (!ActiveStressTestId.IsEmpty())
    {
        APIClient->FetchStressTestZones(ActiveStressTestId);
    }
}

void ARiskDataManager::SwitchCity(const FCityConfig& NewCity)
{
    CurrentCity = NewCity;
    UE_LOG(LogRiskAPI, Log, TEXT("RiskDataManager: Switched to city %s"), *NewCity.DisplayName);
    PollTimer = 0.0f;
    FetchAllData();
}

void ARiskDataManager::SetStressTest(const FString& StressTestId)
{
    ActiveStressTestId = StressTestId;
    if (APIClient && !StressTestId.IsEmpty())
    {
        APIClient->FetchStressTestZones(StressTestId);
    }
}

void ARiskDataManager::FetchScenarioBundle()
{
    if (APIClient)
    {
        APIClient->FetchScenarioBundle(CurrentCity.CityId, ActiveScenarioId);
    }
}

// ============================================================================
// Static city presets
// ============================================================================

TArray<FCityConfig> ARiskDataManager::GetCityPresets()
{
    TArray<FCityConfig> Cities;

    auto MakeCity = [](const FString& Id, const FString& Name,
                       double Lat, double Lng, double Hgt, int64 Ion) -> FCityConfig
    {
        FCityConfig C;
        C.CityId = Id;
        C.DisplayName = Name;
        C.Center.Latitude = Lat;
        C.Center.Longitude = Lng;
        C.Center.HeightMeters = Hgt;
        C.CesiumIonAssetId = Ion;
        return C;
    };

    Cities.Add(MakeCity(TEXT("newyork"),  TEXT("New York City"), 40.7128,  -74.0060,  200.0, 75343));
    Cities.Add(MakeCity(TEXT("tokyo"),    TEXT("Tokyo"),         35.6762,  139.6503,  200.0, 0));
    Cities.Add(MakeCity(TEXT("london"),   TEXT("London"),        51.5074,  -0.1278,   200.0, 0));
    Cities.Add(MakeCity(TEXT("miami"),    TEXT("Miami"),         25.7617,  -80.1918,  150.0, 0));
    Cities.Add(MakeCity(TEXT("shanghai"), TEXT("Shanghai"),      31.2304,  121.4737,  200.0, 0));

    return Cities;
}

FCityConfig ARiskDataManager::GetCityPresetById(const FString& CityId)
{
    const TArray<FCityConfig> All = GetCityPresets();
    for (const auto& C : All)
    {
        if (C.CityId == CityId)
            return C;
    }
    // Return NYC as default
    return All[0];
}

TArray<FTimelineKeyframe> ARiskDataManager::GetImpactTimeline()
{
    // From scenario_replay.py STRESS_TEST_IMPACT_TIMELINE
    TArray<FTimelineKeyframe> KF;

    auto Add = [&](const FString& Label, float Frac, float Loss)
    {
        FTimelineKeyframe K;
        K.Label = Label;
        K.TimeFraction = Frac;
        K.LossShare = Loss;
        KF.Add(K);
    };

    Add(TEXT("T+0h"),   0.000f, 0.17f);
    Add(TEXT("T+24h"),  0.003f, 0.33f);
    Add(TEXT("T+72h"),  0.008f, 0.45f);
    Add(TEXT("T+1w"),   0.019f, 0.67f);
    Add(TEXT("T+1m"),   0.083f, 0.85f);
    Add(TEXT("T+6m"),   0.500f, 0.95f);
    Add(TEXT("T+12m"),  1.000f, 1.00f);

    return KF;
}

// ============================================================================
// Internal callbacks: cache + re-broadcast
// ============================================================================

void ARiskDataManager::HandleFloodData(const FFloodData& Data)
{
    CachedFlood = Data;
    UE_LOG(LogRiskAPI, Log, TEXT("Flood: depth=%.1fm, risk=%s"), Data.MaxFloodDepthM, *Data.RiskLevel);
    OnFloodUpdated.Broadcast(Data);
}

void ARiskDataManager::HandleWindData(const FWindData& Data)
{
    CachedWind = Data;
    UE_LOG(LogRiskAPI, Log, TEXT("Wind: %.0f km/h, Cat %d"), Data.MaxWindKmh, Data.Category);
    OnWindUpdated.Broadcast(Data);
}

void ARiskDataManager::HandleStressZones(const TArray<FStressZone>& Zones)
{
    CachedStressZones = Zones;
    UE_LOG(LogRiskAPI, Log, TEXT("StressZones: %d zones received"), Zones.Num());
    OnStressZonesUpdated.Broadcast(Zones);
}

void ARiskDataManager::HandleIncidents(const TArray<FActiveIncident>& Incidents)
{
    CachedIncidents = Incidents;
    UE_LOG(LogRiskAPI, Log, TEXT("ActiveIncidents: %d incidents"), Incidents.Num());
    OnIncidentsUpdated.Broadcast(Incidents);
}

void ARiskDataManager::HandleInfrastructure(const TArray<FInfrastructureItem>& Items)
{
    CachedInfrastructure = Items;
    UE_LOG(LogRiskAPI, Log, TEXT("Infrastructure: %d items for city"), Items.Num());
    OnInfrastructureUpdated.Broadcast(Items);
}

void ARiskDataManager::HandleMetroFlood(const TArray<FMetroFloodPoint>& Points)
{
    CachedMetroFlood = Points;
    UE_LOG(LogRiskAPI, Log, TEXT("MetroFlood: %d entrances"), Points.Num());
    OnMetroFloodUpdated.Broadcast(Points);
}

void ARiskDataManager::HandleBuildings(const TArray<FBuildingDamage>& Buildings)
{
    CachedBuildings = Buildings;
    UE_LOG(LogRiskAPI, Log, TEXT("Buildings: %d buildings received"), Buildings.Num());
    OnBuildingsUpdated.Broadcast(Buildings);
}

void ARiskDataManager::HandleScenarioBundle(const FScenarioBundle& Bundle)
{
    // Unpack and distribute
    HandleFloodData(Bundle.Flood);
    HandleWindData(Bundle.Wind);
    HandleStressZones(Bundle.Zones);
    HandleIncidents(Bundle.ActiveIncidents);
    HandleInfrastructure(Bundle.Infrastructure);
    HandleMetroFlood(Bundle.MetroFloodPoints);
    HandleBuildings(Bundle.Buildings);
}
