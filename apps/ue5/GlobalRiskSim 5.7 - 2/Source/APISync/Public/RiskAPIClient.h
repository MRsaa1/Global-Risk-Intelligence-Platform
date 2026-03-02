// Copyright (c) 2026 SAA Platform. All rights reserved.
// Async HTTP client for the Global Risk Platform API.
#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "RiskDataTypes.h"
#include "RiskAPIClient.generated.h"

DECLARE_LOG_CATEGORY_EXTERN(LogRiskAPI, Log, All);

/** Delegate fired when a generic JSON response is received */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnApiResponse, const FString&, Endpoint, const FString&, JsonBody);

/** Delegate fired on request failure */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnApiError, const FString&, Endpoint, const FString&, ErrorMessage);

// Per-data-type delegates
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFloodDataReceived, const FFloodData&, Data);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWindDataReceived, const FWindData&, Data);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnStressZonesReceived, const TArray<FStressZone>&, Zones);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnActiveIncidentsReceived, const TArray<FActiveIncident>&, Incidents);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnInfrastructureReceived, const TArray<FInfrastructureItem>&, Items);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnMetroFloodReceived, const TArray<FMetroFloodPoint>&, Points);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnEarthquakeZonesReceived, const TArray<FEarthquakeZone>&, Zones);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnBuildingDamageReceived, const TArray<FBuildingDamage>&, Buildings);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnScenarioBundleReceived, const FScenarioBundle&, Bundle);

/**
 * URiskAPIClient
 * 
 * Singleton-style UObject that handles all HTTP communication with the
 * Global Risk Platform API. Supports async GET requests, JSON parsing,
 * retry logic and typed data delegates.
 */
UCLASS(Blueprintable, BlueprintType)
class APISYNC_API URiskAPIClient : public UObject
{
    GENERATED_BODY()

public:
    URiskAPIClient();

    // ── Configuration ──────────────────────────────────────────────
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "API|Config")
    FString BaseURL = TEXT("http://localhost:9002/api/v1");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "API|Config")
    float RequestTimeoutSeconds = 15.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "API|Config")
    int32 MaxRetries = 2;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "API|Config")
    bool bVerboseLogging = false;

    // ── Generic delegates ──────────────────────────────────────────
    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnApiResponse OnApiResponse;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnApiError OnApiError;

    // ── Typed delegates ────────────────────────────────────────────
    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnFloodDataReceived OnFloodDataReceived;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnWindDataReceived OnWindDataReceived;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnStressZonesReceived OnStressZonesReceived;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnActiveIncidentsReceived OnActiveIncidentsReceived;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnInfrastructureReceived OnInfrastructureReceived;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnMetroFloodReceived OnMetroFloodReceived;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnEarthquakeZonesReceived OnEarthquakeZonesReceived;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnBuildingDamageReceived OnBuildingDamageReceived;

    UPROPERTY(BlueprintAssignable, Category = "API|Events")
    FOnScenarioBundleReceived OnScenarioBundleReceived;

    // ── Blueprint-callable fetch methods ───────────────────────────

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchFloodForecast(double Latitude, double Longitude);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchWindForecast(double Latitude, double Longitude);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchHighFidelityFlood(const FString& ScenarioId);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchHighFidelityWind(const FString& ScenarioId);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchStressTestZones(const FString& StressTestId);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchActiveIncidents();

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchInfrastructure(const FString& CityId);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchMetroFlood(double Latitude, double Longitude);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchEarthquakeZones();

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchBuildingDamageGrid(double Latitude, double Longitude, float RadiusKm, const FString& ScenarioId);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchScenarioBundle(const FString& CityId, const FString& ScenarioId);

    UFUNCTION(BlueprintCallable, Category = "API|Fetch")
    void FetchStressTestCZML(const FString& StressTestId);

    // ── Low-level ──────────────────────────────────────────────────

    /** Fire a GET request to BaseURL + RelativePath */
    UFUNCTION(BlueprintCallable, Category = "API|Core")
    void AsyncGET(const FString& RelativePath, const FString& Tag);

    /** Load config from DefaultGame.ini [/Script/APISync.RiskAPIClient] */
    void LoadConfigFromIni();

private:
    void OnHttpResponseReceived(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bSuccess, FString Tag);

    // JSON parse helpers
    FFloodData ParseFloodData(const TSharedPtr<FJsonObject>& Json) const;
    FWindData ParseWindData(const TSharedPtr<FJsonObject>& Json) const;
    FStressZone ParseStressZone(const TSharedPtr<FJsonObject>& Json) const;
    FActiveIncident ParseActiveIncident(const TSharedPtr<FJsonObject>& Json) const;
    FInfrastructureItem ParseInfrastructureItem(const TSharedPtr<FJsonObject>& Json) const;
    FMetroFloodPoint ParseMetroFloodPoint(const TSharedPtr<FJsonObject>& Json) const;
    FEarthquakeZone ParseEarthquakeZone(const TSharedPtr<FJsonObject>& Json) const;
    FBuildingDamage ParseBuildingDamage(const TSharedPtr<FJsonObject>& Json) const;
    FGeoPoint ParseGeoPoint(const TSharedPtr<FJsonObject>& Json) const;
    TArray<FGeoPoint> ParseGeoPointArray(const TArray<TSharedPtr<FJsonValue>>& Arr) const;
};
