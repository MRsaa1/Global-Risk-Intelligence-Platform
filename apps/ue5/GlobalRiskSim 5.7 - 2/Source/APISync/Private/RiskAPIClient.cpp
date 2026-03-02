// Copyright (c) 2026 SAA Platform. All rights reserved.
#include "RiskAPIClient.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/ConfigCacheIni.h"

DEFINE_LOG_CATEGORY(LogRiskAPI);

// ============================================================================
// Construction
// ============================================================================

URiskAPIClient::URiskAPIClient()
{
    LoadConfigFromIni();
}

void URiskAPIClient::LoadConfigFromIni()
{
    FString IniBaseURL;
    if (GConfig && GConfig->GetString(
        TEXT("/Script/APISync.RiskAPIClient"),
        TEXT("BaseURL"),
        IniBaseURL,
        GGameIni))
    {
        BaseURL = IniBaseURL;
    }

    float IniTimeout = 0.f;
    if (GConfig && GConfig->GetFloat(
        TEXT("/Script/APISync.RiskAPIClient"),
        TEXT("RequestTimeoutSeconds"),
        IniTimeout,
        GGameIni))
    {
        RequestTimeoutSeconds = IniTimeout;
    }

    bool bIniVerbose = false;
    if (GConfig && GConfig->GetBool(
        TEXT("/Script/APISync.RiskAPIClient"),
        TEXT("bVerboseLogging"),
        bIniVerbose,
        GGameIni))
    {
        bVerboseLogging = bIniVerbose;
    }
}

// ============================================================================
// Low-level HTTP
// ============================================================================

void URiskAPIClient::AsyncGET(const FString& RelativePath, const FString& Tag)
{
    const FString FullURL = BaseURL / RelativePath;

    if (bVerboseLogging)
    {
        UE_LOG(LogRiskAPI, Log, TEXT("[%s] GET %s"), *Tag, *FullURL);
    }

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(FullURL);
    Request->SetVerb(TEXT("GET"));
    Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
    Request->SetTimeout(RequestTimeoutSeconds);
    Request->OnProcessRequestComplete().BindUObject(
        this, &URiskAPIClient::OnHttpResponseReceived, Tag);
    Request->ProcessRequest();
}

