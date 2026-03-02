// Copyright (c) 2026 SAA Platform. All rights reserved.
// Data types mirroring the Global Risk Platform API JSON schemas.
#pragma once

#include "CoreMinimal.h"
#include "RiskDataTypes.generated.h"

// ============================================================================
// Geo primitives
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FGeoPoint
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Geo")
    double Latitude = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Geo")
    double Longitude = 0.0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Geo")
    double HeightMeters = 0.0;
};

// ============================================================================
// City configuration
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FCityConfig
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|City")
    FString CityId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|City")
    FString DisplayName;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|City")
    FGeoPoint Center;

    /** Cesium Ion asset ID for premium 3D tiles (0 = use Google tiles) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|City")
    int64 CesiumIonAssetId = 0;
};

// ============================================================================
// Flood data  (from /climate/flood-forecast and /climate/high-fidelity/flood)
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FFloodData
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Flood")
    FGeoPoint Center;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Flood")
    float MaxFloodDepthM = 0.0f;

    /** normal, elevated, high, critical */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Flood")
    FString RiskLevel;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Flood")
    float ExtentRadiusKm = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Flood")
    FString ValidTime;

    /** Polygon boundary points (empty for basic forecasts) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Flood")
    TArray<FGeoPoint> PolygonPoints;
};

// ============================================================================
// Wind data  (from /climate/wind-forecast and /climate/high-fidelity/wind)
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FWindData
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Wind")
    float MaxWindKmh = 0.0f;

    /** Saffir-Simpson category 0-5 */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Wind")
    int32 Category = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Wind")
    float DirectionDegrees = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Wind")
    float TurbulenceIntensity = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Wind")
    FString ValidTime;
};

// ============================================================================
// Metro flood point  (from /climate/metro-flood)
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FMetroFloodPoint
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Metro")
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Metro")
    FGeoPoint Location;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Metro")
    float FloodDepthM = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Metro")
    bool bIsFlooded = false;
};

// ============================================================================
// Stress test zone  (from /stress-tests/{id}/zones)
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FStressZone
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|StressZone")
    FString ZoneId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|StressZone")
    FString Name;

    /** critical, high, medium, low */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|StressZone")
    FString Severity;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|StressZone")
    float RiskScore = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|StressZone")
    float ExposureBillions = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|StressZone")
    float EstimatedDamageUsd = 0.0f;

    /** Polygon vertices defining the zone boundary */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|StressZone")
    TArray<FGeoPoint> Polygon;
};

// ============================================================================
// Active incident  (from /climate/active-incidents  -- GeoJSON features)
// ============================================================================

UENUM(BlueprintType)
enum class ERiskIncidentType : uint8
{
    Earthquake   UMETA(DisplayName = "Earthquake"),
    Fire         UMETA(DisplayName = "Fire"),
    WeatherAlert UMETA(DisplayName = "Weather Alert"),
    Unknown      UMETA(DisplayName = "Unknown")
};

USTRUCT(BlueprintType)
struct APISYNC_API FActiveIncident
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    ERiskIncidentType Type = ERiskIncidentType::Unknown;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    FString Title;

    /** extreme, severe, moderate, minor */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    FString Severity;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    FGeoPoint Location;

    /** Earthquake magnitude (0 for non-earthquake) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    float Magnitude = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    FString InfrastructureImpact;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    float EstimatedDamageUsd = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    FString AffectedRegion;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    TArray<FString> AffectedCityNames;

    /** Optional polygon for area-based incidents (weather alerts) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Incident")
    TArray<FGeoPoint> BoundaryPolygon;
};

// ============================================================================
// Earthquake zone  (from /climate/earthquake-zones)
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FEarthquakeZone
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Earthquake")
    FString ZoneId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Earthquake")
    float Magnitude = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Earthquake")
    FGeoPoint Epicenter;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Earthquake")
    TArray<FGeoPoint> Polygon;
};

// ============================================================================
// Infrastructure item  (from /geodata/infrastructure/{city})
// ============================================================================

UENUM(BlueprintType)
enum class EInfrastructureType : uint8
{
    PowerGrid    UMETA(DisplayName = "Power Grid"),
    WaterSystem  UMETA(DisplayName = "Water System"),
    Hospital     UMETA(DisplayName = "Hospital"),
    Airport      UMETA(DisplayName = "Airport"),
    School       UMETA(DisplayName = "School"),
    Bridge       UMETA(DisplayName = "Bridge"),
    Road         UMETA(DisplayName = "Road"),
    Telecom      UMETA(DisplayName = "Telecom"),
    Other        UMETA(DisplayName = "Other")
};

USTRUCT(BlueprintType)
struct APISYNC_API FInfrastructureItem
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Infra")
    FString ItemId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Infra")
    FString Name;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Infra")
    EInfrastructureType InfraType = EInfrastructureType::Other;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Infra")
    FGeoPoint Location;

    /** 0.0 = destroyed, 1.0 = fully operational */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Infra")
    float StructuralIntegrity = 1.0f;

    /** Dependencies: IDs of infrastructure this item depends on */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Infra")
    TArray<FString> DependsOn;
};

// ============================================================================
// Building damage  (from /ue5/building-damage-grid)
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FBuildingDamage
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Building")
    FString BuildingId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Building")
    FGeoPoint Location;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Building")
    int32 Floors = 1;

    /** 0.0 = no damage, 1.0 = total destruction */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Building")
    float DamageRatio = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Building")
    float FloodDepthM = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Building")
    float StructuralIntegrity = 1.0f;
};

// ============================================================================
// Scenario bundle  (from /ue5/scenario-bundle)
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FScenarioBundle
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    FString CityId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    FString ScenarioId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    FFloodData Flood;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    FWindData Wind;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    TArray<FStressZone> Zones;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    TArray<FActiveIncident> ActiveIncidents;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    TArray<FInfrastructureItem> Infrastructure;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    TArray<FMetroFloodPoint> MetroFloodPoints;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Scenario")
    TArray<FBuildingDamage> Buildings;
};

// ============================================================================
// 4D Timeline keyframe  (stress test impact over time)
// ============================================================================

USTRUCT(BlueprintType)
struct APISYNC_API FTimelineKeyframe
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Timeline")
    FString Label;

    /** Fraction of total timeline (0.0 = T+0h, 1.0 = T+12m) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Timeline")
    float TimeFraction = 0.0f;

    /** Cumulative loss share (0.0 to 1.0) */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Risk|Timeline")
    float LossShare = 0.0f;
};