void URiskAPIClient::OnHttpResponseReceived(
    FHttpRequestPtr Request,
    FHttpResponsePtr Response,
    bool bSuccess,
    FString Tag)
{
    if (!bSuccess || !Response.IsValid())
    {
        const FString Err = TEXT("HTTP request failed (no response)");
        UE_LOG(LogRiskAPI, Warning, TEXT("[%s] %s"), *Tag, *Err);
        OnApiError.Broadcast(Tag, Err);
        return;
    }

    const int32 Code = Response->GetResponseCode();
    const FString Body = Response->GetContentAsString();

    if (Code < 200 || Code >= 300)
    {
        const FString Err = FString::Printf(TEXT("HTTP %d: %s"), Code, *Body.Left(512));
        UE_LOG(LogRiskAPI, Warning, TEXT("[%s] %s"), *Tag, *Err);
        OnApiError.Broadcast(Tag, Err);
        return;
    }

    if (bVerboseLogging)
    {
        UE_LOG(LogRiskAPI, Log, TEXT("[%s] OK (%d bytes)"), *Tag, Body.Len());
    }

    OnApiResponse.Broadcast(Tag, Body);

    // ── Route to typed parsers based on Tag ──
    TSharedPtr<FJsonObject> RootObj;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Body);

    if (Tag == TEXT("flood_forecast") || Tag == TEXT("hf_flood"))
    {
        if (FJsonSerializer::Deserialize(Reader, RootObj) && RootObj.IsValid())
        {
            OnFloodDataReceived.Broadcast(ParseFloodData(RootObj));
        }
    }
    else if (Tag == TEXT("wind_forecast") || Tag == TEXT("hf_wind"))
    {
        if (FJsonSerializer::Deserialize(Reader, RootObj) && RootObj.IsValid())
        {
            OnWindDataReceived.Broadcast(ParseWindData(RootObj));
        }
    }
    else if (Tag == TEXT("stress_zones"))
    {
        TArray<TSharedPtr<FJsonValue>> Arr;
        if (FJsonSerializer::Deserialize(Reader, Arr))
        {
            TArray<FStressZone> Zones;
            for (auto& Val : Arr)
            {
                if (Val->Type == EJson::Object)
                {
                    Zones.Add(ParseStressZone(Val->AsObject()));
                }
            }
            OnStressZonesReceived.Broadcast(Zones);
        }
    }
    else if (Tag == TEXT("active_incidents"))
    {
        if (FJsonSerializer::Deserialize(Reader, RootObj) && RootObj.IsValid())
        {
            TArray<FActiveIncident> Incidents;
            const TArray<TSharedPtr<FJsonValue>>* Features;
            if (RootObj->TryGetArrayField(TEXT("features"), Features))
            {
                for (auto& FVal : *Features)
                {
                    if (FVal->Type == EJson::Object)
                    {
                        Incidents.Add(ParseActiveIncident(FVal->AsObject()));
                    }
                }
            }
            OnActiveIncidentsReceived.Broadcast(Incidents);
        }
    }
    else if (Tag == TEXT("infrastructure"))
    {
        TArray<TSharedPtr<FJsonValue>> Arr;
        if (FJsonSerializer::Deserialize(Reader, Arr))
        {
            TArray<FInfrastructureItem> Items;
            for (auto& Val : Arr)
            {
                if (Val->Type == EJson::Object)
                {
                    Items.Add(ParseInfrastructureItem(Val->AsObject()));
                }
            }
            OnInfrastructureReceived.Broadcast(Items);
        }
    }
    else if (Tag == TEXT("metro_flood"))
    {
        TArray<TSharedPtr<FJsonValue>> Arr;
        if (FJsonSerializer::Deserialize(Reader, Arr))
        {
            TArray<FMetroFloodPoint> Points;
            for (auto& Val : Arr)
            {
                if (Val->Type == EJson::Object)
                {
                    Points.Add(ParseMetroFloodPoint(Val->AsObject()));
                }
            }
            OnMetroFloodReceived.Broadcast(Points);
        }
    }
    else if (Tag == TEXT("earthquake_zones"))
    {
        TArray<TSharedPtr<FJsonValue>> Arr;
        if (FJsonSerializer::Deserialize(Reader, Arr))
        {
            TArray<FEarthquakeZone> EZones;
            for (auto& Val : Arr)
            {
                if (Val->Type == EJson::Object)
                {
                    EZones.Add(ParseEarthquakeZone(Val->AsObject()));
                }
            }
            OnEarthquakeZonesReceived.Broadcast(EZones);
        }
    }
    else if (Tag == TEXT("building_damage"))
    {
        TArray<TSharedPtr<FJsonValue>> Arr;
        if (FJsonSerializer::Deserialize(Reader, Arr))
        {
            TArray<FBuildingDamage> Buildings;
            for (auto& Val : Arr)
            {
                if (Val->Type == EJson::Object)
                {
                    Buildings.Add(ParseBuildingDamage(Val->AsObject()));
                }
            }
            OnBuildingDamageReceived.Broadcast(Buildings);
        }
    }
    else if (Tag == TEXT("scenario_bundle"))
    {
        if (FJsonSerializer::Deserialize(Reader, RootObj) && RootObj.IsValid())
        {
            FScenarioBundle Bundle;
            Bundle.CityId = RootObj->GetStringField(TEXT("city_id"));
            Bundle.ScenarioId = RootObj->GetStringField(TEXT("scenario_id"));

            // Flood
            const TSharedPtr<FJsonObject>* FloodObj;
            if (RootObj->TryGetObjectField(TEXT("flood"), FloodObj))
            {
                Bundle.Flood = ParseFloodData(*FloodObj);
            }
            // Wind
            const TSharedPtr<FJsonObject>* WindObj;
            if (RootObj->TryGetObjectField(TEXT("wind"), WindObj))
            {
                Bundle.Wind = ParseWindData(*WindObj);
            }
            // Zones
            const TArray<TSharedPtr<FJsonValue>>* ZonesArr;
            if (RootObj->TryGetArrayField(TEXT("zones"), ZonesArr))
            {
                for (auto& Val : *ZonesArr)
                {
                    if (Val->Type == EJson::Object)
                        Bundle.Zones.Add(ParseStressZone(Val->AsObject()));
                }
            }
            // Active incidents
            const TArray<TSharedPtr<FJsonValue>>* IncArr;
            if (RootObj->TryGetArrayField(TEXT("active_incidents"), IncArr))
            {
                for (auto& Val : *IncArr)
                {
                    if (Val->Type == EJson::Object)
                        Bundle.ActiveIncidents.Add(ParseActiveIncident(Val->AsObject()));
                }
            }
            // Infrastructure
            const TArray<TSharedPtr<FJsonValue>>* InfraArr;
            if (RootObj->TryGetArrayField(TEXT("infrastructure"), InfraArr))
            {
                for (auto& Val : *InfraArr)
                {
                    if (Val->Type == EJson::Object)
                        Bundle.Infrastructure.Add(ParseInfrastructureItem(Val->AsObject()));
                }
            }
            // Metro
            const TArray<TSharedPtr<FJsonValue>>* MetroArr;
            if (RootObj->TryGetArrayField(TEXT("metro_flood_points"), MetroArr))
            {
                for (auto& Val : *MetroArr)
                {
                    if (Val->Type == EJson::Object)
                        Bundle.MetroFloodPoints.Add(ParseMetroFloodPoint(Val->AsObject()));
                }
            }
            // Buildings
            const TArray<TSharedPtr<FJsonValue>>* BuildArr;
            if (RootObj->TryGetArrayField(TEXT("buildings"), BuildArr))
            {
                for (auto& Val : *BuildArr)
                {
                    if (Val->Type == EJson::Object)
                        Bundle.Buildings.Add(ParseBuildingDamage(Val->AsObject()));
                }
            }
            OnScenarioBundleReceived.Broadcast(Bundle);
        }
    }
}

// ============================================================================
// High-level fetch methods
// ============================================================================

void URiskAPIClient::FetchFloodForecast(double Latitude, double Longitude)
{
    const FString Path = FString::Printf(
        TEXT("climate/flood-forecast?latitude=%.6f&longitude=%.6f"), Latitude, Longitude);
    AsyncGET(Path, TEXT("flood_forecast"));
}

void URiskAPIClient::FetchWindForecast(double Latitude, double Longitude)
{
    const FString Path = FString::Printf(
        TEXT("climate/wind-forecast?latitude=%.6f&longitude=%.6f"), Latitude, Longitude);
    AsyncGET(Path, TEXT("wind_forecast"));
}

void URiskAPIClient::FetchHighFidelityFlood(const FString& ScenarioId)
{
    const FString Path = FString::Printf(
        TEXT("climate/high-fidelity/flood?scenario_id=%s"), *ScenarioId);
    AsyncGET(Path, TEXT("hf_flood"));
}

void URiskAPIClient::FetchHighFidelityWind(const FString& ScenarioId)
{
    const FString Path = FString::Printf(
        TEXT("climate/high-fidelity/wind?scenario_id=%s"), *ScenarioId);
    AsyncGET(Path, TEXT("hf_wind"));
}

void URiskAPIClient::FetchStressTestZones(const FString& StressTestId)
{
    const FString Path = FString::Printf(
        TEXT("stress-tests/%s/zones"), *StressTestId);
    AsyncGET(Path, TEXT("stress_zones"));
}

void URiskAPIClient::FetchActiveIncidents()
{
    AsyncGET(TEXT("climate/active-incidents"), TEXT("active_incidents"));
}

void URiskAPIClient::FetchInfrastructure(const FString& CityId)
{
    const FString Path = FString::Printf(
        TEXT("geodata/infrastructure/%s"), *CityId);
    AsyncGET(Path, TEXT("infrastructure"));
}

void URiskAPIClient::FetchMetroFlood(double Latitude, double Longitude)
{
    const FString Path = FString::Printf(
        TEXT("climate/metro-flood?latitude=%.6f&longitude=%.6f"), Latitude, Longitude);
    AsyncGET(Path, TEXT("metro_flood"));
}

void URiskAPIClient::FetchEarthquakeZones()
{
    AsyncGET(TEXT("climate/earthquake-zones"), TEXT("earthquake_zones"));
}

void URiskAPIClient::FetchBuildingDamageGrid(double Latitude, double Longitude, float RadiusKm, const FString& ScenarioId)
{
    const FString Path = FString::Printf(
        TEXT("ue5/building-damage-grid?lat=%.6f&lng=%.6f&radius_km=%.1f&scenario_id=%s"),
        Latitude, Longitude, RadiusKm, *ScenarioId);
    AsyncGET(Path, TEXT("building_damage"));
}

void URiskAPIClient::FetchScenarioBundle(const FString& CityId, const FString& ScenarioId)
{
    const FString Path = FString::Printf(
        TEXT("ue5/scenario-bundle?city_id=%s&scenario_id=%s"), *CityId, *ScenarioId);
    AsyncGET(Path, TEXT("scenario_bundle"));
}

void URiskAPIClient::FetchStressTestCZML(const FString& StressTestId)
{
    const FString Path = FString::Printf(
        TEXT("stress-tests/%s/czml"), *StressTestId);
    AsyncGET(Path, TEXT("czml"));
}

// ============================================================================
// JSON parse helpers
// ============================================================================

FGeoPoint URiskAPIClient::ParseGeoPoint(const TSharedPtr<FJsonObject>& Json) const
{
    FGeoPoint Pt;
    if (!Json.IsValid()) return Pt;
    Json->TryGetNumberField(TEXT("latitude"), Pt.Latitude);
    Json->TryGetNumberField(TEXT("longitude"), Pt.Longitude);
    Json->TryGetNumberField(TEXT("height_m"), Pt.HeightMeters);
    return Pt;
}

TArray<FGeoPoint> URiskAPIClient::ParseGeoPointArray(const TArray<TSharedPtr<FJsonValue>>& Arr) const
{
    TArray<FGeoPoint> Points;
    for (auto& Val : Arr)
    {
        if (Val->Type == EJson::Object)
        {
            Points.Add(ParseGeoPoint(Val->AsObject()));
        }
        else if (Val->Type == EJson::Array)
        {
            // GeoJSON style [lng, lat]
            const auto& Coords = Val->AsArray();
            if (Coords.Num() >= 2)
            {
                FGeoPoint Pt;
                Pt.Longitude = Coords[0]->AsNumber();
                Pt.Latitude = Coords[1]->AsNumber();
                if (Coords.Num() >= 3)
                    Pt.HeightMeters = Coords[2]->AsNumber();
                Points.Add(Pt);
            }
        }
    }
    return Points;
}

FFloodData URiskAPIClient::ParseFloodData(const TSharedPtr<FJsonObject>& Json) const
{
    FFloodData D;
    if (!Json.IsValid()) return D;

    const TSharedPtr<FJsonObject>* CenterObj;
    if (Json->TryGetObjectField(TEXT("center"), CenterObj))
        D.Center = ParseGeoPoint(*CenterObj);

    D.MaxFloodDepthM = Json->GetNumberField(TEXT("max_flood_depth_m"));
    D.RiskLevel = Json->GetStringField(TEXT("risk_level"));
    Json->TryGetNumberField(TEXT("extent_radius_km"), D.ExtentRadiusKm);
    D.ValidTime = Json->GetStringField(TEXT("valid_time"));

    const TArray<TSharedPtr<FJsonValue>>* PolyArr;
    if (Json->TryGetArrayField(TEXT("polygon_points"), PolyArr))
        D.PolygonPoints = ParseGeoPointArray(*PolyArr);

    return D;
}

FWindData URiskAPIClient::ParseWindData(const TSharedPtr<FJsonObject>& Json) const
{
    FWindData D;
    if (!Json.IsValid()) return D;

    D.MaxWindKmh = Json->GetNumberField(TEXT("max_wind_kmh"));
    D.Category = (int32)Json->GetNumberField(TEXT("category"));
    D.DirectionDegrees = Json->GetNumberField(TEXT("direction_degrees"));
    D.TurbulenceIntensity = Json->GetNumberField(TEXT("turbulence_intensity"));
    D.ValidTime = Json->GetStringField(TEXT("valid_time"));

    return D;
}

FStressZone URiskAPIClient::ParseStressZone(const TSharedPtr<FJsonObject>& Json) const
{
    FStressZone Z;
    if (!Json.IsValid()) return Z;

    Z.ZoneId = Json->GetStringField(TEXT("zone_id"));
    Z.Name = Json->GetStringField(TEXT("name"));
    Z.Severity = Json->GetStringField(TEXT("severity"));
    Json->TryGetNumberField(TEXT("risk_score"), Z.RiskScore);
    Json->TryGetNumberField(TEXT("exposure_billions"), Z.ExposureBillions);
    Json->TryGetNumberField(TEXT("estimated_damage_usd"), Z.EstimatedDamageUsd);

    const TArray<TSharedPtr<FJsonValue>>* PolyArr;
    if (Json->TryGetArrayField(TEXT("polygon"), PolyArr))
        Z.Polygon = ParseGeoPointArray(*PolyArr);

    return Z;
}

FActiveIncident URiskAPIClient::ParseActiveIncident(const TSharedPtr<FJsonObject>& Json) const
{
    FActiveIncident Inc;
    if (!Json.IsValid()) return Inc;

    // GeoJSON feature: geometry + properties
    const TSharedPtr<FJsonObject>* PropsObj;
    if (Json->TryGetObjectField(TEXT("properties"), PropsObj))
    {
        const FString TypeStr = (*PropsObj)->GetStringField(TEXT("type"));
        if (TypeStr == TEXT("earthquake"))       Inc.Type = ERiskIncidentType::Earthquake;
        else if (TypeStr == TEXT("fire"))         Inc.Type = ERiskIncidentType::Fire;
        else if (TypeStr == TEXT("weather_alert")) Inc.Type = ERiskIncidentType::WeatherAlert;
        else                                      Inc.Type = ERiskIncidentType::Unknown;

        Inc.Title = (*PropsObj)->GetStringField(TEXT("title"));
        Inc.Severity = (*PropsObj)->GetStringField(TEXT("severity"));
        (*PropsObj)->TryGetNumberField(TEXT("magnitude"), Inc.Magnitude);
        Inc.InfrastructureImpact = (*PropsObj)->GetStringField(TEXT("infrastructure_impact"));
        (*PropsObj)->TryGetNumberField(TEXT("estimated_damage_usd"), Inc.EstimatedDamageUsd);
        Inc.AffectedRegion = (*PropsObj)->GetStringField(TEXT("affected_region"));

        const TArray<TSharedPtr<FJsonValue>>* CityNamesArr;
        if ((*PropsObj)->TryGetArrayField(TEXT("affected_city_names"), CityNamesArr))
        {
            for (auto& CVal : *CityNamesArr)
                Inc.AffectedCityNames.Add(CVal->AsString());
        }
    }

    // Geometry
    const TSharedPtr<FJsonObject>* GeomObj;
    if (Json->TryGetObjectField(TEXT("geometry"), GeomObj) && (*GeomObj).IsValid())
    {
        const FString GeomType = (*GeomObj)->GetStringField(TEXT("type"));
        const TArray<TSharedPtr<FJsonValue>>* Coords;
        if ((*GeomObj)->TryGetArrayField(TEXT("coordinates"), Coords))
        {
            if (GeomType == TEXT("Point") && Coords->Num() >= 2)
            {
                Inc.Location.Longitude = (*Coords)[0]->AsNumber();
                Inc.Location.Latitude = (*Coords)[1]->AsNumber();
            }
            else if (GeomType == TEXT("Polygon") && Coords->Num() > 0)
            {
                // First ring
                const auto& Ring = (*Coords)[0]->AsArray();
                Inc.BoundaryPolygon = ParseGeoPointArray(Ring);
                // Centroid as location
                if (Inc.BoundaryPolygon.Num() > 0)
                {
                    double SumLat = 0, SumLng = 0;
                    for (auto& P : Inc.BoundaryPolygon) { SumLat += P.Latitude; SumLng += P.Longitude; }
                    Inc.Location.Latitude = SumLat / Inc.BoundaryPolygon.Num();
                    Inc.Location.Longitude = SumLng / Inc.BoundaryPolygon.Num();
                }
            }
        }
    }

    return Inc;
}

FInfrastructureItem URiskAPIClient::ParseInfrastructureItem(const TSharedPtr<FJsonObject>& Json) const
{
    FInfrastructureItem Item;
    if (!Json.IsValid()) return Item;

    Item.ItemId = Json->GetStringField(TEXT("id"));
    Item.Name = Json->GetStringField(TEXT("name"));

    const FString TypeStr = Json->GetStringField(TEXT("type"));
    if (TypeStr == TEXT("power_grid"))     Item.InfraType = EInfrastructureType::PowerGrid;
    else if (TypeStr == TEXT("water"))     Item.InfraType = EInfrastructureType::WaterSystem;
    else if (TypeStr == TEXT("hospital"))  Item.InfraType = EInfrastructureType::Hospital;
    else if (TypeStr == TEXT("airport"))   Item.InfraType = EInfrastructureType::Airport;
    else if (TypeStr == TEXT("school"))    Item.InfraType = EInfrastructureType::School;
    else if (TypeStr == TEXT("bridge"))    Item.InfraType = EInfrastructureType::Bridge;
    else if (TypeStr == TEXT("road"))      Item.InfraType = EInfrastructureType::Road;
    else if (TypeStr == TEXT("telecom"))   Item.InfraType = EInfrastructureType::Telecom;
    else                                   Item.InfraType = EInfrastructureType::Other;

    const TSharedPtr<FJsonObject>* LocObj;
    if (Json->TryGetObjectField(TEXT("location"), LocObj))
        Item.Location = ParseGeoPoint(*LocObj);

    Json->TryGetNumberField(TEXT("structural_integrity"), Item.StructuralIntegrity);

    const TArray<TSharedPtr<FJsonValue>>* DepsArr;
    if (Json->TryGetArrayField(TEXT("depends_on"), DepsArr))
    {
        for (auto& DVal : *DepsArr)
            Item.DependsOn.Add(DVal->AsString());
    }

    return Item;
}

FMetroFloodPoint URiskAPIClient::ParseMetroFloodPoint(const TSharedPtr<FJsonObject>& Json) const
{
    FMetroFloodPoint Pt;
    if (!Json.IsValid()) return Pt;

    Pt.Name = Json->GetStringField(TEXT("name"));
    const TSharedPtr<FJsonObject>* LocObj;
    if (Json->TryGetObjectField(TEXT("location"), LocObj))
        Pt.Location = ParseGeoPoint(*LocObj);

    Pt.FloodDepthM = Json->GetNumberField(TEXT("flood_depth_m"));
    Json->TryGetBoolField(TEXT("is_flooded"), Pt.bIsFlooded);

    return Pt;
}

FEarthquakeZone URiskAPIClient::ParseEarthquakeZone(const TSharedPtr<FJsonObject>& Json) const
{
    FEarthquakeZone EZ;
    if (!Json.IsValid()) return EZ;

    EZ.ZoneId = Json->GetStringField(TEXT("zone_id"));
    EZ.Magnitude = Json->GetNumberField(TEXT("magnitude"));

    const TSharedPtr<FJsonObject>* EpObj;
    if (Json->TryGetObjectField(TEXT("epicenter"), EpObj))
        EZ.Epicenter = ParseGeoPoint(*EpObj);

    const TArray<TSharedPtr<FJsonValue>>* PolyArr;
    if (Json->TryGetArrayField(TEXT("polygon"), PolyArr))
        EZ.Polygon = ParseGeoPointArray(*PolyArr);

    return EZ;
}

FBuildingDamage URiskAPIClient::ParseBuildingDamage(const TSharedPtr<FJsonObject>& Json) const
{
    FBuildingDamage B;
    if (!Json.IsValid()) return B;

    B.BuildingId = Json->GetStringField(TEXT("building_id"));

    const TSharedPtr<FJsonObject>* LocObj;
    if (Json->TryGetObjectField(TEXT("location"), LocObj))
        B.Location = ParseGeoPoint(*LocObj);
    else
    {
        Json->TryGetNumberField(TEXT("latitude"), B.Location.Latitude);
        Json->TryGetNumberField(TEXT("longitude"), B.Location.Longitude);
    }

    B.Floors = (int32)Json->GetNumberField(TEXT("floors"));
    B.DamageRatio = Json->GetNumberField(TEXT("damage_ratio"));
    Json->TryGetNumberField(TEXT("flood_depth_m"), B.FloodDepthM);
    Json->TryGetNumberField(TEXT("structural_integrity"), B.StructuralIntegrity);

    return B;
}
